'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  LayoutGrid, Table2, Filter, X, Search,
  Users, Phone, TrendingUp, Flame, Bot, UserRound, Loader2
} from 'lucide-react'
import { PipelineView } from '@/components/crm/PipelineView'
import { TableView } from '@/components/crm/TableView'
import { LeadDetailPanel } from '@/components/crm/LeadDetailPanel'
import { cn } from '@/lib/utils'
import type { Lead, LeadStage } from '@/types'

type EnrichedLead = Lead & {
  last_message?: { content: string; sent_at: string; direction: string } | null
  conversation?: { qualification_score: number; assigned_to: string | null } | null
}

interface Metrics {
  total: number
  booked: number
  conversionRate: number
  aiBookings: number
  setterBookings: number
  avgHeat: number
}

const SOURCE_OPTIONS = ['dm', 'story_reply', 'comment', 'follow', 'keyword']
const STAGE_OPTIONS = [
  'new', 'contacted', 'qualifying', 'call_offered', 'call_booked',
  'showed', 'no_show', 'won', 'lost', 'disqualified',
]
const QUAL_RANGES = [
  { label: '0-25%', min: 0, max: 25 },
  { label: '25-50%', min: 25, max: 50 },
  { label: '50-75%', min: 50, max: 75 },
  { label: '75-100%', min: 75, max: 100 },
]

