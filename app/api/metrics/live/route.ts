import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import type { LiveMetrics } from '@/types'

export async function GET() {
  const supabase = await createServerSupabaseClient()
  const { data: { session } } = await supabase.auth.getSession()

  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)
  const todayISO = todayStart.toISOString()

  // Run all queries in parallel
  const [
    activeLeadsResult,
    queuedResult,
    onlineSettersResult,
    totalSettersResult,
    autopilotResult,
    bookedResult,
    newLeadsResult,
  ] = await Promise.all([
    // Active leads (not won/lost/disqualified)
    supabase
      .from('leads')
      .select('*', { count: 'exact', head: true })
      .not('stage', 'in', '(won,lost,disqualified)'),

    // Queued messages (outbound messages sent today)
    supabase
      .from('messages')
      .select('*', { count: 'exact', head: true })
      .eq('direction', 'outbound')
      .gte('sent_at', todayISO),

    // Online setters
    supabase
      .from('users')
      .select('*', { count: 'exact', head: true })
      .eq('role', 'setter')
      .eq('status', 'online'),

    // Total setters
    supabase
      .from('users')
      .select('*', { count: 'exact', head: true })
      .eq('role', 'setter'),

    // Autopilot active check (reads enabled field)
    supabase
      .from('autopilot_settings')
      .select('id, enabled')
      .limit(1)
      .single(),

    // Today's booked calls
    supabase
      .from('leads')
      .select('*', { count: 'exact', head: true })
      .eq('stage', 'call_booked')
      .gte('calendly_booked_at', todayISO),

    // Today's new leads
    supabase
      .from('leads')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', todayISO),
  ])

  const metrics: LiveMetrics = {
    activeLeads: activeLeadsResult.count || 0,
    queuedMessages: queuedResult.count || 0,
    onlineSetters: onlineSettersResult.count || 0,
    totalSetters: totalSettersResult.count || 0,
    aiActive: !!(autopilotResult.data && (autopilotResult.data as { enabled?: boolean }).enabled !== false),
    todayBooked: bookedResult.count || 0,
    todayNewLeads: newLeadsResult.count || 0,
  }

  return NextResponse.json(metrics)
}
