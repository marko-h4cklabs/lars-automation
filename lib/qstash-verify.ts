import { Receiver } from '@upstash/qstash'
import { NextRequest, NextResponse } from 'next/server'

let _receiver: Receiver | null = null

function getReceiver(): Receiver | null {
  const currentKey = process.env.QSTASH_CURRENT_SIGNING_KEY
  const nextKey = process.env.QSTASH_NEXT_SIGNING_KEY

  if (!currentKey || !nextKey) return null

  if (!_receiver) {
    _receiver = new Receiver({
      currentSigningKey: currentKey,
      nextSigningKey: nextKey,
    })
  }
  return _receiver
}

/**
 * Verify that an incoming request was sent by QStash.
 * Returns null if valid, or a NextResponse with 401 if invalid.
 * If signing keys are not configured, allows the request through
 * (dev mode / initial setup).
 */
export async function verifyQStashSignature(
  request: NextRequest
): Promise<NextResponse | null> {
  const receiver = getReceiver()

  // No signing keys configured — skip verification (dev mode)
  if (!receiver) return null

  const signature = request.headers.get('upstash-signature')
  if (!signature) {
    return NextResponse.json(
      { error: 'Missing upstash-signature header' },
      { status: 401 }
    )
  }

  try {
    const body = await request.text()
    await receiver.verify({ signature, body })

    // Re-attach body for downstream consumption
    // We store the raw body so the route handler can parse it
    ;(request as NextRequest & { _verifiedBody?: string })._verifiedBody = body
    return null // Valid
  } catch {
    return NextResponse.json(
      { error: 'Invalid QStash signature' },
      { status: 401 }
    )
  }
}

/**
 * Get the verified body from a request that was already verified.
 * Falls back to reading the body stream if not pre-verified.
 */
export async function getVerifiedBody<T>(request: NextRequest): Promise<T> {
  const cached = (request as NextRequest & { _verifiedBody?: string })._verifiedBody
  if (cached) return JSON.parse(cached) as T
  return request.json() as Promise<T>
}
