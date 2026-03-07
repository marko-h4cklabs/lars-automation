import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { generateJSON } from '@/lib/ai'
import { assembleContext } from '@/lib/workers/contextAssembly'
import type { AISuggestionResponse } from '@/types'

export const maxDuration = 30

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createServerSupabaseClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const ctx = await assembleContext(id)

    const suggestions = await generateJSON<AISuggestionResponse>({
      model: 'sonnet',
      system: `You are a co-pilot for a high-ticket fitness coach's appointment setter.
Generate TWO response options for the setter to choose from.

Context:
- Lead: @${ctx.lead.username} (${ctx.lead.full_name || 'Unknown'})
- Stage: ${ctx.lead.stage} | Score: ${ctx.lead.heat_score}/100
- Missing qualifications: ${ctx.missingFields.map((f) => f.field_label).join(', ') || 'None'}

${ctx.kbChunks.length > 0 ? `Knowledge base:\n${ctx.kbChunks.map((c) => c.content).join('\n\n')}` : ''}

Style: Match the lead's energy. Keep messages short (1-2 sentences). Sound human, not scripted.

Respond with JSON:
{
  "option_a": {
    "messages": ["msg1", "msg2"],
    "confidence": 0.85,
    "reasoning": "brief strategy explanation",
    "targeting_field": "which qualification field this targets"
  },
  "option_b": {
    "messages": ["msg1"],
    "confidence": 0.70,
    "reasoning": "alternative approach",
    "targeting_field": "field name"
  },
  "context_summary": "1-sentence summary of where the conversation is",
  "recommended": "a"
}`,
      messages: [
        {
          role: 'user',
          content: `TRANSCRIPT:\n${ctx.transcript}\n\nGenerate two response options.`,
        },
      ],
      maxTokens: 1024,
      temperature: 0.8,
    })

    // Store suggestion in DB
    await supabase.from('ai_suggestions').insert({
      conversation_id: id,
      suggestion_1: JSON.stringify(suggestions.option_a),
      suggestion_2: JSON.stringify(suggestions.option_b),
      reasoning: suggestions.context_summary,
      confidence_score: suggestions.option_a.confidence,
      context_snapshot: { transcript_length: ctx.messages.length },
      used: false,
    })

    return NextResponse.json(suggestions)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
