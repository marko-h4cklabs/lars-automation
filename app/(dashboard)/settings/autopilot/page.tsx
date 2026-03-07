'use client'

import { useState, useEffect } from 'react'
import { Save, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface AutopilotConfig {
  id?: string
  min_delay_seconds: number
  max_delay_seconds: number
  max_messages_per_burst: number
  burst_delay_ms: number
  auto_qualify: boolean
  auto_disqualify: boolean
  auto_send_calendly: boolean
  voice_reply_on_voice: string
}

interface PersonaConfig {
  id?: string
  name: string
  base_prompt: string
  is_global: boolean
}

export default function AutopilotPage() {
  const [autopilot, setAutopilot] = useState<AutopilotConfig>({
    min_delay_seconds: 30, max_delay_seconds: 120, max_messages_per_burst: 2,
    burst_delay_ms: 3000, auto_qualify: true, auto_disqualify: false,
    auto_send_calendly: true, voice_reply_on_voice: 'contextual',
  })
  const [persona, setPersona] = useState<PersonaConfig>({ name: 'Lars AI', base_prompt: '', is_global: true })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetch('/api/settings?section=autopilot')
      .then((r) => r.ok ? r.json() : null)
      .then((d) => {
        if (d?.autopilot) setAutopilot(d.autopilot)
        if (d?.persona) setPersona(d.persona)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const save = async () => {
    setSaving(true)
    try {
      await Promise.all([
        fetch('/api/settings', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ section: 'autopilot', ...autopilot }),
        }),
        fetch('/api/settings', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ section: 'persona', ...persona }),
        }),
      ])
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="p-8 text-[#444] font-mono text-xs">Loading...</div>

  return (
    <div className="p-6 max-w-2xl">
      <h1 className="text-sm font-mono font-bold text-[#f0f0f0] mb-1">Autopilot AI Settings</h1>
      <p className="text-[10px] font-mono text-[#555] mb-6">Configure AI agent behavior when operating in autopilot mode.</p>

      {/* Timing */}
      <Section title="Timing">
        <SliderField label="Min Response Delay" value={autopilot.min_delay_seconds} min={5} max={120} unit="sec"
          onChange={(v) => setAutopilot((p) => ({ ...p, min_delay_seconds: v }))} />
        <SliderField label="Max Response Delay" value={autopilot.max_delay_seconds} min={5} max={300} unit="sec"
          onChange={(v) => setAutopilot((p) => ({ ...p, max_delay_seconds: v }))} />
        <SliderField label="Burst Delay (between messages)" value={autopilot.burst_delay_ms} min={1000} max={8000} step={500} unit="ms"
          onChange={(v) => setAutopilot((p) => ({ ...p, burst_delay_ms: v }))} />
        <div>
          <label className="text-[9px] font-mono text-[#666] block mb-1.5">Max Messages Per Burst</label>
          <div className="flex gap-2">
            {[1, 2, 3].map((n) => (
              <button key={n} onClick={() => setAutopilot((p) => ({ ...p, max_messages_per_burst: n }))}
                className={cn('w-10 h-8 rounded border text-[11px] font-mono font-bold transition-colors',
                  autopilot.max_messages_per_burst === n
                    ? 'bg-[#00ff88]/10 text-[#00ff88] border-[#00ff88]/30'
                    : 'text-[#666] border-[#222] hover:border-[#444]')}>
                {n}
              </button>
            ))}
          </div>
        </div>
      </Section>

      {/* Behavior */}
      <Section title="Behavior">
        <div className="mb-3">
          <label className="text-[9px] font-mono text-[#666] block mb-1.5">Voice Reply Mode</label>
          <div className="flex gap-2">
            {[
              { value: 'always', label: 'Always Voice' },
              { value: 'never', label: 'Never Voice' },
              { value: 'contextual', label: 'Match Lead' },
            ].map((opt) => (
              <button key={opt.value}
                onClick={() => setAutopilot((p) => ({ ...p, voice_reply_on_voice: opt.value }))}
                className={cn('px-3 py-1.5 rounded text-[9px] font-mono border transition-colors',
                  autopilot.voice_reply_on_voice === opt.value
                    ? 'bg-[#00ff88]/10 text-[#00ff88] border-[#00ff88]/30'
                    : 'text-[#666] border-[#222] hover:border-[#444]')}>
                {opt.label}
              </button>
            ))}
          </div>
        </div>
        <ToggleField label="Auto-qualify" desc="AI updates qualification fields from conversation"
          value={autopilot.auto_qualify} onChange={(v) => setAutopilot((p) => ({ ...p, auto_qualify: v }))} />
        <ToggleField label="Auto-disqualify" desc="AI soft-closes disqualified leads"
          value={autopilot.auto_disqualify} onChange={(v) => setAutopilot((p) => ({ ...p, auto_disqualify: v }))} />
        <ToggleField label="Auto-send Calendly" desc="Send booking link when threshold met"
          value={autopilot.auto_send_calendly} onChange={(v) => setAutopilot((p) => ({ ...p, auto_send_calendly: v }))} />
      </Section>

      {/* Custom instructions */}
      <Section title="Custom Instructions">
        <div>
          <textarea
            value={persona.base_prompt}
            onChange={(e) => setPersona((p) => ({ ...p, base_prompt: e.target.value }))}
            rows={8}
            placeholder="Additional instructions for the AI agent... e.g., tone, specific phrases, approach..."
            className="w-full bg-[#111] border border-[#1a1a1a] rounded-lg px-3 py-2.5 text-[10px] font-mono text-[#ccc] placeholder:text-[#333] outline-none resize-none focus:border-[#00ff88]/30"
          />
          <div className="flex items-center justify-between mt-1">
            <span className="text-[8px] font-mono text-[#444]">{persona.base_prompt.length} characters</span>
            {persona.id && (
              <span className="text-[8px] font-mono text-[#333]">Last updated: saved in DB</span>
            )}
          </div>
        </div>
      </Section>

      <button onClick={save} disabled={saving}
        className="flex items-center gap-2 px-4 py-2 bg-[#00ff88]/10 border border-[#00ff88]/30 rounded text-[10px] font-mono text-[#00ff88] hover:bg-[#00ff88]/20 disabled:opacity-50 transition-colors mt-2">
        {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />} SAVE ALL SETTINGS
      </button>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-6">
      <h2 className="text-[9px] font-mono text-[#00ff88] uppercase tracking-wider mb-3 pb-1 border-b border-[#1a1a1a]">{title}</h2>
      <div className="space-y-3">{children}</div>
    </div>
  )
}

function SliderField({ label, value, min, max, step = 1, unit, onChange }: {
  label: string; value: number; min: number; max: number; step?: number; unit: string; onChange: (v: number) => void
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-[9px] font-mono text-[#666]">{label}</span>
        <span className="text-[10px] font-mono text-[#00ff88] font-bold">{value}{unit}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(parseInt(e.target.value))}
        className="w-full h-1 accent-[#00ff88]" />
    </div>
  )
}

function ToggleField({ label, desc, value, onChange }: {
  label: string; desc: string; value: boolean; onChange: (v: boolean) => void
}) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <span className="text-[10px] font-mono text-[#ccc] block">{label}</span>
        <span className="text-[8px] font-mono text-[#555]">{desc}</span>
      </div>
      <button onClick={() => onChange(!value)}
        className={cn('w-9 h-5 rounded-full transition-colors relative shrink-0',
          value ? 'bg-[#00ff88]' : 'bg-[#333]')}>
        <span className={cn('absolute top-0.5 w-4 h-4 bg-white rounded-full transition-transform shadow',
          value ? 'right-0.5' : 'left-0.5')} />
      </button>
    </div>
  )
}
