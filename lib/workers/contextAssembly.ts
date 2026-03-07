import { createAdminClient } from '@/lib/supabase'
import { searchKnowledgeBase } from './ragSearch'
import type { KBChunk } from './ragSearch'
import type {
  Lead,
  Conversation,
  Message,
  PersonaSettings,
  AutopilotSettings,
  QualificationField,
} from '@/types'

export interface ContextPackage {
  lead: Lead
  conversation: Conversation
  messages: Message[]
  transcript: string
  persona: PersonaSettings | null
  autopilotSettings: AutopilotSettings | null
  qualificationFields: QualificationField[]
  missingFields: QualificationField[]
  collectedFields: Record<string, unknown>
  kbChunks: KBChunk[]
  currentDateTime: string
}

/**
 * Assembles full context for AI autopilot response generation.
 * Fetches all required data in parallel using Promise.all.
 */
export async function assembleContext(
  conversationId: string
): Promise<ContextPackage> {
  const supabase = createAdminClient()

  // First: get conversation to find lead_id
  const { data: conversation } = await supabase
    .from('conversations')
    .select('*')
    .eq('id', conversationId)
    .single()

  if (!conversation) {
    throw new Error(`Conversation not found: ${conversationId}`)
  }

  const conv = conversation as Conversation

  // Parallel fetch everything
  const [
    leadResult,
    messagesResult,
    personaResult,
    autopilotResult,
    qualFieldsResult,
  ] = await Promise.all([
    // Lead profile
    supabase
      .from('leads')
      .select('*')
      .eq('id', conv.lead_id)
      .single(),

    // Full conversation history
    supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('sent_at', { ascending: true }),

    // Persona settings (global)
    supabase
      .from('persona_settings')
      .select('*')
      .eq('is_global', true)
      .limit(1)
      .single(),

    // Autopilot settings
    supabase
      .from('autopilot_settings')
      .select('*')
      .limit(1)
      .single(),

    // All qualification fields
    supabase
      .from('qualification_fields')
      .select('*')
      .order('display_order', { ascending: true }),
  ])

  const lead = leadResult.data as Lead
  const messages = (messagesResult.data || []) as Message[]
  const persona = personaResult.data as PersonaSettings | null
  const autopilotSettings = autopilotResult.data as AutopilotSettings | null
  const qualificationFields = (qualFieldsResult.data || []) as QualificationField[]

  if (!lead) {
    throw new Error(`Lead not found for conversation: ${conversationId}`)
  }

  // Build transcript
  const transcript = messages
    .map((m) => {
      const sender =
        m.direction === 'inbound'
          ? `@${lead.username}`
          : m.sent_by === 'ai'
            ? 'Lars (AI)'
            : m.sent_by || 'Lars'
      return `${sender}: ${m.content}`
    })
    .join('\n')

  // Determine missing qualification fields
  const collectedFields = conv.qualified_fields_collected || {}
  const missingFields = qualificationFields.filter(
    (f) => !(f.field_key in collectedFields)
  )

  // RAG search — use last 3 inbound messages as query
  const lastInbound = messages
    .filter((m) => m.direction === 'inbound')
    .slice(-3)
    .map((m) => m.content)
    .join(' ')

  const kbChunks = lastInbound
    ? await searchKnowledgeBase(lastInbound, 5)
    : []

  return {
    lead,
    conversation: conv,
    messages,
    transcript,
    persona,
    autopilotSettings,
    qualificationFields,
    missingFields,
    collectedFields,
    kbChunks,
    currentDateTime: new Date().toISOString(),
  }
}
