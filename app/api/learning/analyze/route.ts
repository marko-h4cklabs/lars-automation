import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { generateJSON } from '@/lib/ai'

interface ConversationMessage {
  role: string
  content: string
  timestamp?: string
}

interface AnalysisResult {
  summary: string
  what_worked: string[]
  what_failed: string[]
  lessons_learned: string[]
  prompt_improvements: string[]
  kb_suggestions: { title: string; content: string; type: string }[]
  outcome_assessment: 'success' | 'failure' | 'partial'
  confidence: number
  patterns_detected: string[]
  recommended_stage_handling: Record<string, string>
}

/**
 * POST /api/learning/analyze — AI-analyze a training conversation.
 * Body: { conversationId } or { conversationData, title }
 */
export async function POST(req: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { conversationId, conversationData, title } = body as {
    conversationId?: string
    conversationData?: { messages: ConversationMessage[] }
    title?: string
  }

  let messages: ConversationMessage[] = []
  let convTitle = title || 'Untitled'
  const convId = conversationId

  // Fetch from DB if conversationId provided
  if (conversationId) {
    const { data: conv } = await supabase
      .from('training_conversations')
      .select('*')
      .eq('id', conversationId)
      .single()

    if (!conv) return NextResponse.json({ error: 'Conversation not found' }, { status: 404 })

    const convData = conv.conversation_data as { messages?: ConversationMessage[] }
    messages = convData?.messages || []
    convTitle = conv.title
  } else if (conversationData?.messages) {
    messages = conversationData.messages
  } else {
    return NextResponse.json({ error: 'conversationId or conversationData required' }, { status: 400 })
  }

  if (messages.length === 0) {
    return NextResponse.json({ error: 'No messages to analyze' }, { status: 400 })
  }

  // Fetch current persona for context
  const { data: persona } = await supabase
    .from('persona_settings')
    .select('base_prompt, style_rules')
    .eq('is_global', true)
    .limit(1)
    .single()

  // Build transcript
  const transcript = messages.map((m) => `[${m.role}]: ${m.content}`).join('\n')

  const systemPrompt = `You are an expert DM sales conversation analyst for a high-ticket fitness coaching business.
You analyze training conversations to extract actionable lessons that improve AI appointment-setting performance.

CURRENT AI PERSONA CONTEXT:
${persona?.base_prompt || 'No persona configured'}

STYLE RULES:
${persona?.style_rules ? JSON.stringify(persona.style_rules, null, 2) : 'None configured'}

CONVERSATION TITLE: ${convTitle}
CONVERSATION TRANSCRIPT:
${transcript}

Analyze this conversation deeply. Respond with JSON:
{
  "summary": "2-3 sentence summary of what happened",
  "what_worked": ["list of things that worked well in this conversation"],
  "what_failed": ["list of things that didn't work or could be improved"],
  "lessons_learned": ["actionable lessons for future conversations"],
  "prompt_improvements": ["specific suggestions to improve the AI system prompt"],
  "kb_suggestions": [{"title": "suggested KB article title", "content": "content to add", "type": "objection_handling|faq|technique"}],
  "outcome_assessment": "success|failure|partial",
  "confidence": 85,
  "patterns_detected": ["recurring patterns found (e.g. 'lead stalled at qualifying stage', 'strong rapport building')"],
  "recommended_stage_handling": {"stage_name": "how to handle this stage better based on this conversation"}
}

Be specific and actionable. Every suggestion should be something that can directly improve the AI's performance.`

  const result = await generateJSON<AnalysisResult>({
    model: 'sonnet',
    system: systemPrompt,
    messages: [{ role: 'user', content: 'Analyze this conversation. JSON only.' }],
    maxTokens: 2048,
    temperature: 0.4,
  })

  // Store analysis in audit log
  await supabase.from('audit_log').insert({
    actor: user.id,
    action: 'analyze',
    entity_type: 'training_conversation',
    entity_id: convId || null,
    metadata: {
      outcome_assessment: result.outcome_assessment,
      patterns_count: result.patterns_detected?.length || 0,
      kb_suggestions_count: result.kb_suggestions?.length || 0,
      prompt_improvements_count: result.prompt_improvements?.length || 0,
    },
  })

  // If we have a conversationId, auto-update the outcome if not already set
  if (convId && result.outcome_assessment) {
    await supabase
      .from('training_conversations')
      .update({ outcome: result.outcome_assessment })
      .eq('id', convId)
      .eq('outcome', 'partial') // Only update if still partial
  }

  return NextResponse.json({
    analysis: {
      summary: result.summary || '',
      whatWorked: result.what_worked || [],
      whatFailed: result.what_failed || [],
      lessonsLearned: result.lessons_learned || [],
      promptImprovements: result.prompt_improvements || [],
      kbSuggestions: result.kb_suggestions || [],
      outcomeAssessment: result.outcome_assessment || 'partial',
      confidence: result.confidence ?? 70,
      patternsDetected: result.patterns_detected || [],
      recommendedStageHandling: result.recommended_stage_handling || {},
    },
  })
}
