import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

/**
 * GET /api/analytics — Full analytics payload for the dashboard.
 * Query: dateFrom (ISO), dateTo (ISO)
 */
export async function GET(req: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const url = req.nextUrl
  const dateFrom = url.searchParams.get('dateFrom') || new Date(Date.now() - 30 * 86400000).toISOString()
  const dateTo = url.searchParams.get('dateTo') || new Date().toISOString()

  const [
    totalDmsResult,
    callsOfferedResult,
    callsBookedResult,
    qualifiedResult,
    aiBookingsResult,
    setterBookingsResult,
    heatScoreResult,
    dailyMetricsResult,
    stageResult,
    setterPerfResult,
    funnelResult,
    bookingsBySourceResult,
    bookingsByHourResult,
    aiSuggestionsGenResult,
    aiSuggestionsUsedResult,
    activityNotifResult,
    activityAuditResult,
  ] = await Promise.all([
    // 1. Total inbound DMs in period
    supabase
      .from('messages')
      .select('*', { count: 'exact', head: true })
      .eq('direction', 'inbound')
      .gte('sent_at', dateFrom)
      .lte('sent_at', dateTo),

    // 2. Calls offered in period (leads that reached call_offered stage or beyond)
    supabase
      .from('leads')
      .select('*', { count: 'exact', head: true })
      .in('stage', ['call_offered', 'call_booked', 'showed', 'no_show', 'won'])
      .gte('created_at', dateFrom)
      .lte('created_at', dateTo),

    // 3. Calls booked in period
    supabase
      .from('leads')
      .select('*', { count: 'exact', head: true })
      .in('stage', ['call_booked', 'showed', 'no_show', 'won'])
      .gte('calendly_booked_at', dateFrom)
      .lte('calendly_booked_at', dateTo),

    // 4. Qualified leads in period (for booking rate denominator)
    supabase
      .from('leads')
      .select('*', { count: 'exact', head: true })
      .in('stage', ['qualifying', 'call_offered', 'call_booked', 'showed', 'no_show', 'won', 'lost'])
      .gte('created_at', dateFrom)
      .lte('created_at', dateTo),

    // 5. AI bookings
    supabase
      .from('leads')
      .select('*', { count: 'exact', head: true })
      .eq('assignment_type', 'ai')
      .in('stage', ['call_booked', 'showed', 'no_show', 'won'])
      .gte('calendly_booked_at', dateFrom)
      .lte('calendly_booked_at', dateTo),

    // 6. Setter bookings
    supabase
      .from('leads')
      .select('*', { count: 'exact', head: true })
      .neq('assignment_type', 'ai')
      .in('stage', ['call_booked', 'showed', 'no_show', 'won'])
      .gte('calendly_booked_at', dateFrom)
      .lte('calendly_booked_at', dateTo),

    // 7. Active leads heat scores (for avg)
    supabase
      .from('leads')
      .select('heat_score')
      .not('stage', 'in', '(won,lost,disqualified)'),

    // 8. Daily metrics (RPC)
    supabase.rpc('get_daily_metrics', { date_from: dateFrom, date_to: dateTo }),

    // 9. Stage distribution (all active leads)
    supabase
      .from('leads')
      .select('stage')
      .not('stage', 'in', '(won,lost,disqualified)'),

    // 10. Setter performance (RPC)
    supabase.rpc('get_setter_performance', { date_from: dateFrom, date_to: dateTo }),

    // 11. Funnel stats (RPC)
    supabase.rpc('get_funnel_stats', { date_from: dateFrom, date_to: dateTo }),

    // 12. Bookings by source
    supabase
      .from('leads')
      .select('source')
      .in('stage', ['call_booked', 'showed', 'no_show', 'won'])
      .gte('calendly_booked_at', dateFrom)
      .lte('calendly_booked_at', dateTo),

    // 13. Bookings by hour
    supabase
      .from('leads')
      .select('calendly_booked_at')
      .not('calendly_booked_at', 'is', null)
      .gte('calendly_booked_at', dateFrom)
      .lte('calendly_booked_at', dateTo),

    // 14. AI suggestions generated
    supabase
      .from('ai_suggestions')
      .select('*', { count: 'exact', head: true })
      .gte('generated_at', dateFrom)
      .lte('generated_at', dateTo),

    // 15. AI suggestions used
    supabase
      .from('ai_suggestions')
      .select('*', { count: 'exact', head: true })
      .eq('used', true)
      .gte('generated_at', dateFrom)
      .lte('generated_at', dateTo),

    // 16. Activity: notifications
    supabase
      .from('notifications')
      .select('id, type, message, lead_id, created_at')
      .order('created_at', { ascending: false })
      .limit(20),

    // 17. Activity: audit log
    supabase
      .from('audit_log')
      .select('id, action, entity_type, metadata, created_at')
      .order('created_at', { ascending: false })
      .limit(20),
  ])

  // ── Compute KPIs ──
  const totalDms = totalDmsResult.count || 0
  const callsOffered = callsOfferedResult.count || 0
  const callsBooked = callsBookedResult.count || 0
  const qualified = qualifiedResult.count || 0
  const aiBookings = aiBookingsResult.count || 0
  const setterBookings = setterBookingsResult.count || 0
  const bookingRate = qualified > 0 ? Math.round((callsBooked / qualified) * 1000) / 10 : 0

  const heatScores = (heatScoreResult.data || []) as { heat_score: number }[]
  const avgHeatScore = heatScores.length > 0
    ? Math.round(heatScores.reduce((sum, l) => sum + l.heat_score, 0) / heatScores.length)
    : 0

  // ── Daily metrics ──
  const dailyMetrics = ((dailyMetricsResult.data || []) as { day: string; inbound_dms: number; calls_booked: number }[]).map((r) => ({
    day: r.day,
    inboundDms: Number(r.inbound_dms),
    bookings: Number(r.calls_booked),
  }))

  // ── Stage distribution ──
  const stageDistribution: Record<string, number> = {}
  for (const row of (stageResult.data || []) as { stage: string }[]) {
    stageDistribution[row.stage] = (stageDistribution[row.stage] || 0) + 1
  }

  // ── Setter performance ──
  interface PerfRow {
    actor_id: string
    actor_name: string
    actor_type: string
    leads_assigned: number
    leads_replied: number
    leads_qualified: number
    leads_booked: number
    avg_response_seconds: number
  }
  const setterPerformance = ((setterPerfResult.data || []) as PerfRow[]).map((r) => ({
    id: r.actor_id,
    name: r.actor_name,
    type: r.actor_type,
    leads: Number(r.leads_assigned),
    replied: Number(r.leads_replied),
    qualified: Number(r.leads_qualified),
    booked: Number(r.leads_booked),
    convRate: Number(r.leads_assigned) > 0
      ? Math.round((Number(r.leads_booked) / Number(r.leads_assigned)) * 1000) / 10
      : 0,
    avgSpeed: Number(r.avg_response_seconds),
  }))

  // ── Funnel ──
  const funnelRaw = (funnelResult.data as { total_dms: number; replied: number; qualifying: number; call_offered: number; booked: number }[] | null)
  const funnel = funnelRaw && funnelRaw.length > 0
    ? {
        totalDms: Number(funnelRaw[0].total_dms),
        replied: Number(funnelRaw[0].replied),
        qualifying: Number(funnelRaw[0].qualifying),
        callOffered: Number(funnelRaw[0].call_offered),
        booked: Number(funnelRaw[0].booked),
      }
    : { totalDms: 0, replied: 0, qualifying: 0, callOffered: 0, booked: 0 }

  // ── Bookings by source ──
  const bookingsBySource: Record<string, number> = {}
  for (const row of (bookingsBySourceResult.data || []) as { source: string }[]) {
    bookingsBySource[row.source] = (bookingsBySource[row.source] || 0) + 1
  }

  // ── Bookings by hour ──
  const bookingsByHour = new Array(24).fill(0)
  for (const row of (bookingsByHourResult.data || []) as { calendly_booked_at: string }[]) {
    const hour = new Date(row.calendly_booked_at).getHours()
    bookingsByHour[hour]++
  }

  // ── AI metrics ──
  const aiGenerated = aiSuggestionsGenResult.count || 0
  const aiUsed = aiSuggestionsUsedResult.count || 0

  const aiMetrics = {
    generated: aiGenerated,
    used: aiUsed,
    usedRate: aiGenerated > 0 ? Math.round((aiUsed / aiGenerated) * 1000) / 10 : 0,
    copilotAccuracy: aiGenerated > 0 ? Math.round((aiUsed / aiGenerated) * 1000) / 10 : 0,
    autopilotBookingRate: aiBookings,
  }

  // ── Activity feed (merge notifications + audit, sort by date, take 20) ──
  const notifs = ((activityNotifResult.data || []) as { id: string; type: string; message: string; lead_id: string | null; created_at: string }[]).map((n) => ({
    id: n.id,
    type: n.type,
    message: n.message,
    leadId: n.lead_id,
    createdAt: n.created_at,
    source: 'notification' as const,
  }))

  const audits = ((activityAuditResult.data || []) as { id: string; action: string; entity_type: string; metadata: Record<string, unknown>; created_at: string }[]).map((a) => ({
    id: a.id,
    type: a.action,
    message: `${a.action} on ${a.entity_type}`,
    leadId: null as string | null,
    createdAt: a.created_at,
    source: 'audit' as const,
  }))

  const activityFeed = [...notifs, ...audits]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 20)

  return NextResponse.json({
    kpis: {
      totalDms,
      callsOffered,
      callsBooked,
      bookingRate,
      aiBookings,
      setterBookings,
      avgHeatScore,
    },
    dailyMetrics,
    stageDistribution,
    setterPerformance,
    funnel,
    bookingsBySource,
    bookingsByHour,
    aiMetrics,
    activityFeed,
  })
}
