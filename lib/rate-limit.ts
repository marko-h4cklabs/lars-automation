/**
 * Rate limiting for webhook and API endpoints.
 *
 * Limits:
 * - Per instagram_user_id: max 60 messages/minute
 * - Global webhooks: max 500 req/minute
 * - ManyChat send API: 10 req/second (enforced in manychat.ts)
 */

import { redis } from '@/lib/queue'

// ═══════════════════════════════════════
// RATE LIMIT CONFIG
// ═══════════════════════════════════════

const LIMITS = {
  PER_USER: { max: 60, windowSeconds: 60 },
  GLOBAL_WEBHOOK: { max: 500, windowSeconds: 60 },
  MANYCHAT_SEND: { max: 10, windowSeconds: 1 },
} as const

// ═══════════════════════════════════════
// CORE RATE LIMITER
// ═══════════════════════════════════════

interface RateLimitResult {
  allowed: boolean
  remaining: number
  resetInSeconds: number
}

async function checkLimit(
  key: string,
  max: number,
  windowSeconds: number
): Promise<RateLimitResult> {
  try {
    const r = redis()
    const count = await r.incr(key)
    if (count === 1) {
      await r.expire(key, windowSeconds)
    }

    const ttl = await r.ttl(key)

    return {
      allowed: count <= max,
      remaining: Math.max(0, max - count),
      resetInSeconds: ttl > 0 ? ttl : windowSeconds,
    }
  } catch {
    // On Redis failure, allow the request (fail open)
    return { allowed: true, remaining: max, resetInSeconds: 0 }
  }
}

// ═══════════════════════════════════════
// PUBLIC API
// ═══════════════════════════════════════

/**
 * Check rate limit for a specific Instagram user (webhook messages).
 * Max 60 messages per minute per user.
 */
export async function checkUserRateLimit(
  instagramUserId: string
): Promise<RateLimitResult> {
  const key = `rl:user:${instagramUserId}`
  return checkLimit(key, LIMITS.PER_USER.max, LIMITS.PER_USER.windowSeconds)
}

/**
 * Check global webhook rate limit.
 * Max 500 requests per minute across all webhooks.
 */
export async function checkGlobalWebhookLimit(): Promise<RateLimitResult> {
  const key = 'rl:global:webhook'
  return checkLimit(key, LIMITS.GLOBAL_WEBHOOK.max, LIMITS.GLOBAL_WEBHOOK.windowSeconds)
}

/**
 * Check ManyChat send rate limit.
 * Max 10 requests per second.
 */
export async function checkManyChatSendLimit(): Promise<RateLimitResult> {
  const key = 'rl:manychat:send'
  return checkLimit(key, LIMITS.MANYCHAT_SEND.max, LIMITS.MANYCHAT_SEND.windowSeconds)
}

/**
 * Apply rate limiting headers to a Response.
 */
export function rateLimitHeaders(result: RateLimitResult): Record<string, string> {
  return {
    'X-RateLimit-Remaining': String(result.remaining),
    'X-RateLimit-Reset': String(result.resetInSeconds),
  }
}
