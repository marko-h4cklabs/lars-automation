import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { generateVoice, getVoiceSettings } from '@/lib/voice'

/**
 * POST /api/voice/generate — Generate a voice message from text.
 * Body: { text, settings? }
 * Returns: { audioUrl, durationMs }
 */
export async function POST(req: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { text, settings: overrides } = body

  if (!text || typeof text !== 'string') {
    return NextResponse.json({ error: 'text required' }, { status: 400 })
  }

  if (text.length > 5000) {
    return NextResponse.json({ error: 'Text too long (max 5000 chars)' }, { status: 400 })
  }

  try {
    // Merge stored settings with any overrides
    const storedSettings = await getVoiceSettings()
    const finalSettings = { ...storedSettings, ...overrides }

    const result = await generateVoice(text, finalSettings)

    return NextResponse.json({
      url: result.audioUrl,
      audioUrl: result.audioUrl,
      durationMs: result.durationMs,
    })
  } catch (err) {
    console.error('Voice generation error:', err)
    const message = err instanceof Error ? err.message : 'Generation failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
