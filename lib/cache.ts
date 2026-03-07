/**
 * Redis caching layer for frequently-read settings and data.
 *
 * Cached with TTLs:
 * - Distribution settings (60s)
 * - Autopilot settings (60s)
 * - Persona settings (300s)
 * - Lead assignment (30s)
 * - KB search results (600s)
 * - Setter online status (30s)
 *
 * All reads go through cache first → Redis → Supabase.
 * Invalidation happens on settings updates via invalidate().
 */

import { redis } from '@/lib/queue'
import { createAdminClient } from '@/lib/supabase'
import type {
  DistributionSettings,
  AutopilotSettings,
  PersonaSettings,
  User,
} from '@/types'

// ═══════════════════════════════════════
// CACHE KEY PREFIXES
// ═══════════════════════════════════════

const KEYS = {
  DISTRIBUTION: 'cache:distribution',
  AUTOPILOT: 'cache:autopilot',
  PERSONA: 'cache:persona:global',
  LEAD_ASSIGNMENT: 'cache:lead:',
  KB_SEARCH: 'cache:kb:',
  ONLINE_SETTERS: 'cache:setters:online',
} as const

// ═══════════════════════════════════════
// TTLs (seconds)
// ═══════════════════════════════════════

const TTL = {
  DISTRIBUTION: 60,
  AUTOPILOT: 60,
  PERSONA: 300,
  LEAD_ASSIGNMENT: 30,
  KB_SEARCH: 600,
  ONLINE_SETTERS: 30,
} as const

// ═══════════════════════════════════════
// GENERIC CACHE HELPERS
// ═══════════════════════════════════════

async function getFromCache<T>(key: string): Promise<T | null> {
  try {
    const cached = await redis().get(key)
    if (!cached) return null
    return (typeof cached === 'string' ? JSON.parse(cached) : cached) as T
  } catch {
    return null
  }
}

async function setInCache(key: string, value: unknown, ttl: number): Promise<void> {
  try {
    await redis().set(key, JSON.stringify(value), { ex: ttl })
  } catch {
    // Cache write failure is non-critical
  }
}

// ═══════════════════════════════════════
// DISTRIBUTION SETTINGS
// ═══════════════════════════════════════

export async function getDistributionSettings(): Promise<DistributionSettings | null> {
  const cached = await getFromCache<DistributionSettings>(KEYS.DISTRIBUTION)
  if (cached) return cached

  const supabase = createAdminClient()
  const { data } = await supabase
    .from('distribution_settings')
    .select('*')
    .limit(1)
    .single()

  if (data) {
    await setInCache(KEYS.DISTRIBUTION, data, TTL.DISTRIBUTION)
  }
  return data as DistributionSettings | null
}

// ═══════════════════════════════════════
// AUTOPILOT SETTINGS
// ═══════════════════════════════════════

export async function getAutopilotSettings(): Promise<AutopilotSettings | null> {
  const cached = await getFromCache<AutopilotSettings>(KEYS.AUTOPILOT)
  if (cached) return cached

  const supabase = createAdminClient()
  const { data } = await supabase
    .from('autopilot_settings')
    .select('*')
    .limit(1)
    .single()

  if (data) {
    await setInCache(KEYS.AUTOPILOT, data, TTL.AUTOPILOT)
  }
  return data as AutopilotSettings | null
}

// ═══════════════════════════════════════
// PERSONA SETTINGS
// ═══════════════════════════════════════

export async function getPersonaSettings(): Promise<PersonaSettings | null> {
  const cached = await getFromCache<PersonaSettings>(KEYS.PERSONA)
  if (cached) return cached

  const supabase = createAdminClient()
  const { data } = await supabase
    .from('persona_settings')
    .select('*')
    .eq('is_global', true)
    .limit(1)
    .single()

  if (data) {
    await setInCache(KEYS.PERSONA, data, TTL.PERSONA)
  }
  return data as PersonaSettings | null
}

// ═══════════════════════════════════════
// LEAD ASSIGNMENT
// ═══════════════════════════════════════

export async function getLeadAssignment(
  leadId: string
): Promise<{ assignedTo: string | null; assignmentType: string } | null> {
  const key = `${KEYS.LEAD_ASSIGNMENT}${leadId}`
  const cached = await getFromCache<{ assignedTo: string | null; assignmentType: string }>(key)
  if (cached) return cached

  const supabase = createAdminClient()
  const { data } = await supabase
    .from('leads')
    .select('assigned_to, assignment_type')
    .eq('id', leadId)
    .single()

  if (data) {
    const result = { assignedTo: data.assigned_to, assignmentType: data.assignment_type }
    await setInCache(key, result, TTL.LEAD_ASSIGNMENT)
    return result
  }
  return null
}

// ═══════════════════════════════════════
// KB SEARCH RESULTS
// ═══════════════════════════════════════

export async function getCachedKBSearch<T>(query: string): Promise<T | null> {
  // Create a simple hash of the query for the cache key
  const hash = query.slice(0, 100).replace(/\s+/g, '_').toLowerCase()
  const key = `${KEYS.KB_SEARCH}${hash}`
  return getFromCache<T>(key)
}

export async function setCachedKBSearch(query: string, results: unknown): Promise<void> {
  const hash = query.slice(0, 100).replace(/\s+/g, '_').toLowerCase()
  const key = `${KEYS.KB_SEARCH}${hash}`
  await setInCache(key, results, TTL.KB_SEARCH)
}

// ═══════════════════════════════════════
// ONLINE SETTERS
// ═══════════════════════════════════════

export async function getOnlineSetters(): Promise<User[]> {
  const cached = await getFromCache<User[]>(KEYS.ONLINE_SETTERS)
  if (cached) return cached

  const supabase = createAdminClient()
  const { data } = await supabase
    .from('users')
    .select('*')
    .eq('role', 'setter')
    .eq('status', 'online')

  const setters = (data || []) as User[]
  await setInCache(KEYS.ONLINE_SETTERS, setters, TTL.ONLINE_SETTERS)
  return setters
}

// ═══════════════════════════════════════
// INVALIDATION
// ═══════════════════════════════════════

export async function invalidateCache(
  ...keys: (keyof typeof KEYS)[]
): Promise<void> {
  try {
    const redisKeys = keys.map((k) => KEYS[k])
    for (const key of redisKeys) {
      await redis().del(key)
    }
  } catch {
    // Invalidation failure is non-critical
  }
}

export async function invalidateLeadCache(leadId: string): Promise<void> {
  try {
    await redis().del(`${KEYS.LEAD_ASSIGNMENT}${leadId}`)
  } catch {
    // Non-critical
  }
}

export async function invalidateAllCache(): Promise<void> {
  await invalidateCache('DISTRIBUTION', 'AUTOPILOT', 'PERSONA', 'ONLINE_SETTERS')
}
