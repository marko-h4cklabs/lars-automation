import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { generateJSON } from '@/lib/ai'
import { assembleContext } from '@/lib/workers/contextAssembly'
import type { AISuggestionResponse, SetterAISettings } from '@/types'
import { buildStyleBlock } from '@/lib/promptStyle'

export const maxDuration = 30

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createServerSupabaseClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const userId = session.user.id

  // 1. Validate setter is assigned to this conversation
  const { data: conv } = await supabase
    .from('conversations')
    .select('id, assigned_to, lead_id')
    .eq('id', id)
    .single()

  if (!conv) return NextResponse.json({ error: 'Conversation not found' }, { status: 404 })

  // Admins can always access; setters must be assigned
  const { data: currentUser } = await supabase
    .from('users')
    .select('role')
    .eq('id', userId)
    .single()

  if (currentUser?.role === 'setter' && conv.assigned_to !== userId) {
    return NextResponse.json({ error: 'Not assigned to this conversation' }, { status: 403 })
  }

  try {
    // 2. Assemble context (same contextAssembly function as autopilot)
    const ctx = await assembleContext(id)

    // 3. Fetch setter-specific AI settings
    const { data: setterSettings } = await supabase
      .from('setter_ai_settings')
      .select('*')
      .eq('user_id', userId)
      .single()

    const settings = setterSettings as SetterAISettings | null

    // 4. Build enhanced system prompt
    const personaBlock = ctx.persona
      ? `\nPERSONA:\n${ctx.persona.base_prompt}\n${buildStyleBlock(ctx.persona.style_rules)}`
      : ''

    const kbBlock = ctx.kbChunks.length > 0
      ? `\nKNOWLEDGE BASE (use this info to answer lead questions accurately):\n${ctx.kbChunks.map((c) => c.content).join('\n\n')}`
      : ''

    const setterBlock = settings?.custom_prompt_additions
      ? `\nSETTER'S PERSONAL PREFERENCES:\n${settings.custom_prompt_additions}`
      : ''

    const collectedList = Object.entries(ctx.collectedFields)
      .map(([k, v]) => `  - ${k}: ${v}`)
      .join('\n')

    const missingList = ctx.missingFields
      .map((f) => `  - ${f.field_label} (key: ${f.field_key}, weight: ${f.weight})`)
      .join('\n')

    const qualBlock = `\nQUALIFICATION STATUS:
Collected (${Object.keys(ctx.collectedFields).length}/${ctx.qualificationFields.length}):
${collectedList || '  (none yet)'}
Missing:
${missingList || '  (all collected!)'}`

    const systemPrompt = `You are an expert AI assistant helping a human appointment setter.
You analyze ongoing Instagram DM conversations and generate 2 strategic response options.
${personaBlock}
${kbBlock}
${setterBlock}
${qualBlock}

CONVERSATION CONTEXT:
- Lead: @${ctx.lead.username} (${ctx.lead.full_name || 'Unknown'})
- Stage: ${ctx.lead.stage} | Heat Score: ${ctx.lead.heat_score}/100
- Followers: ${ctx.lead.follower_count || 'Unknown'}
- Source: ${ctx.lead.source}
- Bio: ${ctx.lead.bio || 'None'}
${ctx.lead.calendly_booked_at ? `- ALREADY BOOKED: ${ctx.lead.calendly_booked_at}` : '- Not yet booked'}

CONVERSATION ANALYSIS GUIDANCE:
- Analyze the lead's language patterns, engagement level, and buying signals
- Consider where they are in the funnel and what naturally comes next
- If they asked a question, make sure to answer it using KB info
- Detect objections and handle them smoothly
- If lead has gone cold (long gap), re-engage with value not pressure

Generate exactly 2 response options:
Option A: Continue rapport/qualifying naturally
Option B: More direct push toward booking (use when lead shows strong signals)

For each option, provide:
- The message(s) to send (1-3 messages, each short — 1-2 sentences)
- Confidence score 0-100
- Brief reasoning (1 sentence, shown to setter as tooltip)
- What qualification info this response is designed to elicit

Respond ONLY in this JSON format:
{
  "option_a": {
    "messages": ["msg1"],
    "confidence": 78,
    "reasoning": "Lead mentioned business — qualifying income indirectly",
    "targeting_field": "occupation"
  },
  "option_b": {
    "messages": ["msg1", "msg2"],
    "confidence": 65,
    "reasoning": "Strong buying signal — worth testing direct approach",
    "targeting_field": "call_booking"
  },
  "context_summary": "Lead is 40yo business owner, engaged 3 messages, hasn't mentioned budget",
  "recommended": "a"
}`

    // 5. Call Claude Sonnet 4
    const suggestions = await generateJSON<AISuggestionResponse>({
      model: 'sonnet',
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: `TRANSCRIPT:\n${ctx.transcript}\n\nGenerate two response options.`,
        },
      ],
      maxTokens: 1024,
      temperature: 0.8,
    })

    // 6. Store suggestion in ai_suggestions table
    const { data: inserted } = await supabase.from('ai_suggestions').insert({
      conversation_id: id,
      suggestion_1: JSON.stringify(suggestions.option_a),
      suggestion_2: JSON.stringify(suggestions.option_b),
      reasoning: suggestions.context_summary,
      confidence_score: Math.max(suggestions.option_a.confidence, suggestions.option_b.confidence),
      context_snapshot: {
        transcript_length: ctx.messages.length,
        setter_id: userId,
        missing_fields: ctx.missingFields.map((f) => f.field_key),
        lead_stage: ctx.lead.stage,
        heat_score: ctx.lead.heat_score,
      },
      used: false,
    }).select('id').single()

    return NextResponse.json({
      ...suggestions,
      suggestion_id: inserted?.id || null,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
