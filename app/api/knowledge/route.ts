import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { upsertDocument } from '@/lib/embedding'

/**
 * GET /api/knowledge — List all parent KB documents (excludes chunks).
 * Query params: type (filter by category), search (title search), active (true/false)
 */
export async function GET(req: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const url = req.nextUrl
  const type = url.searchParams.get('type')
  const search = url.searchParams.get('search')
  const active = url.searchParams.get('active')

  let query = supabase
    .from('kb_documents')
    .select('id, title, content, type, file_url, file_type, is_active, created_at, embedding')
    .or('file_type.neq.chunk,file_type.is.null') // exclude chunks but include docs with null file_type
    .order('created_at', { ascending: false })

  if (type && type !== 'all') {
    query = query.eq('type', type)
  }

  if (search) {
    query = query.ilike('title', `%${search}%`)
  }

  if (active === 'true') {
    query = query.eq('is_active', true)
  } else if (active === 'false') {
    query = query.eq('is_active', false)
  }

  const { data, error } = await query

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Count chunks per parent and compute metadata
  const parentIds = (data || []).map((d) => d.id)

  let chunkCounts: Record<string, number> = {}
  if (parentIds.length > 0) {
    const { data: chunks } = await supabase
      .from('kb_documents')
      .select('file_url')
      .eq('file_type', 'chunk')
      .in('file_url', parentIds)

    if (chunks) {
      chunkCounts = chunks.reduce((acc: Record<string, number>, c) => {
        acc[c.file_url] = (acc[c.file_url] || 0) + 1
        return acc
      }, {})
    }
  }

  const documents = (data || []).map((doc) => ({
    id: doc.id,
    title: doc.title,
    content: doc.content,
    type: doc.type,
    file_type: doc.file_type,
    is_active: doc.is_active,
    created_at: doc.created_at,
    char_count: doc.content.length,
    chunk_count: chunkCounts[doc.id] || 0,
    has_embedding: doc.embedding !== null || (chunkCounts[doc.id] || 0) > 0,
  }))

  return NextResponse.json({ documents })
}

/**
 * POST /api/knowledge — Create a new KB document.
 * Body: { title, content, type, file_type? }
 * Automatically generates embeddings and chunks.
 */
export async function POST(req: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Admin check
  const { data: profile } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
  }

  const body = await req.json()
  const { title, content, type, file_type } = body

  if (!title || !content || !type) {
    return NextResponse.json({ error: 'title, content, and type are required' }, { status: 400 })
  }

  try {
    console.log('[KB] Creating document:', { title, type, file_type, contentLength: content.length })
    const id = await upsertDocument({ title, content, type, file_type })
    console.log('[KB] Document created successfully:', id)
    return NextResponse.json({ id, message: 'Document created and embedded' })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[KB] Create failed:', message, err)
    return NextResponse.json({ error: `Failed to create document: ${message}` }, { status: 500 })
  }
}
