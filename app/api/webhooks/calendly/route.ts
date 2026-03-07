import { NextRequest, NextResponse } from 'next/server'
import { validateCalendlySignature, logWebhookEvent } from '@/lib/webhooks/security'
import { createAdminClient } from '@/lib/supabase'
import { LeadStage, NotificationType } from '@/types'

export async function POST(request: NextRequest) {
  const bodyText = await request.text()

  // Verify Calendly webhook signature
  const valid = await validateCalendlySignature(request, bodyText)
  if (!valid) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  try {
    const body = JSON.parse(bodyText)
    const event = body.event as string
    const payload = body.payload

    // Only handle invitee.created events
    if (event !== 'invitee.created') {
      return NextResponse.json({ status: 'ignored', event })
    }

    const email = payload?.email as string | undefined
    const name = payload?.name as string | undefined
    const scheduledAt = payload?.scheduled_event?.start_time as string | undefined

    // Try to match lead by email or name in tracking fields
    // Calendly doesn't send Instagram username, so we match via
    // qualification_fields or custom UTM params
    const supabase = createAdminClient()

    // Look for UTM-based matching first (instagram username passed as utm_source)
    const utmSource = payload?.tracking?.utm_source as string | undefined
    let leadId: string | null = null

    if (utmSource) {
      const { data: lead } = await supabase
        .from('leads')
        .select('id')
        .eq('username', utmSource)
        .single()
      leadId = lead?.id || null
    }

    // Fallback: match by name
    if (!leadId && name) {
      const { data: lead } = await supabase
        .from('leads')
        .select('id')
        .ilike('full_name', `%${name}%`)
        .limit(1)
        .single()
      leadId = lead?.id || null
    }

    if (leadId) {
      // Update lead stage to call_booked
      await supabase
        .from('leads')
        .update({
          stage: LeadStage.CallBooked,
          calendly_booked_at: scheduledAt || new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', leadId)

      // Update conversation status
      const { data: conversation } = await supabase
        .from('conversations')
        .select('id')
        .eq('lead_id', leadId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      if (conversation) {
        await supabase
          .from('conversations')
          .update({ updated_at: new Date().toISOString() })
          .eq('id', conversation.id)
      }

      // Create CALL_BOOKED notification (broadcast to all users)
      await supabase.from('notifications').insert({
        user_id: null, // broadcast
        type: NotificationType.CallBooked,
        lead_id: leadId,
        conversation_id: conversation?.id || null,
        message: `Call booked! ${name || 'A lead'} scheduled${scheduledAt ? ` for ${new Date(scheduledAt).toLocaleDateString()}` : ''}`,
        read: false,
        telegram_sent: false,
      })

      // Send Telegram notification (fire-and-forget)
      sendTelegramNotification(name, scheduledAt).catch(() => {})
    }

    logWebhookEvent('webhook.calendly.invitee_created', 'lead', leadId || 'unknown', {
      email,
      name,
      scheduledAt,
      matched: !!leadId,
    })

    return NextResponse.json({ status: 'processed', matched: !!leadId })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

async function sendTelegramNotification(
  name: string | undefined,
  scheduledAt: string | undefined
) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN
  const chatId = process.env.TELEGRAM_CHAT_ID
  if (!botToken || !chatId) return

  const text = `🎯 CALL BOOKED!\n${name || 'Unknown lead'}${scheduledAt ? `\n📅 ${new Date(scheduledAt).toLocaleString()}` : ''}`

  await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' }),
  })
}
