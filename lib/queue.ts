import { Redis } from '@upstash/redis'
import { Client } from '@upstash/qstash'

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
})

const qstash = new Client({
  token: process.env.QSTASH_TOKEN!,
})

const MESSAGE_QUEUE = 'message_queue'

export interface QueuePayload {
  source: string
  keyword?: string | null
  instagramUserId: string
  username: string
  fullName: string
  bio: string
  followerCount: number
  profilePicUrl: string
  messageText: string
  messageType: 'text' | 'voice' | 'image'
  voiceUrl?: string | null
  timestamp: string
  rawPayload: Record<string, unknown>
}

export async function pushMessage(payload: QueuePayload): Promise<void> {
  const MAX_RETRIES = 3

  // Push to Redis list for backup (always succeeds first)
  await redis.lpush(MESSAGE_QUEUE, JSON.stringify(payload))

  // Schedule processing via QStash with retry logic
  const appUrl = process.env.NEXT_PUBLIC_APP_URL!
  let lastError: Error | null = null

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      await qstash.publishJSON({
        url: `${appUrl}/api/workers/process`,
        body: payload,
        retries: 3,
      })
      return // Success
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err))
      // Exponential backoff: 100ms, 400ms, 900ms
      if (attempt < MAX_RETRIES - 1) {
        await new Promise((r) => setTimeout(r, (attempt + 1) ** 2 * 100))
      }
    }
  }

  // All retries failed — message is still in Redis for manual recovery
  console.error('QStash publish failed after retries:', lastError?.message)
}

// Bundle management for smart delay
export async function getBundleMessages(
  instagramUserId: string
): Promise<QueuePayload[]> {
  const key = `bundle:${instagramUserId}`
  const messages = await redis.lrange(key, 0, -1)
  return messages.map((m) =>
    typeof m === 'string' ? JSON.parse(m) : m
  ) as QueuePayload[]
}

export async function addToBundle(
  instagramUserId: string,
  payload: QueuePayload,
  ttlSeconds: number = 30
): Promise<number> {
  const key = `bundle:${instagramUserId}`
  const count = await redis.lpush(key, JSON.stringify(payload))
  await redis.expire(key, ttlSeconds)
  return count
}

export async function clearBundle(instagramUserId: string): Promise<void> {
  const key = `bundle:${instagramUserId}`
  await redis.del(key)
}

// Rate limiting
export async function checkRateLimit(
  ip: string,
  maxRequests: number = 100,
  windowSeconds: number = 1
): Promise<boolean> {
  const key = `ratelimit:${ip}`
  const count = await redis.incr(key)
  if (count === 1) {
    await redis.expire(key, windowSeconds)
  }
  return count <= maxRequests
}

export { redis, qstash }
