'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Bell } from 'lucide-react'
import { cn } from '@/lib/utils'
import { NotificationPanel } from '@/components/notifications/NotificationPanel'
import { useNotifications } from '@/hooks/useNotifications'
import { NotificationType } from '@/types'

const SOUND_ENABLED_KEY = 'blackops:notification_sound'

// Notification types that trigger sound alerts
const SOUND_TYPES = new Set([
  NotificationType.HotLead,
  NotificationType.CallBooked,
])

export function NotificationBell() {
  const [panelOpen, setPanelOpen] = useState(false)
  const { notifications, loading } = useNotifications()
  const prevCountRef = useRef(0)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  const unreadCount = notifications.filter((n) => !n.read).length

  // Initialize audio element for notification sound
  useEffect(() => {
    if (typeof window === 'undefined') return
    const audio = new Audio()
    // Simple notification tone using data URI (short beep)
    audio.src = 'data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbsGUrIj2a2teleR0NRaLi7KV5JBhFq+3yl3EYEUu08O+OaxQRS7v07oVkEBNNwvjriV8MFU7F+OqGXAoYUMb66oNZCRpQxvvpgFYIHFDE/OZ9UwgfTsL+43lQCCJLv/7geE0IJ0i7/958SgksSrf+3HlHCjFIsP3ZdkULNkWs/NVyQgw7QKj70m4/DD8+pPvObDwNQz2g+8ppOg5IOJ381GY3D0s2kfnNYjURUDKM+MleMRNULoT4xFktFlgsffbAVSkZXyh298BRJhtjIn7yv04kH2ccdfC8TCAhahh17bpKIyRtE23ouUkm'
    audio.volume = 0.3
    audioRef.current = audio
  }, [])

  // Sound alert when new HOT_LEAD or CALL_BOOKED notification arrives
  useEffect(() => {
    if (loading) return

    const currentCount = unreadCount
    if (currentCount > prevCountRef.current && prevCountRef.current > 0) {
      // Check if the newest notification is a sound-worthy type
      const newest = notifications[0]
      if (newest && !newest.read && SOUND_TYPES.has(newest.type as NotificationType)) {
        playSoundIfEnabled()
      }
    }
    prevCountRef.current = currentCount
  }, [unreadCount, loading, notifications])

  const playSoundIfEnabled = useCallback(() => {
    if (typeof window === 'undefined') return
    const enabled = localStorage.getItem(SOUND_ENABLED_KEY) !== 'false'
    if (enabled && audioRef.current) {
      audioRef.current.play().catch(() => {
        // Browser may block autoplay — silently fail
      })
    }
  }, [])

  return (
    <>
      <button
        onClick={() => setPanelOpen((prev) => !prev)}
        className="relative p-2 rounded hover:bg-[#1a1a1a] transition-colors"
        aria-label="Notifications"
      >
        <Bell className={cn('w-4 h-4', unreadCount > 0 ? 'text-[#ccc]' : 'text-[#666]')} />

        {/* Unread badge */}
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 flex items-center justify-center">
            {/* Pulsing ring */}
            <span className="absolute w-4 h-4 rounded-full bg-[#ff4500]/40 animate-ping" />
            {/* Solid badge */}
            <span className="relative w-4 h-4 bg-[#ff4500] rounded-full flex items-center justify-center text-[8px] font-mono text-white font-bold">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          </span>
        )}
      </button>

      {/* Notification panel */}
      <NotificationPanel open={panelOpen} onClose={() => setPanelOpen(false)} />
    </>
  )
}
