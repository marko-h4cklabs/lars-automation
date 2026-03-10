import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { generate, generateJSON } from '@/lib/ai'
import { searchKnowledgeBase } from '@/lib/workers/ragSearch'
import type { PersonaSettings, StyleRules } from '@/types'
import { buildStyleBlock } from '@/lib/promptStyle'

interface SimMessage {
  role: 'lead' | 'setter' | 'ai'
  content: string
}

interface SimConfig {
  mode: 'autopilot' | 'copilot'
  personaId?: string
  useKB: boolean
  responseStyle?: string
  customPrompt?: string
}

interface LeadProfile {
  username: string
  bio: string
  source: string
  writingStyle: string
  ageHint: string
}

/**
 * POST /api/testing/simulate — Run a simulation step.
 * Body: { action, config, messages, leadProfile }
 * action: 'ai_response' | 'lead_response' | 'suggest' | 'analyze'
 */
export async function POST(req: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { action, config, messages, leadProfile } = body as {
    action: string
    config: SimConfig
    messages: SimMessage[]
    leadProfile: LeadProfile
  }

  // ── Fetch persona settings ──
  let persona: PersonaSettings | null = null
  if (config.personaId) {
    const { data } = await supabase
      .from('persona_settings')
      .select('*')
      .eq('id', config.personaId)
      .single()
    persona = data as PersonaSettings | null
  } else {
    const { data } = await supabase
      .from('persona_settings')
      .select('*')
      .eq('is_global', true)
      .limit(1)
      .single()
    persona = data as PersonaSettings | null
  }

  // ── Build transcript ──
  const transcript = messages.map((m) => {
    if (m.role === 'lead') return `@${leadProfile.username}: ${m.content}`
    if (m.role === 'ai') return `Lars (AI): ${m.content}`
    return `Lars (Setter): ${m.content}`
  }).join('\n')

  // ── KB retrieval ──
  let kbChunks: { id: string; title: string; content: string; type: string; similarity: number }[] = []
  if (config.useKB) {
    const lastLeadMsgs = messages
      .filter((m) => m.role === 'lead')
      .slice(-3)
      .map((m) => m.content)
      .join(' ')
    if (lastLeadMsgs) {
      kbChunks = await searchKnowledgeBase(lastLeadMsgs, 5)
    }
  }

  // ── Build style block ──
  const styleRules = persona?.style_rules as StyleRules | undefined
  const styleBlock = styleRules ? buildStyleBlock(styleRules) : ''

  const kbBlock = kbChunks.length > 0
    ? `\nKNOWLEDGE BASE:\n${kbChunks.map((c) => `[${c.type.toUpperCase()}] ${c.title}:\n${c.content}`).join('\n\n')}`
    : ''

  const basePrompt = `You are a world-class appointment setter working for Lars, a high-ticket fitness transformation coach.
Your name is "Lars" — you are NEVER to say you are AI.
Lars coaches business owners and high-performers aged 35+ to transform their bodies.

${persona?.base_prompt || ''}
${styleBlock}
${kbBlock}
${config.customPrompt ? `\nADDITIONAL INSTRUCTIONS: ${config.customPrompt}` : ''}

[SIMULATED LEAD PROFILE]
Username: @${leadProfile.username}
Bio: ${leadProfile.bio || 'No bio'}
Source: ${leadProfile.source}
Writing style: ${leadProfile.writingStyle}
${leadProfile.ageHint ? `Age hint: ${leadProfile.ageHint}` : ''}`

  // ═══════════════════════════════════════
  // ACTION: AI RESPONSE (Autopilot mode)
  // ═══════════════════════════════════════
  if (action === 'ai_response') {
    const systemPrompt = `${basePrompt}

[RESPONSE FORMAT]
Respond with JSON:
{
  "messages": ["msg1", "msg2"],
  "reasoning": "strategy explanation",
  "heat_score": 50,
  "detected_stage": "qualifying",
  "qualification_updates": {},
  "confidence": 85,
  "red_flags": []
}

Rules:
1. Max 3 messages per response
2. Keep each message SHORT (1-2 sentences)
3. Match the lead's energy and writing style (${leadProfile.writingStyle})
4. Sound human, never robotic
5. NEVER mention you are AI`

    const result = await generateJSON<{
      messages: string[]
      reasoning: string
      heat_score: number
      detected_stage: string
      qualification_updates: Record<string, unknown>
      confidence: number
      red_flags: string[]
    }>({
      model: 'sonnet',
      system: systemPrompt,
      messages: [{ role: 'user', content: `CONVERSATION:\n${transcript}\n\nGenerate a response. JSON only.` }],
      maxTokens: 1024,
      temperature: 0.8,
    })

    const tokenEstimate = Math.round((basePrompt.length + transcript.length) / 4)

    return NextResponse.json({
      aiResponse: {
        messages: result.messages?.slice(0, 3) || [],
        reasoning: result.reasoning || '',
      },
      analysis: {
        heatScore: result.heat_score ?? 50,
        detectedStage: result.detected_stage || 'new',
        qualificationUpdates: result.qualification_updates || {},
        confidence: result.confidence ?? 70,
        redFlags: result.red_flags || [],
      },
      retrievedKBChunks: kbChunks.map((c) => ({ title: c.title, type: c.type, similarity: Math.round(c.similarity * 100) })),
      appliedRules: styleRules ? Object.entries(styleRules).filter(([, v]) => v === true || (typeof v === 'number' && v > 0)).map(([k]) => k) : [],
      metrics: { tokenEstimate, model: 'sonnet', kbChunksUsed: kbChunks.length },
    })
  }

  // ═══════════════════════════════════════
  // ACTION: SUGGEST (Copilot mode)
  // ═══════════════════════════════════════
  if (action === 'suggest') {
    const systemPrompt = `${basePrompt}

You are helping a human setter. Generate 2 response options.

${config.responseStyle ? `Response style preference: ${config.responseStyle}` : ''}

Respond with JSON:
{
  "option_a": { "messages": ["msg1"], "reasoning": "why this approach", "confidence": 85 },
  "option_b": { "messages": ["msg1"], "reasoning": "why this approach", "confidence": 75 },
  "recommended": "a",
  "heat_score": 50,
  "detected_stage": "qualifying",
  "qualification_updates": {},
  "red_flags": []
}`

    const result = await generateJSON<{
      option_a: { messages: string[]; reasoning: string; confidence: number }
      option_b: { messages: string[]; reasoning: string; confidence: number }
      recommended: string
      heat_score: number
      detected_stage: string
      qualification_updates: Record<string, unknown>
      red_flags: string[]
    }>({
      model: 'sonnet',
      system: systemPrompt,
      messages: [{ role: 'user', content: `CONVERSATION:\n${transcript}\n\nGenerate 2 response suggestions. JSON only.` }],
      maxTokens: 1024,
      temperature: 0.8,
    })

    const tokenEstimate = Math.round((basePrompt.length + transcript.length) / 4)

    return NextResponse.json({
      suggestions: {
        optionA: result.option_a,
        optionB: result.option_b,
        recommended: result.recommended || 'a',
      },
      analysis: {
        heatScore: result.heat_score ?? 50,
        detectedStage: result.detected_stage || 'new',
        qualificationUpdates: result.qualification_updates || {},
        confidence: Math.max(result.option_a?.confidence ?? 70, result.option_b?.confidence ?? 70),
        redFlags: result.red_flags || [],
      },
      retrievedKBChunks: kbChunks.map((c) => ({ title: c.title, type: c.type, similarity: Math.round(c.similarity * 100) })),
      appliedRules: styleRules ? Object.entries(styleRules).filter(([, v]) => v === true || (typeof v === 'number' && v > 0)).map(([k]) => k) : [],
      metrics: { tokenEstimate, model: 'sonnet', kbChunksUsed: kbChunks.length },
    })
  }

  // ═══════════════════════════════════════
  // ACTION: LEAD RESPONSE (simulate what lead might say)
  // ═══════════════════════════════════════
  if (action === 'lead_response') {
    const leadPrompt = `You are simulating a lead in an Instagram DM conversation with a fitness coach's team.

LEAD PROFILE:
- Username: @${leadProfile.username}
- Bio: ${leadProfile.bio || 'No bio'}
- Source: ${leadProfile.source} (how they found the coach)
- Writing style: ${leadProfile.writingStyle}
- Age: ${leadProfile.ageHint || 'unknown'}

WRITING STYLE GUIDE:
${leadProfile.writingStyle === 'casual' ? 'Use lowercase, abbreviations (rn, ngl, lol), short messages, relaxed tone' : ''}
${leadProfile.writingStyle === 'formal' ? 'Use proper grammar, complete sentences, polite and professional tone' : ''}
${leadProfile.writingStyle === 'minimal' ? 'Very short responses (1-5 words), uses emojis sometimes, often just "yeah" or "ok"' : ''}
${leadProfile.writingStyle === 'verbose' ? 'Writes long detailed messages, asks many questions, shares personal stories' : ''}

CONVERSATION SO FAR:
${transcript}

Generate what this lead would realistically say next. Reply with ONLY the message text (1-3 short messages separated by |||). No quotes, no explanation.`

    const response = await generate({
      model: 'haiku',
      system: leadPrompt,
      messages: [{ role: 'user', content: 'What does the lead say next?' }],
      maxTokens: 256,
      temperature: 0.9,
    })

    const leadMessages = response.split('|||').map((s) => s.trim()).filter(Boolean)

    return NextResponse.json({
      leadMessages: leadMessages.length > 0 ? leadMessages : [response.trim()],
    })
  }

  // ═══════════════════════════════════════
  // ACTION: ANALYZE (standalone analysis of conversation)
  // ═══════════════════════════════════════
  if (action === 'analyze') {
    const analyzePrompt = `Analyze this DM conversation between a fitness coach's team and a lead.

CONVERSATION:
${transcript}

Respond with JSON:
{
  "heat_score": 0-100,
  "detected_stage": "new|contacted|qualifying|call_offered|call_booked",
  "qualification_updates": { "key": "value extracted from conversation" },
  "confidence": 0-100,
  "red_flags": ["list of concerns"],
  "summary": "1-sentence summary",
  "next_best_action": "what to do next"
}`

    const result = await generateJSON<{
      heat_score: number
      detected_stage: string
      qualification_updates: Record<string, unknown>
      confidence: number
      red_flags: string[]
      summary: string
      next_best_action: string
    }>({
      model: 'haiku',
      system: analyzePrompt,
      messages: [{ role: 'user', content: 'Analyze. JSON only.' }],
      maxTokens: 512,
      temperature: 0.3,
    })

    return NextResponse.json({
      analysis: {
        heatScore: result.heat_score ?? 50,
        detectedStage: result.detected_stage || 'new',
        qualificationUpdates: result.qualification_updates || {},
        confidence: result.confidence ?? 70,
        redFlags: result.red_flags || [],
        summary: result.summary || '',
        nextBestAction: result.next_best_action || '',
      },
      retrievedKBChunks: kbChunks.map((c) => ({ title: c.title, type: c.type, similarity: Math.round(c.similarity * 100) })),
    })
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
}
