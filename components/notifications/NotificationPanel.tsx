'use client'

import { useState } from 'react'
import { X, Flame, Calendar, Moon, AlertTriangle, Filter } from 'lucide-react'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'
import { useNotifications } from '@/hooks/useNotifications'
import { NotificationType } from '@/types'
import type { Notification } from '@/types'

interface NotificationPanelProps {
  open: boolean
  onClose: () => void
}

const typeFilters: { label: string; value: NotificationType | 'all' }[] = [
  { label: 'All', value: 'all' },
  { label: 'Hot', value: NotificationType.HotLead },
  { label: 'Booked', value: NotificationType.CallBooked },
  { label: 'DQ', value: NotificationType.Disqualified },
  { label: 'Offline', value: NotificationType.SetterOffline },
]

function groupByDate(notifications: Notification[]) {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const yesterday = new Date(today.getTime() - 86400000)

  const groups: { label: string; items: Notification[] }[] = [
    { label: 'TODAY', items: [] },
    { label: 'YESTERDAY', items: [] },
    { label: 'EARLIER', items: [] },
  ]

  for (const n of notifications) {
    const d = new Date(n.created_at)
    if (d >= today) {
      groups[0].items.push(n)
    } else if (d >= yesterday) {
      groups[1].items.push(n)
    } else {
      groups[2].items.push(n)
    }
  }

  return groups.filter((g) => g.items.length > 0)
}

export function NotificationPanel({ open, onClose }: NotificationPanelProps) {
  const { notifications, markAsRead, markAllAsRead } = useNotifications()
  const [activeFilter, setActiveFilter] = useState<NotificationType | 'all'>('all')

  if (!open) return null

  const filtered =
    activeFilter === 'all'
      ? notifications
      : notifications.filter((n) => n.type === activeFilter)

  const groups = groupByDate(filtered)

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40" onClick={onClose} />

      {/* Panel */}
      <div className="fixed top-0 right-0 h-full w-[320px] bg-[#0d0d0d] border-l border-[#1a1a1a] z-50 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#1a1a1a]">
          <h2 className="text-[#f0f0f0] font-mono text-xs uppercase tracking-wider">
            Notifications
          </h2>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-[#1a1a1a] transition-colors"
          >
            <X className="w-4 h-4 text-[#666]" />
          </button>
        </div>

        {/* Controls: mark all + filter */}
        <div className="px-4 py-2 border-b border-[#1a1a1a] flex items-center justify-between">
          <button
            onClick={markAllAsRead}
            className="text-[#00ff88] text-[13px] font-mono uppercase tracking-wider hover:text-[#00cc6a] transition-colors"
          >
            Mark all read
          </button>
          <Filter className="w-4 h-4 text-[#444]" />
        </div>

        {/* Type filters */}
        <div className="px-4 py-2 border-b border-[#1a1a1a] flex gap-1 flex-wrap">
          {typeFilters.map((f) => (
            <button
              key={f.value}
              onClick={() => setActiveFilter(f.value)}
              className={cn(
                'px-2 py-0.5 rounded text-xs font-mono uppercase tracking-wider transition-colors',
                activeFilter === f.value
                  ? 'bg-[#00ff88]/10 text-[#00ff88] border border-[#00ff88]/30'
                  : 'text-[#555] hover:text-[#888] border border-[#1a1a1a]'
              )}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Notifications list */}
        <ScrollArea className="flex-1">
          <div className="px-3 py-2">
            {groups.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12">
                <div className="text-[#222] mb-3">
                  <BellIcon className="w-8 h-8" />
                </div>
                <p className="text-[#444] font-mono text-xs">No notifications yet</p>
              </div>
            ) : (
              groups.map((group) => (
                <div key={group.label} className="mb-3">
                  <p className="text-[#333] text-xs font-mono uppercase tracking-widest px-2 py-1.5">
                    {group.label}
                  </p>
                  {group.items.map((n) => (
                    <NotificationItem
                      key={n.id}
                      notification={n}
                      onMarkRead={() => markAsRead(n.id)}
                    />
                  ))}
                </div>
              ))
            )}
          </div>
        </ScrollArea>
      </div>
    </>
  )
}

function NotificationItem({
  notification,
  onMarkRead,
}: {
  notification: Notification
  onMarkRead: () => void
}) {
  const icons: Record<string, React.ReactNode> = {
    hot_lead: <Flame className="w-3.5 h-3.5 text-[#ff4500]" />,
    call_booked: <Calendar className="w-3.5 h-3.5 text-[#00ff88]" />,
    setter_offline: <Moon className="w-3.5 h-3.5 text-[#666]" />,
    disqualified: <AlertTriangle className="w-3.5 h-3.5 text-[#666]" />,
  }

  const timeAgo = formatTimeAgo(notification.created_at)

  return (
    <button
      onClick={onMarkRead}
      className={cn(
        'flex items-start gap-3 px-2 py-2.5 rounded cursor-pointer transition-colors w-full text-left',
        notification.read ? 'opacity-60' : 'bg-[#111]',
        'hover:bg-[#1a1a1a]'
      )}
    >
      <div className="mt-0.5 shrink-0">
        {icons[notification.type] || icons.hot_lead}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[#f0f0f0] text-xs font-mono leading-relaxed">
          {notification.message}
        </p>
        <p className="text-[#444] text-[13px] font-mono mt-1">{timeAgo}</p>
      </div>
      {!notification.read && (
        <div className="w-1.5 h-1.5 rounded-full bg-[#00ff88] mt-1.5 shrink-0" />
      )}
    </button>
  )
}

function formatTimeAgo(dateStr: string): string {
  const now = Date.now()
  const then = new Date(dateStr).getTime()
  const diff = Math.floor((now - then) / 1000)

  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

function BellIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
      <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
    </svg>
  )
}
