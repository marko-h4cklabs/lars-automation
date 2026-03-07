import Anthropic from '@anthropic-ai/sdk'
import { logAIUsage, estimateTokens } from '@/lib/ai-cost'

let _anthropic: Anthropic | null = null
function getAnthropic() {
  if (!_anthropic) {
    _anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })
  }
  return _anthropic
}

export type AIModel = 'sonnet' | 'haiku'

const MODEL_MAP: Record<AIModel, string> = {
  sonnet: 'claude-sonnet-4-20250514',
  haiku: 'claude-haiku-4-5-20251001',
}

interface GenerateOptions {
  model: AIModel
  system: string
  messages: { role: 'user' | 'assistant'; content: string }[]
  maxTokens?: number
  temperature?: number
  // Optional context for cost tracking
  action?: string
  conversationId?: string
  leadId?: string
}

export async function generate({
  model,
  system,
  messages,
  maxTokens = 2048,
  temperature = 0.7,
  action,
  conversationId,
  leadId,
}: GenerateOptions): Promise<string> {
  const response = await getAnthropic().messages.create({
    model: MODEL_MAP[model],
    max_tokens: maxTokens,
    temperature,
    system,
    messages,
  })

  // Log token usage for cost tracking
  if (action) {
    const inputTokens = response.usage?.input_tokens || estimateTokens(system + messages.map((m) => m.content).join(''))
    const outputTokens = response.usage?.output_tokens || 0

    logAIUsage({
      model,
      action,
      inputTokens,
      outputTokens,
      conversationId,
      leadId,
    })
  }

  const block = response.content[0]
  if (block.type === 'text') {
    return block.text
  }
  throw new Error('Unexpected response type from Claude API')
}

export async function generateJSON<T>(options: GenerateOptions): Promise<T> {
  const text = await generate(options)
  // Extract JSON from response (handles markdown code blocks)
  const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/) || [null, text]
  const jsonStr = jsonMatch[1]?.trim() || text.trim()
  return JSON.parse(jsonStr) as T
}

export { getAnthropic as anthropic }
