'use client'

import { cn } from '@/lib/utils'
import { Mic, Image as ImageIcon, FileText, Zap } from 'lucide-react'
import type { Message } from '@/types'

interface MessageBubbleProps {
  message: Pick<Message, 'id' | 'content' | 'direction' | 'type' | 'sent_at' | 'ai_generated' | 'voice_url' | 'sent_by' | 'is_trigger_outbound' | 'trigger_type'>
  showTimestamp?: boolean
}

export function MessageBubble({ message, showTimestamp = true }: MessageBubbleProps) {
  const isOutbound = message.direction === 'outbound'

  // Trigger outbound messages render as compact orange alerts
  if (message.is_trigger_outbound) {
    return (
      <div className="flex w-full justify-center mb-2 animate-slide-in-up">
        <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#f0a030]/10 border border-[#f0a030]/20">
          <Zap className="w-2.5 h-2.5 text-[#f0a030]" />
          <span className="text-[9px] font-mono text-[#f0a030]">
            {message.trigger_type === 'keyword' ? 'Keyword trigger' : 'Auto-reply'} sent
          </span>
          <span className="text-[8px] font-mono text-[#f0a030]/60 truncate max-w-[200px]">
            {message.content}
          </span>
          {showTimestamp && (
            <span className="text-[7px] font-mono text-[#f0a030]/40 ml-1">
              {formatTime(message.sent_at)}
            </span>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className={cn('flex w-full mb-2 animate-slide-in-up', isOutbound ? 'justify-end' : 'justify-start')}>
      <div className={cn('max-w-[70%] flex flex-col', isOutbound ? 'items-end' : 'items-start')}>
        {/* Bubble */}
        <div
          className={cn(
            'rounded-lg px-3 py-2 text-xs font-mono leading-relaxed',
            isOutbound
              ? 'bg-[#00ff88]/10 text-[#d0ffd0] border border-[#00ff88]/20'
              : 'bg-[#151515] text-[#ccc] border border-[#1a1a1a]'
          )}
        >
          {message.type === 'voice' ? (
            <div className="flex items-center gap-2">
              <Mic className="w-3.5 h-3.5 text-[#00ff88] shrink-0" />
              <div className="flex-1">
                <div className="flex gap-0.5 items-center h-4">
                  {Array.from({ length: 20 }).map((_, i) => (
                    <div
                      key={i}
                      className="w-0.5 bg-[#00ff88]/40 rounded-full"
                      style={{ height: `${Math.random() * 12 + 4}px` }}
                    />
                  ))}
                </div>
                {message.content && (
                  <p className="text-[10px] text-[#666] mt-1 italic">{message.content}</p>
                )}
              </div>
            </div>
          ) : message.type === 'image' ? (
            <div className="flex items-center gap-2 text-[#666]">
              <ImageIcon className="w-3.5 h-3.5 shrink-0" />
              <span className="text-[10px]">[Image]</span>
            </div>
          ) : message.type === 'template' ? (
            <div className="flex items-start gap-2">
              <FileText className="w-3 h-3 text-[#555] shrink-0 mt-0.5" />
              <span>{message.content}</span>
            </div>
          ) : (
            <span>{message.content}</span>
          )}
        </div>

        {/* Timestamp */}
        {showTimestamp && (
          <span className="text-[8px] font-mono text-[#333] mt-0.5 px-1">
            {formatTime(message.sent_at)}
          </span>
        )}
      </div>
    </div>
  )
}

function formatTime(dateStr: string): string {
  const d = new Date(dateStr)
  const now = new Date()
  const isToday = d.toDateString() === now.toDateString()

  const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })

  if (isToday) return time
  return `${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} ${time}`
}
