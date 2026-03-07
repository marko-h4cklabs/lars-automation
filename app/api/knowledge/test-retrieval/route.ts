import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { searchSimilar } from '@/lib/embedding'

/**
 * POST /api/knowledge/test-retrieval — Test retrieval with a sample query.
 * Body: { query, category?, topK? }
 * Returns top matching KB chunks with similarity scores.
 */
export async function POST(req: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { query, category, topK } = await req.json()

  if (!query || typeof query !== 'string') {
    return NextResponse.json({ error: 'query string required' }, { status: 400 })
  }

  try {
    const results = await searchSimilar(query, topK || 5, category || undefined)

    return NextResponse.json({
      query,
      results: results.map((r) => ({
        id: r.id,
        title: r.title,
        content: r.content.slice(0, 500) + (r.content.length > 500 ? '...' : ''),
        type: r.type,
        similarity: Math.round(r.similarity * 100),
        parent_doc_id: r.parent_doc_id,
      })),
    })
  } catch (err) {
    console.error('Test retrieval error:', err)
    return NextResponse.json({ error: 'Retrieval failed' }, { status: 500 })
  }
}
