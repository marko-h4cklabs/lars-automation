import { NextRequest, NextResponse } from 'next/server'
import { getSubscriberInfoRaw } from '@/lib/manychat'
import axios from 'axios'

const MANYCHAT_BASE_URL = 'https://api.manychat.com/fb'

function getHeaders() {
  return {
    Authorization: `Bearer ${process.env.MANYCHAT_API_KEY!}`,
    'Content-Type': 'application/json',
  }
}

/**
 * GET /api/debug/manychat?subscriber_id=1475102489
 * Returns full subscriber info + attempts a test send
 */
export async function GET(request: NextRequest) {
  const subscriberId = request.nextUrl.searchParams.get('subscriber_id')
  if (!subscriberId) {
    return NextResponse.json({ error: 'subscriber_id query param required' }, { status: 400 })
  }

  const results: Record<string, unknown> = { subscriber_id: subscriberId }

  // Step 1: Get subscriber info
  try {
    const info = await getSubscriberInfoRaw(subscriberId)
    results.subscriber_info = info
  } catch (err) {
    if (axios.isAxiosError(err)) {
      results.subscriber_info_error = {
        status: err.response?.status,
        data: err.response?.data,
      }
    } else {
      results.subscriber_info_error = String(err)
    }
  }

  // Step 2: Try sending a test message (small text)
  try {
    const sendRes = await axios.post(
      `${MANYCHAT_BASE_URL}/sending/sendContent`,
      {
        subscriber_id: parseInt(subscriberId, 10),
        data: {
          version: 'v2',
          content: {
            messages: [{ type: 'text', text: '[test] diagnostic ping from dashboard' }],
          },
        },
      },
      { headers: getHeaders() }
    )
    results.send_test = { status: sendRes.status, data: sendRes.data }
  } catch (err) {
    if (axios.isAxiosError(err)) {
      results.send_test_error = {
        status: err.response?.status,
        data: err.response?.data,
      }
    } else {
      results.send_test_error = String(err)
    }
  }

  // Step 3: Try sendFlow as alternative (if you have a flow namespace)
  // This is just informational — shows if the API is reachable
  try {
    const flowRes = await axios.post(
      `${MANYCHAT_BASE_URL}/sending/sendFlow`,
      {
        subscriber_id: parseInt(subscriberId, 10),
        flow_ns: 'content20250309',
      },
      { headers: getHeaders() }
    )
    results.send_flow_test = { status: flowRes.status, data: flowRes.data }
  } catch (err) {
    if (axios.isAxiosError(err)) {
      results.send_flow_test_error = {
        status: err.response?.status,
        data: err.response?.data,
      }
    } else {
      results.send_flow_test_error = String(err)
    }
  }

  return NextResponse.json(results, { status: 200 })
}
