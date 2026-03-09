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

  // Try with HUMAN_AGENT tag first (inside data.content), fall back without tag
  const bodyWithTag = {
    subscriber_id: numericId,
    data: {
      version: 'v2',
      content: {
        messages: [{ type: 'text', text }],
        message_tag: 'HUMAN_AGENT',
      },
    },
  }

  const bodyWithoutTag = {
    subscriber_id: numericId,
    data: {
      version: 'v2',
      content: {
        messages: [{ type: 'text', text }],
      },
    },
  }

  // Attempt 1: with HUMAN_AGENT inside content
  try {
    const response = await axios.post(
      `${MANYCHAT_BASE_URL}/sending/sendContent`,
      bodyWithTag,
      { headers: getHeaders() }
    )
    console.log('[ManyChat] sendTextMessage SUCCESS (with tag):', response.status, JSON.stringify(response.data))
    return
  } catch (err) {
    if (axios.isAxiosError(err)) {
      const data = err.response?.data
      console.warn('[ManyChat] attempt with HUMAN_AGENT tag failed:', err.response?.status, JSON.stringify(data))
      // If "unsupported message tag", try without tag
      if (err.response?.status === 400 && (
        data?.message?.includes('Unsupported message tag') ||
        data?.details?.messages?.[0]?.message?.includes('Unsupported message tag')
      )) {
        console.log('[ManyChat] retrying without message_tag...')
      } else {
        // Different error — check for 24h window
        if (data?.code === 3011) {
          throw new ManyChatWindowExpiredError(
            '24-hour messaging window expired. The lead must send a new message before you can reply.'
          )
        }
        throw err
      }
    } else {
      throw err
    }
  }

  // Attempt 2: without tag (works within 24h window)
  try {
    const response = await axios.post(
      `${MANYCHAT_BASE_URL}/sending/sendContent`,
      bodyWithoutTag,
      { headers: getHeaders() }
    )
    console.log('[ManyChat] sendTextMessage SUCCESS (no tag):', response.status, JSON.stringify(response.data))
  } catch (err) {
    if (axios.isAxiosError(err)) {
      const data = err.response?.data
      console.error('[ManyChat] sendTextMessage FAILED (no tag):', err.response?.status, JSON.stringify(data))
      if (data?.code === 3011) {
        throw new ManyChatWindowExpiredError(
          '24-hour messaging window expired. The lead must send a new message before you can reply.'
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
      console.error('ManyChat API error:', err.response?.status, JSON.stringify(err.response?.data))
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
