import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

/**
 * GET /api/learning/feedback — Fetch feedback entries from audit_log.
 * Tracks: AI suggestion usage, booking signals, negative signals, stage overrides.
 * Query: ?type=all|suggestion_used|suggestion_rejected|booking_signal|negative_signal|stage_override&page=0&limit=30
 */
export async function GET(req: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const url = req.nextUrl
  const type = url.searchParams.get('type') || 'all'
  const page = parseInt(url.searchParams.get('page') || '0')
  const limit = parseInt(url.searchParams.get('limit') || '30')
  const dateFrom = url.searchParams.get('dateFrom')
  const dateTo = url.searchParams.get('dateTo')

  // Feedback actions tracked in audit_log
  const feedbackActions = [
    'suggestion_used',
    'suggestion_rejected',
    'suggestion_edited',
    'booking_confirmed',
    'lead_lost',
    'lead_disqualified',
    'stage_override',
    'message_sent',
    'autopilot_override',
  ]

  let query = supabase
    .from('audit_log')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(page * limit, (page + 1) * limit - 1)

  if (type !== 'all') {
    query = query.eq('action', type)
  } else {
    query = query.in('action', feedbackActions)
  }

  if (dateFrom) query = query.gte('created_at', dateFrom)
  if (dateTo) query = query.lte('created_at', dateTo)

  const { data, count, error } = await query

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Compute summary stats
  const summaryQuery = supabase
    .from('audit_log')
    .select('action')
    .in('action', feedbackActions)

  const dateFilteredQuery = dateFrom
    ? dateTo
      ? summaryQuery.gte('created_at', dateFrom).lte('created_at', dateTo)
      : summaryQuery.gte('created_at', dateFrom)
    : summaryQuery

  const { data: allActions } = await dateFilteredQuery

  const stats: Record<string, number> = {}
  for (const entry of allActions || []) {
    stats[entry.action] = (stats[entry.action] || 0) + 1
  }

  return NextResponse.json({
    entries: data || [],
    total: count || 0,
    page,
    hasMore: (count || 0) > (page + 1) * limit,
    stats,
  })
}

/**
 * POST /api/learning/feedback — Record a feedback event.
 * Body: { action, entityType, entityId, metadata }
 */
export async function POST(req: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { action, entityType, entityId, metadata } = body as {
    action: string
    entityType: string
    entityId?: string
    metadata?: Record<string, unknown>
  }

  if (!action || !entityType) {
    return NextResponse.json({ error: 'action and entityType required' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('audit_log')
    .insert({
      actor: user.id,
      action,
      entity_type: entityType,
      entity_id: entityId || null,
      metadata: metadata || {},
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ entry: data })
}
