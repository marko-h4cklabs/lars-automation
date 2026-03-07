/**
 * AI cost tracking and token estimation.
 *
 * Logs token usage to audit_log for cost monitoring.
 * Provides monthly cost estimator data for the dashboard.
 */

import { createAdminClient } from '@/lib/supabase'
import type { AIModel } from '@/lib/ai'

// ═══════════════════════════════════════
// PRICING (per 1M tokens, as of 2025)
// ═══════════════════════════════════════

const PRICING: Record<string, { input: number; output: number }> = {
  'claude-sonnet-4-20250514': { input: 3.0, output: 15.0 },
  'claude-haiku-4-5-20251001': { input: 0.80, output: 4.0 },
}

const MODEL_MAP: Record<AIModel, string> = {
  sonnet: 'claude-sonnet-4-20250514',
  haiku: 'claude-haiku-4-5-20251001',
}

// ═══════════════════════════════════════
// TOKEN ESTIMATION
// ═══════════════════════════════════════

/**
 * Rough token count estimate (4 chars per token for English text).
 * Not exact but sufficient for cost tracking and context window management.
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4)
}

/**
 * Estimate cost in USD for a given model and token counts.
 */
export function estimateCost(
  model: AIModel,
  inputTokens: number,
  outputTokens: number
): number {
  const modelId = MODEL_MAP[model]
  const pricing = PRICING[modelId]
  if (!pricing) return 0

  const inputCost = (inputTokens / 1_000_000) * pricing.input
  const outputCost = (outputTokens / 1_000_000) * pricing.output
  return inputCost + outputCost
}

// ═══════════════════════════════════════
// USAGE LOGGING
// ═══════════════════════════════════════

interface AIUsageLog {
  model: AIModel
  action: string // 'triage', 'autopilot', 'suggestion', 'summary', etc.
  inputTokens: number
  outputTokens: number
  conversationId?: string
  leadId?: string
}

/**
 * Log AI usage to audit_log for cost tracking.
 * Fire-and-forget.
 */
export function logAIUsage(usage: AIUsageLog): void {
  const cost = estimateCost(usage.model, usage.inputTokens, usage.outputTokens)

  Promise.resolve(
    createAdminClient()
      .from('audit_log')
      .insert({
        actor: 'ai',
        action: `ai.${usage.action}`,
        entity_type: 'ai_usage',
        entity_id: usage.conversationId || null,
        metadata: {
          model: usage.model,
          input_tokens: usage.inputTokens,
          output_tokens: usage.outputTokens,
          cost_usd: cost,
          lead_id: usage.leadId,
        },
      })
  ).catch(() => {})
}

// ═══════════════════════════════════════
// MONTHLY COST ESTIMATOR
// ═══════════════════════════════════════

interface CostEstimate {
  totalCost: number
  byModel: Record<string, { calls: number; tokens: number; cost: number }>
  byAction: Record<string, { calls: number; cost: number }>
  projectedMonthly: number
  period: { from: string; to: string; days: number }
}

/**
 * Calculate AI cost estimate from audit_log data.
 * Used by the dashboard to show projected monthly spend.
 */
export async function getAICostEstimate(
  dateFrom: string,
  dateTo: string
): Promise<CostEstimate> {
  const supabase = createAdminClient()

  const { data: logs } = await supabase
    .from('audit_log')
    .select('action, metadata, created_at')
    .eq('entity_type', 'ai_usage')
    .gte('created_at', dateFrom)
    .lte('created_at', dateTo)
    .order('created_at', { ascending: false })
    .limit(10000)

  const entries = (logs || []) as { action: string; metadata: Record<string, unknown>; created_at: string }[]

  let totalCost = 0
  const byModel: Record<string, { calls: number; tokens: number; cost: number }> = {}
  const byAction: Record<string, { calls: number; cost: number }> = {}

  for (const entry of entries) {
    const cost = (entry.metadata.cost_usd as number) || 0
    const model = (entry.metadata.model as string) || 'unknown'
    const tokens = ((entry.metadata.input_tokens as number) || 0) + ((entry.metadata.output_tokens as number) || 0)

    totalCost += cost

    if (!byModel[model]) byModel[model] = { calls: 0, tokens: 0, cost: 0 }
    byModel[model].calls++
    byModel[model].tokens += tokens
    byModel[model].cost += cost

    const action = entry.action.replace('ai.', '')
    if (!byAction[action]) byAction[action] = { calls: 0, cost: 0 }
    byAction[action].calls++
    byAction[action].cost += cost
  }

  // Calculate projection
  const from = new Date(dateFrom)
  const to = new Date(dateTo)
  const days = Math.max(1, Math.ceil((to.getTime() - from.getTime()) / 86400000))
  const dailyAvg = totalCost / days
  const projectedMonthly = dailyAvg * 30

  return {
    totalCost,
    byModel,
    byAction,
    projectedMonthly,
    period: { from: dateFrom, to: dateTo, days },
  }
}

// ═══════════════════════════════════════
// CONTEXT WINDOW OPTIMIZATION
// ═══════════════════════════════════════

/**
 * Trim conversation messages to fit within token budget.
 * Keeps the most recent messages and summarizes older ones.
 *
 * @param messages - Array of message objects with content
 * @param maxMessages - Maximum recent messages to keep (default: 20)
 * @param summary - Optional summary of older messages
 */
export function trimMessagesForContext(
  messages: { direction: string; content: string; sent_by?: string | null }[],
  maxMessages = 20,
  summary?: string
): { recent: typeof messages; olderSummary: string | null } {
  if (messages.length <= maxMessages) {
    return { recent: messages, olderSummary: null }
  }

  const recent = messages.slice(-maxMessages)
  const olderCount = messages.length - maxMessages

  const olderSummary = summary || `[${olderCount} earlier messages omitted — use conversation summary for context]`

  return { recent, olderSummary }
}
