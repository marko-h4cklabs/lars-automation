/**
 * Queue health monitoring: dead letter queue, depth alerts, job dedup.
 *
 * DLQ: Failed jobs after 3 retries get moved to a dead letter queue.
 * Health: Alert if queue depth > 500 messages.
 * Dedup: Same lead + same timestamp = skip.
 */

import { redis } from '@/lib/queue'
import { createAdminClient } from '@/lib/supabase'
import { NotificationType } from '@/types'

// ═══════════════════════════════════════
// DEAD LETTER QUEUE
// ═══════════════════════════════════════

const DLQ_KEY = 'dlq:messages'
const DLQ_MAX_SIZE = 1000

interface DLQEntry {
  payload: Record<string, unknown>
  error: string
  failedAt: string
  retryCount: number
  worker: string
}

/**
 * Move a failed job to the dead letter queue.
 * Called after all retries are exhausted.
 */
export async function moveToDLQ(
  worker: string,
  payload: Record<string, unknown>,
  error: string,
  retryCount = 3
): Promise<void> {
  try {
    const entry: DLQEntry = {
      payload,
      error,
      failedAt: new Date().toISOString(),
      retryCount,
      worker,
    }

    const r = redis()
    await r.lpush(DLQ_KEY, JSON.stringify(entry))

    // Trim DLQ to max size (keep newest)
    await r.ltrim(DLQ_KEY, 0, DLQ_MAX_SIZE - 1)

    // Log to audit_log
    Promise.resolve(
      createAdminClient()
        .from('audit_log')
        .insert({
          actor: 'system',
          action: 'queue.dlq_entry',
          entity_type: 'queue',
          entity_id: null,
          metadata: { worker, error, retryCount },
        })
    ).catch(() => {})

    // Alert on DLQ entry
    Promise.resolve(
      createAdminClient()
        .from('notifications')
        .insert({
          user_id: null,
          type: NotificationType.SetterOffline, // Reuse for system alerts
          message: `Queue alert: job failed in ${worker} — ${error.slice(0, 100)}`,
          read: false,
          slack_sent: false,
        })
    ).catch(() => {})
  } catch {
    console.error('Failed to move job to DLQ:', error)
  }
}

/**
 * Get dead letter queue entries.
 */
export async function getDLQEntries(limit = 50): Promise<DLQEntry[]> {
  try {
    const r = redis()
    const entries = await r.lrange(DLQ_KEY, 0, limit - 1)
    return entries.map((e) =>
      typeof e === 'string' ? JSON.parse(e) : e
    ) as DLQEntry[]
  } catch {
    return []
  }
}

/**
 * Get DLQ depth (number of failed jobs).
 */
export async function getDLQDepth(): Promise<number> {
  try {
    return await redis().llen(DLQ_KEY)
  } catch {
    return 0
  }
}

/**
 * Clear the dead letter queue (after manual review).
 */
export async function clearDLQ(): Promise<void> {
  await redis().del(DLQ_KEY)
}

// ═══════════════════════════════════════
// QUEUE DEPTH MONITORING
// ═══════════════════════════════════════

const QUEUE_KEY = 'message_queue'
const QUEUE_DEPTH_ALERT_THRESHOLD = 500

/**
 * Get current queue depth.
 */
export async function getQueueDepth(): Promise<number> {
  try {
    return await redis().llen(QUEUE_KEY)
  } catch {
    return 0
  }
}

/**
 * Check queue health and alert if depth exceeds threshold.
 * Call this periodically (e.g., from a cron job).
 */
export async function checkQueueHealth(): Promise<{
  depth: number
  dlqDepth: number
  healthy: boolean
}> {
  const [depth, dlqDepth] = await Promise.all([
    getQueueDepth(),
    getDLQDepth(),
  ])

  const healthy = depth < QUEUE_DEPTH_ALERT_THRESHOLD

  if (!healthy) {
    // Create alert notification
    Promise.resolve(
      createAdminClient()
        .from('notifications')
        .insert({
          user_id: null,
          type: NotificationType.SetterOffline,
          message: `Queue depth alert: ${depth} messages pending (threshold: ${QUEUE_DEPTH_ALERT_THRESHOLD})`,
          read: false,
          slack_sent: false,
        })
    ).catch(() => {})
  }

  return { depth, dlqDepth, healthy }
}

// ═══════════════════════════════════════
// JOB DEDUPLICATION
// ═══════════════════════════════════════

/**
 * Check if a job has already been processed.
 * Uses Redis with a 1-hour TTL.
 */
export async function isDuplicate(
  instagramUserId: string,
  timestamp: string
): Promise<boolean> {
  const key = `dedup:${instagramUserId}:${timestamp}`
  try {
    const exists = await redis().get(key)
    return !!exists
  } catch {
    return false
  }
}

/**
 * Mark a job as processed for deduplication.
 */
export async function markProcessed(
  instagramUserId: string,
  timestamp: string
): Promise<void> {
  const key = `dedup:${instagramUserId}:${timestamp}`
  try {
    await redis().set(key, '1', { ex: 3600 })
  } catch {
    // Non-critical
  }
}
