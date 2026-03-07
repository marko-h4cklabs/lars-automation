/**
 * Central notification system.
 *
 * createNotification() handles:
 * 1. Insert into notifications table (triggers Supabase Realtime for in-app)
 * 2. Check notification preferences (notification_settings table)
 * 3. Route to Slack if the type's mode includes Slack
 * 4. Mark slack_sent on the notification row
 */

import { createAdminClient } from '@/lib/supabase'
import { sendNotification } from '@/lib/slack'
import { NotificationType } from '@/types'

// ═══════════════════════════════════════
// TYPES
// ═══════════════════════════════════════

interface NotificationSettings {
  hot_lead_mode: string
  hot_lead_threshold: number
  call_booked_mode: string
  setter_offline_mode: string
  ai_takeover_mode: string
  dnd_start: string | null
  dnd_end: string | null
}

interface CreateNotificationParams {
  type: NotificationType
  leadId?: string | null
  conversationId?: string | null
  userId?: string | null // null = broadcast to all
  message: string
  metadata?: {
    username?: string
    heatScore?: number
    scheduledAt?: string
    conversationUrl?: string
    leadUrl?: string
  }
}

const DEFAULT_SETTINGS: NotificationSettings = {
  hot_lead_mode: 'slack_and_app',
  hot_lead_threshold: 80,
  call_booked_mode: 'slack_and_app',
  setter_offline_mode: 'app_only',
  ai_takeover_mode: 'app_only',
  dnd_start: null,
  dnd_end: null,
}

// ═══════════════════════════════════════
// SETTINGS CACHE (5-minute TTL)
// ═══════════════════════════════════════

let cachedSettings: NotificationSettings | null = null
let settingsCachedAt = 0
const SETTINGS_CACHE_TTL = 5 * 60 * 1000 // 5 minutes

async function getNotificationSettings(): Promise<NotificationSettings> {
  if (cachedSettings && Date.now() - settingsCachedAt < SETTINGS_CACHE_TTL) {
    return cachedSettings
  }

  try {
    const supabase = createAdminClient()
    const { data } = await supabase
      .from('notification_settings')
      .select('*')
      .limit(1)
      .single()

    if (data) {
      cachedSettings = data as NotificationSettings
      settingsCachedAt = Date.now()
      return cachedSettings
    }
  } catch {
    // Table may not exist yet — use defaults
  }

  return DEFAULT_SETTINGS
}

// ═══════════════════════════════════════
// DND CHECK
// ═══════════════════════════════════════

function isInDndWindow(settings: NotificationSettings): boolean {
  if (!settings.dnd_start || !settings.dnd_end) return false

  const now = new Date()
  const [startH, startM] = settings.dnd_start.split(':').map(Number)
  const [endH, endM] = settings.dnd_end.split(':').map(Number)

  const currentMinutes = now.getHours() * 60 + now.getMinutes()
  const startMinutes = startH * 60 + startM
  const endMinutes = endH * 60 + endM

  // Handle overnight DND (e.g., 22:00 - 08:00)
  if (startMinutes > endMinutes) {
    return currentMinutes >= startMinutes || currentMinutes < endMinutes
  }

  return currentMinutes >= startMinutes && currentMinutes < endMinutes
}

// ═══════════════════════════════════════
// MODE HELPERS
// ═══════════════════════════════════════

function getModeForType(type: NotificationType, settings: NotificationSettings): string {
  switch (type) {
    case NotificationType.HotLead:
      return settings.hot_lead_mode
    case NotificationType.CallBooked:
      return settings.call_booked_mode
    case NotificationType.SetterOffline:
      return settings.setter_offline_mode
    case NotificationType.AITakeover:
      return settings.ai_takeover_mode
    case NotificationType.Disqualified:
      return 'app_only' // Always in-app only for disqualified
    default:
      return 'app_only'
  }
}

function shouldSendInApp(mode: string): boolean {
  return mode === 'slack_and_app' || mode === 'app_only'
}

function shouldSendSlack(mode: string): boolean {
  return mode === 'slack_and_app'
}

// ═══════════════════════════════════════
// PUBLIC API
// ═══════════════════════════════════════

/**
 * Create a notification with automatic Slack routing.
 *
 * - Inserts into notifications table (Supabase Realtime broadcasts to in-app)
 * - Checks notification_settings for delivery mode per type
 * - Respects DND hours (suppresses Slack only, in-app still delivers)
 * - Sends Slack via lib/slack.ts with rate limiting and retry
 */
export async function createNotification(params: CreateNotificationParams): Promise<string | null> {
  const { type, leadId, conversationId, userId, message, metadata } = params
  const supabase = createAdminClient()

  // Load notification preferences
  const settings = await getNotificationSettings()
  const mode = getModeForType(type, settings)

  // If mode is 'off', skip entirely
  if (mode === 'off') return null

  let notificationId: string | null = null

  // Step 1: Insert in-app notification
  if (shouldSendInApp(mode)) {
    const { data } = await supabase
      .from('notifications')
      .insert({
        user_id: userId || null,
        type,
        lead_id: leadId || null,
        conversation_id: conversationId || null,
        message,
        read: false,
        slack_sent: false,
      })
      .select('id')
      .single()

    notificationId = data?.id || null
  }

  // Step 2: Send Slack notification (if mode includes slack and not in DND)
  if (shouldSendSlack(mode) && !isInDndWindow(settings)) {
    const slackSuccess = await sendNotification({
      type,
      leadId: leadId || undefined,
      username: metadata?.username,
      heatScore: metadata?.heatScore,
      scheduledAt: metadata?.scheduledAt,
      conversationUrl: metadata?.conversationUrl,
      leadUrl: metadata?.leadUrl,
      message,
    })

    // Update slack_sent flag on the notification row
    if (slackSuccess && notificationId) {
      await supabase
        .from('notifications')
        .update({ slack_sent: true })
        .eq('id', notificationId)
    }
  }

  return notificationId
}

/**
 * Invalidate the settings cache (call after settings are updated).
 */
export function invalidateSettingsCache(): void {
  cachedSettings = null
  settingsCachedAt = 0
}
