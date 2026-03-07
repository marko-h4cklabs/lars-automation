import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { generate } from '@/lib/ai'
import { verifyQStashSignature, getVerifiedBody } from '@/lib/qstash-verify'
import type { Message } from '@/types'

export const maxDuration = 30

/**
 * Conversation summary worker.
 * Regenerates a concise summary of the conversation for the CRM sidebar.
 * Called every N inbound messages by the process worker.
 */
export async function POST(request: NextRequest) {
  // Verify QStash signature
  const authError = await verifyQStashSignature(request)
  if (authError) return authError

  const supabase = createAdminClient()

  try {
    const { conversationId } = await getVerifiedBody<{ conversationId: string }>(request)

    if (!conversationId) {
      return NextResponse.json({ error: 'Missing conversationId' }, { status: 400 })
    }

    // Fetch conversation + messages
    const { data: messages } = await supabase
      .from('messages')
      .select('direction, content, type, sent_at')
      .eq('conversation_id', conversationId)
      .order('sent_at', { ascending: true })
      .limit(50)

    if (!messages || messages.length === 0) {
      return NextResponse.json({ status: 'skipped', reason: 'no_messages' })
    }

    // Fetch lead info
    const { data: conversation } = await supabase
      .from('conversations')
      .select('lead_id')
      .eq('id', conversationId)
      .single()

    const { data: lead } = await supabase
      .from('leads')
      .select('username, full_name, stage, heat_score')
      .eq('id', conversation?.lead_id)
      .single()

    const transcript = (messages as Pick<Message, 'direction' | 'content' | 'type' | 'sent_at'>[])
      .map((m) => `[${m.direction}] ${m.content}`)
      .join('\n')

    const summary = await generate({
      model: 'haiku',
      system: `Summarize this Instagram DM conversation for a sales team CRM.
Keep it under 3 sentences. Focus on: what the lead wants, qualification status, and next steps.
Be direct and factual.`,
      messages: [
        {
          role: 'user',
          content: `Lead: @${lead?.username || 'unknown'} (${lead?.full_name || 'Unknown'})
Stage: ${lead?.stage || 'new'} | Score: ${lead?.heat_score || 0}/100

CONVERSATION:
${transcript}`,
        },
      ],
      maxTokens: 256,
      temperature: 0.3,
    })

    // Update conversation summary
    await supabase
      .from('conversations')
      .update({
        summary,
        summary_updated_at: new Date().toISOString(),
      })
      .eq('id', conversationId)

    return NextResponse.json({ status: 'summarized', conversationId })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('Summarize worker error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
