import { createAdminClient } from '@/lib/supabase'
import { searchKnowledgeBase } from './ragSearch'
import type { KBChunk } from './ragSearch'
import {
  getAutopilotSettings,
  getPersonaSettings,
  getCachedKBSearch,
  setCachedKBSearch,
} from '@/lib/cache'
import { trimMessagesForContext } from '@/lib/ai-cost'
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
 * Uses Redis caching for settings and KB results.
 * Limits conversation history to last 20 messages for token efficiency.
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

  // Parallel fetch: DB queries + cached settings
  const [
    leadResult,
    messagesResult,
    persona,
    autopilotSettings,
    qualFieldsResult,
  ] = await Promise.all([
    // Lead profile
    supabase
      .from('leads')
      .select('*')
      .eq('id', conv.lead_id)
      .single(),

    // Conversation messages (limit to last 50 for DB efficiency)
    supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('sent_at', { ascending: true })
      .limit(50),

    // Persona settings (cached — 300s TTL)
    getPersonaSettings(),

    // Autopilot settings (cached — 60s TTL)
    getAutopilotSettings(),

    // All qualification fields
    supabase
      .from('qualification_fields')
      .select('*')
      .order('display_order', { ascending: true }),
  ])

  const lead = leadResult.data as Lead
  const allMessages = (messagesResult.data || []) as Message[]
  const qualificationFields = (qualFieldsResult.data || []) as QualificationField[]

  if (!lead) {
    throw new Error(`Lead not found for conversation: ${conversationId}`)
  }

  // Trim messages to last 20 for AI context (saves tokens)
  const { recent: messages, olderSummary } = trimMessagesForContext(
    allMessages,
    20,
    conv.summary || undefined
  )

  // Build transcript with optional summary prefix
  let transcript = ''
  if (olderSummary) {
    transcript += `[EARLIER CONTEXT]: ${olderSummary}\n\n`
  }
  transcript += messages
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

  // RAG search — use last 3 inbound messages as query (cached — 600s TTL)
  const lastInbound = allMessages
    .filter((m) => m.direction === 'inbound')
    .slice(-3)
    .map((m) => m.content)
    .join(' ')

  let kbChunks: KBChunk[] = []
  if (lastInbound) {
    // Check cache first
    const cached = await getCachedKBSearch<KBChunk[]>(lastInbound)
    if (cached) {
      kbChunks = cached
    } else {
      kbChunks = await searchKnowledgeBase(lastInbound, 5)
      await setCachedKBSearch(lastInbound, kbChunks)
    }
  }

  return {
    lead,
    conversation: conv,
    messages: allMessages, // Return all for downstream use
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