export default function CRMPage() {
  const [view, setView] = useState<'pipeline' | 'table'>('pipeline')
  const [leads, setLeads] = useState<EnrichedLead[]>([])
  const [loading, setLoading] = useState(true)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(0)
  const [hasMore, setHasMore] = useState(true)
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null)
  const [filtersOpen, setFiltersOpen] = useState(false)

  // Filters
  const [search, setSearch] = useState('')
  const [selectedStages, setSelectedStages] = useState<string[]>([])
  const [selectedSources, setSelectedSources] = useState<string[]>([])
  const [assignedTo, setAssignedTo] = useState('')
  const [heatRange, setHeatRange] = useState<[number, number]>([0, 100])
  const [qualRange, setQualRange] = useState<[number, number]>([0, 100])

  // Sort
  const [sort, setSort] = useState('updated_at')
  const [sortDir, setSortDir] = useState('desc')

  // Metrics
  const [metrics, setMetrics] = useState<Metrics>({ total: 0, booked: 0, conversionRate: 0, aiBookings: 0, setterBookings: 0, avgHeat: 0 })

  const fetchLeads = useCallback(async (pageNum: number, append = false) => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: String(pageNum),
        limit: view === 'pipeline' ? '200' : '50',
        search,
        sort,
        sortDir,
        heatMin: String(heatRange[0]),
        heatMax: String(heatRange[1]),
        qualMin: String(qualRange[0]),
        qualMax: String(qualRange[1]),
      })
      if (selectedStages.length > 0) params.set('stages', selectedStages.join(','))
      if (selectedSources.length > 0) params.set('sources', selectedSources.join(','))
      if (assignedTo) params.set('assignedTo', assignedTo)

      const res = await fetch(`/api/leads?${params}`)
      if (!res.ok) return
      const data = await res.json()
      if (append) {
        setLeads((prev) => [...prev, ...data.leads])
      } else {
        setLeads(data.leads)
      }
      setTotal(data.total)
      setHasMore(data.hasMore)
    } finally {
      setLoading(false)
    }
  }, [search, sort, sortDir, selectedStages, selectedSources, assignedTo, heatRange, qualRange, view])

  useEffect(() => {
    setPage(0)
    fetchLeads(0)
  }, [fetchLeads])

  // Compute metrics from loaded leads
  useEffect(() => {
    if (leads.length === 0) {
      setMetrics({ total: 0, booked: 0, conversionRate: 0, aiBookings: 0, setterBookings: 0, avgHeat: 0 })
      return
    }
    const booked = leads.filter((l) => l.stage === 'call_booked' || l.stage === 'showed' || l.stage === 'won')
    const aiBooked = booked.filter((l) => l.assignment_type === 'ai')
    const avgHeat = Math.round(leads.reduce((sum, l) => sum + l.heat_score, 0) / leads.length)
    setMetrics({
      total,
      booked: booked.length,
      conversionRate: total > 0 ? Math.round((booked.length / total) * 100) : 0,
      aiBookings: aiBooked.length,
      setterBookings: booked.length - aiBooked.length,
      avgHeat,
    })
  }, [leads, total])

  const handleSort = (column: string) => {
    if (sort === column) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc')
    } else {
      setSort(column)
      setSortDir('desc')
    }
  }

  const handleStageChange = async (leadId: string, newStage: LeadStage) => {
    // Optimistic update
    setLeads((prev) => prev.map((l) => l.id === leadId ? { ...l, stage: newStage } : l))
    await fetch(`/api/leads/${leadId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stage: newStage }),
    })
  }

  const toggleStage = (stage: string) => {
    setSelectedStages((prev) =>
      prev.includes(stage) ? prev.filter((s) => s !== stage) : [...prev, stage]
    )
  }

  const toggleSource = (source: string) => {
    setSelectedSources((prev) =>
      prev.includes(source) ? prev.filter((s) => s !== source) : [...prev, source]
    )
  }

  const clearFilters = () => {
    setSelectedStages([])
    setSelectedSources([])
    setAssignedTo('')
    setHeatRange([0, 100])
    setQualRange([0, 100])
    setSearch('')
  }

  const activeFilterCount = selectedStages.length + selectedSources.length +
    (assignedTo ? 1 : 0) + (heatRange[0] > 0 || heatRange[1] < 100 ? 1 : 0) +
    (qualRange[0] > 0 || qualRange[1] < 100 ? 1 : 0)

  return (
    <div className="flex h-full overflow-hidden">
      {/* Filters sidebar */}
      {filtersOpen && (
        <div className="w-[240px] border-r border-[#1a1a1a] bg-[#0a0a0a] flex flex-col shrink-0 overflow-y-auto">
          <div className="flex items-center justify-between px-3 py-2 border-b border-[#1a1a1a]">
            <span className="text-[9px] font-mono text-[#00ff88] uppercase tracking-wider">Filters</span>
            <div className="flex items-center gap-2">
              {activeFilterCount > 0 && (
                <button onClick={clearFilters} className="text-[8px] font-mono text-[#f05050] hover:text-[#ff6060]">
                  CLEAR
                </button>
              )}
              <button onClick={() => setFiltersOpen(false)} className="text-[#444] hover:text-[#888]">
                <X className="w-3 h-3" />
              </button>
            </div>
          </div>

          <div className="p-3 space-y-4">
            {/* Stage multi-select */}
            <div>
              <span className="text-[8px] font-mono text-[#555] uppercase tracking-wider">Stage</span>
              <div className="flex flex-wrap gap-1 mt-1.5">
                {STAGE_OPTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => toggleStage(s)}
                    className={cn(
                      'px-1.5 py-0.5 rounded text-[7px] font-mono uppercase border transition-colors',
                      selectedStages.includes(s)
                        ? 'bg-[#00ff88]/10 text-[#00ff88] border-[#00ff88]/30'
                        : 'text-[#555] border-[#1a1a1a] hover:border-[#333]'
                    )}
                  >
                    {s.replace('_', ' ')}
                  </button>
                ))}
              </div>
            </div>

            {/* Assigned to */}
            <div>
              <span className="text-[8px] font-mono text-[#555] uppercase tracking-wider">Assigned To</span>
              <div className="flex gap-1 mt-1.5">
                {[
                  { value: '', label: 'All' },
                  { value: 'ai', label: 'AI' },
                ].map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setAssignedTo(opt.value)}
                    className={cn(
                      'px-2 py-0.5 rounded text-[8px] font-mono border transition-colors',
                      assignedTo === opt.value
                        ? 'bg-[#00ff88]/10 text-[#00ff88] border-[#00ff88]/30'
                        : 'text-[#555] border-[#1a1a1a] hover:border-[#333]'
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Source */}
            <div>
              <span className="text-[8px] font-mono text-[#555] uppercase tracking-wider">Source</span>
              <div className="flex flex-wrap gap-1 mt-1.5">
                {SOURCE_OPTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => toggleSource(s)}
                    className={cn(
                      'px-1.5 py-0.5 rounded text-[7px] font-mono uppercase border transition-colors',
                      selectedSources.includes(s)
                        ? 'bg-[#00ff88]/10 text-[#00ff88] border-[#00ff88]/30'
                        : 'text-[#555] border-[#1a1a1a] hover:border-[#333]'
                    )}
                  >
                    {s.replace('_', ' ')}
                  </button>
                ))}
              </div>
            </div>

            {/* Heat score range */}
            <div>
              <div className="flex items-center justify-between">
                <span className="text-[8px] font-mono text-[#555] uppercase tracking-wider">Heat Score</span>
                <span className="text-[8px] font-mono text-[#666]">{heatRange[0]}-{heatRange[1]}</span>
              </div>
              <div className="flex gap-2 mt-1.5">
                <input
                  type="range"
                  min={0} max={100}
                  value={heatRange[0]}
                  onChange={(e) => setHeatRange([parseInt(e.target.value), heatRange[1]])}
                  className="flex-1 accent-[#00ff88] h-1"
                />
                <input
                  type="range"
                  min={0} max={100}
                  value={heatRange[1]}
                  onChange={(e) => setHeatRange([heatRange[0], parseInt(e.target.value)])}
                  className="flex-1 accent-[#00ff88] h-1"
                />
              </div>
            </div>

            {/* Qualification completeness */}
            <div>
              <span className="text-[8px] font-mono text-[#555] uppercase tracking-wider">Qualification</span>
              <div className="flex flex-wrap gap-1 mt-1.5">
                {QUAL_RANGES.map((r) => (
                  <button
                    key={r.label}
                    onClick={() => setQualRange([r.min, r.max])}
                    className={cn(
                      'px-1.5 py-0.5 rounded text-[7px] font-mono border transition-colors',
                      qualRange[0] === r.min && qualRange[1] === r.max
                        ? 'bg-[#00ff88]/10 text-[#00ff88] border-[#00ff88]/30'
                        : 'text-[#555] border-[#1a1a1a] hover:border-[#333]'
                    )}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Metrics bar */}
        <div className="flex items-center gap-4 px-4 py-2.5 border-b border-[#1a1a1a] bg-[#0a0a0a] shrink-0">
          <MetricChip icon={Users} label="Total" value={metrics.total} />
          <MetricChip icon={Phone} label="Booked" value={metrics.booked} color="#00ff88" />
          <MetricChip icon={TrendingUp} label="Conv %" value={`${metrics.conversionRate}%`} color={metrics.conversionRate >= 10 ? '#00ff88' : '#f0a030'} />
          <MetricChip icon={Bot} label="AI" value={metrics.aiBookings} color="#00ff88" />
          <MetricChip icon={UserRound} label="Setter" value={metrics.setterBookings} />
          <MetricChip icon={Flame} label="Avg Heat" value={metrics.avgHeat} color={metrics.avgHeat >= 60 ? '#f05050' : '#f0a030'} />

          <div className="flex-1" />

          {/* Search */}
          <div className="flex items-center gap-2 bg-[#111] rounded px-2.5 py-1 w-[200px]">
            <Search className="w-3 h-3 text-[#444]" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search leads..."
              className="bg-transparent text-[#ccc] text-[10px] font-mono placeholder:text-[#333] outline-none flex-1"
            />
          </div>

          {/* Filter toggle */}
          <button
            onClick={() => setFiltersOpen(!filtersOpen)}
            className={cn(
              'flex items-center gap-1 px-2 py-1 rounded text-[9px] font-mono border transition-colors',
              filtersOpen || activeFilterCount > 0
                ? 'bg-[#00ff88]/10 text-[#00ff88] border-[#00ff88]/30'
                : 'text-[#666] border-[#222] hover:text-[#888]'
            )}
          >
            <Filter className="w-3 h-3" />
            FILTER
            {activeFilterCount > 0 && (
              <span className="w-3.5 h-3.5 rounded-full bg-[#00ff88] text-black text-[7px] font-bold flex items-center justify-center">
                {activeFilterCount}
              </span>
            )}
          </button>

          {/* View toggle */}
          <div className="flex bg-[#111] rounded border border-[#1a1a1a]">
            <button
              onClick={() => setView('pipeline')}
              className={cn(
                'px-2 py-1 rounded-l transition-colors',
                view === 'pipeline' ? 'bg-[#00ff88]/10 text-[#00ff88]' : 'text-[#444] hover:text-[#666]'
              )}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setView('table')}
              className={cn(
                'px-2 py-1 rounded-r transition-colors',
                view === 'table' ? 'bg-[#00ff88]/10 text-[#00ff88]' : 'text-[#444] hover:text-[#666]'
              )}
            >
              <Table2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden">
          {loading && leads.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="w-5 h-5 animate-spin text-[#00ff88]" />
            </div>
          ) : view === 'pipeline' ? (
            <PipelineView
              leads={leads}
              onLeadClick={(id) => setSelectedLeadId(id)}
              onStageChange={handleStageChange}
            />
          ) : (
            <TableView
              leads={leads}
              onLeadClick={(id) => setSelectedLeadId(id)}
              onStageChange={handleStageChange}
              sort={sort}
              sortDir={sortDir}
              onSort={handleSort}
            />
          )}

          {/* Load more for table view */}
          {view === 'table' && hasMore && !loading && (
            <div className="flex justify-center py-3">
              <button
                onClick={() => {
                  const next = page + 1
                  setPage(next)
                  fetchLeads(next, true)
                }}
                className="text-[9px] font-mono text-[#444] hover:text-[#888] px-4 py-1.5 border border-[#1a1a1a] rounded"
              >
                Load more ({total - leads.length} remaining)
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Lead detail slide-over */}
      {selectedLeadId && (
        <>
          <div
            className="fixed inset-0 bg-black/40 z-40"
            onClick={() => setSelectedLeadId(null)}
          />
          <LeadDetailPanel
            leadId={selectedLeadId}
            onClose={() => setSelectedLeadId(null)}
            onUpdate={() => fetchLeads(0)}
          />
        </>
      )}
    </div>
  )
}

function MetricChip({ icon: Icon, label, value, color }: {
  icon: typeof Users
  label: string
  value: number | string
  color?: string
}) {
  return (
    <div className="flex items-center gap-1.5">
      <Icon className="w-3 h-3 text-[#444]" />
      <div>
        <p className="text-[7px] font-mono text-[#444] uppercase">{label}</p>
        <p className="text-[11px] font-mono font-bold" style={{ color: color || '#999' }}>
          {value}
        </p>
      </div>
    </div>
  )
}
