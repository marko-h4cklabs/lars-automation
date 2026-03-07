'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { createBrowserSupabaseClient } from '@/lib/supabase'
import { useAppStore } from '@/store/appStore'
import { NotificationType } from '@/types'
import type { Notification } from '@/types'

const BROWSER_NOTIFY_TYPES: NotificationType[] = [
  NotificationType.HotLead,
  NotificationType.CallBooked,
]

export function useNotifications() {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)
  const supabaseRef = useRef<ReturnType<typeof createBrowserSupabaseClient> | null>(null)
  const { setUnreadNotifications } = useAppStore()

  function getSupabase() {
    if (!supabaseRef.current) {
      supabaseRef.current = createBrowserSupabaseClient()
    }
    return supabaseRef.current
  }

  // Request browser notification permission on mount
  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      if (Notification.permission === 'default') {
        Notification.requestPermission()
      }
    }
  }, [])

  // Fetch notifications
  const fetchNotifications = useCallback(async () => {
    try {
      const supabase = getSupabase()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      const { data } = await supabase
        .from('notifications')
        .select('*')
        .or(`user_id.eq.${session.user.id},user_id.is.null`)
        .order('created_at', { ascending: false })
        .limit(50)

      if (data) {
        setNotifications(data as Notification[])
        const unread = data.filter((n: Notification) => !n.read).length
        setUnreadNotifications(unread)
      }
    } catch {
      // Silently fail
    } finally {
      setLoading(false)
    }
  }, [setUnreadNotifications])

  // Mark single notification as read
  const markAsRead = useCallback(async (id: string) => {
    const supabase = getSupabase()
    await supabase.from('notifications').update({ read: true }).eq('id', id)

    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    )
    setUnreadNotifications(
      notifications.filter((n) => !n.read && n.id !== id).length
    )
  }, [notifications, setUnreadNotifications])

  // Mark all as read
  const markAllAsRead = useCallback(async () => {
    const supabase = getSupabase()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return

    await supabase
      .from('notifications')
      .update({ read: true })
      .or(`user_id.eq.${session.user.id},user_id.is.null`)
      .eq('read', false)

    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
    setUnreadNotifications(0)
  }, [setUnreadNotifications])

  // Real-time subscription for new notifications
  useEffect(() => {
    fetchNotifications()

    const supabase = getSupabase()
    const channel = supabase
      .channel('notifications-hook')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications' },
        (payload) => {
          const notification = payload.new as Notification
          setNotifications((prev) => [notification, ...prev])

          // Show browser notification for HOT_LEAD and CALL_BOOKED only
          if (
            BROWSER_NOTIFY_TYPES.includes(notification.type as NotificationType) &&
            typeof window !== 'undefined' &&
            'Notification' in window &&
            Notification.permission === 'granted'
          ) {
            new Notification('BlackOps Alert', {
              body: notification.message,
              icon: '/favicon.ico',
            })
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [fetchNotifications])

  return {
    notifications,
    loading,
    markAsRead,
    markAllAsRead,
    refetch: fetchNotifications,
  }
}
