import axios from 'axios'

const MANYCHAT_BASE_URL = 'https://api.manychat.com/fb'

function getHeaders() {
  return {
    Authorization: `Bearer ${process.env.MANYCHAT_API_KEY!}`,
    'Content-Type': 'application/json',
  }
}

function toSubscriberId(id: string): number {
  const num = parseInt(id, 10)
  if (isNaN(num)) throw new Error(`Invalid subscriber ID: ${id}`)
  return num
}

export class ManyChatWindowExpiredError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ManyChatWindowExpiredError'
  }
}

export async function sendTextMessage(
  subscriberId: string,
  text: string
): Promise<void> {
  const numericId = toSubscriberId(subscriberId)
  console.log('[ManyChat] sendTextMessage → subscriber_id:', numericId, 'text:', text.substring(0, 50))

  try {
    const response = await axios.post(
      `${MANYCHAT_BASE_URL}/sending/sendContent`,
      {
        subscriber_id: numericId,
        data: {
          version: 'v2',
          content: {
            messages: [{ type: 'text', text }],
          },
        },
      },
      { headers: getHeaders() }
    )
    console.log('[ManyChat] sendTextMessage SUCCESS:', response.status, JSON.stringify(response.data))
  } catch (err) {
    if (axios.isAxiosError(err)) {
      const data = err.response?.data
      console.error('[ManyChat] sendTextMessage FAILED:', err.response?.status, JSON.stringify(data))

      // Diagnostic: fetch subscriber info to understand the window state
      try {
        const info = await getSubscriberInfoRaw(subscriberId)
        console.error('[ManyChat] DIAGNOSTIC subscriber info:', JSON.stringify(info, null, 2))
      } catch (diagErr) {
        console.error('[ManyChat] DIAGNOSTIC getInfo also failed:', diagErr)
      }

      if (data?.code === 3011) {
        throw new ManyChatWindowExpiredError(
          'ManyChat 24h window expired — subscriber last interaction is too old. Have the lead send a new DM to reset the window.'
        )
      }
    }
    throw err
  }
}

export async function sendVoiceMessage(
  subscriberId: string,
  audioUrl: string
): Promise<void> {
  try {
    await axios.post(
      `${MANYCHAT_BASE_URL}/sending/sendContent`,
      {
        subscriber_id: toSubscriberId(subscriberId),
        data: {
          version: 'v2',
          content: {
            messages: [
              {
                type: 'audio',
                url: audioUrl,
              },
            ],
          },
        },
      },
      { headers: getHeaders() }
    )
  } catch (err) {
    if (axios.isAxiosError(err)) {
      console.error('[ManyChat] sendVoiceMessage FAILED:', err.response?.status, JSON.stringify(err.response?.data))
    }
    throw err
  }
}

export async function sendMultipleMessages(
  subscriberId: string,
  messages: string[],
  delayMs: number = 2500
): Promise<void> {
  for (let i = 0; i < messages.length; i++) {
    await sendTextMessage(subscriberId, messages[i])
    if (i < messages.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, delayMs))
    }
  }
}

export interface SubscriberInfo {
  id: string
  name: string
  first_name: string
  last_name: string
  profile_pic: string
  gender: string
  locale: string
}

// Returns parsed subscriber info
export async function getSubscriberInfo(
  subscriberId: string
): Promise<SubscriberInfo> {
  const response = await axios.get(
    `${MANYCHAT_BASE_URL}/subscriber/getInfo`,
    {
      params: { subscriber_id: subscriberId },
      headers: getHeaders(),
    }
  )
  return response.data.data
}

// Returns the FULL raw response for diagnostics (includes last_interaction, channels, etc.)
export async function getSubscriberInfoRaw(
  subscriberId: string
): Promise<Record<string, unknown>> {
  const response = await axios.get(
    `${MANYCHAT_BASE_URL}/subscriber/getInfo`,
    {
      params: { subscriber_id: subscriberId },
      headers: getHeaders(),
    }
  )
  return response.data
}
