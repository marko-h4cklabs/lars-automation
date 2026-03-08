'use client'

import { useState, useEffect, useCallback } from 'react'
import { Save, Loader2, AlertCircle, Bot, RotateCcw } from 'lucide-react'
import { cn } from '@/lib/utils'
import { LoadingFormSection } from '@/components/ui/loading-pulse'
import { ErrorState } from '@/components/ui/error-state'
import type { User } from '@/types'

interface SetterRow {
  user_id: string | null // null = AI
  name: string
  role: string
  receives_leads: boolean
  pct: number
  status?: string
}

interface DistSettings {
  id?: string
  distribution_mode: string
  setter_allocations: SetterRow[]
}

const COLORS = ['#6688ff', '#f0a030', '#ff66aa', '#66ddff', '#ddff66', '#ff8866']

export default function DistributionPage() {
  const [settings, setSettings] = useState<DistSettings>({
    distribution_mode: 'percentage',
    setter_allocations: [],
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(false)

  const fetchSettings = useCallback(() => {
    setError(false)
    setLoading(true)
    Promise.all([
      fetch('/api/settings?section=distribution').then((r) => r.ok ? r.json() : null),
      fetch('/api/team').then((r) => r.ok ? r.json() : null),
    ])
      .then(([distData, teamData]) => {
        const users = (teamData?.users || []) as User[]
        const existing = distData?.setter_allocations as SetterRow[] | undefined

        // Build setter rows from users + existing allocations
        const rows: SetterRow[] = []

        // AI Agent row (always present)
        const aiExisting = existing?.find((a) => a.user_id === null)
        rows.push({
          user_id: null,
          name: 'AI Agent',
          role: 'ai',
          receives_leads: aiExisting ? aiExisting.receives_leads : true,
          pct: aiExisting?.pct ?? distData?.ai_pct ?? 30,
          status: 'online',
        })

        // User rows
        for (const u of users) {
          if (u.role === 'viewer') continue
          const ex = existing?.find((a) => a.user_id === u.id)
          rows.push({
            user_id: u.id,
            name: u.name,
            role: u.role,
            receives_leads: ex ? ex.receives_leads : (u.receives_leads ?? false),
            pct: ex?.pct ?? 0,
            status: u.status,
          })
        }

        setSettings({
          id: distData?.id,
          distribution_mode: distData?.distribution_mode || 'percentage',
          setter_allocations: rows,
        })
      })
      .catch(() => { setError(true) })
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { fetchSettings() }, [fetchSettings])

  const activeRows = settings.setter_allocations.filter((r) => r.receives_leads)
  const totalPct = activeRows.reduce((sum, r) => sum + r.pct, 0)
  const isValid = totalPct === 100

  const toggleReceivesLeads = (idx: number) => {
    setSettings((prev) => {
      const allocs = [...prev.setter_allocations]
      const row = { ...allocs[idx] }
      // AI cannot be removed
      if (row.user_id === null) return prev
      row.receives_leads = !row.receives_leads
      if (!row.receives_leads) row.pct = 0
      allocs[idx] = row
      return { ...prev, setter_allocations: allocs }
    })
  }

  const updatePct = (idx: number, value: number) => {
    setSettings((prev) => {
      const allocs = [...prev.setter_allocations]
      allocs[idx] = { ...allocs[idx], pct: value }
      return { ...prev, setter_allocations: allocs }
    })
  }

  const autoBalance = () => {
    setSettings((prev) => {
      const allocs = [...prev.setter_allocations]
      const activeIdxs = allocs
        .map((r, i) => (r.receives_leads ? i : -1))
        .filter((i) => i >= 0)
      if (activeIdxs.length === 0) return prev
      const each = Math.floor(100 / activeIdxs.length)
      const remainder = 100 - each * activeIdxs.length
      for (let j = 0; j < activeIdxs.length; j++) {
        allocs[activeIdxs[j]] = {
          ...allocs[activeIdxs[j]],
          pct: each + (j === 0 ? remainder : 0),
        }
      }
      // Set inactive to 0
      for (let i = 0; i < allocs.length; i++) {
        if (!allocs[i].receives_leads) allocs[i] = { ...allocs[i], pct: 0 }
      }
      return { ...prev, setter_allocations: allocs }
    })
  }

  const save = async () => {
    if (!isValid) return
    setSaving(true)
    try {
      // Also update receives_leads on each user
      const userUpdates = settings.setter_allocations
        .filter((r) => r.user_id !== null)
        .map((r) => ({
          id: r.user_id,
          receives_leads: r.receives_leads,
        }))

      await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          section: 'distribution',
          distribution_mode: settings.distribution_mode,
          setter_allocations: settings.setter_allocations,
          // Legacy fields for backward compat
          ai_pct: settings.setter_allocations.find((r) => r.user_id === null)?.pct ?? 30,
          user_updates: userUpdates,
        }),
      })
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="p-6"><LoadingFormSection /></div>
  if (error) return <div className="p-6"><ErrorState message="Failed to load settings" onRetry={fetchSettings} /></div>

  return (
    <div className="p-6 max-w-2xl">
      <h1 className="text-sm font-mono font-bold text-[#f0f0f0] mb-1">Distribution Settings</h1>
      <p className="text-[10px] font-mono text-[#555] mb-6">Configure how incoming leads are distributed between setters and AI.</p>

      {/* Distribution mode */}
      <div className="mb-6">
        <label className="text-[9px] font-mono text-[#666] uppercase tracking-wider mb-2 block">Distribution Mode</label>
        <div className="flex gap-2">
          {['percentage', 'round_robin', 'load_based'].map((mode) => (
            <button
              key={mode}
              onClick={() => setSettings((p) => ({ ...p, distribution_mode: mode }))}
              className={cn(
                'px-3 py-1.5 rounded text-[10px] font-mono border transition-colors',
                settings.distribution_mode === mode
                  ? 'bg-[#00ff88]/10 text-[#00ff88] border-[#00ff88]/30'
                  : 'text-[#666] border-[#222] hover:border-[#444]'
              )}
            >
              {mode.replace('_', ' ').toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {/* Active Setters section */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <label className="text-[9px] font-mono text-[#666] uppercase tracking-wider">Active Setters</label>
          <button
            onClick={autoBalance}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded text-[9px] font-mono text-[#888] border border-[#222] hover:border-[#444] transition-colors"
          >
            <RotateCcw className="w-3 h-3" />
            AUTO-BALANCE
          </button>
        </div>

        <div className="space-y-2">
          {settings.setter_allocations.map((row, idx) => {
            const isAI = row.user_id === null
            const color = isAI ? '#00ff88' : COLORS[idx % COLORS.length]

            return (
              <div
                key={row.user_id ?? 'ai'}
                className={cn(
                  'flex items-center gap-3 p-3 rounded-lg border transition-colors',
                  row.receives_leads
                    ? 'bg-[#0d0d0d] border-[#1a1a1a]'
                    : 'bg-[#080808] border-[#141414] opacity-50'
                )}
              >
                {/* Avatar / icon */}
                <div
                  className="w-7 h-7 rounded-full flex items-center justify-center shrink-0"
                  style={{ backgroundColor: `${color}15` }}
                >
                  {isAI ? (
                    <Bot className="w-3.5 h-3.5" style={{ color }} />
                  ) : (
                    <span className="text-[10px] font-mono font-bold" style={{ color }}>
                      {row.name.charAt(0).toUpperCase()}
                    </span>
                  )}
                </div>

                {/* Name + role */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-mono text-[#ccc] truncate">{row.name}</span>
                    <span className="text-[8px] font-mono uppercase text-[#444]">{row.role}</span>
                    {row.status && (
                      <div className={cn(
                        'w-1.5 h-1.5 rounded-full',
                        row.status === 'online' ? 'bg-[#00ff88]' : 'bg-[#333]'
                      )} />
                    )}
                  </div>
                </div>

                {/* Toggle */}
                <button
                  onClick={() => toggleReceivesLeads(idx)}
                  disabled={isAI}
                  className={cn(
                    'w-8 h-4 rounded-full transition-colors relative shrink-0',
                    isAI ? 'cursor-not-allowed' : 'cursor-pointer',
                    row.receives_leads ? 'bg-[#00ff88]/30' : 'bg-[#222]'
                  )}
                >
                  <div className={cn(
                    'absolute top-0.5 w-3 h-3 rounded-full transition-all',
                    row.receives_leads ? 'left-4 bg-[#00ff88]' : 'left-0.5 bg-[#555]'
                  )} />
                </button>

                {/* Percentage input */}
                <div className="flex items-center gap-1 shrink-0">
                  <input
                    type="number"
                    min={0} max={100} step={5}
                    value={row.pct}
                    disabled={!row.receives_leads}
                    onChange={(e) => updatePct(idx, parseInt(e.target.value) || 0)}
                    className="w-12 bg-[#111] border border-[#222] rounded px-1.5 py-0.5 text-[11px] font-mono text-center text-[#ccc] disabled:opacity-30 outline-none focus:border-[#00ff88]/40"
                  />
                  <span className="text-[10px] font-mono text-[#444]">%</span>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Total indicator */}
      <div className={cn(
        'flex items-center gap-2 p-3 rounded-lg border mb-6',
        isValid ? 'bg-[#00ff88]/5 border-[#00ff88]/20' : 'bg-[#f05050]/5 border-[#f05050]/20'
      )}>
        {!isValid && <AlertCircle className="w-3.5 h-3.5 text-[#f05050]" />}
        <span className={cn('text-[10px] font-mono', isValid ? 'text-[#00ff88]' : 'text-[#f05050]')}>
          Total: {totalPct}% {isValid ? '— Valid' : `— Must equal 100% (off by ${totalPct - 100 > 0 ? '+' : ''}${totalPct - 100})`}
        </span>
      </div>

      {/* Visual bar */}
      <div className="flex h-3 rounded-full overflow-hidden mb-6">
        {settings.setter_allocations
          .filter((r) => r.receives_leads && r.pct > 0)
          .map((row, i) => (
            <div
              key={row.user_id ?? 'ai'}
              style={{
                width: `${row.pct}%`,
                backgroundColor: row.user_id === null ? '#00ff88' : COLORS[i % COLORS.length],
              }}
            />
          ))}
      </div>

      {/* Preview */}
      <div className="bg-[#0d0d0d] rounded-lg border border-[#1a1a1a] p-3 mb-6 space-y-1.5">
        <span className="text-[8px] font-mono text-[#555] uppercase tracking-wider">Preview</span>
        <p className="text-[10px] font-mono text-[#888]">
          All active setters online: {activeRows.map((r) => `${r.name}=${r.pct}%`).join(', ')}
        </p>
        <p className="text-[10px] font-mono text-[#666]">
          All setters offline: AI=100%
        </p>
      </div>

      <button
        onClick={save}
        disabled={!isValid || saving}
        className="flex items-center gap-2 px-4 py-2 bg-[#00ff88]/10 border border-[#00ff88]/30 rounded text-[10px] font-mono text-[#00ff88] hover:bg-[#00ff88]/20 disabled:opacity-50 transition-colors"
      >
        {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
        SAVE CHANGES
      </button>
    </div>
  )
}
