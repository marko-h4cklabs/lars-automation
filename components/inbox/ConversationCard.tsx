'use client'

import { cn } from '@/lib/utils'
import { LeadAvatar } from '@/components/ui/lead-avatar'
import { HeatScore } from '@/components/ui/heat-score'
import { Badge } from '@/components/ui/badge'
import type { Conversation, Lead, Message } from '@/types'

interface ConversationCardProps {
  conversation: Conversation & {
    lead: Lead
    last_message: Pick<Message, 'content' | 'direction' | 'sent_at' | 'type'> | null
    unread_count: number
  }
  isActive: boolean
  onClick: () => void
}

export function ConversationCard({ conversation, isActive, onClick }: ConversationCardProps) {
  const { lead, last_message, unread_count } = conversation

  const timeAgo = last_message
    ? formatTimeAgo(last_message.sent_at)
    : formatTimeAgo(conversation.updated_at)

  const preview = last_message
    ? `${last_message.direction === 'outbound' ? 'You: ' : ''}${last_message.content}`.slice(0, 50)
    : 'No messages yet'

  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full flex items-start gap-3 px-3 py-2.5 text-left transition-colors border-b border-[#111]',
        isActive ? 'bg-[#111] border-l-2 border-l-[#00ff88]' : 'hover:bg-[#0d0d0d]'
      )}
    >
      <LeadAvatar
        src={lead.profile_pic_url}
        name={lead.full_name || lead.username}
        size="md"
      />

      <div className="flex-1 min-w-0">
        {/* Top row: name + time */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="text-[#f0f0f0] text-xs font-mono font-bold truncate">
              @{lead.username}
            </span>
          </div>
          <span className="text-[#444] text-xs font-mono shrink-0">{timeAgo}</span>
        </div>

        {/* Full name */}
        {lead.full_name && (
          <p className="text-[#555] text-[13px] font-mono truncate">{lead.full_name}</p>
        )}

        {/* Message preview */}
        <p className={cn(
          'text-[13px] font-mono truncate mt-0.5',
          unread_count > 0 ? 'text-[#999]' : 'text-[#444]'
        )}>
          {preview}
        </p>

        {/* Bottom row: badges */}
        <div className="flex items-center gap-1.5 mt-1.5">
          <HeatScore score={lead.heat_score} size="sm" />
          <Badge variant="stage" className="text-[11px] py-0 px-1">
            {lead.stage.replace('_', ' ')}
          </Badge>
          <Badge variant="source" className="text-[11px] py-0 px-1">
            {lead.source}
          </Badge>
          {unread_count > 0 && (
            <span className="ml-auto w-4 h-4 bg-[#00ff88] rounded-full flex items-center justify-center text-[11px] font-mono text-black font-bold">
              {unread_count > 9 ? '9+' : unread_count}
            </span>
          )}
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
