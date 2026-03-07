import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { generateJSON } from '@/lib/ai'
import { subDays, startOfDay, format } from 'date-fns'

interface WeeklyInsight {
  summary: string
  top_patterns: string[]
  improvement_areas: string[]
  wins: string[]
  prompt_recommendations: string[]
  kb_gaps: string[]
  performance_trend: 'improving' | 'stable' | 'declining'
  confidence: number
}

/**
 * GET /api/learning/insights — Generate or fetch weekly performance insights.
 * Query: ?period=week|month|custom&dateFrom=&dateTo=&refresh=true
 */
export async function GET(req: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const url = req.nextUrl
  const period = url.searchParams.get('period') || 'week'
  const refresh = url.searchParams.get('refresh') === 'true'
  const now = new Date()

  let dateFrom: string
  let dateTo: string

  if (period === 'month') {
    dateFrom = startOfDay(subDays(now, 30)).toISOString()
    dateTo = now.toISOString()
  } else if (period === 'custom') {
    dateFrom = url.searchParams.get('dateFrom') || startOfDay(subDays(now, 7)).toISOString()
    dateTo = url.searchParams.get('dateTo') || now.toISOString()
  } else {
    dateFrom = startOfDay(subDays(now, 7)).toISOString()
    dateTo = now.toISOString()
  }

  // Check for cached insight (generated within last 6 hours for same period)
  if (!refresh) {
    const { data: cached } = await supabase
      .from('audit_log')
      .select('metadata, created_at')
      .eq('action', 'insight_generated')
      .eq('entity_type', 'learning_insights')
      .gte('created_at', subDays(now, 0.25).toISOString()) // 6 hours
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (cached?.metadata) {
      const meta = cached.metadata as { insight?: WeeklyInsight; period?: string; dateFrom?: string; dateTo?: string; metrics?: Record<string, unknown> }
      if (meta.period === period) {
        return NextResponse.json({
          insight: meta.insight,
          metrics: meta.metrics,
          cached: true,
          generatedAt: cached.created_at,
        })
      }
    }
  }

  // Gather data for insight generation
  const [
    { count: totalConversations },
    { count: approvedTraining },
    { data: recentTraining },
    { data: feedbackActions },
    { count: totalBookings },
    { count: totalLeads },
    { data: aiSuggestions },
    { count: lostLeads },
  ] = await Promise.all([
    supabase.from('conversations').select('*', { count: 'exact', head: true }).gte('created_at', dateFrom).lte('created_at', dateTo),
    supabase.from('training_conversations').select('*', { count: 'exact', head: true }).eq('approved', true),
    supabase.from('training_conversations').select('title, outcome, feedback_notes, conversation_data').gte('created_at', dateFrom).order('created_at', { ascending: false }).limit(10),
    supabase.from('audit_log').select('action, metadata').in('action', ['suggestion_used', 'suggestion_rejected', 'suggestion_edited', 'booking_confirmed', 'lead_lost', 'stage_override', 'autopilot_override']).gte('created_at', dateFrom).lte('created_at', dateTo),
    supabase.from('leads').select('*', { count: 'exact', head: true }).not('calendly_booked_at', 'is', null).gte('calendly_booked_at', dateFrom).lte('calendly_booked_at', dateTo),
    supabase.from('leads').select('*', { count: 'exact', head: true }).gte('created_at', dateFrom).lte('created_at', dateTo),
    supabase.from('ai_suggestions').select('id, used, confidence').gte('created_at', dateFrom).lte('created_at', dateTo),
    supabase.from('leads').select('*', { count: 'exact', head: true }).eq('stage', 'lost').gte('updated_at', dateFrom).lte('updated_at', dateTo),
  ])

  // Calculate metrics
  const suggestionsUsed = aiSuggestions?.filter((s) => s.used).length || 0
  const suggestionsTotal = aiSuggestions?.length || 0
  const acceptanceRate = suggestionsTotal > 0 ? Math.round((suggestionsUsed / suggestionsTotal) * 100) : 0
  const bookingRate = (totalLeads || 0) > 0 ? Math.round(((totalBookings || 0) / (totalLeads || 0)) * 100) : 0

  const feedbackStats: Record<string, number> = {}
  for (const entry of feedbackActions || []) {
    feedbackStats[entry.action] = (feedbackStats[entry.action] || 0) + 1
  }

  // Build training data summary
  const trainingDigest = (recentTraining || []).map((t) => {
    const convData = t.conversation_data as { messages?: { role: string; content: string }[] }
    const msgCount = convData?.messages?.length || 0
    return `- "${t.title}" (${t.outcome}, ${msgCount} msgs)${t.feedback_notes ? `: ${t.feedback_notes}` : ''}`
  }).join('\n')

  const systemPrompt = `You are an AI performance analyst for a high-ticket fitness coaching DM automation platform.
Generate weekly insights based on the following data.

PERIOD: ${format(new Date(dateFrom), 'MMM d')} — ${format(new Date(dateTo), 'MMM d, yyyy')}

METRICS:
- Total conversations: ${totalConversations || 0}
- New leads: ${totalLeads || 0}
- Calls booked: ${totalBookings || 0}
- Booking rate: ${bookingRate}%
- Leads lost: ${lostLeads || 0}
- AI suggestions generated: ${suggestionsTotal}
- AI suggestions used: ${suggestionsUsed} (${acceptanceRate}% acceptance)
- Approved training conversations: ${approvedTraining || 0}
- Feedback events: ${JSON.stringify(feedbackStats)}

RECENT TRAINING CONVERSATIONS:
${trainingDigest || 'None available'}

Respond with JSON:
{
  "summary": "2-3 sentence executive summary of this period's performance",
  "top_patterns": ["top 3-5 patterns observed across conversations and feedback"],
  "improvement_areas": ["3-5 specific areas where the AI needs improvement"],
  "wins": ["2-4 things that went well this period"],
  "prompt_recommendations": ["2-4 specific prompt changes to improve performance"],
  "kb_gaps": ["knowledge base topics that are missing or need expansion"],
  "performance_trend": "improving|stable|declining",
  "confidence": 75
}

Be specific and data-driven. Reference actual numbers. Every recommendation should be actionable.`

  const insight = await generateJSON<WeeklyInsight>({
    model: 'sonnet',
    system: systemPrompt,
    messages: [{ role: 'user', content: 'Generate insights. JSON only.' }],
    maxTokens: 1536,
    temperature: 0.3,
  })

  const metrics = {
    totalConversations: totalConversations || 0,
    totalLeads: totalLeads || 0,
    totalBookings: totalBookings || 0,
    bookingRate,
    lostLeads: lostLeads || 0,
    suggestionsTotal,
    suggestionsUsed,
    acceptanceRate,
    approvedTraining: approvedTraining || 0,
    feedbackStats,
    dateFrom,
    dateTo,
  }

  // Cache the insight
  await supabase.from('audit_log').insert({
    actor: 'system',
    action: 'insight_generated',
    entity_type: 'learning_insights',
    entity_id: null,
    metadata: { insight, metrics, period },
  })

  return NextResponse.json({
    insight: {
      summary: insight.summary || '',
      topPatterns: insight.top_patterns || [],
      improvementAreas: insight.improvement_areas || [],
      wins: insight.wins || [],
      promptRecommendations: insight.prompt_recommendations || [],
      kbGaps: insight.kb_gaps || [],
      performanceTrend: insight.performance_trend || 'stable',
      confidence: insight.confidence ?? 70,
    },
    metrics,
    cached: false,
    generatedAt: now.toISOString(),
  })
}
