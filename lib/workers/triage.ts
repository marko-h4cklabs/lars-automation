import { generateJSON } from '@/lib/ai'
import type { AITriageResult, Message } from '@/types'

/**
 * AI Triage using Haiku 4 (fast, cheap).
 * Scores the lead and suggests next stage based on message + context.
 */
export async function triageLead(
  messageText: string,
  leadBio: string,
  conversationHistory: Message[],
  followerCount: number
): Promise<AITriageResult> {
  const historyText = conversationHistory
    .slice(-10)
    .map((m) => `[${m.direction}] ${m.content}`)
    .join('\n')

  const result = await generateJSON<AITriageResult>({
    model: 'haiku',
    system: `You are a lead scoring AI for a high-ticket fitness coaching business.

Analyze the incoming Instagram DM and rate the lead.

SCORING GUIDE:
- 0-20: Spam, bot, irrelevant (e.g., "hi", single emoji, self-promo)
- 21-40: Curious but unlikely buyer (browsing, no intent signals)
- 41-60: Warm — shows interest, asks questions about programs/pricing
- 61-79: Hot — expresses pain point, mentions budget/timeline, asks about calls
- 80-100: Fire — ready to buy, mentions specific goals + timeline + budget, asks to book

URGENCY:
- low: Can wait hours. Generic or low-intent messages
- medium: Should respond within 30 min. Shows genuine interest
- high: Respond ASAP. Booking intent, time-sensitive, or very high score

QUALIFICATION HINTS:
Extract any info about: age, location, occupation, fitness goals, timeline, budget.

SUGGESTED STAGE:
- 'new' — first contact, unclear intent
- 'contacted' — we've engaged, no qualification yet
- 'qualifying' — actively gathering info
- 'call_offered' — ready to offer a call
- 'disqualified' — clearly not a fit (spam, competitor, etc.)

Respond with JSON only:
{ "heat_score": number, "urgency": "low"|"medium"|"high", "qualification_hints": string[], "suggested_stage": string }`,
    messages: [
      {
        role: 'user',
        content: `LEAD BIO: ${leadBio || 'No bio'}
FOLLOWERS: ${followerCount}

CONVERSATION HISTORY:
${historyText || 'No prior messages'}

NEW MESSAGE: ${messageText}`,
      },
    ],
    maxTokens: 512,
    temperature: 0.3,
  })

  // Clamp heat_score to 0-100
  result.heat_score = Math.max(0, Math.min(100, result.heat_score))

  return result
}
