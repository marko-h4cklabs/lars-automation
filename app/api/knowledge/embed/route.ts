import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { upsertDocument } from '@/lib/embedding'

/**
 * POST /api/knowledge/embed — Regenerate embeddings for a document.
 * Body: { id }
 * Re-chunks and re-embeds the document content.
 */
export async function POST(req: NextRequest) {
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

  const { id } = await req.json()
  if (!id) return NextResponse.json({ error: 'Document id required' }, { status: 400 })

  // Fetch the document
  const { data: doc } = await supabase
    .from('kb_documents')
    .select('id, title, content, type, file_type, is_active')
    .eq('id', id)
    .single()

  if (!doc) return NextResponse.json({ error: 'Document not found' }, { status: 404 })

  try {
    await upsertDocument({
      id: doc.id,
      title: doc.title,
      content: doc.content,
      type: doc.type,
      file_type: doc.file_type,
      is_active: doc.is_active,
    })
    return NextResponse.json({ message: 'Embeddings regenerated successfully' })
  } catch (err) {
    console.error('Embedding regeneration error:', err)
    return NextResponse.json({ error: 'Failed to regenerate embeddings' }, { status: 500 })
  }
}
