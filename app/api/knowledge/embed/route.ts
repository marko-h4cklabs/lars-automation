import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { createAdminClient } from '@/lib/supabase'
import { generateEmbedding, chunkText } from '@/lib/embedding'

/**
 * POST /api/knowledge/embed — Regenerate embeddings for a document.
 * Body: { id }
 * Generates embedding directly (bypassing upsertDocument) for clarity and diagnostics.
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

  // Use admin client for all DB operations (bypasses RLS)
  const admin = createAdminClient()

  const { data: doc, error: fetchErr } = await admin
    .from('kb_documents')
    .select('id, title, content, type, file_type, is_active')
    .eq('id', id)
    .single()

  if (fetchErr || !doc) {
    return NextResponse.json({ error: `Document not found: ${fetchErr?.message}` }, { status: 404 })
  }

  const steps: string[] = []

  try {
    // Step 1: Delete old chunks
    const { count: deletedChunks } = await admin
      .from('kb_documents')
      .delete({ count: 'exact' })
      .eq('file_type', 'chunk')
      .eq('file_url', id)
    steps.push(`Deleted ${deletedChunks || 0} old chunks`)

    // Step 2: Clear parent embedding
    await admin
      .from('kb_documents')
      .update({ embedding: null })
      .eq('id', id)
    steps.push('Cleared parent embedding')

    // Step 3: Chunk content
    const chunks = chunkText(doc.content, 1000)
    steps.push(`Content chunked into ${chunks.length} piece(s)`)

    if (chunks.length === 1) {
      // Short doc — embed directly on parent
      const embedding = await generateEmbedding(`${doc.title}\n\n${doc.content}`)
      steps.push(`Generated embedding: ${embedding.length} dimensions`)

      const { error: updateErr } = await admin
        .from('kb_documents')
        .update({ embedding })
        .eq('id', id)

      if (updateErr) {
        return NextResponse.json({
          error: `Failed to store embedding: ${updateErr.message}`,
          steps,
        }, { status: 500 })
      }
      steps.push('Stored embedding on parent doc')

      // Verify
      const { data: verify } = await admin
        .from('kb_documents')
        .select('embedding')
        .eq('id', id)
        .single()

      const hasEmbed = verify?.embedding !== null && verify?.embedding !== undefined
      steps.push(`Verification: embedding ${hasEmbed ? 'STORED' : 'MISSING'}`)

    } else {
      // Long doc — create chunks with embeddings
      for (let i = 0; i < chunks.length; i++) {
        const chunkTitle = `${doc.title} [${i + 1}/${chunks.length}]`
        const embedding = await generateEmbedding(`${chunkTitle}\n\n${chunks[i]}`)

        const { error: chunkErr } = await admin.from('kb_documents').insert({
          title: chunkTitle,
          content: chunks[i],
          type: doc.type,
          file_type: 'chunk',
          file_url: id,
          embedding,
          is_active: doc.is_active,
        })

        if (chunkErr) {
          steps.push(`Chunk ${i + 1} FAILED: ${chunkErr.message}`)
        } else {
          steps.push(`Chunk ${i + 1}/${chunks.length} embedded (${embedding.length} dims)`)
        }
      }
    }

    return NextResponse.json({ message: 'Embeddings regenerated', steps })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message, steps }, { status: 500 })
  }
}
