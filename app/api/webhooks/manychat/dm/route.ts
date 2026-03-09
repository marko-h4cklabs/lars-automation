import { NextRequest, NextResponse } from 'next/server'
import { normalizePayload } from '@/lib/webhooks/normalizePayload'
import { validateManyChatWebhook, logWebhookEvent } from '@/lib/webhooks/security'
import { pushMessage } from '@/lib/queue'
import { checkUserRateLimit, checkGlobalWebhookLimit, rateLimitHeaders } from '@/lib/rate-limit'
import { logError } from '@/lib/errors'
import { LeadSource } from '@/types'

export async function POST(request: NextRequest) {
  // Validate request
  const rejection = await validateManyChatWebhook(request)
  if (rejection) return rejection

  try {
    const raw = await request.json()
    console.log('[Webhook DM] raw payload keys:', Object.keys(raw), 'subscriber_id:', raw.subscriber_id, 'instagram_user_id:', raw.instagram_user_id)
    const payload = normalizePayload(raw, LeadSource.DM)

    // Rate limiting: global webhook limit
    const globalLimit = await checkGlobalWebhookLimit()
    if (!globalLimit.allowed) {
      return NextResponse.json(
        { error: 'Rate limited' },
        { status: 429, headers: rateLimitHeaders(globalLimit) }
      )
    }

    // Rate limiting: per-user limit (60 msgs/min)
    const userLimit = await checkUserRateLimit(payload.instagramUserId)
    if (!userLimit.allowed) {
      return NextResponse.json(
        { error: 'Too many messages from this user' },
        { status: 429, headers: rateLimitHeaders(userLimit) }
      )
    }

    // Push to queue — don't process inline
    await pushMessage(payload)

    // Audit log (non-blocking)
    logWebhookEvent('webhook.manychat.dm', 'lead', payload.instagramUserId, {
      username: payload.username,
      source: payload.source,
    })

    // Respond within 200ms
    return NextResponse.json({ status: 'queued' })
  } catch (err) {
    logError('webhook.manychat.dm', err)
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
