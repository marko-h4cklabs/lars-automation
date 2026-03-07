import OpenAI from 'openai'
import { createAdminClient } from '@/lib/supabase'

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
  parent_doc_id: string | null
}

const CHARS_PER_TOKEN = 4
const CHUNK_OVERLAP_CHARS = 200

/**
 * Generate an embedding vector via OpenAI text-embedding-3-small (1536 dims).
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  const response = await getOpenAI().embeddings.create({
    model: 'text-embedding-3-small',
    input: text.slice(0, 8000 * CHARS_PER_TOKEN), // model max ~8k tokens
  })
  return response.data[0].embedding
}

/**
 * Split text into chunks of approximately maxTokens size.
 * Splits on paragraph boundaries first, then sentence boundaries.
 */
export function chunkText(text: string, maxTokens: number = 1000): string[] {
  const maxChars = maxTokens * CHARS_PER_TOKEN

  if (text.length <= maxChars) return [text]

  const paragraphs = text.split(/\n\n+/)
  const chunks: string[] = []
  let current = ''

  for (const para of paragraphs) {
    if (current.length + para.length + 2 > maxChars) {
      if (current.trim()) {
        chunks.push(current.trim())
      }
      // If a single paragraph exceeds maxChars, split by sentences
      if (para.length > maxChars) {
        const sentences = para.match(/[^.!?]+[.!?]+\s*/g) || [para]
        let sentBuf = ''
        for (const sent of sentences) {
          if (sentBuf.length + sent.length > maxChars) {
            if (sentBuf.trim()) chunks.push(sentBuf.trim())
            sentBuf = sent
          } else {
            sentBuf += sent
          }
        }
        current = sentBuf
      } else {
        current = para
      }
    } else {
      current += (current ? '\n\n' : '') + para
    }
  }

  if (current.trim()) chunks.push(current.trim())

  // Add overlap between chunks for better retrieval
  if (chunks.length > 1) {
    const overlapped: string[] = [chunks[0]]
    for (let i = 1; i < chunks.length; i++) {
      const prevTail = chunks[i - 1].slice(-CHUNK_OVERLAP_CHARS)
      overlapped.push(prevTail + '\n\n' + chunks[i])
    }
    return overlapped
  }

  return chunks
}

/**
 * Insert or update a KB document, chunk if needed, generate embeddings.
 * Parent doc stored with file_type as original type.
 * Chunks stored with file_type='chunk' and file_url=parent_id.
 */
export async function upsertDocument(doc: {
  id?: string
  title: string
  content: string
  type: string
  file_type?: string | null
  is_active?: boolean
}): Promise<string> {
  const supabase = createAdminClient()
  const isNew = !doc.id

  // Upsert the parent document (no embedding on parent if chunked)
  let parentId: string

  if (isNew) {
    const { data, error } = await supabase
      .from('kb_documents')
      .insert({
        title: doc.title,
        content: doc.content,
        type: doc.type,
        file_type: doc.file_type || null,
        is_active: doc.is_active ?? true,
      })
      .select('id')
      .single()
    if (error || !data) throw new Error(error?.message || 'Insert failed')
    parentId = data.id
  } else {
    parentId = doc.id!
    const { error } = await supabase
      .from('kb_documents')
      .update({
        title: doc.title,
        content: doc.content,
        type: doc.type,
        file_type: doc.file_type || null,
        is_active: doc.is_active ?? true,
        embedding: null, // clear old embedding on update
      })
      .eq('id', parentId)
    if (error) throw new Error(error.message)
  }

  // Delete existing chunks for this parent
  await supabase
    .from('kb_documents')
    .delete()
    .eq('file_type', 'chunk')
    .eq('file_url', parentId)

  // Chunk the content
  const chunks = chunkText(doc.content, 1000)

  if (chunks.length === 1) {
    // Short document — embed directly on the parent
    try {
      const embedding = await generateEmbedding(`${doc.title}\n\n${doc.content}`)
      await supabase
        .from('kb_documents')
        .update({ embedding })
        .eq('id', parentId)
    } catch (err) {
      console.error('Embedding failed for parent doc:', err)
    }
  } else {
    // Long document — create chunks with embeddings
    for (let i = 0; i < chunks.length; i++) {
      const chunkTitle = `${doc.title} [${i + 1}/${chunks.length}]`
      const chunkContent = chunks[i]

      let embedding: number[] | null = null
      try {
        embedding = await generateEmbedding(`${chunkTitle}\n\n${chunkContent}`)
      } catch (err) {
        console.error(`Embedding failed for chunk ${i + 1}:`, err)
      }

      await supabase.from('kb_documents').insert({
        title: chunkTitle,
        content: chunkContent,
        type: doc.type,
        file_type: 'chunk',
        file_url: parentId,
        embedding,
        is_active: doc.is_active ?? true,
      })
    }
  }

  return parentId
}

/**
 * Search for similar KB chunks/docs using pgvector cosine similarity.
 * Optionally filter by category (type).
 */
export async function searchSimilar(
  query: string,
  topK: number = 5,
  category?: string
): Promise<KBChunk[]> {
  const supabase = createAdminClient()

  let embedding: number[]
  try {
    embedding = await generateEmbedding(query)
  } catch (err) {
    console.error('Query embedding failed:', err)
    return []
  }

  // Fetch more than needed to allow for category filtering
  const fetchCount = category ? topK * 3 : topK

  const { data, error } = await supabase.rpc('match_kb_documents', {
    query_embedding: embedding,
    match_threshold: 0.3,
    match_count: fetchCount,
  })

  if (error || !data) {
    console.error('Similarity search failed:', error?.message)
    return []
  }

  type MatchRow = { id: string; title: string; content: string; type: string; similarity: number }

  let results = (data as MatchRow[]).map((row) => ({
    id: row.id,
    title: row.title,
    content: row.content,
    type: row.type,
    similarity: row.similarity,
    parent_doc_id: null as string | null,
  }))

  if (category) {
    results = results.filter((r) => r.type === category)
  }

  // For chunks, resolve parent_doc_id from file_url
  if (results.length > 0) {
    const ids = results.map((r) => r.id)
    const { data: docs } = await supabase
      .from('kb_documents')
      .select('id, file_url, file_type')
      .in('id', ids)

    if (docs) {
      const docMap = new Map(docs.map((d: { id: string; file_url: string | null; file_type: string | null }) => [d.id, d]))
      results = results.map((r) => {
        const doc = docMap.get(r.id)
        return {
          ...r,
          parent_doc_id: doc?.file_type === 'chunk' ? doc.file_url : null,
        }
      })
    }
  }

  return results.slice(0, topK)
}
