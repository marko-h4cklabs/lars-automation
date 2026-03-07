import type { DistributionSettings, User, AssignmentType } from '@/types'

interface AssignmentResult {
  assignedTo: string | null // user_id or null for AI
  assignmentType: AssignmentType
}

/**
 * Calculates assignment using weighted random selection.
 * Only considers online setters. Falls back to AI if no setters available.
 */
export function calculateAssignment(
  settings: DistributionSettings,
  onlineSetters: User[]
): AssignmentResult {
  const onlineIds = new Set(onlineSetters.map((s) => s.id))

  const setter1Online = settings.setter1_id
    ? onlineIds.has(settings.setter1_id)
    : false
  const setter2Online = settings.setter2_id
    ? onlineIds.has(settings.setter2_id)
    : false

  // Build weighted pool from available assignees
  const pool: { assignedTo: string | null; type: AssignmentType; weight: number }[] = []

  if (setter1Online && settings.setter1_id) {
    pool.push({
      assignedTo: settings.setter1_id,
      type: 'setter1' as AssignmentType,
      weight: settings.setter1_pct,
    })
  }

  if (setter2Online && settings.setter2_id) {
    pool.push({
      assignedTo: settings.setter2_id,
      type: 'setter2' as AssignmentType,
      weight: settings.setter2_pct,
    })
  }

  // AI always available
  pool.push({
    assignedTo: null,
    type: 'ai' as AssignmentType,
    weight: settings.ai_pct,
  })

  // If no setters online, AI gets 100%
  if (!setter1Online && !setter2Online) {
    return { assignedTo: null, assignmentType: 'ai' as AssignmentType }
  }

  // Normalize weights among available pool
  const totalWeight = pool.reduce((sum, p) => sum + p.weight, 0)
  if (totalWeight <= 0) {
    return { assignedTo: null, assignmentType: 'ai' as AssignmentType }
  }

  // Weighted random selection
  const roll = Math.random() * totalWeight
  let cumulative = 0

  for (const entry of pool) {
    cumulative += entry.weight
    if (roll < cumulative) {
      return {
        assignedTo: entry.assignedTo,
        assignmentType: entry.type,
      }
    }
  }

  // Fallback (shouldn't reach here)
  const last = pool[pool.length - 1]
  return {
    assignedTo: last.assignedTo,
    assignmentType: last.type,
  }
}
