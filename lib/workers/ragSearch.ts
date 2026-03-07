import OpenAI from 'openai'
import { createAdminClient } from '@/lib/supabase'
import type { KBDocument } from '@/types'

let _openai: OpenAI | null = null
function getOpenAI() {
  if (!_openai) {
    _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! })
  }
  return _openai
}

export interface KBChunk {
  id: string
  title: string
  content: string
  type: string
  similarity: number
}

/**
 * Embeds query with OpenAI text-embedding-3-small, then runs
 * pgvector similarity search on kb_documents table.
 */
export async function searchKnowledgeBase(
  query: string,
  topK: number = 5
): Promise<KBChunk[]> {
  const supabase = createAdminClient()

  // Generate embedding for the query
  let embedding: number[]
  try {
    const response = await getOpenAI().embeddings.create({
      model: 'text-embedding-3-small',
      input: query,
    })
    embedding = response.data[0].embedding
  } catch (err) {
    console.error('Embedding generation failed:', err)
    // Fallback: return recent active KB docs without similarity search
    return fallbackSearch(supabase, topK)
  }

  // pgvector similarity search via Supabase RPC
  // This requires a Postgres function: match_kb_documents
  const { data, error } = await supabase.rpc('match_kb_documents', {
    query_embedding: embedding,
    match_threshold: 0.5,
    match_count: topK,
  })

  if (error || !data) {
    console.error('RAG search failed:', error?.message)
    return fallbackSearch(supabase, topK)
  }

  return (data as Array<KBDocument & { similarity: number }>).map((doc) => ({
    id: doc.id,
    title: doc.title,
    content: doc.content,
    type: doc.type,
    similarity: doc.similarity,
  }))
}

/**
 * Fallback: returns most recent active KB docs when vector search fails.
 */
async function fallbackSearch(
  supabase: ReturnType<typeof createAdminClient>,
  limit: number
): Promise<KBChunk[]> {
  const { data } = await supabase
    .from('kb_documents')
    .select('id, title, content, type')
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (!data) return []

  return (data as Pick<KBDocument, 'id' | 'title' | 'content' | 'type'>[]).map((doc) => ({
    id: doc.id,
    title: doc.title,
    content: doc.content,
    type: doc.type,
    similarity: 0,
  }))
}

/**
 * Generates and stores embedding for a KB document.
 * Called when documents are created/updated.
 */
export async function embedDocument(documentId: string): Promise<void> {
  const supabase = createAdminClient()

  const { data: doc } = await supabase
    .from('kb_documents')
    .select('id, title, content')
    .eq('id', documentId)
    .single()

  if (!doc) return

  const textToEmbed = `${doc.title}\n\n${doc.content}`

  const response = await getOpenAI().embeddings.create({
    model: 'text-embedding-3-small',
    input: textToEmbed,
  })

  await supabase
    .from('kb_documents')
    .update({ embedding: response.data[0].embedding })
    .eq('id', documentId)
}
