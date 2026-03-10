import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { upsertDocument } from '@/lib/embedding'

export const maxDuration = 60

interface ImportDocument {
  title: string
  content: string
  type: string
  file_type?: string
  folder_name: string
}

/**
 * POST /api/workers/bulk-import
 * Bulk import KB documents. Authenticated via x-import-secret header.
 * Body: { documents: ImportDocument[] } (max 20 per batch)
 */
export async function POST(req: NextRequest) {
  // Auth via shared secret
  const secret = req.headers.get('x-import-secret')
  if (!secret || secret !== process.env.IMPORT_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json()
  const documents: ImportDocument[] = body.documents

  if (!Array.isArray(documents) || documents.length === 0) {
    return NextResponse.json({ error: 'documents array is required' }, { status: 400 })
  }

  if (documents.length > 20) {
    return NextResponse.json({ error: 'Max 20 documents per batch' }, { status: 400 })
  }

  const supabase = createAdminClient()
  const results: { folder: string; id?: string; status: string; error?: string }[] = []
  let succeeded = 0
  let duplicates = 0
  let failed = 0

  for (const doc of documents) {
    try {
      // Dedup check: skip if a document with same title and type already exists
      const { data: existing } = await supabase
        .from('kb_documents')
        .select('id')
        .eq('title', doc.title)
        .eq('type', doc.type)
        .neq('file_type', 'chunk')
        .limit(1)

      if (existing && existing.length > 0) {
        duplicates++
        results.push({ folder: doc.folder_name, id: existing[0].id, status: 'duplicate' })
        continue
      }

      const id = await upsertDocument({
        title: doc.title,
        content: doc.content,
        type: doc.type,
        file_type: doc.file_type || null,
      })

      succeeded++
      results.push({ folder: doc.folder_name, id, status: 'created' })
    } catch (err) {
      failed++
      const message = err instanceof Error ? err.message : String(err)
      console.error(`[Bulk Import] Failed for ${doc.folder_name}:`, message)
      results.push({ folder: doc.folder_name, status: 'failed', error: message })
    }
  }

  return NextResponse.json({
    results,
    summary: { succeeded, duplicates, failed, total: documents.length },
  })
}
