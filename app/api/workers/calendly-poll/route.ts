import { NextRequest, NextResponse } from 'next/server'
import { verifyQStashSignature } from '@/lib/qstash-verify'
import { createAdminClient } from '@/lib/supabase'
import { createNotification } from '@/lib/notifications'
import { LeadSource, LeadStage, NotificationType } from '@/types'

export const maxDuration = 30

const CALENDLY_API = 'https://api.calendly.com'

interface CalendlyEvent {
  uri: string
  name: string
  start_time: string
  end_time: string
  status: string
  event_memberships: { user: string }[]
}

interface CalendlyInvitee {
  uri: string
  name: string
  email: string
  status: string
  tracking: {
    utm_source?: string
    utm_medium?: string
    utm_campaign?: string
  }
}

/**
 * POST /api/workers/calendly-poll
 *
 * QStash cron worker (every 15 min). Polls Calendly API for new bookings
 * and processes them — updates lead stage, fires Slack + in-app notification.
 * Free-plan alternative to Calendly webhook subscriptions.
 */
export async function POST(request: NextRequest) {
  const authError = await verifyQStashSignature(request)
  if (authError) return authError

  const accessToken = process.env.CALENDLY_ACCESS_TOKEN
  const userUri = process.env.CALENDLY_USER_URI

  if (!accessToken || !userUri) {
    return NextResponse.json({
      status: 'skipped',
      reason: 'CALENDLY_ACCESS_TOKEN or CALENDLY_USER_URI not configured',
    })
  }

  try {
    // Look back 24 hours for events (catches anything missed)
    const minTime = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    const params = new URLSearchParams({
      user: userUri,
      min_start_time: minTime,
      status: 'active',
      sort: 'start_time:asc',
      count: '20',
    })

    const eventsRes = await fetch(`${CALENDLY_API}/scheduled_events?${params}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })

    if (!eventsRes.ok) {
      const errText = await eventsRes.text()
      console.error('Calendly API error:', eventsRes.status, errText)
      return NextResponse.json({ status: 'error', code: eventsRes.status }, { status: 502 })
    }

    const { collection: events } = (await eventsRes.json()) as {
      collection: CalendlyEvent[]
    }

    if (!events || events.length === 0) {
      return NextResponse.json({ status: 'ok', processed: 0, message: 'No events found' })
    }

    const supabase = createAdminClient()

    // Get all event URIs we've already processed
    const eventUris = events.map((e) => e.uri)
    const { data: existingLeads } = await supabase
      .from('leads')
      .select('calendly_event_uri')
      .in('calendly_event_uri', eventUris)

    const processedUris = new Set(
      (existingLeads || []).map((l: { calendly_event_uri: string }) => l.calendly_event_uri)
    )

    let processed = 0
    let skipped = 0

    for (const event of events) {
      // Skip already-processed events
      if (processedUris.has(event.uri)) {
        skipped++
        continue
      }

      // Fetch invitees for this event
      const eventUuid = event.uri.split('/').pop()
      const inviteesRes = await fetch(
        `${CALENDLY_API}/scheduled_events/${eventUuid}/invitees`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      )

      if (!inviteesRes.ok) continue

      const { collection: invitees } = (await inviteesRes.json()) as {
        collection: CalendlyInvitee[]
      }

      for (const invitee of invitees || []) {
        const utmSource = invitee.tracking?.utm_source
        const name = invitee.name
        const scheduledAt = event.start_time

        // Match lead — same logic as webhook handler
        let leadId: string | null = null
        let username: string | null = null

        // 1. Match by utm_source (Instagram username)
        if (utmSource) {
          const { data: lead } = await supabase
            .from('leads')
            .select('id, username')
            .eq('username', utmSource)
            .single()
          leadId = lead?.id || null
          username = lead?.username || null
        }

        // 2. Fallback: match by name
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

        const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

        if (leadId) {
          // Update existing lead
          await supabase
            .from('leads')
            .update({
              stage: LeadStage.CallBooked,
              calendly_booked_at: scheduledAt || new Date().toISOString(),
              calendly_event_uri: event.uri,
              updated_at: new Date().toISOString(),
            })
            .eq('id', leadId)

          // Get conversation for notification link
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

          await createNotification({
            type: NotificationType.CallBooked,
            leadId,
            conversationId: conversation?.id || null,
            message: `📅 Call booked! @${username || name || 'A lead'} scheduled${scheduledAt ? ` for ${new Date(scheduledAt).toLocaleDateString()}` : ''}`,
            metadata: {
              username: username || name || undefined,
              scheduledAt,
              leadUrl: `${appUrl}/crm?lead=${leadId}`,
              conversationUrl: conversation
                ? `${appUrl}/inbox/${conversation.id}`
                : undefined,
            },
          }).catch((err) => console.error('Notification error (matched):', err))

          processed++
        } else {
          // No existing lead — create one from Calendly data
          const email = invitee.email
          const syntheticId = `calendly_${email || eventUuid}`

          const { data: newLead } = await supabase
            .from('leads')
            .insert({
              instagram_user_id: syntheticId,
              username: email || name || 'unknown',
              full_name: name || null,
              source: LeadSource.Calendly,
              stage: LeadStage.CallBooked,
              calendly_booked_at: scheduledAt || new Date().toISOString(),
              calendly_event_uri: event.uri,
            })
            .select('id')
            .single()

          if (newLead) {
            await createNotification({
              type: NotificationType.CallBooked,
              leadId: newLead.id,
              conversationId: null,
              message: `📅 Call booked! ${name || email || 'Someone'} scheduled via Calendly${scheduledAt ? ` for ${new Date(scheduledAt).toLocaleDateString()}` : ''}`,
              metadata: {
                username: name || email || undefined,
                scheduledAt,
                leadUrl: `${appUrl}/crm?lead=${newLead.id}`,
              },
            }).catch((err) => console.error('Notification error (new lead):', err))
          }

          processed++
        }
      }
    }

    return NextResponse.json({ status: 'ok', processed, skipped, total: events.length })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('Calendly poll error:', message)
    return NextResponse.json({ status: 'error', message }, { status: 500 })
  }
}
