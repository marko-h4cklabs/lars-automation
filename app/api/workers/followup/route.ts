import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { generate } from '@/lib/ai'
import { sendTextMessage } from '@/lib/manychat'
import { assembleContext } from '@/lib/workers/contextAssembly'
import { advanceJob } from '@/lib/workers/followup'
import {
  FollowUpJobStatus,
  LeadStage,
  MessageDirection,
  MessageType,
} from '@/types'
import type { FollowUpStep } from '@/types'

export const maxDuration = 60

/**
 * POST /api/workers/followup — Follow-up scheduler worker.
 * Called by QStash every 5 minutes (cron).
 * Processes all due follow-up jobs.
 */
export async function POST() {
  const supabase = createAdminClient()

  try {
    // ═══════════════════════════════════════
    // STEP 1 — FETCH DUE JOBS
    // ═══════════════════════════════════════
    const now = new Date().toISOString()
    const { data: dueJobs } = await supabase
      .from('follow_up_jobs')
      .select('*, follow_up_sequences(*)')
      .eq('status', FollowUpJobStatus.Active)
      .lte('next_fire_at', now)
      .limit(20)

    if (!dueJobs || dueJobs.length === 0) {
      return NextResponse.json({ status: 'idle', jobsProcessed: 0 })
    }

    let processed = 0
    let skipped = 0
    let sent = 0

    for (const job of dueJobs) {
      try {
        const sequence = job.follow_up_sequences
        if (!sequence || !sequence.steps) {
          // Invalid sequence — cancel job
          await supabase
            .from('follow_up_jobs')
            .update({ status: FollowUpJobStatus.Cancelled })
            .eq('id', job.id)
          skipped++
          continue
        }

        const steps = sequence.steps as FollowUpStep[]
        const currentStep = steps[job.current_step]
        if (!currentStep) {
          // Step index out of range — complete
          await supabase
            .from('follow_up_jobs')
            .update({ status: FollowUpJobStatus.Completed })
            .eq('id', job.id)
          skipped++
          continue
        }

        // ═══════════════════════════════════════
        // STEP 2 — CHECK CANCELLATION CONDITIONS
        // ═══════════════════════════════════════

        // 2a. Check if conversation had inbound message after job was created
        const { count: replyCount } = await supabase
          .from('messages')
          .select('*', { count: 'exact', head: true })
          .eq('conversation_id', job.conversation_id)
          .eq('direction', 'inbound')
          .gt('sent_at', job.created_at)

        if (replyCount && replyCount > 0) {
          await supabase
            .from('follow_up_jobs')
            .update({ status: FollowUpJobStatus.Cancelled })
            .eq('id', job.id)
          skipped++
          continue
        }

        // 2b. Check if lead stage changed to terminal state
        const { data: lead } = await supabase
          .from('leads')
          .select('stage, instagram_user_id, username, full_name')
          .eq('id', job.lead_id)
          .single()

        if (!lead) {
          await supabase
            .from('follow_up_jobs')
            .update({ status: FollowUpJobStatus.Cancelled })
            .eq('id', job.id)
          skipped++
          continue
        }

        const terminalStages: string[] = [
          LeadStage.CallBooked,
          LeadStage.Showed,
          LeadStage.Won,
          LeadStage.Lost,
          LeadStage.Disqualified,
        ]

        if (terminalStages.includes(lead.stage)) {
          await supabase
            .from('follow_up_jobs')
            .update({ status: FollowUpJobStatus.Cancelled })
            .eq('id', job.id)
          skipped++
          continue
        }

        // ═══════════════════════════════════════
        // STEP 3 — GENERATE MESSAGE CONTENT
        // ═══════════════════════════════════════
        let messageContent: string

        if (currentStep.message_type === 'ai_personalized') {
          // Use Sonnet to generate personalized follow-up
          const ctx = await assembleContext(job.conversation_id)

          const followUpPrompt = `You are a world-class appointment setter working for Lars, a high-ticket fitness transformation coach.
You are sending a follow-up message because the lead hasn't replied.

${ctx.persona?.base_prompt || ''}

LEAD PROFILE:
Username: @${ctx.lead.username}
Name: ${ctx.lead.full_name || 'Unknown'}
Stage: ${ctx.lead.stage}
Heat Score: ${ctx.lead.heat_score}/100

CONVERSATION SO FAR:
${ctx.transcript}

FOLLOW-UP CONTEXT:
- This is follow-up step ${job.current_step + 1} of ${steps.length} in sequence "${sequence.name}"
- The step guidance says: "${currentStep.content}"
- Time since last message: the lead hasn't replied

RULES:
1. Write ONE short follow-up message (1-2 sentences max)
2. Don't be pushy or desperate
3. Sound natural, like a real person checking in
4. Reference something from the conversation if possible
5. Match the lead's communication style
6. NEVER mention you are AI or automated
7. NEVER say "just following up" or "just checking in" — be creative

Reply with ONLY the message text. No quotes, no explanation.`

          messageContent = await generate({
            model: 'sonnet',
            system: followUpPrompt,
            messages: [{ role: 'user', content: 'Generate the follow-up message.' }],
            maxTokens: 256,
            temperature: 0.85,
          })
        } else {
          // Text or template — use content as-is with variable substitution
          messageContent = currentStep.content

          // Variable replacement
          const vars: Record<string, string> = {
            lead_name: lead.full_name || lead.username || 'there',
            lead_username: lead.username || '',
          }
          for (const [key, val] of Object.entries(vars)) {
            messageContent = messageContent.replace(new RegExp(`\\{${key}\\}`, 'g'), val)
          }
        }

        // ═══════════════════════════════════════
        // STEP 4 — SEND VIA MANYCHAT
        // ═══════════════════════════════════════
        await sendTextMessage(lead.instagram_user_id, messageContent)

        // Store in messages table
        await supabase.from('messages').insert({
          conversation_id: job.conversation_id,
          lead_id: job.lead_id,
          direction: MessageDirection.Outbound,
          type: currentStep.message_type === 'ai_personalized' ? MessageType.AIGenerated : MessageType.Text,
          content: messageContent,
          sent_by: 'ai',
          sent_at: new Date().toISOString(),
          ai_generated: currentStep.message_type === 'ai_personalized',
        })

        // Touch conversation
        await supabase
          .from('conversations')
          .update({ updated_at: new Date().toISOString() })
          .eq('id', job.conversation_id)

        // ═══════════════════════════════════════
        // STEP 5 — ADVANCE OR COMPLETE
        // ═══════════════════════════════════════
        await advanceJob(job.id, steps)

        sent++
        processed++
      } catch (jobErr) {
        console.error(`Follow-up job ${job.id} failed:`, jobErr)
        processed++
      }
    }

    return NextResponse.json({
      status: 'processed',
      jobsProcessed: processed,
      sent,
      skipped,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('Follow-up worker error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
