import axios from 'axios'

const MANYCHAT_BASE_URL = 'https://api.manychat.com/ig'

function getHeaders() {
  return {
    Authorization: `Bearer ${process.env.MANYCHAT_API_KEY!}`,
    'Content-Type': 'application/json',
  }
}

export async function sendTextMessage(
  subscriberId: string,
  text: string
): Promise<void> {
  await axios.post(
    `${MANYCHAT_BASE_URL}/sending/sendContent`,
    {
      subscriber_id: subscriberId,
      data: {
        version: 'v2',
        content: {
          messages: [{ type: 'text', text }],
        },
      },
      message_tag: 'ACCOUNT_UPDATE',
    },
    { headers: getHeaders() }
  )
}

export async function sendVoiceMessage(
  subscriberId: string,
  audioUrl: string
): Promise<void> {
  await axios.post(
    `${MANYCHAT_BASE_URL}/sending/sendContent`,
    {
      subscriber_id: subscriberId,
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
      message_tag: 'ACCOUNT_UPDATE',
    },
    { headers: getHeaders() }
  )
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
