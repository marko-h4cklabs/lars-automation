'use client'

import { useState, useRef } from 'react'
import { LeadCard } from './LeadCard'
import { cn } from '@/lib/utils'
import type { Lead, LeadStage } from '@/types'

type EnrichedLead = Lead & {
  last_message?: { content: string; sent_at: string; direction: string } | null
  conversation?: { qualification_score: number; assigned_to: string | null } | null
}

interface PipelineViewProps {
  leads: EnrichedLead[]
  onLeadClick: (id: string) => void
  onStageChange: (leadId: string, newStage: LeadStage) => void
}

const PIPELINE_STAGES: { value: LeadStage; label: string; color: string }[] = [
  { value: 'new' as LeadStage, label: 'NEW', color: '#666' },
  { value: 'contacted' as LeadStage, label: 'CONTACTED', color: '#6688ff' },
  { value: 'qualifying' as LeadStage, label: 'QUALIFYING', color: '#f0a030' },
  { value: 'call_offered' as LeadStage, label: 'CALL OFFERED', color: '#f0c030' },
  { value: 'call_booked' as LeadStage, label: 'CALL BOOKED', color: '#00ff88' },
  { value: 'showed' as LeadStage, label: 'SHOWED', color: '#00ff88' },
  { value: 'no_show' as LeadStage, label: 'NO-SHOW', color: '#f05050' },
  { value: 'won' as LeadStage, label: 'WON', color: '#00ff88' },
  { value: 'lost' as LeadStage, label: 'LOST', color: '#f05050' },
  { value: 'disqualified' as LeadStage, label: 'DISQ', color: '#555' },
]

export function PipelineView({ leads, onLeadClick, onStageChange }: PipelineViewProps) {
  const [dragLeadId, setDragLeadId] = useState<string | null>(null)
  const [dragOverStage, setDragOverStage] = useState<LeadStage | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  const grouped = PIPELINE_STAGES.map((stage) => ({
    ...stage,
    leads: leads.filter((l) => l.stage === stage.value),
  }))

  const handleDragStart = (leadId: string) => {
    setDragLeadId(leadId)
  }

  const handleDragOver = (e: React.DragEvent, stage: LeadStage) => {
    e.preventDefault()
    setDragOverStage(stage)
  }

  const handleDrop = (stage: LeadStage) => {
    if (dragLeadId) {
      const lead = leads.find((l) => l.id === dragLeadId)
      if (lead && lead.stage !== stage) {
        onStageChange(dragLeadId, stage)
      }
    }
    setDragLeadId(null)
    setDragOverStage(null)
  }

  const handleDragEnd = () => {
    setDragLeadId(null)
    setDragOverStage(null)
  }

  return (
    <div
      ref={scrollRef}
      className="flex gap-2 overflow-x-auto h-full px-2 pb-2"
    >
      {grouped.map((col) => (
        <div
          key={col.value}
          className={cn(
            'flex flex-col w-[220px] min-w-[220px] rounded-lg border transition-colors',
            dragOverStage === col.value
              ? 'bg-[#00ff88]/[0.03] border-[#00ff88]/20'
              : 'bg-[#080808] border-[#1a1a1a]'
          )}
          onDragOver={(e) => handleDragOver(e, col.value)}
          onDragLeave={() => setDragOverStage(null)}
          onDrop={() => handleDrop(col.value)}
        >
          {/* Column header */}
          <div className="flex items-center justify-between px-3 py-2 border-b border-[#1a1a1a]">
            <div className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: col.color }} />
              <span className="text-[8px] font-mono uppercase tracking-wider" style={{ color: col.color }}>
                {col.label}
              </span>
            </div>
            <span className="text-[9px] font-mono text-[#444] font-bold">{col.leads.length}</span>
          </div>

          {/* Cards */}
          <div className="flex-1 overflow-y-auto p-1.5 space-y-1.5">
            {col.leads.length === 0 ? (
              <div className="flex items-center justify-center py-6">
                <span className="text-[8px] font-mono text-[#222]">Empty</span>
              </div>
            ) : (
              col.leads.map((lead) => (
                <div
                  key={lead.id}
                  draggable
                  onDragStart={() => handleDragStart(lead.id)}
                  onDragEnd={handleDragEnd}
                  className="cursor-grab active:cursor-grabbing"
                >
                  <LeadCard
                    lead={lead}
                    onClick={() => onLeadClick(lead.id)}
                    isDragging={dragLeadId === lead.id}
                  />
                </div>
              ))
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
