import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

const DEFAULT_VOICE_SETTINGS = {
  voice_id: '',
  voice_name: 'Lars — Official',
  model_id: 'eleven_multilingual_v2',
  stability: 50,
  similarity_boost: 75,
  style: 0,
  use_speaker_boost: true,
  language_hint: 'en',
}

const DEFAULT_AUTO_VOICE = {
  mode: 'match',
  match_threshold_seconds: 30,
  max_length_seconds: 30,
  prefix_silence_ms: 300,
}

/**
 * GET /api/voice/settings — Fetch voice profile and auto-voice settings.
 */
export async function GET() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const [voiceResult, autoResult] = await Promise.all([
    supabase.from('app_settings').select('value').eq('key', 'voice_settings').single(),
    supabase.from('app_settings').select('value').eq('key', 'auto_voice_settings').single(),
  ])

  return NextResponse.json({
    voice: { ...DEFAULT_VOICE_SETTINGS, ...((voiceResult.data?.value || {}) as Record<string, unknown>) },
    auto: { ...DEFAULT_AUTO_VOICE, ...((autoResult.data?.value || {}) as Record<string, unknown>) },
  })
}

/**
 * PATCH /api/voice/settings — Update voice profile or auto-voice settings.
 * Body: { section: 'voice' | 'auto', ...settings }
 */
export async function PATCH(req: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Admin check
  const { data: profile } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
  }

  const body = await req.json()
  const { section, ...settings } = body

  const key = section === 'auto' ? 'auto_voice_settings' : 'voice_settings'

  // Load existing
  const { data: existing } = await supabase
    .from('app_settings')
    .select('value')
    .eq('key', key)
    .single()

  const merged = { ...((existing?.value || {}) as Record<string, unknown>), ...settings }

  if (existing) {
    await supabase.from('app_settings').update({ value: merged }).eq('key', key)
  } else {
    await supabase.from('app_settings').insert({ key, value: merged })
  }

  return NextResponse.json({ status: 'saved' })
}
