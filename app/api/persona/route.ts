import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

/**
 * GET /api/persona — Fetch the global persona settings.
 */
export async function GET() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('persona_settings')
    .select('*')
    .eq('is_global', true)
    .limit(1)
    .single()

  if (error && error.code !== 'PGRST116') {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Return existing or default structure
  const defaults = {
    name: '',
    base_prompt: 'You are a world-class appointment setter working for a high-ticket fitness coach. Your job is to engage leads in genuine conversation, qualify them, and book them onto discovery calls.',
    style_rules: {
      never_use_em_dash: true,
      vary_capitalization: true,
      use_contractions: true,
      use_casual_shortcuts: true,
      multi_message_bursts: true,
      match_lead_vibe: true,
      imperfect_punctuation: true,
      no_bullet_points: true,
      max_sentences_per_bubble: 2,
      max_messages_per_burst: 3,
      burst_delay_ms: 1500,
      variable_emoji: true,
      max_emojis_per_burst: 2,
      prohibited_phrases: [
        'I understand your concerns',
        'Great question!',
        'As an AI...',
        "I'm unable to...",
        'I apologize for',
        'Thank you for your patience',
      ],
      signature_phrases: ['bro', 'listen', 'lowkey', 'for real though', 'ngl'],
      custom_rules: [],
      vibe_formality_matching: true,
      vibe_emoji_mirroring: true,
      vibe_length_matching: true,
      vibe_pace_matching: true,
    },
    language_rules: {
      tone: 'balanced',
      primary_language: 'English',
      accent_notes: '',
    },
    is_global: true,
  }

  if (!data) {
    return NextResponse.json(defaults)
  }

  // Merge defaults into existing data to fill any missing keys
  return NextResponse.json({
    ...defaults,
    ...data,
    style_rules: { ...defaults.style_rules, ...(data.style_rules || {}) },
    language_rules: { ...defaults.language_rules, ...(data.language_rules || {}) },
  })
}

/**
 * PATCH /api/persona — Update the global persona settings.
 * Body: Partial persona fields (name, base_prompt, style_rules, language_rules)
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

  // Get existing record
  const { data: existing } = await supabase
    .from('persona_settings')
    .select('id')
    .eq('is_global', true)
    .limit(1)
    .single()

  if (existing) {
    const { error } = await supabase
      .from('persona_settings')
      .update({
        name: body.name,
        base_prompt: body.base_prompt,
        style_rules: body.style_rules,
        language_rules: body.language_rules,
      })
      .eq('id', existing.id)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  } else {
    const { error } = await supabase
      .from('persona_settings')
      .insert({
        name: body.name,
        base_prompt: body.base_prompt,
        style_rules: body.style_rules,
        language_rules: body.language_rules,
        is_global: true,
      })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ status: 'saved' })
}
