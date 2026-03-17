'use client'

import { useState } from 'react'
import { ChevronDown, ChevronUp, ArrowUpDown, Download, Users, ArrowRight } from 'lucide-react'
import { LeadAvatar } from '@/components/ui/lead-avatar'
import { HeatScore } from '@/components/ui/heat-score'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { Lead, LeadStage } from '@/types'

type EnrichedLead = Lead & {
  last_message?: { content: string; sent_at: string; direction: string } | null
  conversation?: { qualification_score: number; assigned_to: string | null } | null
}

interface TableViewProps {
  leads: EnrichedLead[]
  onLeadClick: (id: string) => void
  onStageChange: (leadId: string, newStage: LeadStage) => void
  sort: string
  sortDir: string
  onSort: (column: string) => void
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

interface SortHeaderProps {
  label: string
  column: string
  currentSort: string
  currentDir: string
  onSort: (col: string) => void
  className?: string
}

function SortHeader({ label, column, currentSort, currentDir, onSort, className }: SortHeaderProps) {
  const isActive = currentSort === column
  return (
    <button
      onClick={() => onSort(column)}
      className={cn('flex items-center gap-1 text-[8px] font-mono uppercase tracking-wider', className)}
    >
      <span className={isActive ? 'text-[#00ff88]' : 'text-[#555]'}>{label}</span>
      {isActive ? (
        currentDir === 'asc' ? <ChevronUp className="w-2.5 h-2.5 text-[#00ff88]" /> : <ChevronDown className="w-2.5 h-2.5 text-[#00ff88]" />
      ) : (
        <ArrowUpDown className="w-2.5 h-2.5 text-[#333]" />
      )}
    </button>
  )
}

export function TableView({ leads, onLeadClick, onStageChange, sort, sortDir, onSort }: TableViewProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [bulkStageOpen, setBulkStageOpen] = useState(false)
  const [openStageId, setOpenStageId] = useState<string | null>(null)

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleAll = () => {
    if (selected.size === leads.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(leads.map((l) => l.id)))
    }
  }

