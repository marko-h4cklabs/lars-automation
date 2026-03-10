import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { invalidateCache } from '@/lib/cache'

/**
 * POST /api/autopilot/toggle
 * Toggles the global AI autopilot on/off.
 * Returns the new enabled state.
 */
export async function POST() {
  const supabase = await createServerSupabaseClient()
  const { data: { session } } = await supabase.auth.getSession()

  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Check admin role
  const { data: user } = await supabase
    .from('users')
    .select('role')
    .eq('id', session.user.id)
    .single()

  if (user?.role !== 'admin') {
    return NextResponse.json({ error: 'Admin only' }, { status: 403 })
  }

  // Get current state
  const { data: settings } = await supabase
    .from('autopilot_settings')
    .select('id, enabled')
    .limit(1)
    .single()

  if (!settings) {
    return NextResponse.json({ error: 'Autopilot settings not found' }, { status: 404 })
  }

  const newEnabled = !(settings.enabled ?? true)

  await supabase
    .from('autopilot_settings')
    .update({ enabled: newEnabled, updated_at: new Date().toISOString() })
    .eq('id', settings.id)

  // Bust cache so workers pick it up immediately
  invalidateCache('AUTOPILOT').catch(() => {})

  return NextResponse.json({ enabled: newEnabled })
}
