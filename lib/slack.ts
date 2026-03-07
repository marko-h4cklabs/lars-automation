/**
 * Slack notification helpers.
 * Uses Slack Incoming Webhook URL for sending messages.
 */

function getWebhookUrl() {
  return process.env.SLACK_WEBHOOK_URL!
}

export async function sendSlackMessage(
  text: string,
  blocks?: Record<string, unknown>[]
): Promise<void> {
  const webhookUrl = getWebhookUrl()
  if (!webhookUrl) return

  const body: Record<string, unknown> = { text }
  if (blocks) body.blocks = blocks

  await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

export async function sendHotLeadAlert(
  username: string,
  heatScore: number,
  conversationUrl: string
): Promise<void> {
  await sendSlackMessage(
    `🔥 *HOT LEAD ALERT*\n\n*@${username}* — Score: ${heatScore}/100\n\n<${conversationUrl}|Open Conversation →>`,
    [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `🔥 *HOT LEAD ALERT*\n\n*@${username}* — Score: ${heatScore}/100`,
        },
      },
      {
        type: 'actions',
        elements: [
          {
            type: 'button',
            text: { type: 'plain_text', text: 'Open Conversation →' },
            url: conversationUrl,
            style: 'primary',
          },
        ],
      },
    ]
  )
}

export async function sendCallBookedAlert(
  username: string,
  bookedAt: string,
  conversationUrl: string
): Promise<void> {
  await sendSlackMessage(
    `📅 *CALL BOOKED*\n\n*@${username}*\nScheduled: ${bookedAt}\n\n<${conversationUrl}|Open Conversation →>`,
    [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `📅 *CALL BOOKED*\n\n*@${username}*\nScheduled: ${bookedAt}`,
        },
      },
      {
        type: 'actions',
        elements: [
          {
            type: 'button',
            text: { type: 'plain_text', text: 'Open Conversation →' },
            url: conversationUrl,
            style: 'primary',
          },
        ],
      },
    ]
  )
}
