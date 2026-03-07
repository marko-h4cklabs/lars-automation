import { NextRequest, NextResponse } from 'next/server'
import { normalizePayload } from '@/lib/webhooks/normalizePayload'
import { validateManyChatWebhook, logWebhookEvent } from '@/lib/webhooks/security'
import { pushMessage } from '@/lib/queue'
import { LeadSource } from '@/types'

export async function POST(request: NextRequest) {
  const rejection = await validateManyChatWebhook(request)
  if (rejection) return rejection

  try {
    const raw = await request.json()

    // Force message type to voice — includes voice_url for transcription
    raw.message_type = 'voice'
    const payload = normalizePayload(raw, LeadSource.DM)

    if (!payload.voiceUrl) {
      return NextResponse.json(
        { error: 'Missing voice_url for voice webhook' },
        { status: 400 }
      )
    }

    await pushMessage(payload)

    logWebhookEvent('webhook.manychat.voice', 'lead', payload.instagramUserId, {
      username: payload.username,
      source: payload.source,
      voiceUrl: payload.voiceUrl,
    })

    return NextResponse.json({ status: 'queued' })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
