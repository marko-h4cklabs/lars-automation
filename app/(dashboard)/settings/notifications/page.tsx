'use client'

import { useState, useEffect } from 'react'
import { Save, Loader2, Send, Volume2, VolumeX } from 'lucide-react'
import { cn } from '@/lib/utils'
import { LoadingFormSection } from '@/components/ui/loading-pulse'
import { ErrorState } from '@/components/ui/error-state'

interface NotifSettings {
  id?: string
  slack_webhook_alerts: string
  slack_webhook_system: string
  hot_lead_mode: string
  hot_lead_threshold: number
  call_booked_mode: string
  setter_offline_mode: string
  dnd_start: string
  dnd_end: string
}

const MODE_OPTIONS = [
  { value: 'slack_and_app', label: 'Slack + In-app' },
  { value: 'app_only', label: 'In-app only' },
  { value: 'off', label: 'Off' },
]

const SOUND_KEY = 'blackops:notification_sound'

export default function NotificationsPage() {
  const [settings, setSettings] = useState<NotifSettings>({
    slack_webhook_alerts: '',
    slack_webhook_system: '',
    hot_lead_mode: 'slack_and_app',
    hot_lead_threshold: 80,
    call_booked_mode: 'slack_and_app',
    setter_offline_mode: 'app_only',
    dnd_start: '',
    dnd_end: '',
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState<'alerts' | 'system' | null>(null)
  const [testResult, setTestResult] = useState<string | null>(null)
  const [soundEnabled, setSoundEnabled] = useState(true)
  const [error, setError] = useState(false)

  const fetchSettings = () => {
    setError(false)
    setLoading(true)
    fetch('/api/settings?section=notifications')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.slack_webhook_alerts !== undefined) setSettings(d)
      })
      .catch(() => { setError(true) })
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    fetchSettings()

    if (typeof window !== 'undefined') {
      setSoundEnabled(localStorage.getItem(SOUND_KEY) !== 'false')
    }
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

  const testSlack = async (channel: 'alerts' | 'system') => {
    const url =
      channel === 'alerts'
        ? settings.slack_webhook_alerts
        : settings.slack_webhook_system || settings.slack_webhook_alerts

    if (!url) {
      setTestResult('Missing webhook URL')
      return
    }

    setTesting(channel)
    setTestResult(null)
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text:
            channel === 'alerts'
              ? '🟢 BlackOps test — Alerts channel connected!'
              : '🟢 BlackOps test — System channel connected!',
        }),
      })
      setTestResult(res.ok ? 'Message sent!' : 'Failed. Check URL.')
    } catch {
      setTestResult('Network error. Check URL.')
    } finally {
      setTesting(null)
    }
  }

  const toggleSound = () => {
    const newVal = !soundEnabled
    setSoundEnabled(newVal)
    if (typeof window !== 'undefined') {
      localStorage.setItem(SOUND_KEY, String(newVal))
    }
  }

  if (loading) return <div className="p-6"><LoadingFormSection /></div>
  if (error) return <div className="p-6"><ErrorState message="Failed to load settings" onRetry={fetchSettings} /></div>

  return (
    <div className="p-6 max-w-2xl">
      <h1 className="text-sm font-mono font-bold text-[#f0f0f0] mb-1">Notification Settings</h1>
      <p className="text-[13px] font-mono text-[#555] mb-6">
        Configure Slack integration, notification preferences, and alert behavior.
      </p>

      {/* ═══ Slack Webhooks ═══ */}
      <div className="bg-[#0d0d0d] border border-[#1a1a1a] rounded-lg p-4 mb-6 space-y-4">
        <span className="text-xs font-mono text-[#00ff88] uppercase tracking-wider">
          Slack Webhooks
        </span>

        {/* Alerts Webhook */}
        <div>
          <label className="text-[11px] font-mono text-[#555] uppercase block mb-1">
            Alerts Webhook URL (Hot Leads + Bookings)
          </label>
          <input
            type="password"
            value={settings.slack_webhook_alerts}
            onChange={(e) =>
              setSettings((p) => ({ ...p, slack_webhook_alerts: e.target.value }))
            }
            className="w-full bg-[#111] border border-[#1a1a1a] rounded px-3 py-2 text-[13px] font-mono text-[#ccc] outline-none focus:border-[#00ff88]/30"
            placeholder="https://hooks.slack.com/services/..."
          />
          <div className="flex items-center gap-2 mt-2">
            <button
              onClick={() => testSlack('alerts')}
              disabled={testing === 'alerts'}
              className="flex items-center gap-1.5 px-3 py-1 text-xs font-mono text-[#888] border border-[#222] rounded hover:text-[#00ff88] hover:border-[#00ff88]/30 disabled:opacity-50"
            >
              {testing === 'alerts' ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}{' '}
              TEST ALERTS
            </button>
            {testResult && testing === null && (
              <span
                className={cn(
                  'text-xs font-mono',
                  testResult.includes('sent') ? 'text-[#00ff88]' : 'text-[#f05050]'
                )}
              >
                {testResult}
              </span>
            )}
          </div>
        </div>

        {/* System Webhook */}
        <div>
          <label className="text-[11px] font-mono text-[#555] uppercase block mb-1">
            System Webhook URL (Offline + AI Takeover) — optional, falls back to Alerts
          </label>
          <input
            type="password"
            value={settings.slack_webhook_system}
            onChange={(e) =>
              setSettings((p) => ({ ...p, slack_webhook_system: e.target.value }))
            }
            className="w-full bg-[#111] border border-[#1a1a1a] rounded px-3 py-2 text-[13px] font-mono text-[#ccc] outline-none focus:border-[#00ff88]/30"
            placeholder="https://hooks.slack.com/services/... (optional)"
          />
          <div className="flex items-center gap-2 mt-2">
            <button
              onClick={() => testSlack('system')}
              disabled={testing === 'system'}
              className="flex items-center gap-1.5 px-3 py-1 text-xs font-mono text-[#888] border border-[#222] rounded hover:text-[#00ff88] hover:border-[#00ff88]/30 disabled:opacity-50"
            >
              {testing === 'system' ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}{' '}
              TEST SYSTEM
            </button>
          </div>
        </div>
      </div>

      {/* ═══ Per-Type Settings ═══ */}
      <div className="space-y-4 mb-6">
        <NotifType
          label="Hot Lead Alert"
          desc={`Heat score >= ${settings.hot_lead_threshold}`}
          value={settings.hot_lead_mode}
          onChange={(v) => setSettings((p) => ({ ...p, hot_lead_mode: v }))}
        />

        <div className="pl-4 border-l-2 border-[#1a1a1a]">
          <label className="text-[11px] font-mono text-[#555] uppercase block mb-1">
            Hot Lead Threshold
          </label>
          <div className="flex items-center gap-2">
            <input
              type="range"
              min={50}
              max={100}
              value={settings.hot_lead_threshold}
              onChange={(e) =>
                setSettings((p) => ({
                  ...p,
                  hot_lead_threshold: parseInt(e.target.value),
                }))
              }
              className="flex-1 h-1 accent-[#00ff88]"
            />
            <span className="text-[13px] font-mono text-[#00ff88] font-bold w-8">
              {settings.hot_lead_threshold}
            </span>
          </div>
        </div>

        <NotifType
          label="Call Booked"
          desc="When a lead books via Calendly"
          value={settings.call_booked_mode}
          onChange={(v) => setSettings((p) => ({ ...p, call_booked_mode: v }))}
        />
        <NotifType
          label="Setter Went Offline"
          desc="Admin alert when setter goes offline"
          value={settings.setter_offline_mode}
          onChange={(v) => setSettings((p) => ({ ...p, setter_offline_mode: v }))}
        />
      </div>

      {/* ═══ Sound Settings ═══ */}
      <div className="bg-[#0d0d0d] border border-[#1a1a1a] rounded-lg p-4 mb-6">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-xs font-mono text-[#666] uppercase tracking-wider block">
              Sound Alert
            </span>
            <span className="text-[11px] font-mono text-[#444]">
              Play sound for Hot Lead and Call Booked notifications
            </span>
          </div>
          <button
            onClick={toggleSound}
            className={cn(
              'flex items-center gap-1.5 px-3 py-2 rounded text-xs font-mono border transition-colors',
              soundEnabled
                ? 'bg-[#00ff88]/10 text-[#00ff88] border-[#00ff88]/30'
                : 'text-[#555] border-[#1a1a1a]'
            )}
          >
            {soundEnabled ? (
              <Volume2 className="w-4 h-4" />
            ) : (
              <VolumeX className="w-4 h-4" />
            )}
            {soundEnabled ? 'ON' : 'OFF'}
          </button>
        </div>
      </div>

      {/* ═══ Do Not Disturb ═══ */}
      <div className="bg-[#0d0d0d] border border-[#1a1a1a] rounded-lg p-4 mb-6">
        <span className="text-xs font-mono text-[#666] uppercase tracking-wider">
          Do Not Disturb (suppresses Slack only)
        </span>
        <div className="flex gap-3 mt-2">
          <div>
            <label className="text-[11px] font-mono text-[#555] block mb-1">Start</label>
            <input
              type="time"
              value={settings.dnd_start}
              onChange={(e) =>
                setSettings((p) => ({ ...p, dnd_start: e.target.value }))
              }
              className="bg-[#111] border border-[#1a1a1a] rounded px-3 py-1.5 text-[13px] font-mono text-[#ccc] outline-none"
            />
          </div>
          <div>
            <label className="text-[11px] font-mono text-[#555] block mb-1">End</label>
            <input
              type="time"
              value={settings.dnd_end}
              onChange={(e) =>
                setSettings((p) => ({ ...p, dnd_end: e.target.value }))
              }
              className="bg-[#111] border border-[#1a1a1a] rounded px-3 py-1.5 text-[13px] font-mono text-[#ccc] outline-none"
            />
          </div>
        </div>
      </div>

      {/* ═══ Save Button ═══ */}
      <button
        onClick={save}
        disabled={saving}
        className="flex items-center gap-2 px-4 py-2 bg-[#00ff88]/10 border border-[#00ff88]/30 rounded text-[13px] font-mono text-[#00ff88] hover:bg-[#00ff88]/20 disabled:opacity-50 transition-colors"
      >
        {saving ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <Save className="w-4 h-4" />
        )}{' '}
        SAVE SETTINGS
      </button>
    </div>
  )
}

function NotifType({
  label,
  desc,
  value,
  onChange,
}: {
  label: string
  desc: string
  value: string
  onChange: (v: string) => void
}) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <span className="text-[13px] font-mono text-[#ccc] block">{label}</span>
        <span className="text-[11px] font-mono text-[#555]">{desc}</span>
      </div>
      <div className="flex gap-1">
        {MODE_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => onChange(opt.value)}
            className={cn(
              'px-3 py-1.5 rounded text-[11px] font-mono border transition-colors',
              value === opt.value
                ? 'bg-[#00ff88]/10 text-[#00ff88] border-[#00ff88]/30'
                : 'text-[#555] border-[#1a1a1a] hover:border-[#333]'
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  )
}
