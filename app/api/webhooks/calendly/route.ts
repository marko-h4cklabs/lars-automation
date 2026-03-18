import { NextRequest, NextResponse } from 'next/server'
import { validateCalendlySignature, logWebhookEvent } from '@/lib/webhooks/security'
import { createAdminClient } from '@/lib/supabase'
import { createNotification } from '@/lib/notifications'
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
    const eventUri = payload?.scheduled_event?.uri as string | undefined

    // Try to match lead by email or name in tracking fields
    // Calendly doesn't send Instagram username, so we match via
    // qualification_fields or custom UTM params
    const supabase = createAdminClient()

    // Look for UTM-based matching first (instagram username passed as utm_source)
    const utmSource = payload?.tracking?.utm_source as string | undefined
    let leadId: string | null = null
    let username: string | null = null

    if (utmSource) {
      const { data: lead } = await supabase
        .from('leads')
        .select('id, username')
        .eq('username', utmSource)
        .single()
      leadId = lead?.id || null
      username = lead?.username || null
    }

    // Fallback: match by name
    if (!leadId && name) {
      const { data: lead } = await supabase
        .from('leads')
        .select('id, username')
        .ilike('full_name', `%${name}%`)
        .limit(1)
        .single()
      leadId = lead?.id || null
      username = lead?.username || null
    }

    if (leadId) {
      // Update lead stage to call_booked
      await supabase
        .from('leads')
        .update({
          stage: LeadStage.CallBooked,
          calendly_booked_at: scheduledAt || new Date().toISOString(),
          calendly_event_uri: eventUri || null,
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

      const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

      // Create CALL_BOOKED notification via centralized system (handles in-app + Slack)
      createNotification({
        type: NotificationType.CallBooked,
        leadId,
        conversationId: conversation?.id || null,
        message: `📅 Call booked! @${username || name || 'A lead'} scheduled${scheduledAt ? ` for ${new Date(scheduledAt).toLocaleDateString()}` : ''}`,
        metadata: {
          username: username || name || undefined,
          scheduledAt,
          leadUrl: `${appUrl}/crm?lead=${leadId}`,
          conversationUrl: conversation ? `${appUrl}/inbox/${conversation.id}` : undefined,
        },
      }).catch(() => {})
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
