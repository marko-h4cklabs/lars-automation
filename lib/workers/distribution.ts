import type { AssignmentType, SetterAllocation, User } from '@/types'

interface AssignmentResult {
  assignedTo: string | null // user_id or null for AI
  assignmentType: AssignmentType
}

/**
 * Calculates assignment using weighted random selection.
 * Queries all users with receives_leads=true, filters to online,
 * and uses configured percentages for weighted selection.
 * Falls back to AI if no setters are online.
 */
export function calculateAssignment(
  allocations: SetterAllocation[],
  onlineSetters: User[]
): AssignmentResult {
  const onlineIds = new Set(onlineSetters.map((s) => s.id))

  // Build weighted pool from active allocations
  const pool: { assignedTo: string | null; type: AssignmentType; weight: number }[] = []

  for (const alloc of allocations) {
    if (!alloc.receives_leads || alloc.pct <= 0) continue

    if (alloc.user_id === null) {
      // AI always available
      pool.push({
        assignedTo: null,
        type: 'ai' as AssignmentType,
        weight: alloc.pct,
      })
    } else if (onlineIds.has(alloc.user_id)) {
      // Only include online setters
      pool.push({
        assignedTo: alloc.user_id,
        type: 'setter' as AssignmentType,
        weight: alloc.pct,
      })
    }
  }

  // If pool is empty or only has offline entries, AI gets 100%
  if (pool.length === 0) {
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

  // Fallback
  const last = pool[pool.length - 1]
  return {
    assignedTo: last.assignedTo,
    assignmentType: last.type,
  }
}
