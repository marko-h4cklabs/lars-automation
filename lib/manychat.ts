import axios from 'axios'

const MANYCHAT_BASE_URL = 'https://api.manychat.com/ig'

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

export async function sendTextMessage(
  subscriberId: string,
  text: string
): Promise<void> {
  try {
    await axios.post(
      `${MANYCHAT_BASE_URL}/sending/sendContent`,
      {
        subscriber_id: toSubscriberId(subscriberId),
        data: {
          version: 'v2',
          content: {
            messages: [{ type: 'text', text }],
          },
        },
        message_tag: 'HUMAN_AGENT',
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
        message_tag: 'HUMAN_AGENT',
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
