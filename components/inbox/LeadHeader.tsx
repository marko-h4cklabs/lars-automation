'use client'

import { useState } from 'react'
import { LeadAvatar } from '@/components/ui/lead-avatar'
import { HeatScore } from '@/components/ui/heat-score'
import { Badge } from '@/components/ui/badge'
import { Bot, UserRound, ChevronDown, Phone } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Lead, LeadStage, Conversation } from '@/types'

interface LeadHeaderProps {
  lead: Lead
  conversation: Conversation
  onTransfer: () => void
  onStageChange: (stage: LeadStage) => void
}

const STAGES: { value: LeadStage; label: string }[] = [
  { value: 'new' as LeadStage, label: 'New' },
  { value: 'contacted' as LeadStage, label: 'Contacted' },
  { value: 'qualifying' as LeadStage, label: 'Qualifying' },
  { value: 'call_offered' as LeadStage, label: 'Call Offered' },
  { value: 'call_booked' as LeadStage, label: 'Call Booked' },
  { value: 'showed' as LeadStage, label: 'Showed' },
  { value: 'no_show' as LeadStage, label: 'No Show' },
  { value: 'won' as LeadStage, label: 'Won' },
  { value: 'lost' as LeadStage, label: 'Lost' },
  { value: 'disqualified' as LeadStage, label: 'Disqualified' },
]

export function LeadHeader({ lead, onTransfer, onStageChange }: LeadHeaderProps) {
  const [stageOpen, setStageOpen] = useState(false)
  const isAI = lead.assignment_type === 'ai'
  const isUnassigned = !lead.assignment_type || lead.assignment_type === 'unassigned'

  return (
    <div className="flex items-center gap-3 px-4 py-3 bg-[#0a0a0a] border-b border-[#1a1a1a]">
      <LeadAvatar
        src={lead.profile_pic_url}
        name={lead.full_name || lead.username}
        size="lg"
      />

      {/* Lead info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-[#f0f0f0] text-sm font-mono font-bold truncate">
            @{lead.username}
          </span>
          {isAI ? (
            <Badge variant="ai" className="text-[8px] py-0 px-1.5 gap-0.5">
              <Bot className="w-2.5 h-2.5" />
              AUTOPILOT
            </Badge>
          ) : isUnassigned ? (
            <Badge variant="default" className="text-[8px] py-0 px-1.5 gap-0.5 bg-[#f0a030]/20 text-[#f0a030] border-[#f0a030]/30">
              UNASSIGNED
            </Badge>
          ) : (
            <Badge variant="default" className="text-[8px] py-0 px-1.5 gap-0.5">
              <UserRound className="w-2.5 h-2.5" />
              HUMAN
            </Badge>
          )}
        </div>
        {lead.full_name && (
          <p className="text-[#555] text-[10px] font-mono truncate">{lead.full_name}</p>
        )}
        <div className="flex items-center gap-2 mt-1">
          <HeatScore score={lead.heat_score} size="sm" />
          <span className="text-[#444] text-[9px] font-mono">
            {lead.follower_count ? `${(lead.follower_count / 1000).toFixed(1)}k followers` : ''}
          </span>
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-2 shrink-0">
        {/* Stage selector */}
        <div className="relative">
          <button
            onClick={() => setStageOpen(!stageOpen)}
            className="flex items-center gap-1 px-2 py-1 bg-[#111] border border-[#222] rounded text-[9px] font-mono text-[#888] hover:text-[#ccc] transition-colors"
          >
            {lead.stage.replace('_', ' ').toUpperCase()}
            <ChevronDown className="w-2.5 h-2.5" />
          </button>
          {stageOpen && (
            <div className="absolute right-0 top-full mt-1 bg-[#111] border border-[#222] rounded shadow-xl z-50 min-w-[140px]">
              {STAGES.map((s) => (
                <button
                  key={s.value}
                  onClick={() => {
                    onStageChange(s.value)
                    setStageOpen(false)
                  }}
                  className={cn(
                    'w-full text-left px-3 py-1.5 text-[9px] font-mono hover:bg-[#1a1a1a] transition-colors',
                    lead.stage === s.value ? 'text-[#00ff88]' : 'text-[#888]'
                  )}
                >
                  {s.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Transfer button */}
        <button
          onClick={onTransfer}
          className={cn(
            'flex items-center gap-1.5 px-3 py-1.5 rounded text-[9px] font-mono font-bold transition-all',
            isAI
              ? 'bg-[#111] border border-[#222] text-[#888] hover:text-[#f0a030] hover:border-[#f0a030]/30'
              : 'bg-[#00ff88]/15 border border-[#00ff88]/40 text-[#00ff88] hover:bg-[#00ff88]/25'
          )}
          title={isAI ? 'Transfer to human' : 'Assign AI autopilot'}
        >
          {isAI ? (
            <><UserRound className="w-3 h-3" /> TAKE OVER</>
          ) : (
            <><Bot className="w-3 h-3" /> ASSIGN AI</>
          )}
        </button>

        {/* Calendly link */}
        {lead.calendly_booked_at ? (
          <Badge variant="booked" className="text-[8px] py-1 px-1.5 gap-0.5">
            <Phone className="w-2.5 h-2.5" />
            BOOKED
          </Badge>
        ) : null}
      </div>
    </div>
  )
}
