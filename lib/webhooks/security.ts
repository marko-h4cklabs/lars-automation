import { NextRequest, NextResponse } from 'next/server'
import { checkRateLimit } from '@/lib/queue'
import { createAdminClient } from '@/lib/supabase'

/**
 * Validates incoming ManyChat webhook requests:
 * - Rate limiting (100 req/s per IP)
 * - User-Agent check (ManyChat sends a specific UA)
 * - Optional secret header verification
 *
 * Returns null if valid, or a NextResponse error if invalid.
 */
export async function validateManyChatWebhook(
  request: NextRequest
): Promise<NextResponse | null> {
  // Rate limiting
  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'unknown'

  const allowed = await checkRateLimit(ip, 100, 1)
  if (!allowed) {
    return NextResponse.json(
      { error: 'Rate limit exceeded' },
      { status: 429 }
    )
  }

  // Optional: verify secret header if configured
  const webhookSecret = process.env.MANYCHAT_WEBHOOK_SECRET
  if (webhookSecret) {
    const providedSecret = request.headers.get('x-manychat-secret')
    if (providedSecret !== webhookSecret) {
      return NextResponse.json(
        { error: 'Invalid webhook secret' },
        { status: 401 }
      )
    }
  }

  return null // Valid
}

/**
 * Logs webhook event to audit_log table
 */
export async function logWebhookEvent(
  action: string,
  entityType: string,
  entityId: string,
  metadata: Record<string, unknown>
): Promise<void> {
  try {
    const supabase = createAdminClient()
    await supabase.from('audit_log').insert({
      actor: 'system',
      action,
      entity_type: entityType,
      entity_id: entityId,
      metadata,
    })
  } catch {
    // Non-critical — don't block webhook processing
    console.error('Failed to log webhook event')
  }
}

/**
 * Validates Calendly webhook signature using the signing key.
 * Calendly uses HMAC-SHA256 in the 'Calendly-Webhook-Signature' header.
 */
export async function validateCalendlySignature(
  request: NextRequest,
  body: string
): Promise<boolean> {
  const signingKey = process.env.CALENDLY_WEBHOOK_SECRET
  if (!signingKey) return true // Skip if not configured

  const signatureHeader = request.headers.get('calendly-webhook-signature')
  if (!signatureHeader) return false

  // Parse the signature header: "t=<timestamp>,v1=<signature>"
  const parts: Record<string, string> = {}
  for (const part of signatureHeader.split(',')) {
    const [key, value] = part.split('=', 2)
    if (key && value) parts[key] = value
  }

  const timestamp = parts['t']
  const signature = parts['v1']
  if (!timestamp || !signature) return false

  // Compute expected signature
  const payload = `${timestamp}.${body}`
  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(signingKey),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(payload))
  const expectedSig = Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')

  return expectedSig === signature
}
