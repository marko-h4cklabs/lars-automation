'use client'

import { useState, useEffect } from 'react'
import { Save, Loader2, Copy, Check, ExternalLink } from 'lucide-react'
import { LoadingFormSection } from '@/components/ui/loading-pulse'
import { ErrorState } from '@/components/ui/error-state'

interface IntegrationSettings {
  id?: string
  calendly_link: string
  manychat_page_id: string
}

const WEBHOOK_ENDPOINTS = [
  { label: 'DM Webhook', path: '/api/webhooks/manychat/dm' },
  { label: 'Story Reply', path: '/api/webhooks/manychat/story-reply' },
  { label: 'Comment', path: '/api/webhooks/manychat/comment' },
  { label: 'Voice', path: '/api/webhooks/manychat/voice' },
]

export default function IntegrationsPage() {
  const [settings, setSettings] = useState<IntegrationSettings>({
    calendly_link: '', manychat_page_id: '',
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null)
  const [error, setError] = useState(false)

  const domain = typeof window !== 'undefined' ? window.location.origin : 'https://your-domain.com'

  const fetchSettings = () => {
    setError(false)
    setLoading(true)
    fetch('/api/settings?section=integrations')
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { if (d) setSettings({ id: d.id, calendly_link: d.calendly_link ?? '', manychat_page_id: d.manychat_page_id ?? '' }) })
      .catch(() => { setError(true) })
      .finally(() => setLoading(false))
  }

  useEffect(() => { fetchSettings() }, [])

  const save = async () => {
    setSaving(true)
    try {
      await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ section: 'integrations', ...settings }),
      })
    } finally {
      setSaving(false)
    }
  }

  const copyUrl = (idx: number, path: string) => {
    navigator.clipboard.writeText(`${domain}${path}`)
    setCopiedIdx(idx)
    setTimeout(() => setCopiedIdx(null), 2000)
  }

  if (loading) return <div className="p-6"><LoadingFormSection /></div>
  if (error) return <div className="p-6"><ErrorState message="Failed to load settings" onRetry={fetchSettings} /></div>

  return (
    <div className="p-6 max-w-2xl">
      <h1 className="text-sm font-mono font-bold text-[#f0f0f0] mb-1">Integrations</h1>
      <p className="text-[13px] font-mono text-[#555] mb-6">Connect external services to the BlackOps platform.</p>

      {/* Env Var Info */}
      <div className="bg-[#111] border border-[#1a1a1a] rounded-lg p-3 mb-6">
        <span className="text-[11px] font-mono text-[#666] uppercase tracking-wider block mb-1.5">API Keys &amp; Credentials</span>
        <p className="text-xs font-mono text-[#555] leading-relaxed">
          API keys (ManyChat, Calendly webhook secret, Anthropic, OpenAI, ElevenLabs) are configured as environment variables in Vercel and are never stored in the database.
        </p>
      </div>

      {/* Calendly */}
      <div className="bg-[#0d0d0d] border border-[#1a1a1a] rounded-lg p-4 mb-6 space-y-3">
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono text-[#00ff88] uppercase tracking-wider">Calendly</span>
        </div>
        <div>
          <label className="text-[11px] font-mono text-[#555] uppercase block mb-1">Booking Link</label>
          <input value={settings.calendly_link}
            onChange={(e) => setSettings((p) => ({ ...p, calendly_link: e.target.value }))}
            className="w-full bg-[#111] border border-[#1a1a1a] rounded px-3 py-2 text-[13px] font-mono text-[#ccc] outline-none focus:border-[#00ff88]/30"
            placeholder="https://calendly.com/your-link" />
        </div>
        <div className="flex items-center gap-2">
          <a href={settings.calendly_link || '#'} target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-1 text-[11px] font-mono text-[#666] hover:text-[#00ff88]">
            <ExternalLink className="w-3.5 h-3.5" /> Test Link
          </a>
        </div>
      </div>

      {/* ManyChat */}
      <div className="bg-[#0d0d0d] border border-[#1a1a1a] rounded-lg p-4 mb-6 space-y-3">
        <span className="text-xs font-mono text-[#00ff88] uppercase tracking-wider">ManyChat</span>
        <div>
          <label className="text-[11px] font-mono text-[#555] uppercase block mb-1">Page ID</label>
          <input value={settings.manychat_page_id}
            onChange={(e) => setSettings((p) => ({ ...p, manychat_page_id: e.target.value }))}
            className="w-full bg-[#111] border border-[#1a1a1a] rounded px-3 py-2 text-[13px] font-mono text-[#ccc] outline-none focus:border-[#00ff88]/30" />
        </div>

        {/* Webhook URLs */}
        <div className="mt-3">
          <span className="text-[11px] font-mono text-[#555] uppercase tracking-wider block mb-2">
            Webhook URLs (paste these in ManyChat)
          </span>
          <div className="space-y-1.5">
            {WEBHOOK_ENDPOINTS.map((ep, idx) => (
              <div key={ep.path} className="flex items-center gap-2 bg-[#111] rounded px-3 py-2">
                <span className="text-[11px] font-mono text-[#666] w-20 shrink-0">{ep.label}</span>
                <span className="text-xs font-mono text-[#888] truncate flex-1">{domain}{ep.path}</span>
                <button onClick={() => copyUrl(idx, ep.path)}
                  className="text-[#444] hover:text-[#00ff88] shrink-0">
                  {copiedIdx === idx ? <Check className="w-4 h-4 text-[#00ff88]" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      <button onClick={save} disabled={saving}
        className="flex items-center gap-2 px-4 py-2 bg-[#00ff88]/10 border border-[#00ff88]/30 rounded text-[13px] font-mono text-[#00ff88] hover:bg-[#00ff88]/20 disabled:opacity-50 transition-colors">
        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} SAVE SETTINGS
      </button>
    </div>
  )
}
