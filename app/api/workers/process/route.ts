import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import {
  redis as getRedis,
  qstash as getQStash,
  getBundleMessages,
  addToBundle,
  clearBundle,
} from '@/lib/queue'
import type { QueuePayload } from '@/lib/queue'
import { transcribeVoice } from '@/lib/voice'
import { triageLead } from '@/lib/workers/triage'
import { calculateAssignment } from '@/lib/workers/distribution'
import { createNotification } from '@/lib/notifications'
import { verifyQStashSignature, getVerifiedBody } from '@/lib/qstash-verify'
import { getDisplayName, getFirstName } from '@/lib/nameValidator'
import { sendTextMessage } from '@/lib/manychat'
import {
  LeadStage,
  LeadSource,
  NotificationType,
  MessageDirection,
  MessageType,
  ConversationStatus,
  FollowUpJobStatus,
} from '@/types'
import type {
  Lead,
  Conversation,
  Message,
  DistributionSettings,
  User,
  AutopilotSettings,
  KeywordTrigger,
} from '@/types'
import {
  HOT_LEAD_THRESHOLD,
  MESSAGE_BUNDLE_WINDOW_SECONDS,
  MESSAGE_BUNDLE_EXTEND_SECONDS,
  SUMMARY_UPDATE_INTERVAL,
} from '@/constants'

export const maxDuration = 60 // Allow up to 60s for this worker

