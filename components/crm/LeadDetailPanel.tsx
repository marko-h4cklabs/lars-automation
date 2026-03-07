'use client'

import { useState, useEffect, useCallback } from 'react'
import { X, ExternalLink, Bot, UserRound, ChevronDown, Save, Loader2, MessageSquare } from 'lucide-react'
import { LeadAvatar } from '@/components/ui/lead-avatar'
import { HeatScore } from '@/components/ui/heat-score'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { LoadingPulse } from '@/components/ui/loading-pulse'
import { QualificationFields } from './QualificationFields'
import { LeadTimeline } from './LeadTimeline'
import { cn } from '@/lib/utils'
import type { Lead, QualificationField, LeadStage } from '@/types'

interface LeadDetail extends Lead {
  conversation: {
    id: string
    status: string
    summary: string | null
    summary_updated_at: string | null
    qualified_fields_collected: Record<string, unknown>
    qualification_score: number
    assigned_to: string | null
  } | null
  assigned_user: { id: string; name: string; email: string; avatar_url: string | null; role: string } | null
  qual_field_definitions: QualificationField[]
  follow_up: {
    id: string
    current_step: number
    next_fire_at: string
    status: string
    sequence: { name: string; steps: unknown[] }
  } | null
  notes: { id: string; content: string; user_id: string; created_at: string }[]
}

interface LeadDetailPanelProps {
  leadId: string
  onClose: () => void
  onUpdate: () => void
}

const STAGES: { value: string; label: string }[] = [
  { value: 'new', label: 'New' },
  { value: 'contacted', label: 'Contacted' },
  { value: 'qualifying', label: 'Qualifying' },
  { value: 'call_offered', label: 'Call Offered' },
  { value: 'call_booked', label: 'Call Booked' },
  { value: 'showed', label: 'Showed' },
  { value: 'no_show', label: 'No Show' },
  { value: 'won', label: 'Won' },
  { value: 'lost', label: 'Lost' },
  { value: 'disqualified', label: 'Disqualified' },
]

