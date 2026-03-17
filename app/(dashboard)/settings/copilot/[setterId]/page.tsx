'use client'

import { useState, useEffect } from 'react'
import { Save, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useParams } from 'next/navigation'
import { LoadingFormSection } from '@/components/ui/loading-pulse'
import { ErrorState } from '@/components/ui/error-state'

interface CopilotSettings {
  id?: string
  user_id: string
  response_style: string
  custom_prompt_additions: string
  suggestions_count: number
  auto_score_leads: boolean
}

export default function CopilotPage() {
  const params = useParams()
  const setterId = params.setterId as string
  const [settings, setSettings] = useState<CopilotSettings>({
    user_id: setterId, response_style: 'balanced',
    custom_prompt_additions: '', suggestions_count: 2, auto_score_leads: true,
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(false)
  const [setterName, setSetterName] = useState('Setter')

  const fetchSettings = () => {
    setError(false)
    setLoading(true)
    Promise.all([
      fetch(`/api/settings?section=copilot&userId=${setterId}`).then((r) => r.ok ? r.json() : null),
      fetch('/api/team').then((r) => r.ok ? r.json() : null),
    ])
      .then(([copilotData, teamData]) => {
        if (copilotData?.user_id) setSettings(copilotData)
        const users = (teamData?.users || []) as { id: string; name: string }[]
        const user = users.find((u) => u.id === setterId)
        if (user) setSetterName(user.name)
      })
      .catch(() => { setError(true) })
      .finally(() => setLoading(false))
  }

  useEffect(() => { fetchSettings() }, [setterId])

  const save = async () => {
    setSaving(true)
    try {
      await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ section: 'copilot', ...settings }),
      })
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="p-6"><LoadingFormSection /></div>
  if (error) return <div className="p-6"><ErrorState message="Failed to load settings" onRetry={fetchSettings} /></div>

  return (
    <div className="p-6 max-w-2xl">
      <h1 className="text-sm font-mono font-bold text-[#f0f0f0] mb-1">{setterName} Co-Pilot Settings</h1>
      <p className="text-[13px] font-mono text-[#555] mb-6">Personal AI assistant preferences for {setterName}.</p>

      {/* Response style */}
      <div className="mb-6">
        <label className="text-xs font-mono text-[#666] uppercase tracking-wider mb-2 block">Response Style</label>
        <div className="flex gap-2">
          {[
            { value: 'casual', label: 'Casual', desc: 'Relaxed, friendly approach' },
            { value: 'balanced', label: 'Balanced', desc: 'Professional but warm' },
            { value: 'aggressive', label: 'Aggressive', desc: 'Direct push to booking' },
          ].map((opt) => (
            <button
              key={opt.value}
              onClick={() => setSettings((p) => ({ ...p, response_style: opt.value }))}
              className={cn(
                'flex-1 p-3 rounded-lg border text-left transition-colors',
                settings.response_style === opt.value
                  ? 'bg-[#00ff88]/5 border-[#00ff88]/30'
                  : 'bg-[#0d0d0d] border-[#1a1a1a] hover:border-[#333]'
              )}
            >
              <span className={cn('text-[13px] font-mono font-bold block',
                settings.response_style === opt.value ? 'text-[#00ff88]' : 'text-[#888]')}>
                {opt.label}
              </span>
              <span className="text-[11px] font-mono text-[#555]">{opt.desc}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Suggestions count */}
      <div className="mb-6">
        <label className="text-xs font-mono text-[#666] uppercase tracking-wider mb-2 block">Suggestions to Generate</label>
        <div className="flex gap-2">
          {[1, 2].map((n) => (
            <button key={n}
              onClick={() => setSettings((p) => ({ ...p, suggestions_count: n }))}
              className={cn('w-12 h-9 rounded border text-sm font-mono font-bold transition-colors',
                settings.suggestions_count === n
                  ? 'bg-[#00ff88]/10 text-[#00ff88] border-[#00ff88]/30'
                  : 'text-[#666] border-[#222] hover:border-[#444]')}>
              {n}
            </button>
          ))}
        </div>
      </div>

      {/* Auto-score toggle */}
      <div className="flex items-center justify-between mb-6 p-3 bg-[#0d0d0d] rounded-lg border border-[#1a1a1a]">
        <div>
          <span className="text-[13px] font-mono text-[#ccc] block">Auto-score Leads</span>
          <span className="text-[11px] font-mono text-[#555]">Show real-time heat score updates</span>
        </div>
        <button onClick={() => setSettings((p) => ({ ...p, auto_score_leads: !p.auto_score_leads }))}
          className={cn('w-9 h-5 rounded-full transition-colors relative',
            settings.auto_score_leads ? 'bg-[#00ff88]' : 'bg-[#333]')}>
          <span className={cn('absolute top-0.5 w-4 h-4 bg-white rounded-full transition-transform shadow',
            settings.auto_score_leads ? 'right-0.5' : 'left-0.5')} />
        </button>
      </div>

      {/* Custom instructions */}
      <div className="mb-6">
        <label className="text-xs font-mono text-[#666] uppercase tracking-wider mb-2 block">Custom Instructions</label>
        <textarea
          value={settings.custom_prompt_additions}
          onChange={(e) => setSettings((p) => ({ ...p, custom_prompt_additions: e.target.value }))}
          rows={6}
          placeholder="e.g., Always mention our 30-day money-back guarantee early in the conversation..."
          className="w-full bg-[#111] border border-[#1a1a1a] rounded-lg px-3 py-2.5 text-[13px] font-mono text-[#ccc] placeholder:text-[#333] outline-none resize-none focus:border-[#00ff88]/30"
        />
        <span className="text-[11px] font-mono text-[#444]">{settings.custom_prompt_additions.length} characters</span>
      </div>

      <button onClick={save} disabled={saving}
        className="flex items-center gap-2 px-4 py-2 bg-[#00ff88]/10 border border-[#00ff88]/30 rounded text-[13px] font-mono text-[#00ff88] hover:bg-[#00ff88]/20 disabled:opacity-50 transition-colors">
        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} SAVE SETTINGS
      </button>
    </div>
  )
}
