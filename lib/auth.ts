import { createServerSupabaseClient } from '@/lib/supabase-server'
import { createBrowserSupabaseClient } from '@/lib/supabase'
import type { User } from '@/types'

// Server-side: get current Supabase auth session
export async function getSession() {
  const supabase = await createServerSupabaseClient()
  const { data: { session }, error } = await supabase.auth.getSession()
  if (error || !session) return null
  return session
}

// Server-side: get current user with role from our users table
export async function getCurrentUser(): Promise<User | null> {
  const supabase = await createServerSupabaseClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.user) return null

  const { data: user } = await supabase
    .from('users')
    .select('*')
    .eq('id', session.user.id)
    .single()

  return user as User | null
}

// Client-side: sign out
export async function signOut() {
  const supabase = createBrowserSupabaseClient()
  await supabase.auth.signOut()
}
