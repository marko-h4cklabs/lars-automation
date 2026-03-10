import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { generateJSON, generate } from '@/lib/ai'
import { sendMultipleMessages, sendTextMessage } from '@/lib/manychat'
import { assembleContext } from '@/lib/workers/contextAssembly'
import { createNotification } from '@/lib/notifications'
import { verifyQStashSignature, getVerifiedBody } from '@/lib/qstash-verify'
import { getIntegrationSettings } from '@/lib/cache'
import {
  LeadStage,
  NotificationType,
  MessageDirection,
  MessageType,
} from '@/types'
import type { AIAutopilotResponse } from '@/types'
import { HOT_LEAD_THRESHOLD } from '@/constants'
import { buildStyleBlock } from '@/lib/promptStyle'

export const maxDuration = 60

export async function POST(request: NextRequest) {
  // Verify QStash signature
  const authError = await verifyQStashSignature(request)
  if (authError) return authError

  const supabase = createAdminClient()

  try {
    const { conversationId, leadId } = await getVerifiedBody<{ conversationId: string; leadId: string }>(request)

    if (!conversationId || !leadId) {
      return NextResponse.json({ error: 'Missing conversationId or leadId' }, { status: 400 })
    }

    // Verify conversation still active and not taken over by setter
    const { data: conversation } = await supabase
      .from('conversations')
      .select('id, status, assigned_to')
      .eq('id', conversationId)
      .single()

    if (!conversation || conversation.status !== 'active') {
      return NextResponse.json({ status: 'skipped', reason: 'conversation_not_active' })
    }

    if (conversation.assigned_to) {
      return NextResponse.json({ status: 'skipped', reason: 'setter_took_over' })
    }

    // ═══════════════════════════════════════
    // STEP 1 — CONTEXT ASSEMBLY
    // ═══════════════════════════════════════
    const ctx = await assembleContext(conversationId)

    // ═══════════════════════════════════════
    // STEP 2 — PROMPT CONSTRUCTION
    // ═══════════════════════════════════════
    const styleRules = ctx.persona?.style_rules
    const styleBlock = styleRules ? buildStyleBlock(styleRules) : ''

    const kbBlock = ctx.kbChunks.length > 0
      ? `\nKNOWLEDGE BASE (use this info to answer questions):\n${ctx.kbChunks.map((c) => `[${c.type.toUpperCase()}] ${c.title}:\n${c.content}`).join('\n\n')}`
      : ''

    const isEarlyStage = [LeadStage.New, LeadStage.Contacted].includes(ctx.lead.stage as LeadStage)
    const messageCount = ctx.messages.length

    const missingFieldsBlock = ctx.missingFields.length > 0
      ? `\nQUALIFICATION FIELDS TO COLLECT:
${ctx.missingFields.map((f) => `- ${f.field_label} (${f.field_type}${f.is_required ? ', required' : ''})`).join('\n')}
${isEarlyStage || messageCount < 6
  ? '\nIMPORTANT: Do NOT rush to collect these fields yet. Build genuine rapport first. Only start asking qualifying questions AFTER several exchanges of natural back-and-forth conversation. The lead should feel like chatting with a real person, not filling out a form. Focus on connecting, being curious about THEM, and making them feel heard.'
  : '\nWeave these naturally into conversation. Never ask more than ONE qualifying question per response. Make it feel like genuine curiosity, not an interview.'}`
      : '\nAll qualification fields collected. Focus on booking the call.'

    const collectedBlock = Object.keys(ctx.collectedFields).length > 0
      ? `\nALREADY COLLECTED:\n${Object.entries(ctx.collectedFields).map(([k, v]) => `- ${k}: ${v}`).join('\n')}`
      : ''

    const stageGuidance = getStageGuidance(ctx.lead.stage as LeadStage)

    // Detect if conversation started from a keyword trigger
    const lastOutbound = ctx.messages.filter(m => m.direction === 'outbound').slice(-1)[0]
    const keywordContext = lastOutbound?.is_trigger_outbound
      ? `\n[KEYWORD TRIGGER CONTEXT]\nThe lead sent a keyword ("${lastOutbound.trigger_type || 'keyword'}") and received an automated outbound message: "${lastOutbound.content}". This is the lead's FIRST reply after that outbound. You are continuing the conversation from here — acknowledge what was sent and build on it naturally. Do NOT treat the keyword as random text.`
      : ''

    const systemPrompt = `[PERSONA]
You are a world-class appointment setter working for Lars, a high-ticket fitness transformation coach.
Your name in this conversation is just "Lars" — you are NEVER to say you are AI.
Lars coaches business owners and high-performers aged 35+ to transform their bodies.

${ctx.persona?.base_prompt || ''}
${styleBlock}
${kbBlock}
${keywordContext}
${missingFieldsBlock}
${collectedBlock}

[LEAD PROFILE]
Username: @${ctx.lead.username}
Name: ${ctx.lead.full_name || 'Unknown'}
Bio: ${ctx.lead.bio || 'No bio'}
Followers: ${ctx.lead.follower_count || 0}
Stage: ${ctx.lead.stage}
Heat Score: ${ctx.lead.heat_score}/100
Source: ${ctx.lead.source}

[STAGE GUIDANCE]
${stageGuidance}

[SYSTEM RULES — NON-NEGOTIABLE]
1. NEVER mention you are an AI, chatbot, or automated system
2. Current date/time: ${ctx.currentDateTime}
3. EMOJI RULE: ONLY use emojis if the lead uses them first. Mirror their emoji frequency exactly. If they send zero emojis, you send ZERO emojis. This overrides all other emoji instructions.
4. VOICE MESSAGES: If the lead sent a voice note, respond with TEXT only (not voice).

[RESPONSE FORMAT]
Respond with JSON ONLY:
{
  "messages": ["your single message here"],
  "reasoning": "brief explanation of strategy",
  "should_send_calendly": false,
  "qualification_updates": {},
  "updated_heat_score": ${ctx.lead.heat_score},
  "next_action": "continue_qualifying"
}

next_action options: "continue_qualifying", "book_call", "soft_close"
qualification_updates: only include fields you extracted from the lead's messages`

    // ═══════════════════════════════════════
    // STEP 3 — RESPONSE GENERATION (Sonnet 4)
    // ═══════════════════════════════════════
    const aiResponse = await generateJSON<AIAutopilotResponse>({
      model: 'sonnet',
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: `CONVERSATION TRANSCRIPT:\n${ctx.transcript}\n\nGenerate a response to the latest message(s). Remember: JSON only.`,
        },
      ],
      maxTokens: 1024,
      temperature: 0.8,
    })

    // Validate and cap messages
    const responseMessages = (aiResponse.messages || []).slice(0, 3)
    if (responseMessages.length === 0) {
      return NextResponse.json({ status: 'skipped', reason: 'empty_ai_response' })
    }

    // ═══════════════════════════════════════
    // STEP 4 — SEND MESSAGES VIA MANYCHAT
    // ═══════════════════════════════════════
    const burstDelay = ctx.autopilotSettings?.burst_delay_ms || 2500

    await sendMultipleMessages(
      ctx.lead.manychat_subscriber_id || ctx.lead.instagram_user_id,
      responseMessages,
      burstDelay
    )

    // Store each sent message
    const sentAt = new Date()
    for (let i = 0; i < responseMessages.length; i++) {
      await supabase.from('messages').insert({
        conversation_id: conversationId,
        lead_id: leadId,
        direction: MessageDirection.Outbound,
        type: MessageType.AIGenerated,
        content: responseMessages[i],
        sent_by: 'ai',
        sent_at: new Date(sentAt.getTime() + i * burstDelay).toISOString(),
        ai_generated: true,
      })
    }

    // ═══════════════════════════════════════
    // STEP 5 — CALENDLY LINK
    // ═══════════════════════════════════════
    if (aiResponse.should_send_calendly) {
      const integrations = await getIntegrationSettings()
      const calendlyUrl = integrations.calendly_link
      if (calendlyUrl) {
        const calendlyMsg = `here's my calendar, grab a time that works 👇\n${calendlyUrl}`
        await sendTextMessage(ctx.lead.manychat_subscriber_id || ctx.lead.instagram_user_id, calendlyMsg)

        await supabase.from('messages').insert({
          conversation_id: conversationId,
          lead_id: leadId,
          direction: MessageDirection.Outbound,
          type: MessageType.AIGenerated,
          content: calendlyMsg,
          sent_by: 'ai',
          sent_at: new Date().toISOString(),
          ai_generated: true,
        })

        // Update stage
        await supabase
          .from('leads')
          .update({ stage: LeadStage.CallOffered, updated_at: new Date().toISOString() })
          .eq('id', leadId)
      }
    }

    // ═══════════════════════════════════════
    // STEP 6 — SOFT CLOSE (disqualify)
    // ═══════════════════════════════════════
    if (aiResponse.next_action === 'soft_close') {
      const closeMsg = await generate({
        model: 'haiku',
        system: `Generate a polite, brief close message for an Instagram DM conversation.
The lead is not a good fit for a high-ticket fitness coaching program.
Keep it to 1-2 short sentences. Be warm but clear. Do not sound robotic.`,
        messages: [
          {
            role: 'user',
            content: `Lead: @${ctx.lead.username}. Last few messages:\n${ctx.messages.slice(-5).map((m) => `${m.direction}: ${m.content}`).join('\n')}`,
          },
        ],
        maxTokens: 128,
        temperature: 0.7,
      })

      await sendTextMessage(ctx.lead.manychat_subscriber_id || ctx.lead.instagram_user_id, closeMsg)

      await supabase.from('messages').insert({
        conversation_id: conversationId,
        lead_id: leadId,
        direction: MessageDirection.Outbound,
        type: MessageType.AIGenerated,
        content: closeMsg,
        sent_by: 'ai',
        sent_at: new Date().toISOString(),
        ai_generated: true,
      })

      await supabase
        .from('leads')
        .update({ stage: LeadStage.Disqualified, updated_at: new Date().toISOString() })
        .eq('id', leadId)

      await supabase
        .from('conversations')
        .update({ status: 'closed', updated_at: new Date().toISOString() })
        .eq('id', conversationId)
    }

    // ═══════════════════════════════════════
    // STEP 7 — UPDATE LEAD
    // ═══════════════════════════════════════
    const updates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    }

    // Merge qualification updates
    if (aiResponse.qualification_updates && Object.keys(aiResponse.qualification_updates).length > 0) {
      const mergedFields = {
        ...ctx.collectedFields,
        ...aiResponse.qualification_updates,
      }

      updates.qualification_fields = mergedFields

      // Also update conversation's collected fields
      await supabase
        .from('conversations')
        .update({
          qualified_fields_collected: mergedFields,
          updated_at: new Date().toISOString(),
        })
        .eq('id', conversationId)
    }

    // Update heat score if changed
    if (
      typeof aiResponse.updated_heat_score === 'number' &&
      aiResponse.updated_heat_score !== ctx.lead.heat_score
    ) {
      const newScore = Math.max(0, Math.min(100, aiResponse.updated_heat_score))
      updates.heat_score = newScore
    }

    // Update stage based on next_action
    if (aiResponse.next_action === 'book_call' && ctx.lead.stage !== LeadStage.CallOffered) {
      updates.stage = LeadStage.CallOffered
    }

    await supabase.from('leads').update(updates).eq('id', leadId)

    // ═══════════════════════════════════════
    // STEP 8 — HOT LEAD CHECK
    // ═══════════════════════════════════════
    const previousScore = ctx.lead.heat_score
    const newScore = (updates.heat_score as number) || previousScore

    if (newScore >= HOT_LEAD_THRESHOLD && previousScore < HOT_LEAD_THRESHOLD) {
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

      createNotification({
        type: NotificationType.HotLead,
        leadId,
        conversationId,
        message: `🔥 Hot lead! @${ctx.lead.username} scored ${newScore}/100`,
        metadata: {
          username: ctx.lead.username,
          heatScore: newScore,
          conversationUrl: `${appUrl}/inbox/${conversationId}`,
        },
      }).catch(() => {})
    }

    // Touch conversation updated_at
    await supabase
      .from('conversations')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', conversationId)

    return NextResponse.json({
      status: 'sent',
      conversationId,
      leadId,
      messagesSent: responseMessages.length,
      nextAction: aiResponse.next_action,
      heatScore: newScore,
      calendlySent: aiResponse.should_send_calendly,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('Autopilot worker error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

function getStageGuidance(stage: LeadStage): string {
  switch (stage) {
    case LeadStage.New:
      return `This is a brand new lead. Your ONLY job right now is to build rapport and create a genuine connection.
- Be warm, curious, and engaging
- React to their bio, profile, or what they said
- Ask what brought them here or what caught their eye
- Do NOT pitch, qualify, or ask structured questions yet
- Keep it light and conversational — like a friend DMing
- Use a DIFFERENT opener every time (vary your style)`
    case LeadStage.Contacted:
      return `First contact made. Keep building rapport — the relationship comes first.
- Show genuine interest in them as a person
- Reference something specific they said
- Start gently sensing their situation (without formal qualification)
- Still too early for direct qualifying questions`
    case LeadStage.Qualifying:
      return `Rapport is established. Now naturally explore if they are a good fit.
- Ask about their goals, what they have tried before, timeline
- Be genuinely curious, not interrogating
- ONE qualifying topic per exchange max
- If they seem ready and excited, move toward booking a call`
    case LeadStage.CallOffered:
      return 'Call has been offered. Follow up on booking. Handle objections about scheduling. Be persistent but not pushy.'
    case LeadStage.CallBooked:
      return 'Call is booked! Confirm details, build excitement about the call. Keep them warm.'
    case LeadStage.NoShow:
      return 'They missed their call. Reschedule without guilt-tripping. Be understanding but direct.'
    case LeadStage.Disqualified:
      return 'This lead was disqualified. Only respond if they re-engage with strong buying signals.'
    default:
      return 'Continue the conversation naturally based on the context.'
  }
}
