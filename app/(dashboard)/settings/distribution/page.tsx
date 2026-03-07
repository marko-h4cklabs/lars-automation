'use client'

import { useState, useEffect } from 'react'
import { Save, Loader2, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

interface DistSettings {
  id?: string
  setter1_id: string | null
  setter2_id: string | null
  setter1_pct: number
  setter2_pct: number
  ai_pct: number
  distribution_mode: string
}

export default function DistributionPage() {
  const [settings, setSettings] = useState<DistSettings>({
    setter1_id: null, setter2_id: null,
    setter1_pct: 35, setter2_pct: 35, ai_pct: 30,
    distribution_mode: 'percentage',
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetch('/api/settings?section=distribution')
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { if (d?.distribution_mode) setSettings(d) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const totalPct = settings.setter1_pct + settings.setter2_pct + settings.ai_pct
  const isValid = totalPct === 100

  const handlePctChange = (field: 'setter1_pct' | 'setter2_pct' | 'ai_pct', value: number) => {
    setSettings((prev) => ({ ...prev, [field]: value }))
  }

  const save = async () => {
    if (!isValid) return
    setSaving(true)
    try {
      await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ section: 'distribution', ...settings }),
      })
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="p-8 text-[#444] font-mono text-xs">Loading...</div>

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

      {/* Percentage sliders */}
      <div className="space-y-4 mb-6">
        {[
          { key: 'setter1_pct' as const, label: 'Setter 1', color: '#6688ff' },
          { key: 'setter2_pct' as const, label: 'Setter 2', color: '#f0a030' },
          { key: 'ai_pct' as const, label: 'AI Autopilot', color: '#00ff88' },
        ].map(({ key, label, color }) => (
          <div key={key}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-mono text-[#999]">{label}</span>
              <span className="text-[11px] font-mono font-bold" style={{ color }}>
                {settings[key]}%
              </span>
            </div>
            <input
              type="range"
              min={0} max={100} step={5}
              value={settings[key]}
              onChange={(e) => handlePctChange(key, parseInt(e.target.value))}
              className="w-full h-1.5 accent-current rounded-full"
              style={{ accentColor: color }}
            />
          </div>
        ))}
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

      {/* Preview */}
      <div className="bg-[#0d0d0d] rounded-lg border border-[#1a1a1a] p-3 mb-6 space-y-1.5">
        <span className="text-[8px] font-mono text-[#555] uppercase tracking-wider">Preview</span>
        <p className="text-[10px] font-mono text-[#888]">
          Both setters online: S1={settings.setter1_pct}%, S2={settings.setter2_pct}%, AI={settings.ai_pct}%
        </p>
        <p className="text-[10px] font-mono text-[#666]">
          Setter 1 offline: S2={Math.round(settings.setter2_pct / (settings.setter2_pct + settings.ai_pct) * 100 || 0)}%, AI={Math.round(settings.ai_pct / (settings.setter2_pct + settings.ai_pct) * 100 || 0)}%
        </p>
        <p className="text-[10px] font-mono text-[#666]">
          Both offline: AI=100%
        </p>
      </div>

      {/* Visual bar */}
      <div className="flex h-3 rounded-full overflow-hidden mb-6">
        <div className="bg-[#6688ff]" style={{ width: `${settings.setter1_pct}%` }} />
        <div className="bg-[#f0a030]" style={{ width: `${settings.setter2_pct}%` }} />
        <div className="bg-[#00ff88]" style={{ width: `${settings.ai_pct}%` }} />
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
