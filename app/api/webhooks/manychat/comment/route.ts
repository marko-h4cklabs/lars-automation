import { NextRequest, NextResponse } from 'next/server'
import { normalizePayload } from '@/lib/webhooks/normalizePayload'
import { validateManyChatWebhook, logWebhookEvent } from '@/lib/webhooks/security'
import { pushMessage } from '@/lib/queue'
import { LeadSource } from '@/types'

/**
 * Comment webhook — processes comment-keyword triggers.
 * When someone comments a keyword on a post, this queues the event
 * for the process worker to check keyword triggers and send auto-DMs.
 */
export async function POST(request: NextRequest) {
  const rejection = await validateManyChatWebhook(request)
  if (rejection) return rejection

  try {
    const raw = await request.json()
    const payload = normalizePayload(raw, LeadSource.Comment)

    await pushMessage(payload)

    logWebhookEvent('webhook.manychat.comment', 'lead', payload.instagramUserId, {
      username: payload.username,
      source: payload.source,
    })

    return NextResponse.json({ status: 'queued' })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
