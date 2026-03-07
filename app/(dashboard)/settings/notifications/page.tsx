'use client'

import { useState, useEffect } from 'react'
import { Save, Loader2, Send } from 'lucide-react'
import { cn } from '@/lib/utils'

interface NotifSettings {
  id?: string
  slack_webhook_url: string
  slack_channel: string
  hot_lead_mode: string
  hot_lead_threshold: number
  call_booked_mode: string
  setter_offline_mode: string
  ai_takeover_mode: string
  dnd_start: string
  dnd_end: string
}

const MODE_OPTIONS = [
  { value: 'slack_and_app', label: 'Slack + In-app' },
  { value: 'app_only', label: 'In-app only' },
  { value: 'off', label: 'Off' },
]

export default function NotificationsPage() {
  const [settings, setSettings] = useState<NotifSettings>({
    slack_webhook_url: '', slack_channel: '',
    hot_lead_mode: 'slack_and_app', hot_lead_threshold: 80,
    call_booked_mode: 'slack_and_app', setter_offline_mode: 'app_only',
    ai_takeover_mode: 'app_only', dnd_start: '', dnd_end: '',
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/settings?section=notifications')
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { if (d?.slack_webhook_url !== undefined) setSettings(d) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const save = async () => {
    setSaving(true)
    try {
      await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ section: 'notifications', ...settings }),
      })
    } finally {
      setSaving(false)
    }
  }

  const testSlack = async () => {
    if (!settings.slack_webhook_url) {
      setTestResult('Missing Slack webhook URL')
      return
    }
    setTesting(true)
    setTestResult(null)
    try {
      const res = await fetch(settings.slack_webhook_url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: '🟢 BlackOps test notification — connection working!' }),
      })
      setTestResult(res.ok ? 'Message sent successfully!' : 'Failed to send. Check webhook URL.')
    } catch {
      setTestResult('Network error. Check webhook URL.')
    } finally {
      setTesting(false)
    }
  }

  if (loading) return <div className="p-8 text-[#444] font-mono text-xs">Loading...</div>

  return (
    <div className="p-6 max-w-2xl">
      <h1 className="text-sm font-mono font-bold text-[#f0f0f0] mb-1">Notification Settings</h1>
      <p className="text-[10px] font-mono text-[#555] mb-6">Configure Slack integration and notification preferences.</p>

      {/* Slack config */}
      <div className="bg-[#0d0d0d] border border-[#1a1a1a] rounded-lg p-4 mb-6 space-y-3">
        <span className="text-[9px] font-mono text-[#00ff88] uppercase tracking-wider">Slack</span>
        <div>
          <label className="text-[8px] font-mono text-[#555] uppercase block mb-1">Webhook URL</label>
          <input type="password" value={settings.slack_webhook_url}
            onChange={(e) => setSettings((p) => ({ ...p, slack_webhook_url: e.target.value }))}
            className="w-full bg-[#111] border border-[#1a1a1a] rounded px-2.5 py-1.5 text-[10px] font-mono text-[#ccc] outline-none focus:border-[#00ff88]/30"
            placeholder="https://hooks.slack.com/services/..." />
        </div>
        <div>
          <label className="text-[8px] font-mono text-[#555] uppercase block mb-1">Channel (optional override)</label>
          <input value={settings.slack_channel}
            onChange={(e) => setSettings((p) => ({ ...p, slack_channel: e.target.value }))}
            className="w-full bg-[#111] border border-[#1a1a1a] rounded px-2.5 py-1.5 text-[10px] font-mono text-[#ccc] outline-none focus:border-[#00ff88]/30"
            placeholder="#notifications" />
        </div>
        <div className="flex items-center gap-2">
          <button onClick={testSlack} disabled={testing}
            className="flex items-center gap-1.5 px-3 py-1.5 text-[9px] font-mono text-[#888] border border-[#222] rounded hover:text-[#00ff88] hover:border-[#00ff88]/30 disabled:opacity-50">
            {testing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />} TEST
          </button>
          {testResult && (
            <span className={cn('text-[9px] font-mono', testResult.includes('success') ? 'text-[#00ff88]' : 'text-[#f05050]')}>
              {testResult}
            </span>
          )}
        </div>
      </div>

      {/* Per-type settings */}
      <div className="space-y-4 mb-6">
        <NotifType label="Hot Lead Alert" desc={`Heat score >= ${settings.hot_lead_threshold}`}
          value={settings.hot_lead_mode} onChange={(v) => setSettings((p) => ({ ...p, hot_lead_mode: v }))} />

        <div className="pl-4 border-l-2 border-[#1a1a1a]">
          <label className="text-[8px] font-mono text-[#555] uppercase block mb-1">Hot Lead Threshold</label>
          <div className="flex items-center gap-2">
            <input type="range" min={50} max={100} value={settings.hot_lead_threshold}
              onChange={(e) => setSettings((p) => ({ ...p, hot_lead_threshold: parseInt(e.target.value) }))}
              className="flex-1 h-1 accent-[#00ff88]" />
            <span className="text-[10px] font-mono text-[#00ff88] font-bold w-8">{settings.hot_lead_threshold}</span>
          </div>
        </div>

        <NotifType label="Call Booked" desc="When a lead books via Calendly"
          value={settings.call_booked_mode} onChange={(v) => setSettings((p) => ({ ...p, call_booked_mode: v }))} />
        <NotifType label="Setter Offline" desc="Admin alert when setter goes offline"
          value={settings.setter_offline_mode} onChange={(v) => setSettings((p) => ({ ...p, setter_offline_mode: v }))} />
        <NotifType label="AI Takeover" desc="When conversation transfers to AI"
          value={settings.ai_takeover_mode} onChange={(v) => setSettings((p) => ({ ...p, ai_takeover_mode: v }))} />
      </div>

      {/* DND */}
      <div className="bg-[#0d0d0d] border border-[#1a1a1a] rounded-lg p-4 mb-6">
        <span className="text-[9px] font-mono text-[#666] uppercase tracking-wider">Do Not Disturb (optional)</span>
        <div className="flex gap-3 mt-2">
          <div>
            <label className="text-[8px] font-mono text-[#555] block mb-1">Start</label>
            <input type="time" value={settings.dnd_start}
              onChange={(e) => setSettings((p) => ({ ...p, dnd_start: e.target.value }))}
              className="bg-[#111] border border-[#1a1a1a] rounded px-2 py-1 text-[10px] font-mono text-[#ccc] outline-none" />
          </div>
          <div>
            <label className="text-[8px] font-mono text-[#555] block mb-1">End</label>
            <input type="time" value={settings.dnd_end}
              onChange={(e) => setSettings((p) => ({ ...p, dnd_end: e.target.value }))}
              className="bg-[#111] border border-[#1a1a1a] rounded px-2 py-1 text-[10px] font-mono text-[#ccc] outline-none" />
          </div>
        </div>
      </div>

      <button onClick={save} disabled={saving}
        className="flex items-center gap-2 px-4 py-2 bg-[#00ff88]/10 border border-[#00ff88]/30 rounded text-[10px] font-mono text-[#00ff88] hover:bg-[#00ff88]/20 disabled:opacity-50 transition-colors">
        {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />} SAVE SETTINGS
      </button>
    </div>
  )
}

function NotifType({ label, desc, value, onChange }: {
  label: string; desc: string; value: string; onChange: (v: string) => void
}) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <span className="text-[10px] font-mono text-[#ccc] block">{label}</span>
        <span className="text-[8px] font-mono text-[#555]">{desc}</span>
      </div>
      <div className="flex gap-1">
        {MODE_OPTIONS.map((opt) => (
          <button key={opt.value} onClick={() => onChange(opt.value)}
            className={cn('px-2 py-1 rounded text-[8px] font-mono border transition-colors',
              value === opt.value
                ? 'bg-[#00ff88]/10 text-[#00ff88] border-[#00ff88]/30'
                : 'text-[#555] border-[#1a1a1a] hover:border-[#333]')}>
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  )
}
