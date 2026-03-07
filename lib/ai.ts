import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
})

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
}

export async function generate({
  model,
  system,
  messages,
  maxTokens = 2048,
  temperature = 0.7,
}: GenerateOptions): Promise<string> {
  const response = await anthropic.messages.create({
    model: MODEL_MAP[model],
    max_tokens: maxTokens,
    temperature,
    system,
    messages,
  })

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

export { anthropic }
