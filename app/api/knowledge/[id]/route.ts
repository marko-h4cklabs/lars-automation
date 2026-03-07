import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { upsertDocument } from '@/lib/embedding'

/**
 * GET /api/knowledge/[id] — Get a single KB document with its chunks.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = params

  const { data: doc, error } = await supabase
    .from('kb_documents')
    .select('*')
    .eq('id', id)
    .single()

  if (error || !doc) {
    return NextResponse.json({ error: 'Document not found' }, { status: 404 })
  }

  // Fetch chunks for this document
  const { data: chunks } = await supabase
    .from('kb_documents')
    .select('id, title, content, embedding, created_at')
    .eq('file_type', 'chunk')
    .eq('file_url', id)
    .order('created_at', { ascending: true })

  return NextResponse.json({
    ...doc,
    char_count: doc.content.length,
    has_embedding: doc.embedding !== null || (chunks?.length || 0) > 0,
    chunks: (chunks || []).map((c: { id: string; title: string; content: string; embedding: number[] | null; created_at: string }) => ({
      id: c.id,
      title: c.title,
      char_count: c.content.length,
      has_embedding: c.embedding !== null,
    })),
  })
}

/**
 * PATCH /api/knowledge/[id] — Update a document.
 * Body: { title?, content?, type?, is_active? }
 * If content changes, re-chunks and re-embeds.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
  }

  const { id } = params
  const body = await req.json()

  // Fetch current doc
  const { data: existing } = await supabase
    .from('kb_documents')
    .select('title, content, type, is_active')
    .eq('id', id)
    .single()

  if (!existing) {
    return NextResponse.json({ error: 'Document not found' }, { status: 404 })
  }

  const contentChanged = body.content !== undefined && body.content !== existing.content
  const title = body.title ?? existing.title
  const content = body.content ?? existing.content
  const type = body.type ?? existing.type
  const is_active = body.is_active ?? existing.is_active

  if (contentChanged) {
    // Content changed: re-chunk and re-embed via upsertDocument
    try {
      await upsertDocument({ id, title, content, type, is_active })
      return NextResponse.json({ message: 'Document updated and re-embedded' })
    } catch (err) {
      console.error('KB update error:', err)
      return NextResponse.json({ error: 'Failed to update document' }, { status: 500 })
    }
  } else {
    // Only metadata changed: direct update
    const { error } = await supabase
      .from('kb_documents')
      .update({ title, type, is_active })
      .eq('id', id)

    // Also update chunks' is_active and type to match parent
    await supabase
      .from('kb_documents')
      .update({ is_active, type })
      .eq('file_type', 'chunk')
      .eq('file_url', id)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ message: 'Document updated' })
  }
}

/**
 * DELETE /api/knowledge/[id] — Delete a document and its chunks.
 */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
  }

  const { id } = params

  // Delete chunks first
  await supabase
    .from('kb_documents')
    .delete()
    .eq('file_type', 'chunk')
    .eq('file_url', id)

  // Delete parent
  const { error } = await supabase
    .from('kb_documents')
    .delete()
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ message: 'Document deleted' })
}
