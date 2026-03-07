'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { createBrowserSupabaseClient } from '@/lib/supabase'
import type { User, UserStatus } from '@/types'

export function useUser() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const supabaseRef = useRef<ReturnType<typeof createBrowserSupabaseClient> | null>(null)

  function getSupabase() {
    if (!supabaseRef.current) {
      supabaseRef.current = createBrowserSupabaseClient()
    }
    return supabaseRef.current
  }

  const fetchUser = useCallback(async () => {
    try {
      const supabase = getSupabase()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) {
        setUser(null)
        setLoading(false)
        return
      }

      const { data } = await supabase
        .from('users')
        .select('*')
        .eq('id', session.user.id)
        .single()

      setUser(data as User | null)
    } catch {
      setUser(null)
    } finally {
      setLoading(false)
    }
  }, [])

  const updateStatus = useCallback(async (status: UserStatus | string) => {
    if (!user) return

    await getSupabase()
      .from('users')
      .update({ status, last_seen: new Date().toISOString() })
      .eq('id', user.id)

    setUser((prev) => prev ? { ...prev, status: status as UserStatus } : null)
  }, [user])

  useEffect(() => {
    const supabase = getSupabase()
    fetchUser()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (session) {
          fetchUser()
        } else {
          setUser(null)
        }
      }
    )

    return () => subscription.unsubscribe()
  }, [fetchUser])

  // Set online on mount, offline on tab close
  useEffect(() => {
    if (!user) return

    updateStatus('online')

    function handleBeforeUnload() {
      const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/users?id=eq.${user!.id}`
      const body = JSON.stringify({ status: 'offline', last_seen: new Date().toISOString() })
      navigator.sendBeacon(
        url,
        new Blob([body], { type: 'application/json' })
      )
    }

    function handleVisibilityChange() {
      if (document.visibilityState === 'hidden') {
        updateStatus('offline')
      } else if (document.visibilityState === 'visible') {
        updateStatus('online')
      }
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [user?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  return { user, loading, updateStatus, refetch: fetchUser }
}