  const exportCSV = () => {
    const rows = leads.filter((l) => selected.size === 0 || selected.has(l.id))
    const header = 'Username,Full Name,Heat Score,Stage,Source,Assignment,Qualification %,First Contact\n'
    const csv = rows.map((l) =>
      `@${l.username},"${l.full_name || ''}",${l.heat_score},${l.stage},${l.source},${l.assignment_type},${l.conversation?.qualification_score || 0},${l.created_at}`
    ).join('\n')
    const blob = new Blob([header + csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `leads-export-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleBulkStageChange = (stage: string) => {
    selected.forEach((id) => onStageChange(id, stage as LeadStage))
    setBulkStageOpen(false)
    setSelected(new Set())
  }

  return (
    <div className="flex flex-col h-full">
      {/* Bulk actions bar */}
      {selected.size > 0 && (
        <div className="flex items-center gap-3 px-4 py-2 bg-[#0d0d0d] border-b border-[#1a1a1a]">
          <span className="text-[9px] font-mono text-[#00ff88]">{selected.size} selected</span>
          <div className="relative">
            <button
              onClick={() => setBulkStageOpen(!bulkStageOpen)}
              className="flex items-center gap-1 px-2 py-1 text-[8px] font-mono text-[#888] bg-[#111] border border-[#222] rounded hover:text-[#ccc]"
            >
              <ArrowRight className="w-2.5 h-2.5" /> CHANGE STAGE
            </button>
            {bulkStageOpen && (
              <div className="absolute left-0 top-full mt-1 bg-[#111] border border-[#222] rounded shadow-xl z-50 min-w-[130px]">
                {STAGES.map((s) => (
                  <button
                    key={s.value}
                    onClick={() => handleBulkStageChange(s.value)}
                    className="w-full text-left px-3 py-1.5 text-[9px] font-mono text-[#888] hover:bg-[#1a1a1a]"
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            )}
          </div>
          <button
            onClick={() => setSelected(new Set())}
            className="px-2 py-1 text-[8px] font-mono text-[#888] bg-[#111] border border-[#222] rounded hover:text-[#ccc]"
          >
            <Users className="w-2.5 h-2.5 inline mr-1" /> REASSIGN
          </button>
          <button
            onClick={exportCSV}
            className="px-2 py-1 text-[8px] font-mono text-[#888] bg-[#111] border border-[#222] rounded hover:text-[#ccc]"
          >
            <Download className="w-2.5 h-2.5 inline mr-1" /> EXPORT CSV
          </button>
        </div>
      )}

      {/* Table */}
      <div className="flex-1 overflow-auto">
        <table className="w-full">
          <thead className="sticky top-0 bg-[#0a0a0a] z-10">
            <tr className="border-b border-[#1a1a1a]">
              <th className="px-3 py-2 w-8">
                <input
                  type="checkbox"
                  checked={selected.size === leads.length && leads.length > 0}
                  onChange={toggleAll}
                  className="accent-[#00ff88]"
                />
              </th>
              <th className="px-3 py-2 text-left">
                <SortHeader label="Username" column="username" currentSort={sort} currentDir={sortDir} onSort={onSort} />
              </th>
              <th className="px-3 py-2 text-left">
                <SortHeader label="Heat" column="heat_score" currentSort={sort} currentDir={sortDir} onSort={onSort} />
              </th>
              <th className="px-3 py-2 text-left">
                <SortHeader label="Stage" column="stage" currentSort={sort} currentDir={sortDir} onSort={onSort} />
              </th>
              <th className="px-3 py-2 text-left">
                <span className="text-[8px] font-mono text-[#555] uppercase tracking-wider">Source</span>
              </th>
              <th className="px-3 py-2 text-left">
                <span className="text-[8px] font-mono text-[#555] uppercase tracking-wider">Assigned</span>
              </th>
              <th className="px-3 py-2 text-left">
                <span className="text-[8px] font-mono text-[#555] uppercase tracking-wider">Qual %</span>
              </th>
              <th className="px-3 py-2 text-left">
                <SortHeader label="Last Msg" column="last_message_at" currentSort={sort} currentDir={sortDir} onSort={onSort} />
              </th>
              <th className="px-3 py-2 text-left">
                <SortHeader label="First Contact" column="created_at" currentSort={sort} currentDir={sortDir} onSort={onSort} />
              </th>
            </tr>
          </thead>
          <tbody>
            {leads.map((lead) => (
              <tr
                key={lead.id}
                onClick={() => onLeadClick(lead.id)}
                className="border-b border-[#111] hover:bg-[#0d0d0d] cursor-pointer transition-colors"
              >
                <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                  <input
                    type="checkbox"
                    checked={selected.has(lead.id)}
                    onChange={() => toggleSelect(lead.id)}
                    className="accent-[#00ff88]"
                  />
                </td>
                <td className="px-3 py-2">
                  <div className="flex items-center gap-2">
                    <LeadAvatar src={lead.profile_pic_url} name={lead.full_name || lead.username} size="sm" />
                    <div className="min-w-0">
                      <span className="text-[10px] font-mono font-bold text-[#f0f0f0] truncate block">@{lead.username}</span>
                      {lead.full_name && (
                        <span className="text-[8px] font-mono text-[#555] truncate block">{lead.full_name}</span>
                      )}
                    </div>
                  </div>
                </td>
                <td className="px-3 py-2">
                  <HeatScore score={lead.heat_score} size="sm" />
                </td>
                <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                  <div className="relative">
                    <button
                      onClick={() => setOpenStageId(openStageId === lead.id ? null : lead.id)}
                      className="text-[9px] font-mono text-[#888] hover:text-[#ccc] flex items-center gap-0.5"
                    >
                      {lead.stage.replace('_', ' ')}
                      <ChevronDown className="w-2 h-2" />
                    </button>
                    {openStageId === lead.id && (
                      <div className="absolute left-0 top-full mt-1 bg-[#111] border border-[#222] rounded shadow-xl z-50 min-w-[120px]">
                        {STAGES.map((s) => (
                          <button
                            key={s.value}
                            onClick={() => {
                              onStageChange(lead.id, s.value as LeadStage)
                              setOpenStageId(null)
                            }}
                            className={cn(
                              'w-full text-left px-3 py-1 text-[9px] font-mono hover:bg-[#1a1a1a]',
                              lead.stage === s.value ? 'text-[#00ff88]' : 'text-[#888]'
                            )}
                          >
                            {s.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </td>
                <td className="px-3 py-2">
                  <Badge variant="source" className="text-[7px] py-0 px-1">{lead.source}</Badge>
                </td>
                <td className="px-3 py-2">
                  <span className="text-[9px] font-mono text-[#666]">
                    {lead.assigned_to ? 'Setter' : '-'}
                  </span>
                </td>
                <td className="px-3 py-2">
                  <span className="text-[9px] font-mono text-[#666]">
                    {lead.conversation?.qualification_score || 0}%
                  </span>
                </td>
                <td className="px-3 py-2">
                  <span className="text-[9px] font-mono text-[#555]">
                    {lead.last_message ? formatTimeAgo(lead.last_message.sent_at) : '-'}
                  </span>
                </td>
                <td className="px-3 py-2">
                  <span className="text-[9px] font-mono text-[#555]">
                    {new Date(lead.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function formatTimeAgo(dateStr: string): string {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000)
  if (diff < 60) return 'now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`
  return `${Math.floor(diff / 86400)}d`
}
