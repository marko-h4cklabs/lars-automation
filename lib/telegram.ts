import axios from 'axios'

function getBotUrl() {
  return `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN!}`
}

export async function sendTelegramMessage(
  text: string,
  chatId?: string
): Promise<void> {
  const targetChatId = chatId || process.env.TELEGRAM_CHAT_ID!
  await axios.post(`${getBotUrl()}/sendMessage`, {
    chat_id: targetChatId,
    text,
    parse_mode: 'HTML',
  })
}

export async function sendHotLeadAlert(
  username: string,
  heatScore: number,
  conversationUrl: string
): Promise<void> {
  const message = [
    '🔥 <b>HOT LEAD ALERT</b>',
    '',
    `<b>@${username}</b> — Score: ${heatScore}/100`,
    '',
    `<a href="${conversationUrl}">Open Conversation →</a>`,
  ].join('\n')

  await sendTelegramMessage(message)
}

export async function sendCallBookedAlert(
  username: string,
  bookedAt: string,
  conversationUrl: string
): Promise<void> {
  const message = [
    '📅 <b>CALL BOOKED</b>',
    '',
    `<b>@${username}</b>`,
    `Scheduled: ${bookedAt}`,
    '',
    `<a href="${conversationUrl}">Open Conversation →</a>`,
  ].join('\n')

  await sendTelegramMessage(message)
}
