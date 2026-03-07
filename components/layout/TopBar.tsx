'use client'

import { usePathname } from 'next/navigation'
import { Bell } from 'lucide-react'
import { cn } from '@/lib/utils'
import { UserMenu } from '@/components/auth/UserMenu'

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
  '/learning': 'Learning Center',
}

interface TopBarProps {
  onToggleNotifications: () => void
  unreadCount: number
}

export function TopBar({ onToggleNotifications, unreadCount }: TopBarProps) {
  const pathname = usePathname()

  const title = Object.entries(pageTitles).find(
    ([path]) => pathname === path || pathname?.startsWith(path + '/')
  )?.[1] || 'BlackOps'

  return (
    <header className="h-12 bg-[#0d0d0d] border-b border-[#1a1a1a] flex items-center justify-between px-5 shrink-0">
      {/* Page title */}
      <h1 className="text-[#f0f0f0] font-mono text-sm uppercase tracking-wider">
        {title}
      </h1>

      {/* Live metrics strip */}
      <div className="hidden lg:flex items-center gap-4 text-[10px] font-mono text-[#555] uppercase tracking-wider">
        <MetricPill label="Active Leads" value="--" />
        <span className="text-[#222]">|</span>
        <MetricPill label="Queued" value="--" />
        <span className="text-[#222]">|</span>
        <MetricPill label="Setters" value="--/--" />
        <span className="text-[#222]">|</span>
        <MetricPill label="AI" value="ON" valueColor="text-[#00ff88]" />
      </div>

      {/* Right side */}
      <div className="flex items-center gap-2">
        {/* Notification bell */}
        <button
          onClick={onToggleNotifications}
          className="relative p-2 rounded hover:bg-[#1a1a1a] transition-colors"
        >
          <Bell className="w-4 h-4 text-[#666]" />
          {unreadCount > 0 && (
            <span className="absolute top-1 right-1 w-4 h-4 bg-[#ff4500] rounded-full flex items-center justify-center text-[8px] font-mono text-white font-bold">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>

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
