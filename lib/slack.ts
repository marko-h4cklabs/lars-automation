/**
 * Slack notification system using Incoming Webhooks + Block Kit.
 *
 * Webhook URLs are read from the notification_settings DB table (set via Settings > Notifications).
 * Supports:
 * - Dual webhooks: alerts (hot leads + bookings) and system (offline/takeover)
 * - Rate limiting: max 1 Slack message per lead per 60 minutes
 * - Retry with exponential backoff: 3 attempts
 * - Rich Block Kit formatting per notification type
 */

import { NotificationType } from '@/types'
import { createAdminClient } from '@/lib/supabase'

// ═══════════════════════════════════════
// TYPES
// ═══════════════════════════════════════

export interface SlackNotificationPayload {
  type: NotificationType
  leadId?: string
  username?: string
  message: string
  heatScore?: number
  scheduledAt?: string
  conversationUrl?: string
  leadUrl?: string
}

interface SlackBlock {
  type: string
  text?: { type: string; text: string }
  elements?: Record<string, unknown>[]
  fields?: { type: string; text: string }[]
}

// ═══════════════════════════════════════
// RATE LIMIT CACHE (in-memory, per-process)
// ═══════════════════════════════════════

const rateLimitCache = new Map<string, number>()
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000 // 60 minutes

function isRateLimited(leadId: string): boolean {
  if (!leadId) return false
  const key = `slack:${leadId}`
  const lastSent = rateLimitCache.get(key)
  if (lastSent && Date.now() - lastSent < RATE_LIMIT_WINDOW_MS) {
    return true
  }
  return false
}

function recordSend(leadId: string): void {
  if (!leadId) return
  const key = `slack:${leadId}`
  rateLimitCache.set(key, Date.now())

  // Cleanup old entries every 100 records
  if (rateLimitCache.size > 500) {
    const now = Date.now()
    const toDelete: string[] = []
    rateLimitCache.forEach((v, k) => {
      if (now - v > RATE_LIMIT_WINDOW_MS) toDelete.push(k)
    })
    toDelete.forEach((k) => rateLimitCache.delete(k))
  }
}

// ═══════════════════════════════════════
// WEBHOOK HELPERS (read from notification_settings DB)
// ═══════════════════════════════════════

interface SlackWebhooks {
  alerts: string | undefined
  system: string | undefined
}

let cachedWebhooks: SlackWebhooks | null = null
let webhooksCachedAt = 0
const WEBHOOKS_CACHE_TTL = 5 * 60 * 1000 // 5 minutes

async function getSlackWebhooks(): Promise<SlackWebhooks> {
  if (cachedWebhooks && Date.now() - webhooksCachedAt < WEBHOOKS_CACHE_TTL) {
    return cachedWebhooks
  }

  try {
    const supabase = createAdminClient()
    const { data } = await supabase
      .from('notification_settings')
      .select('slack_webhook_alerts, slack_webhook_system')
      .limit(1)
      .single()

    cachedWebhooks = {
      alerts: data?.slack_webhook_alerts || undefined,
      system: data?.slack_webhook_system || undefined,
    }
    webhooksCachedAt = Date.now()
    return cachedWebhooks
  } catch {
    return { alerts: undefined, system: undefined }
  }
}

/**
 * Invalidate the webhook URL cache (call after notification settings are updated).
 */
export function invalidateSlackWebhookCache(): void {
  cachedWebhooks = null
  webhooksCachedAt = 0
}

async function getWebhookForType(type: NotificationType): Promise<string | undefined> {
  const webhooks = await getSlackWebhooks()
  switch (type) {
    case NotificationType.HotLead:
    case NotificationType.CallBooked:
    case NotificationType.Disqualified:
      return webhooks.alerts
    case NotificationType.SetterOffline:
      return webhooks.system || webhooks.alerts
    default:
      return webhooks.alerts
  }
}

// ═══════════════════════════════════════
// RETRY WITH EXPONENTIAL BACKOFF
// ═══════════════════════════════════════

async function postWithRetry(
  webhookUrl: string,
  body: Record<string, unknown>,
  maxRetries = 3
): Promise<boolean> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const res = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (res.ok) return true

      // Slack returns 429 for rate limits
      if (res.status === 429) {
        const retryAfter = parseInt(res.headers.get('Retry-After') || '5', 10)
        await sleep(retryAfter * 1000)
        continue
      }

      // Non-retryable errors (400, 403, 404)
      if (res.status >= 400 && res.status < 500 && res.status !== 429) {
        console.error(`Slack webhook error ${res.status}: ${await res.text()}`)
        return false
      }
    } catch (err) {
      console.error(`Slack webhook attempt ${attempt + 1} failed:`, err)
    }

    // Exponential backoff: 1s, 2s, 4s
    if (attempt < maxRetries - 1) {
      await sleep(Math.pow(2, attempt) * 1000)
    }
  }
  return false
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// ═══════════════════════════════════════
// BLOCK KIT MESSAGE BUILDERS
// ═══════════════════════════════════════