export async function POST(request: NextRequest) {
  // Verify QStash signature
  const authError = await verifyQStashSignature(request)
  if (authError) return authError

  const supabase = createAdminClient()

  let payload: QueuePayload
  try {
    payload = await getVerifiedBody<QueuePayload>(request)
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { instagramUserId, username } = payload

  try {
    // Check if this is an internal bundle-check call
    const isBundleCheck = (payload as QueuePayload & { _bundleCheck?: boolean })._bundleCheck

    // ═══════════════════════════════════════
    // STEP 1 — DEDUP CHECK (skip for bundle-check calls)
    // ═══════════════════════════════════════
    if (!isBundleCheck) {
      const dedupKey = `dedup:${instagramUserId}:${payload.timestamp}`
      const alreadyProcessed = await getRedis().get(dedupKey)
      if (alreadyProcessed) {
        return NextResponse.json({ status: 'duplicate', skipped: true })
      }
      // Mark as processing (TTL 1 hour)
      await getRedis().set(dedupKey, '1', { ex: 3600 })
    }

    // ═══════════════════════════════════════
    // STEP 2 — SMART DELAY / BUNDLE CHECK
    // ═══════════════════════════════════════
    if (!isBundleCheck) {
      const existingBundle = await getBundleMessages(instagramUserId)

      if (existingBundle.length > 0) {
        // Add to existing bundle and extend window
        await addToBundle(instagramUserId, payload, MESSAGE_BUNDLE_EXTEND_SECONDS)

        // Reschedule processing after bundle window
        const appUrl = process.env.NEXT_PUBLIC_APP_URL!
        await getQStash().publishJSON({
          url: `${appUrl}/api/workers/process`,
          body: { ...payload, _bundleCheck: true },
          delay: MESSAGE_BUNDLE_EXTEND_SECONDS,
          retries: 3,
        })

        return NextResponse.json({ status: 'bundled', count: existingBundle.length + 1 })
      }

      // First message — start a bundle window
      await addToBundle(instagramUserId, payload, MESSAGE_BUNDLE_WINDOW_SECONDS)

      // Schedule a delayed self-call to process after bundle window
      const appUrl = process.env.NEXT_PUBLIC_APP_URL!
      await getQStash().publishJSON({
        url: `${appUrl}/api/workers/process`,
        body: { ...payload, _bundleCheck: true },
        delay: MESSAGE_BUNDLE_WINDOW_SECONDS,
        retries: 3,
      })
      return NextResponse.json({ status: 'bundle_started', waitingMs: MESSAGE_BUNDLE_WINDOW_SECONDS * 1000 })
    }

    // Bundle window expired — gather all bundled messages
    const bundledMessages = await getBundleMessages(instagramUserId)
    await clearBundle(instagramUserId)

    // Use all bundled messages (or just this one if bundle is empty)
    const allPayloads = bundledMessages.length > 0 ? bundledMessages : [payload]

    // ═══════════════════════════════════════
    // STEP 3 — LEAD UPSERT
    // ═══════════════════════════════════════
    const { data: existingLead } = await supabase
      .from('leads')
      .select('*')
      .eq('instagram_user_id', instagramUserId)
      .single()

    let lead: Lead

    if (existingLead) {
      const { data: updated } = await supabase
        .from('leads')
        .update({
          username,
          full_name: payload.fullName || existingLead.full_name,
          bio: payload.bio || existingLead.bio,
          profile_pic_url: payload.profilePicUrl || existingLead.profile_pic_url,
          follower_count: payload.followerCount || existingLead.follower_count,
          manychat_subscriber_id: payload.subscriberId || existingLead.manychat_subscriber_id,
          last_message_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingLead.id)
        .select()
        .single()

      lead = (updated || existingLead) as Lead
    } else {
      const { data: newLead } = await supabase
        .from('leads')
        .insert({
          instagram_user_id: instagramUserId,
          manychat_subscriber_id: payload.subscriberId || null,
          username,
          full_name: payload.fullName || null,
          bio: payload.bio || null,
          profile_pic_url: payload.profilePicUrl || null,
          follower_count: payload.followerCount || 0,
          source: payload.source as LeadSource,
          stage: LeadStage.New,
          heat_score: 0,
          assignment_type: 'ai',
          qualification_fields: {},
          last_message_at: new Date().toISOString(),
        })
        .select()
        .single()

      lead = newLead as Lead
    }

    // ═══════════════════════════════════════
    // STEP 4 — CONVERSATION UPSERT
    // ═══════════════════════════════════════
    const { data: existingConvo } = await supabase
      .from('conversations')
      .select('*')
      .eq('lead_id', lead.id)
      .eq('status', ConversationStatus.Active)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    let conversation: Conversation
    const isNewConversation = !existingConvo

    if (existingConvo) {
      conversation = existingConvo as Conversation
      // Touch updated_at
      await supabase
        .from('conversations')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', conversation.id)
    } else {
      const { data: newConvo } = await supabase
        .from('conversations')
        .insert({
          lead_id: lead.id,
          status: ConversationStatus.Active,
          qualification_score: 0,
          qualified_fields_collected: {},
        })
        .select()
        .single()

      conversation = newConvo as Conversation

      // Mark as potentially having prior ManyChat history
      try {
        await supabase
          .from('conversations')
          .update({ has_prior_history: true })
          .eq('id', conversation.id)

        // Insert system message about prior history
        await supabase.from('messages').insert({
          conversation_id: conversation.id,
          lead_id: lead.id,
          direction: 'outbound',
          type: 'text',
          content: 'This contact may have prior conversation history in ManyChat before migration. Check ManyChat for full context.',
          sent_by: 'system',
          sent_at: new Date().toISOString(),
          ai_generated: false,
        })
      } catch {
        // Non-critical — continue processing
      }
    }

    // ═══════════════════════════════════════
    // STEP 5 — MESSAGE STORAGE
    // ═══════════════════════════════════════
    const messagesToInsert = allPayloads.map((p) => ({
      conversation_id: conversation.id,
      lead_id: lead.id,
      direction: MessageDirection.Inbound,
      type: p.messageType === 'voice'
        ? MessageType.Voice
        : p.messageType === 'image'
          ? MessageType.Image
          : MessageType.Text,
      content: p.messageText,
      voice_url: p.voiceUrl || null,
      sent_by: null, // from lead
      sent_at: p.timestamp || new Date().toISOString(),
      ai_generated: false,
    }))

    const { data: insertedMessages } = await supabase
      .from('messages')
      .insert(messagesToInsert)
      .select()

    const storedMessages = (insertedMessages || []) as Message[]

    // ═══════════════════════════════════════
    // STEP 6 — SMART KEYWORD CHECK
    // ═══════════════════════════════════════
    {
      const combinedText = allPayloads.map((p) => p.messageText).join(' ').toLowerCase()

      // Get current message count for the conversation
      const { count: messageCount } = await supabase
        .from('messages')
        .select('*', { count: 'exact', head: true })
        .eq('conversation_id', conversation.id)

      const currentMsgCount = messageCount || 0

      const { data: triggers } = await supabase
        .from('keyword_triggers')
        .select('*')
        .eq('is_active', true)

      if (triggers && triggers.length > 0) {
        const matchedTrigger = (triggers as KeywordTrigger[]).find((t) => {
          const kw = t.keyword.toLowerCase()
          switch (t.match_type) {
            case 'exact':
              return combinedText === kw
            case 'contains':
              return combinedText.includes(kw)
            case 'starts_with':
              return combinedText.startsWith(kw)
            case 'regex':
              try {
                return new RegExp(kw, 'i').test(combinedText)
              } catch {
                return false
              }
            default:
              return false
          }
        })

        if (matchedTrigger) {
          // Only fire keyword trigger on first messages (message_count <= 1)
          if (currentMsgCount <= 1 || isNewConversation) {
            // Resolve template variables
            const resolvedContent = matchedTrigger.response_template
              .replace(/\{username\}/g, lead.username || '')
              .replace(/\{lead_username\}/g, lead.username || '')
              .replace(/\{lead_name\}/g, getDisplayName(lead.full_name || lead.username, 'man'))
              .replace(/\{lead_first_name\}/g, getFirstName(lead.full_name || lead.username, 'man'))
              .replace(/\{first_name\}/g, getFirstName(lead.full_name || lead.username, 'man'))

            // Send keyword-triggered response via ManyChat
            const triggerSubId = payload.subscriberId || lead.manychat_subscriber_id
            if (triggerSubId) {
              try {
                await sendTextMessage(triggerSubId, resolvedContent)
                console.log(`[Process] Keyword trigger sent to ${triggerSubId}:`, resolvedContent.slice(0, 80))
              } catch (sendErr) {
                console.error(`[Process] Keyword trigger send failed for ${triggerSubId}:`, sendErr)
              }
            } else {
              console.warn(`[Process] No subscriber ID for keyword trigger, cannot send to ${lead.username}`)
            }

            await supabase.from('messages').insert({
              conversation_id: conversation.id,
              lead_id: lead.id,
              direction: MessageDirection.Outbound,
              type: MessageType.Template,
              content: resolvedContent,
              sent_by: 'system',
              sent_at: new Date().toISOString(),
              ai_generated: false,
              is_trigger_outbound: true,
              trigger_type: payload.source === 'follow' ? 'follow'
                : payload.source === 'comment' ? 'comment_keyword'
                : payload.source === 'story_reply' ? 'story_keyword'
                : 'dm_keyword',
            })
          } else {
            // Keyword detected mid-conversation — suppress trigger, mark messages
            for (const msg of storedMessages) {
              await supabase
                .from('messages')
                .update({ keyword_suppressed: true })
                .eq('id', msg.id)
            }
            // Continue to normal AI/setter flow (don't return early)
          }
        }
      }

      // Update conversation message_count
      await supabase
        .from('conversations')
        .update({ message_count: currentMsgCount + storedMessages.length })
        .eq('id', conversation.id)
    }

    // ═══════════════════════════════════════
    // STEP 7 — VOICE HANDLING
    // ═══════════════════════════════════════
    for (const msg of storedMessages) {
      if (msg.type === MessageType.Voice && msg.voice_url) {
        try {
          const transcription = await transcribeVoice(msg.voice_url)
          await supabase
            .from('messages')
            .update({ content: transcription })
            .eq('id', msg.id)
          // Update local reference
          msg.content = transcription
        } catch (err) {
          console.error('Voice transcription failed:', err)
        }
      }
    }

    // ═══════════════════════════════════════
    // STEP 8 — AI TRIAGE (Haiku 4)
    // ═══════════════════════════════════════
    const { data: recentMessages } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', conversation.id)
      .order('sent_at', { ascending: false })
      .limit(10)

    const combinedMessageText = allPayloads.map((p) => p.messageText).join('\n')

    const triageResult = await triageLead(
      combinedMessageText,
      lead.bio || '',
      ((recentMessages || []) as Message[]).reverse(),
      lead.follower_count || 0
    )

    // Update lead with triage results
    const stageUpdate = triageResult.suggested_stage as LeadStage
    const validStages = Object.values(LeadStage)
    const newStage = validStages.includes(stageUpdate) ? stageUpdate : lead.stage

    await supabase
      .from('leads')
      .update({
        heat_score: triageResult.heat_score,
        stage: newStage,
        updated_at: new Date().toISOString(),
      })
      .eq('id', lead.id)

    // Hot lead notification (centralized — handles in-app + Slack + preferences)
    if (triageResult.heat_score >= HOT_LEAD_THRESHOLD) {
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

      createNotification({
        type: NotificationType.HotLead,
        leadId: lead.id,
        conversationId: conversation.id,
        message: `🔥 Hot lead! @${username} scored ${triageResult.heat_score}/100`,
        metadata: {
          username,
          heatScore: triageResult.heat_score,
          conversationUrl: `${appUrl}/inbox/${conversation.id}`,
        },
      }).catch(() => {})
    }

    // ═══════════════════════════════════════
    // STEP 9 — ASSIGNMENT
    // ═══════════════════════════════════════
    let assignedTo = conversation.assigned_to
    let assignmentType = lead.assignment_type

    if (!assignedTo || isNewConversation) {
      const { data: distSettings } = await supabase
        .from('distribution_settings')
        .select('*')
        .limit(1)
        .single()

      const { data: onlineSetters } = await supabase
        .from('users')
        .select('*')
        .in('role', ['setter', 'admin'])
        .eq('status', 'online')
        .eq('receives_leads', true)

      if (distSettings) {
        const allocations = (distSettings as DistributionSettings).setter_allocations || []
        const result = calculateAssignment(
          allocations,
          (onlineSetters || []) as User[]
        )
        assignedTo = result.assignedTo
        assignmentType = result.assignmentType
      }

      // Update conversation assignment
      await supabase
        .from('conversations')
        .update({ assigned_to: assignedTo })
        .eq('id', conversation.id)

      // Update lead assignment
      await supabase
        .from('leads')
        .update({
          assigned_to: assignedTo,
          assignment_type: assignmentType,
        })
        .eq('id', lead.id)
    }

    // ═══════════════════════════════════════
    // STEP 10 — RESPONSE ROUTING
    // ═══════════════════════════════════════
    if (assignmentType === 'ai' || !assignedTo) {
      // AI Autopilot — schedule delayed response
      const { data: autopilotSettings } = await supabase
        .from('autopilot_settings')
        .select('*')
        .limit(1)
        .single()

      const settings = autopilotSettings as AutopilotSettings | null
      const minDelay = settings?.min_delay_seconds || 8
      const maxDelay = settings?.max_delay_seconds || 45
      const delay = Math.floor(Math.random() * (maxDelay - minDelay + 1)) + minDelay

      const appUrl = process.env.NEXT_PUBLIC_APP_URL!
      await getQStash().publishJSON({
        url: `${appUrl}/api/workers/autopilot`,
        body: {
          conversationId: conversation.id,
          leadId: lead.id,
        },
        delay,
        retries: 3,
      })
    } else {
      // Setter assigned — push notification via centralized system
      createNotification({
        type: NotificationType.HotLead,
        leadId: lead.id,
        conversationId: conversation.id,
        userId: assignedTo,
        message: `New message from @${username}`,
        metadata: { username },
      }).catch(() => {})
    }

    // ═══════════════════════════════════════
    // STEP 11 — SUMMARY UPDATE (async)
    // ═══════════════════════════════════════
    const totalInbound = storedMessages.length + (existingConvo ? 1 : 0)
    const { count: inboundCount } = await supabase
      .from('messages')
      .select('*', { count: 'exact', head: true })
      .eq('conversation_id', conversation.id)
      .eq('direction', MessageDirection.Inbound)

    if ((inboundCount || 0) % SUMMARY_UPDATE_INTERVAL === 0 && (inboundCount || 0) > 0) {
      // Fire and forget
      const appUrl = process.env.NEXT_PUBLIC_APP_URL!
      getQStash().publishJSON({
        url: `${appUrl}/api/workers/summarize`,
        body: { conversationId: conversation.id },
        retries: 2,
      }).catch(() => {})
    }

    // ═══════════════════════════════════════
    // STEP 12 — FOLLOW-UP MANAGEMENT
    // ═══════════════════════════════════════
    // Cancel pending follow-ups since lead replied
    await supabase
      .from('follow_up_jobs')
      .update({
        status: FollowUpJobStatus.Cancelled,
      })
      .eq('conversation_id', conversation.id)
      .eq('status', FollowUpJobStatus.Active)

    return NextResponse.json({
      status: 'processed',
      leadId: lead.id,
      conversationId: conversation.id,
      heatScore: triageResult.heat_score,
      assignedTo: assignedTo || 'ai',
      messagesStored: totalInbound,
    })
  } catch (err) {
    console.error('Worker process error:', err)
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
