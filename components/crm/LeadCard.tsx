'use client'

import { LeadAvatar } from '@/components/ui/lead-avatar'
import { HeatScore } from '@/components/ui/heat-score'
import { Badge } from '@/components/ui/badge'
import { Bot, UserRound } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Lead } from '@/types'

interface LeadCardProps {
  lead: Lead & {
    last_message?: { content: string; sent_at: string; direction: string } | null
    conversation?: { qualification_score: number; assigned_to: string | null } | null
  }
  onClick: () => void
  isDragging?: boolean
}

export function LeadCard({ lead, onClick, isDragging }: LeadCardProps) {
  const isAI = lead.assignment_type === 'ai'
  const preview = lead.last_message
    ? `${lead.last_message.direction === 'outbound' ? 'You: ' : ''}${lead.last_message.content}`.slice(0, 60)
    : 'No messages'

  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full text-left p-2.5 rounded-lg border transition-all',
        isDragging
          ? 'bg-[#00ff88]/5 border-[#00ff88]/30 shadow-lg shadow-[#00ff88]/10'
          : 'bg-[#0d0d0d] border-[#1a1a1a] hover:border-[#333]'
      )}
    >
      <div className="flex items-start gap-2.5">
        <LeadAvatar
          src={lead.profile_pic_url}
          name={lead.full_name || lead.username}
          size="sm"
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-1">
            <div className="flex items-center gap-1 min-w-0">
              <span className="text-[11px] font-mono font-bold text-[#f0f0f0] truncate">
                @{lead.username}
              </span>
              {isAI ? (
                <Bot className="w-2.5 h-2.5 text-[#00ff88] shrink-0" />
              ) : (
                <UserRound className="w-2.5 h-2.5 text-[#555] shrink-0" />
              )}
            </div>
            <HeatScore score={lead.heat_score} size="sm" />
          </div>
          <p className="text-[9px] font-mono text-[#555] truncate mt-0.5">{preview}</p>
          <div className="flex items-center gap-1 mt-1">
            <Badge variant="source" className="text-[7px] py-0 px-1">{lead.source}</Badge>
            {lead.last_message?.sent_at && (
              <span className="text-[7px] font-mono text-[#333] ml-auto">
                {formatTimeAgo(lead.last_message.sent_at)}
              </span>
            )}
          </div>
        </div>
      </div>
    </button>
  )
}

function formatTimeAgo(dateStr: string): string {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000)
  if (diff < 60) return 'now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`
  return `${Math.floor(diff / 86400)}d`
}
