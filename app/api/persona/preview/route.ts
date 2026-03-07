import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { generate } from '@/lib/ai'

/**
 * GET /api/persona/preview — Fetch recent AI-generated messages.
 */
export async function GET() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data } = await supabase
    .from('messages')
    .select('content, created_at')
    .eq('direction', 'outbound')
    .eq('is_ai_generated', true)
    .order('created_at', { ascending: false })
    .limit(3)

  return NextResponse.json({ messages: data || [] })
}

/**
 * POST /api/persona/preview — Test persona with a sample message.
 * Body: { message, persona }
 * Returns AI-generated response(s) using current persona settings.
 */
export async function POST(req: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { message, persona } = await req.json()

  if (!message) {
    return NextResponse.json({ error: 'message required' }, { status: 400 })
  }

  const sr = persona.style_rules || {}
  const lr = persona.language_rules || {}

  // Build system prompt from persona settings
  const styleRuleLines: string[] = []
  if (sr.never_use_em_dash) styleRuleLines.push('Never use em dashes (— or --).')
  if (sr.vary_capitalization) styleRuleLines.push('Vary capitalization — don\'t always capitalize the first word of a message.')
  if (sr.use_casual_shortcuts) styleRuleLines.push('Use casual text shortcuts naturally: rn, lmk, ngl, tbh, bet, fr.')
  if (sr.multi_message_bursts) styleRuleLines.push(`Split responses into ${sr.max_messages_per_burst || 3} short messages instead of one long one.`)
  if (sr.match_lead_vibe) styleRuleLines.push('Match the lead\'s energy, formality, and communication style.')
  if (sr.imperfect_punctuation) styleRuleLines.push('Use imperfect punctuation — occasional missing periods, no excessive question marks.')
  if (sr.no_bullet_points) styleRuleLines.push('Never use bullet points or numbered lists in messages.')
  if (sr.variable_emoji) styleRuleLines.push('Only use emojis if the lead uses them, and match their frequency.')
  if (sr.use_contractions) styleRuleLines.push('Always use contractions (don\'t, won\'t, can\'t — never do not, will not, cannot).')
  if (sr.max_sentences_per_bubble) styleRuleLines.push(`Maximum ${sr.max_sentences_per_bubble} sentences per message.`)

  // Custom rules
  if (sr.custom_rules?.length > 0) {
    sr.custom_rules.forEach((r: string) => styleRuleLines.push(r))
  }

  // Prohibited phrases
  const prohibitedSection = sr.prohibited_phrases?.length > 0
    ? `\n\nNEVER use these phrases: ${sr.prohibited_phrases.map((p: string) => `"${p}"`).join(', ')}`
    : ''

  // Signature phrases
  const signatureSection = sr.signature_phrases?.length > 0
    ? `\n\nNaturally incorporate these signature phrases when appropriate: ${sr.signature_phrases.map((p: string) => `"${p}"`).join(', ')}`
    : ''

  const system = `${persona.base_prompt || 'You are a DM setter.'}

TONE: ${lr.tone || 'balanced'}
LANGUAGE: ${lr.primary_language || 'English'}${lr.accent_notes ? ` (${lr.accent_notes})` : ''}

WRITING STYLE RULES:
${styleRuleLines.map((r) => `- ${r}`).join('\n')}
${prohibitedSection}${signatureSection}

IMPORTANT: This is a DM conversation preview. Respond as you would in an Instagram DM. ${sr.multi_message_bursts ? 'Split your response into multiple short messages separated by |||.' : ''}`

  try {
    const response = await generate({
      model: 'sonnet',
      system,
      messages: [{ role: 'user', content: message }],
      maxTokens: 500,
      temperature: 0.8,
    })

    // Split on ||| for multi-message bursts
    const responses = response
      .split('|||')
      .map((s) => s.trim())
      .filter(Boolean)

    return NextResponse.json({ responses })
  } catch (err) {
    console.error('Persona preview error:', err)
    return NextResponse.json({ error: 'Failed to generate preview' }, { status: 500 })
  }
}
