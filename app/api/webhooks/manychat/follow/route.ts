import { NextRequest, NextResponse } from 'next/server'
import { validateManyChatWebhook } from '@/lib/webhooks/security'

/**
 * Follow webhook — disabled.
 * Follows and follow responses are handled entirely by ManyChat flows.
 * We accept the request so ManyChat doesn't error, but do not process it.
 */
export async function POST(request: NextRequest) {
  const rejection = await validateManyChatWebhook(request)
  if (rejection) return rejection

  return NextResponse.json({ status: 'ignored', reason: 'follows handled by manychat' })
}
