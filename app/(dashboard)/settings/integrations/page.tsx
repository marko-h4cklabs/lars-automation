'use client'

import { useState, useEffect } from 'react'
import { Save, Loader2, Copy, Check, ExternalLink } from 'lucide-react'

interface IntegrationSettings {
  id?: string
  calendly_link: string
  calendly_webhook_secret: string
  manychat_api_key: string
  manychat_page_id: string
}

const WEBHOOK_ENDPOINTS = [
  { label: 'DM Webhook', path: '/api/webhooks/manychat/dm' },
  { label: 'Story Reply', path: '/api/webhooks/manychat/story-reply' },
  { label: 'Comment', path: '/api/webhooks/manychat/comment' },
  { label: 'Follow', path: '/api/webhooks/manychat/follow' },
  { label: 'Keyword', path: '/api/webhooks/manychat/keyword' },
  { label: 'Voice', path: '/api/webhooks/manychat/voice' },
]

export default function IntegrationsPage() {
  const [settings, setSettings] = useState<IntegrationSettings>({
    calendly_link: '', calendly_webhook_secret: '',
    manychat_api_key: '', manychat_page_id: '',
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null)

  const domain = typeof window !== 'undefined' ? window.location.origin : 'https://your-domain.com'

  useEffect(() => {
    fetch('/api/settings?section=integrations')
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { if (d?.calendly_link !== undefined) setSettings(d) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

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

  if (loading) return <div className="p-8 text-[#444] font-mono text-xs">Loading...</div>

  return (
    <div className="p-6 max-w-2xl">
      <h1 className="text-sm font-mono font-bold text-[#f0f0f0] mb-1">Integrations</h1>
      <p className="text-[10px] font-mono text-[#555] mb-6">Connect external services to the BlackOps platform.</p>

      {/* Calendly */}
      <div className="bg-[#0d0d0d] border border-[#1a1a1a] rounded-lg p-4 mb-6 space-y-3">
        <div className="flex items-center gap-2">
          <span className="text-[9px] font-mono text-[#00ff88] uppercase tracking-wider">Calendly</span>
        </div>
        <div>
          <label className="text-[8px] font-mono text-[#555] uppercase block mb-1">Booking Link</label>
          <input value={settings.calendly_link}
            onChange={(e) => setSettings((p) => ({ ...p, calendly_link: e.target.value }))}
            className="w-full bg-[#111] border border-[#1a1a1a] rounded px-2.5 py-1.5 text-[10px] font-mono text-[#ccc] outline-none focus:border-[#00ff88]/30"
            placeholder="https://calendly.com/your-link" />
        </div>
        <div>
          <label className="text-[8px] font-mono text-[#555] uppercase block mb-1">Webhook Secret</label>
          <input type="password" value={settings.calendly_webhook_secret}
            onChange={(e) => setSettings((p) => ({ ...p, calendly_webhook_secret: e.target.value }))}
            className="w-full bg-[#111] border border-[#1a1a1a] rounded px-2.5 py-1.5 text-[10px] font-mono text-[#ccc] outline-none focus:border-[#00ff88]/30"
            placeholder="whsec_..." />
        </div>
        <div className="flex items-center gap-2">
          <a href={settings.calendly_link || '#'} target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-1 text-[8px] font-mono text-[#666] hover:text-[#00ff88]">
            <ExternalLink className="w-2.5 h-2.5" /> Test Link
          </a>
        </div>
      </div>

      {/* ManyChat */}
      <div className="bg-[#0d0d0d] border border-[#1a1a1a] rounded-lg p-4 mb-6 space-y-3">
        <span className="text-[9px] font-mono text-[#00ff88] uppercase tracking-wider">ManyChat</span>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-[8px] font-mono text-[#555] uppercase block mb-1">API Key</label>
            <input type="password" value={settings.manychat_api_key}
              onChange={(e) => setSettings((p) => ({ ...p, manychat_api_key: e.target.value }))}
              className="w-full bg-[#111] border border-[#1a1a1a] rounded px-2.5 py-1.5 text-[10px] font-mono text-[#ccc] outline-none focus:border-[#00ff88]/30" />
          </div>
          <div>
            <label className="text-[8px] font-mono text-[#555] uppercase block mb-1">Page ID</label>
            <input value={settings.manychat_page_id}
              onChange={(e) => setSettings((p) => ({ ...p, manychat_page_id: e.target.value }))}
              className="w-full bg-[#111] border border-[#1a1a1a] rounded px-2.5 py-1.5 text-[10px] font-mono text-[#ccc] outline-none focus:border-[#00ff88]/30" />
          </div>
        </div>

        {/* Webhook URLs */}
        <div className="mt-3">
          <span className="text-[8px] font-mono text-[#555] uppercase tracking-wider block mb-2">
            Webhook URLs (paste these in ManyChat)
          </span>
          <div className="space-y-1.5">
            {WEBHOOK_ENDPOINTS.map((ep, idx) => (
              <div key={ep.path} className="flex items-center gap-2 bg-[#111] rounded px-2.5 py-1.5">
                <span className="text-[8px] font-mono text-[#666] w-20 shrink-0">{ep.label}</span>
                <span className="text-[9px] font-mono text-[#888] truncate flex-1">{domain}{ep.path}</span>
                <button onClick={() => copyUrl(idx, ep.path)}
                  className="text-[#444] hover:text-[#00ff88] shrink-0">
                  {copiedIdx === idx ? <Check className="w-3 h-3 text-[#00ff88]" /> : <Copy className="w-3 h-3" />}
                </button>
              </div>
            ))}
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
