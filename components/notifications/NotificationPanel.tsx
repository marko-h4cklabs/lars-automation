'use client'

import { X, Flame, Calendar, Bot, Moon } from 'lucide-react'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'

interface NotificationPanelProps {
  open: boolean
  onClose: () => void
}

export function NotificationPanel({ open, onClose }: NotificationPanelProps) {
  if (!open) return null

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

        {/* Mark all read */}
        <div className="px-4 py-2 border-b border-[#1a1a1a]">
          <button className="text-[#00ff88] text-[10px] font-mono uppercase tracking-wider hover:text-[#00cc6a] transition-colors">
            Mark all read
          </button>
        </div>

        {/* Notifications list */}
        <ScrollArea className="flex-1">
          <div className="px-4 py-3">
            {/* Empty state */}
            <div className="flex flex-col items-center justify-center py-12">
              <div className="text-[#222] mb-3">
                <Bell className="w-8 h-8" />
              </div>
              <p className="text-[#444] font-mono text-xs">No notifications yet</p>
            </div>
          </div>
        </ScrollArea>
      </div>
    </>
  )
}

// Notification item component for future use
export function NotificationItem({
  type,
  message,
  time,
  read,
}: {
  type: string
  message: string
  time: string
  read: boolean
}) {
  const icons: Record<string, React.ReactNode> = {
    hot_lead: <Flame className="w-3.5 h-3.5 text-[#ff4500]" />,
    call_booked: <Calendar className="w-3.5 h-3.5 text-[#00ff88]" />,
    ai_takeover: <Bot className="w-3.5 h-3.5 text-amber-400" />,
    setter_offline: <Moon className="w-3.5 h-3.5 text-[#666]" />,
  }

  return (
    <div
      className={cn(
        'flex items-start gap-3 px-3 py-2.5 rounded cursor-pointer transition-colors',
        read ? 'opacity-60' : 'bg-[#111]',
        'hover:bg-[#1a1a1a]'
      )}
    >
      <div className="mt-0.5 shrink-0">{icons[type] || icons.hot_lead}</div>
      <div className="flex-1 min-w-0">
        <p className="text-[#f0f0f0] text-xs font-mono leading-relaxed">{message}</p>
        <p className="text-[#444] text-[10px] font-mono mt-1">{time}</p>
      </div>
      {!read && <div className="w-1.5 h-1.5 rounded-full bg-[#00ff88] mt-1.5 shrink-0" />}
    </div>
  )
}

// Re-export for the panel's empty state
function Bell(props: React.SVGProps<SVGSVGElement> & { className?: string }) {
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