function buildHotLeadBlocks(payload: SlackNotificationPayload): SlackBlock[] {
  const blocks: SlackBlock[] = [
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `🔥 *HOT LEAD DETECTED*\n*@${payload.username || 'Unknown'}* | Score: *${payload.heatScore || 0}/100*\n_${payload.message}_`,
      },
    },
  ]

  if (payload.conversationUrl) {
    blocks.push({
      type: 'actions',
      elements: [
        {
          type: 'button',
          text: { type: 'plain_text', text: 'View Conversation', emoji: true },
          url: payload.conversationUrl,
          style: 'primary',
        },
      ],
    })
  }

  return blocks
}

function buildCallBookedBlocks(payload: SlackNotificationPayload): SlackBlock[] {
  const scheduledText = payload.scheduledAt
    ? `\n📅 ${new Date(payload.scheduledAt).toLocaleString()}`
    : ''

  const blocks: SlackBlock[] = [
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `📅 *CALL BOOKED*\n*@${payload.username || 'Unknown'}* booked via AI Agent${scheduledText}\n_Next step: check Calendly_`,
      },
    },
  ]

  const url = payload.leadUrl || payload.conversationUrl
  if (url) {
    blocks.push({
      type: 'actions',
      elements: [
        {
          type: 'button',
          text: { type: 'plain_text', text: 'View Lead', emoji: true },
          url,
          style: 'primary',
        },
      ],
    })
  }

  return blocks
}

function buildSetterOfflineBlocks(payload: SlackNotificationPayload): SlackBlock[] {
  return [
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `🌙 *SETTER OFFLINE*\n${payload.message}`,
      },
    },
  ]
}

function buildDisqualifiedBlocks(payload: SlackNotificationPayload): SlackBlock[] {
  return [
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `⚠️ *LEAD DISQUALIFIED*\n*@${payload.username || 'Unknown'}*\n${payload.message}`,
      },
    },
  ]
}

function buildBlocksForType(payload: SlackNotificationPayload): SlackBlock[] {
  switch (payload.type) {
    case NotificationType.HotLead:
      return buildHotLeadBlocks(payload)
    case NotificationType.CallBooked:
      return buildCallBookedBlocks(payload)
    case NotificationType.SetterOffline:
      return buildSetterOfflineBlocks(payload)
    case NotificationType.Disqualified:
      return buildDisqualifiedBlocks(payload)
    default:
      return [{ type: 'section', text: { type: 'mrkdwn', text: payload.message } }]
  }
}

// ═══════════════════════════════════════
// PUBLIC API
// ═══════════════════════════════════════

/**
 * Send a notification to Slack with Block Kit formatting.
 * Handles rate limiting (1 per lead per 60 min), retry, and webhook routing.
 */
export async function sendNotification(payload: SlackNotificationPayload): Promise<boolean> {
  const webhookUrl = await getWebhookForType(payload.type)
  if (!webhookUrl) return false

  // Rate limit per lead
  if (payload.leadId && isRateLimited(payload.leadId)) {
    return false
  }

  const blocks = buildBlocksForType(payload)
  const fallbackText = payload.message

  const success = await postWithRetry(webhookUrl, {
    text: fallbackText,
    blocks,
  })

  if (success && payload.leadId) {
    recordSend(payload.leadId)
  }

  return success
}

/**
 * Send a raw text message to the alerts webhook (used for test messages).
 */
export async function sendSlackMessage(
  text: string,
  webhookUrl?: string
): Promise<boolean> {
  const url = webhookUrl || (await getSlackWebhooks()).alerts
  if (!url) return false

  return postWithRetry(url, { text })
}

/**
 * Convenience: send hot lead alert (used by workers).
 */
export async function sendHotLeadAlert(
  username: string,
  heatScore: number,
  conversationUrl: string,
  leadId?: string
): Promise<boolean> {
  return sendNotification({
    type: NotificationType.HotLead,
    leadId,
    username,
    heatScore,
    conversationUrl,
    message: `Hot lead @${username} scored ${heatScore}/100`,
  })
}

/**
 * Convenience: send call booked alert (used by Calendly webhook).
 */
export async function sendCallBookedAlert(
  username: string,
  scheduledAt: string,
  leadUrl: string,
  leadId?: string
): Promise<boolean> {
  return sendNotification({
    type: NotificationType.CallBooked,
    leadId,
    username,
    scheduledAt,
    leadUrl,
    message: `Call booked! @${username} scheduled${scheduledAt ? ` for ${new Date(scheduledAt).toLocaleDateString()}` : ''}`,
  })
}
