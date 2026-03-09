import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { createAdminClient } from '@/lib/supabase'

/**
 * GET /api/debug/kb — Diagnose KB issues
 * Returns: user auth status, role, document count, OpenAI key status
 */
export async function GET() {
  const results: Record<string, unknown> = {}

  // 1. Check auth
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user }, error: authErr } = await supabase.auth.getUser()
    results.auth = user ? { id: user.id, email: user.email } : { error: authErr?.message || 'No user session' }

    // 2. Check user role
    if (user) {
      const { data: profile, error: profileErr } = await supabase
        .from('users')
        .select('role')
        .eq('id', user.id)
        .single()
      results.user_role = profile?.role || `NOT FOUND (${profileErr?.message})`
      results.is_admin = profile?.role === 'admin'
    }
  } catch (err) {
    results.auth_error = String(err)
  }

  // 3. Check env vars
  results.env = {
    OPENAI_API_KEY: process.env.OPENAI_API_KEY ? `set (${process.env.OPENAI_API_KEY.slice(0, 8)}...)` : 'MISSING',
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY ? 'set' : 'MISSING',
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL ? 'set' : 'MISSING',
  }

  // 4. Check KB documents via admin client
  try {
    const admin = createAdminClient()
    const { data, count, error } = await admin
      .from('kb_documents')
      .select('id, title, type, file_type, is_active, created_at', { count: 'exact' })
      .neq('file_type', 'chunk')
      .order('created_at', { ascending: false })
      .limit(5)

    results.kb_documents = {
      total_count: count,
      recent: data?.map(d => ({ id: d.id, title: d.title, type: d.type, created_at: d.created_at })),
      error: error?.message,
    }
  } catch (err) {
    results.kb_documents_error = String(err)
  }

  // 5. Test OpenAI embedding
  try {
    const { generateEmbedding } = await import('@/lib/embedding')
    const embedding = await generateEmbedding('test')
    results.openai_embedding = { status: 'success', dimensions: embedding.length }
  } catch (err) {
    results.openai_embedding = { status: 'failed', error: err instanceof Error ? err.message : String(err) }
  }

  return NextResponse.json(results)
}
