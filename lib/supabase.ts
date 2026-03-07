import { createBrowserClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'

// ═══════════════════════════════════════
// Client-side Supabase client (React components, hooks)
// ═══════════════════════════════════════

export function createBrowserSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !key) {
    throw new Error('Missing Supabase environment variables')
  }

  return createBrowserClient(url, key)
}

// ═══════════════════════════════════════
// Admin client — service role key (bypasses RLS)
// For API routes, workers, background jobs
// ═══════════════════════════════════════

export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  )
}
