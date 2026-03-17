'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { usePathname } from 'next/navigation'
import { Bell } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Tooltip } from '@/components/ui/tooltip'
import { UserMenu } from '@/components/auth/UserMenu'
import { useAppStore } from '@/store/appStore'
import type { LiveMetrics } from '@/types'

const pageTitles: Record<string, string> = {
  '/inbox': 'Inbox',
  '/crm': 'CRM Pipeline',
  '/dashboard': 'Dashboard',
  '/knowledge': 'Knowledge Base',
  '/persona': 'Persona',
  '/voice': 'Voice Studio',
  '/templates': 'Templates',
  '/settings': 'Settings',
  '/testing': 'Testing Ground',
}

interface TopBarProps {
  onToggleNotifications: () => void
  unreadCount: number
}

export function TopBar({ onToggleNotifications, unreadCount }: TopBarProps) {
  const pathname = usePathname()
  const isConnected = useAppStore((s) => s.isRealtimeConnected)
  const [metrics, setMetrics] = useState<LiveMetrics | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const [bellShake, setBellShake] = useState(false)
  const prevUnread = useRef(unreadCount)
  // Shake bell when unread count increases
  useEffect(() => {
    if (unreadCount > prevUnread.current) {
      setBellShake(true)
      const t = setTimeout(() => setBellShake(false), 400)
      return () => clearTimeout(t)
    }
    prevUnread.current = unreadCount
  }, [unreadCount])

  const title = Object.entries(pageTitles).find(
    ([path]) => pathname === path || pathname?.startsWith(path + '/')
  )?.[1] || 'BlackOps'

  const fetchMetrics = useCallback(async () => {
    try {
      const res = await fetch('/api/metrics/live')
      if (res.ok) {
        const data = await res.json()
        setMetrics(data)
      }
    } catch {
      // Silently fail
    }
  }, [])

  // Poll metrics every 30s
  useEffect(() => {
    fetchMetrics()
    intervalRef.current = setInterval(fetchMetrics, 30000)
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [fetchMetrics])

  return (
    <header className="h-12 bg-[#0d0d0d] border-b border-[#1a1a1a] flex items-center justify-between px-5 shrink-0">
      {/* Page title + connection status */}
      <div className="flex items-center gap-2.5">
        <h1 className="text-[#f0f0f0] font-mono text-sm uppercase tracking-wider">
          {title}
        </h1>
        <Tooltip content={isConnected ? 'Realtime connected' : 'Realtime disconnected'} side="bottom">
          <div
            className={cn(
              'w-1.5 h-1.5 rounded-full',
              isConnected ? 'bg-[#00ff88]' : 'bg-[#ff4500]'
            )}
          />
        </Tooltip>
      </div>

      {/* Live metrics strip */}
      <div className="hidden lg:flex items-center gap-4 text-[13px] font-mono text-[#555] uppercase tracking-wider">
        <MetricPill
          label="Active Leads"
          value={metrics ? String(metrics.activeLeads) : '--'}
        />
        <span className="text-[#222]">|</span>
        <MetricPill
          label="Queued"
          value={metrics ? String(metrics.queuedMessages) : '--'}
        />
        <span className="text-[#222]">|</span>
        <MetricPill
          label="Setters"
          value={
            metrics
              ? `${metrics.onlineSetters}/${metrics.totalSetters}`
              : '--/--'
          }
        />
        <span className="text-[#222]">|</span>
        <MetricPill
          label="Booked"
          value={metrics ? String(metrics.todayBooked) : '--'}
          valueColor="text-[#00ff88]"
        />
      </div>

      {/* Right side */}
      <div className="flex items-center gap-3">
        {/* Notification bell */}
        <Tooltip content="Notifications" side="bottom">
          <button
            onClick={onToggleNotifications}
            className="relative p-2 rounded hover:bg-[#1a1a1a] transition-colors"
          >
            <Bell className={cn('w-4 h-4 text-[#666]', bellShake && 'animate-shake')} />
          {unreadCount > 0 && (
            <span className="absolute top-1 right-1 w-4 h-4 bg-[#ff4500] rounded-full flex items-center justify-center text-[11px] font-mono text-white font-bold">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
          </button>
        </Tooltip>

        {/* User menu */}
        <UserMenu />
      </div>
    </header>
  )
}

function MetricPill({
  label,
  value,
  valueColor,
}: {
  label: string
  value: string
  valueColor?: string
}) {
  return (
    <span>
      {label}:{' '}
      <span className={cn('font-bold', valueColor || 'text-[#888]')}>{value}</span>
    </span>
  )
}
