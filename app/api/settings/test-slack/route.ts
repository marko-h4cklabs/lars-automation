import { NextRequest, NextResponse } from 'next/server'

/**
 * POST /api/settings/test-slack
 * Server-side proxy for testing Slack webhook URLs.
 * Browser can't call Slack directly due to CORS.
 */
export async function POST(request: NextRequest) {
  try {
    const { url, channel } = await request.json()

    if (!url || typeof url !== 'string' || !url.startsWith('https://hooks.slack.com/')) {
      return NextResponse.json({ error: 'Invalid Slack webhook URL' }, { status: 400 })
    }

    const label = channel === 'bookings' ? 'Booking Alerts' : 'Hot Lead Alerts'
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: `✅ BlackOps test — ${label} channel connected!`,
      }),
    })

    if (res.ok) {
      return NextResponse.json({ success: true })
    }

    const text = await res.text()
    return NextResponse.json({ error: text || 'Slack returned an error' }, { status: res.status })
  } catch {
    return NextResponse.json({ error: 'Failed to reach Slack' }, { status: 502 })
  }
}