export function LeadDetailPanel({ leadId, onClose, onUpdate }: LeadDetailPanelProps) {
  const [lead, setLead] = useState<LeadDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [stageOpen, setStageOpen] = useState(false)
  const [noteText, setNoteText] = useState('')
  const [savingNote, setSavingNote] = useState(false)
  const [activeTab, setActiveTab] = useState<'details' | 'timeline'>('details')

  const fetchLead = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/leads/${leadId}`)
      if (res.ok) {
        const data = await res.json()
        setLead(data)
      }
    } finally {
      setLoading(false)
    }
  }, [leadId])

  useEffect(() => {
    fetchLead()
  }, [fetchLead])

  const handleStageChange = async (stage: string) => {
    if (!lead) return
    setStageOpen(false)
    await fetch(`/api/leads/${leadId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stage }),
    })
    setLead((prev) => prev ? { ...prev, stage: stage as LeadStage } : null)
    onUpdate()
  }

  const handleSaveNote = async () => {
    if (!noteText.trim()) return
    setSavingNote(true)
    try {
      await fetch(`/api/leads/${leadId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes: noteText }),
      })
      setNoteText('')
      fetchLead()
    } finally {
      setSavingNote(false)
    }
  }

  return (
    <div className="fixed inset-y-0 right-0 w-[480px] bg-[#0a0a0a] border-l border-[#1a1a1a] shadow-2xl z-50 flex flex-col">
      {/* Close button */}
      <button
        onClick={onClose}
        className="absolute top-3 right-3 w-7 h-7 flex items-center justify-center rounded bg-[#111] text-[#666] hover:text-[#ccc] z-10"
      >
        <X className="w-4 h-4" />
      </button>

      {loading || !lead ? (
        <div className="p-6">
          <LoadingPulse lines={8} />
        </div>
      ) : (
        <ScrollArea className="flex-1">
          <div className="p-5 space-y-5">
            {/* 1. Header */}
            <div className="flex items-start gap-4">
              <LeadAvatar
                src={lead.profile_pic_url}
                name={lead.full_name || lead.username}
                size="lg"
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-mono font-bold text-[#f0f0f0]">@{lead.username}</span>
                  {lead.assignment_type === 'ai' ? (
                    <Badge variant="ai" className="text-[8px] py-0 px-1.5 gap-0.5">
                      <Bot className="w-2.5 h-2.5" /> AI
                    </Badge>
                  ) : (
                    <Badge variant="default" className="text-[8px] py-0 px-1.5 gap-0.5">
                      <UserRound className="w-2.5 h-2.5" /> HUMAN
                    </Badge>
                  )}
                </div>
                {lead.full_name && (
                  <p className="text-[11px] font-mono text-[#666] mt-0.5">{lead.full_name}</p>
                )}
                <div className="flex items-center gap-3 mt-1.5">
                  <HeatScore score={lead.heat_score} size="md" showBar />
                  {lead.follower_count && (
                    <span className="text-[10px] font-mono text-[#555]">
                      {(lead.follower_count / 1000).toFixed(1)}k followers
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1.5 mt-1.5">
                  <Badge variant="source" className="text-[8px] py-0 px-1.5">{lead.source}</Badge>
                  {/* Stage selector */}
                  <div className="relative">
                    <button
                      onClick={() => setStageOpen(!stageOpen)}
                      className="flex items-center gap-1 px-2 py-0.5 bg-[#111] border border-[#222] rounded text-[8px] font-mono text-[#888] hover:text-[#ccc]"
                    >
                      {lead.stage.replace('_', ' ').toUpperCase()}
                      <ChevronDown className="w-2.5 h-2.5" />
                    </button>
                    {stageOpen && (
                      <div className="absolute left-0 top-full mt-1 bg-[#111] border border-[#222] rounded shadow-xl z-50 min-w-[130px]">
                        {STAGES.map((s) => (
                          <button
                            key={s.value}
                            onClick={() => handleStageChange(s.value)}
                            className={cn(
                              'w-full text-left px-3 py-1.5 text-[9px] font-mono hover:bg-[#1a1a1a]',
                              lead.stage === s.value ? 'text-[#00ff88]' : 'text-[#888]'
                            )}
                          >
                            {s.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {lead.bio && (
              <p className="text-[10px] font-mono text-[#555] italic bg-[#0d0d0d] rounded p-2 border border-[#111]">
                {lead.bio}
              </p>
            )}

            {/* Tab toggle */}
            <div className="flex border-b border-[#1a1a1a]">
              {(['details', 'timeline'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={cn(
                    'flex-1 py-2 text-[9px] font-mono uppercase tracking-wider transition-colors',
                    activeTab === tab
                      ? 'text-[#00ff88] border-b border-[#00ff88]'
                      : 'text-[#444] hover:text-[#666]'
                  )}
                >
                  {tab}
                </button>
              ))}
            </div>

            {activeTab === 'details' ? (
              <div className="space-y-5">
                {/* 2. Qualification fields */}
                <div className="bg-[#0d0d0d] rounded-lg border border-[#1a1a1a] p-3">
                  <QualificationFields
                    fields={lead.qual_field_definitions}
                    collected={lead.conversation?.qualified_fields_collected || {}}
                  />
                </div>

                {/* 3. AI Summary */}
                {lead.conversation?.summary && (
                  <div className="bg-[#0d0d0d] rounded-lg border border-[#1a1a1a] p-3">
                    <span className="text-[9px] font-mono text-[#666] uppercase tracking-wider">AI Summary</span>
                    <p className="text-[10px] font-mono text-[#888] leading-relaxed mt-1.5">
                      {lead.conversation.summary}
                    </p>
                    {lead.conversation.summary_updated_at && (
                      <p className="text-[8px] font-mono text-[#333] mt-1">
                        Updated {new Date(lead.conversation.summary_updated_at).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                )}

                {/* 4. Conversation link */}
                {lead.conversation && (
                  <a
                    href={`/inbox?id=${lead.conversation.id}`}
                    className="flex items-center gap-2 px-3 py-2 bg-[#0d0d0d] rounded-lg border border-[#1a1a1a] hover:border-[#00ff88]/30 transition-colors"
                  >
                    <MessageSquare className="w-3.5 h-3.5 text-[#00ff88]" />
                    <span className="text-[10px] font-mono text-[#888]">View conversation in Inbox</span>
                    <ExternalLink className="w-3 h-3 text-[#444] ml-auto" />
                  </a>
                )}

                {/* 6. Assignment */}
                <div className="bg-[#0d0d0d] rounded-lg border border-[#1a1a1a] p-3">
                  <span className="text-[9px] font-mono text-[#666] uppercase tracking-wider">Assignment</span>
                  <div className="flex items-center gap-2 mt-1.5">
                    {lead.assigned_user ? (
                      <>
                        <LeadAvatar
                          src={lead.assigned_user.avatar_url}
                          name={lead.assigned_user.name}
                          size="sm"
                        />
                        <div>
                          <p className="text-[10px] font-mono text-[#ccc]">{lead.assigned_user.name}</p>
                          <p className="text-[8px] font-mono text-[#555]">{lead.assigned_user.role}</p>
                        </div>
                      </>
                    ) : (
                      <div className="flex items-center gap-1.5">
                        <Bot className="w-3.5 h-3.5 text-[#00ff88]" />
                        <span className="text-[10px] font-mono text-[#00ff88]">AI Autopilot</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* 7. Notes */}
                <div className="bg-[#0d0d0d] rounded-lg border border-[#1a1a1a] p-3">
                  <span className="text-[9px] font-mono text-[#666] uppercase tracking-wider">Notes</span>
                  <div className="mt-2 space-y-2">
                    {lead.notes.map((note) => (
                      <div key={note.id} className="text-[10px] font-mono text-[#888] bg-[#111] rounded p-2">
                        {note.content}
                        <p className="text-[8px] text-[#333] mt-1">
                          {new Date(note.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-2 mt-2">
                    <textarea
                      value={noteText}
                      onChange={(e) => setNoteText(e.target.value)}
                      placeholder="Add a note..."
                      rows={2}
                      className="flex-1 bg-[#111] border border-[#1a1a1a] rounded px-2.5 py-1.5 text-[10px] font-mono text-[#ccc] placeholder:text-[#333] outline-none resize-none focus:border-[#00ff88]/30"
                    />
                    <button
                      onClick={handleSaveNote}
                      disabled={!noteText.trim() || savingNote}
                      className="self-end px-2.5 py-1.5 bg-[#111] border border-[#222] rounded text-[9px] font-mono text-[#888] hover:text-[#00ff88] hover:border-[#00ff88]/30 disabled:opacity-50"
                    >
                      {savingNote ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                    </button>
                  </div>
                </div>

                {/* 8. Follow-up status */}
                {lead.follow_up && (
                  <div className="bg-[#0d0d0d] rounded-lg border border-[#1a1a1a] p-3">
                    <span className="text-[9px] font-mono text-[#666] uppercase tracking-wider">Follow-Up</span>
                    <div className="mt-1.5">
                      <p className="text-[10px] font-mono text-[#ccc]">{lead.follow_up.sequence.name}</p>
                      <p className="text-[9px] font-mono text-[#555] mt-0.5">
                        Step {lead.follow_up.current_step + 1}/{lead.follow_up.sequence.steps.length}
                        {' '}&middot;{' '}
                        <span className={cn(
                          lead.follow_up.status === 'active' ? 'text-[#00ff88]' : 'text-[#666]'
                        )}>
                          {lead.follow_up.status.toUpperCase()}
                        </span>
                      </p>
                      {lead.follow_up.next_fire_at && (
                        <p className="text-[8px] font-mono text-[#444] mt-0.5">
                          Next: {new Date(lead.follow_up.next_fire_at).toLocaleString()}
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              /* 5. Timeline tab */
              <LeadTimeline leadId={leadId} />
            )}
          </div>
        </ScrollArea>
      )}
    </div>
  )
}
