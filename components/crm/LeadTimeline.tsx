'use client'

import { useState, useEffect } from 'react'
import {
  MessageSquare, ArrowRight, Phone, UserPlus, StickyNote, Bot, Loader2, Clock
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface TimelineEvent {
  id: string
  type: 'stage_change' | 'message_sent' | 'message_received' | 'call_booked' | 'assignment' | 'note' | 'first_contact' | 'ai_suggestion'
  title: string
  detail: string | null
  actor: string | null
  timestamp: string
}

interface LeadTimelineProps {
  leadId: string
}

const ICON_MAP: Record<string, typeof MessageSquare> = {
  stage_change: ArrowRight,
  message_sent: MessageSquare,
  message_received: MessageSquare,
  call_booked: Phone,
  assignment: UserPlus,
  note: StickyNote,
  first_contact: UserPlus,
  ai_suggestion: Bot,
}

const COLOR_MAP: Record<string, string> = {
  stage_change: 'text-[#f0a030]',
  message_sent: 'text-[#00ff88]',
  message_received: 'text-[#6688ff]',
  call_booked: 'text-[#00ff88]',
  assignment: 'text-[#888]',
  note: 'text-[#888]',
  first_contact: 'text-[#00ff88]',
  ai_suggestion: 'text-[#00ff88]',
}

export function LeadTimeline({ leadId }: LeadTimelineProps) {
  const [events, setEvents] = useState<TimelineEvent[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    fetch(`/api/leads/${leadId}/timeline`)
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (data?.events) setEvents(data.events)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [leadId])

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-4 justify-center">
        <Loader2 className="w-3 h-3 animate-spin text-[#444]" />
        <span className="text-[9px] font-mono text-[#444]">Loading timeline...</span>
      </div>
    )
  }

  if (events.length === 0) {
    return <p className="text-[10px] font-mono text-[#444] italic py-4 text-center">No events yet</p>
  }

  return (
    <div className="relative">
      {/* Vertical line */}
      <div className="absolute left-[7px] top-2 bottom-2 w-px bg-[#1a1a1a]" />

      <div className="space-y-3">
        {events.map((event) => {
          const Icon = ICON_MAP[event.type] || Clock
          const color = COLOR_MAP[event.type] || 'text-[#555]'

          return (
            <div key={event.id} className="flex items-start gap-3 relative">
              <div className={cn(
                'w-4 h-4 rounded-full bg-[#0a0a0a] border border-[#1a1a1a] flex items-center justify-center shrink-0 z-10',
                color
              )}>
                <Icon className="w-2.5 h-2.5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] font-mono text-[#ccc]">{event.title}</span>
                  <span className="text-[8px] font-mono text-[#333] shrink-0">
                    {formatEventTime(event.timestamp)}
                  </span>
                </div>
                {event.detail && (
                  <p className="text-[9px] font-mono text-[#555] mt-0.5 truncate">{event.detail}</p>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function formatEventTime(dateStr: string): string {
  const d = new Date(dateStr)
  const now = new Date()
  const diffDays = Math.floor((now.getTime() - d.getTime()) / 86400000)

  if (diffDays === 0) return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 7) return `${diffDays}d ago`
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}
