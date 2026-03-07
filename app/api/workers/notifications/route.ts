import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { createNotification } from '@/lib/notifications'
import { verifyQStashSignature, getVerifiedBody } from '@/lib/qstash-verify'
import { NotificationType } from '@/types'

export const maxDuration = 30

/**
 * Notification worker — called internally by other workers/webhooks.
 *
 * Events handled:
 * - hot_lead_detected  (from triage worker)
 * - call_booked        (from Calendly webhook)
 * - setter_offline     (from user status update)
 * - ai_takeover        (from conversation transfer)
 * - refresh_views      (materialized view refresh — called by QStash cron)
 *
 * POST body:
 * {
 *   event: 'hot_lead_detected' | 'call_booked' | 'setter_offline' | 'ai_takeover' | 'refresh_views',
 *   leadId?: string,
 *   conversationId?: string,
 *   userId?: string,     // target user for directed notifications (null = broadcast)
 *   username?: string,   // Instagram username for display
 *   heatScore?: number,
 *   scheduledAt?: string,
 *   message?: string,    // override default message
 * }
 */
export async function POST(request: NextRequest) {
  // Verify QStash signature
  const authError = await verifyQStashSignature(request)
  if (authError) return authError

  try {
    const body = await getVerifiedBody<Record<string, unknown>>(request)
    const {
      event,
      leadId,
      conversationId,
      userId,
      username,
      heatScore,
      scheduledAt,
      message: customMessage,
    } = body as {
      event: string
      leadId?: string
      conversationId?: string
      userId?: string
      username?: string
      heatScore?: number
      scheduledAt?: string
      message?: string
    }

    if (!event) {
      return NextResponse.json({ error: 'Missing event' }, { status: 400 })
    }

    // Handle materialized view refresh (no notification needed)
    if (event === 'refresh_views') {
      const supabase = createAdminClient()
      await supabase.rpc('refresh_daily_metrics')
      await supabase.rpc('refresh_lead_stats')
      return NextResponse.json({ status: 'refreshed', views: ['mv_daily_metrics', 'mv_lead_stats'] })
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

    let type: NotificationType
    let message: string

    switch (event) {
      case 'hot_lead_detected': {
        type = NotificationType.HotLead
        message = customMessage || `🔥 Hot lead! @${username || 'Unknown'} scored ${heatScore || 0}/100`
        break
      }

      case 'call_booked': {
        type = NotificationType.CallBooked
        const dateStr = scheduledAt
          ? ` for ${new Date(scheduledAt).toLocaleDateString()}`
          : ''
        message = customMessage || `📅 Call booked! @${username || 'A lead'} scheduled${dateStr}`
        break
      }

      case 'setter_offline': {
        type = NotificationType.SetterOffline
        message = customMessage || `🌙 A setter has gone offline`
        break
      }

      case 'ai_takeover': {
        type = NotificationType.AITakeover
        message = customMessage || `🤖 @${username || 'Lead'} transferred to AI autopilot`
        break
      }

      default:
        return NextResponse.json({ error: `Unknown event: ${event}` }, { status: 400 })
    }

    const conversationUrl = conversationId ? `${appUrl}/inbox/${conversationId}` : undefined
    const leadUrl = leadId ? `${appUrl}/crm?lead=${leadId}` : undefined

    const notificationId = await createNotification({
      type,
      leadId,
      conversationId,
      userId: userId || null,
      message,
      metadata: {
        username,
        heatScore,
        scheduledAt,
        conversationUrl,
        leadUrl,
      },
    })

    return NextResponse.json({
      status: 'processed',
      event,
      notificationId,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('Notification worker error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
