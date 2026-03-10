'use client'

import { useState, useEffect } from 'react'
import { Plus, Trash2, Save, Loader2, Zap, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { LoadingTable } from '@/components/ui/loading-pulse'
import { ErrorState } from '@/components/ui/error-state'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { ResponsiveTable } from '@/components/ui/responsive-table'

interface Trigger {
  id?: string
  keyword: string
  match_type: string
  source: string
  response_template: string
  is_active: boolean
}

export default function KeywordsPage() {
  const [triggers, setTriggers] = useState<Trigger[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<Trigger | null>(null)
  const [saving, setSaving] = useState(false)
  const [testText, setTestText] = useState('')
  const [testResults, setTestResults] = useState<string[] | null>(null)
  const [error, setError] = useState(false)
  const [deleteTriggerId, setDeleteTriggerId] = useState<string | null>(null)

  const fetchTriggers = () => {
    setError(false)
    setLoading(true)
    fetch('/api/settings?section=keywords')
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { if (d?.triggers) setTriggers(d.triggers) })
      .catch(() => { setError(true) })
      .finally(() => setLoading(false))
  }

  useEffect(() => { fetchTriggers() }, [])

  const saveTrigger = async (trigger: Trigger) => {
    setSaving(true)
    try {
      await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ section: 'keyword', ...trigger }),
      })
      const res = await fetch('/api/settings?section=keywords')
      const data = await res.json()
      setTriggers(data.triggers)
      setEditing(null)
    } finally {
      setSaving(false)
    }
  }

  const deleteTrigger = async (id: string) => {
    await fetch(`/api/settings?section=keyword&id=${id}`, { method: 'DELETE' })
    setTriggers((prev) => prev.filter((t) => t.id !== id))
    setDeleteTriggerId(null)
  }

  const toggleActive = async (trigger: Trigger) => {
    const updated = { ...trigger, is_active: !trigger.is_active }
    setTriggers((prev) => prev.map((t) => t.id === trigger.id ? updated : t))
    await fetch('/api/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ section: 'keyword', ...updated }),
    })
  }

  const runTest = () => {
    if (!testText) return
    const matches = triggers.filter((t) => {
      if (!t.is_active) return false
      switch (t.match_type) {
        case 'exact': return testText.toLowerCase() === t.keyword.toLowerCase()
        case 'contains': return testText.toLowerCase().includes(t.keyword.toLowerCase())
        case 'starts_with': return testText.toLowerCase().startsWith(t.keyword.toLowerCase())
        case 'regex': try { return new RegExp(t.keyword, 'i').test(testText) } catch { return false }
        default: return false
      }
    })
    setTestResults(matches.map((m) => `"${m.keyword}" (${m.match_type})`))
  }

  if (loading) return <div className="p-6"><LoadingTable /></div>
  if (error) return <div className="p-6"><ErrorState message="Failed to load settings" onRetry={fetchTriggers} /></div>

  return (
    <div className="p-6 max-w-3xl">
      <h1 className="text-sm font-mono font-bold text-[#f0f0f0] mb-1">Keyword Triggers</h1>
      <p className="text-[10px] font-mono text-[#555] mb-6">Automatic responses when leads send specific keywords.</p>

      {/* Triggers table */}
      <ResponsiveTable className="border border-[#1a1a1a] rounded-lg overflow-hidden mb-4">
        <table className="w-full">
          <thead>
            <tr className="bg-[#0d0d0d] border-b border-[#1a1a1a]">
              <th className="px-3 py-2 text-left text-[8px] font-mono text-[#555] uppercase">Keyword</th>
              <th className="px-3 py-2 text-left text-[8px] font-mono text-[#555] uppercase">Match</th>
              <th className="px-3 py-2 text-left text-[8px] font-mono text-[#555] uppercase">Source</th>
              <th className="px-3 py-2 text-left text-[8px] font-mono text-[#555] uppercase">Response</th>
              <th className="px-3 py-2 text-left text-[8px] font-mono text-[#555] uppercase">Active</th>
              <th className="px-3 py-2 w-20"></th>
            </tr>
          </thead>
          <tbody>
            {triggers.map((t) => (
              <tr key={t.id} className="border-b border-[#111] hover:bg-[#0d0d0d]">
                <td className="px-3 py-2 text-[10px] font-mono text-[#ccc] font-bold">{t.keyword}</td>
                <td className="px-3 py-2 text-[9px] font-mono text-[#666]">{t.match_type}</td>
                <td className="px-3 py-2 text-[9px] font-mono text-[#666]">{t.source}</td>
                <td className="px-3 py-2 text-[9px] font-mono text-[#555] truncate max-w-[200px]">
                  {t.response_template.includes('|||')
                    ? <span>{t.response_template.split('|||').length} messages</span>
                    : t.response_template}
                </td>
                <td className="px-3 py-2">
                  <button onClick={() => toggleActive(t)}
                    className={cn('w-8 h-4 rounded-full transition-colors relative',
                      t.is_active ? 'bg-[#00ff88]' : 'bg-[#333]')}>
                    <span className={cn('absolute top-0.5 w-3 h-3 bg-white rounded-full transition-transform',
                      t.is_active ? 'right-0.5' : 'left-0.5')} />
                  </button>
                </td>
                <td className="px-3 py-2 flex gap-1">
                  <button onClick={() => setEditing(t)} className="text-[8px] font-mono text-[#666] hover:text-[#ccc] px-1.5 py-0.5 border border-[#222] rounded">EDIT</button>
                  <button onClick={() => t.id && setDeleteTriggerId(t.id)} className="text-[#444] hover:text-[#f05050]"><Trash2 className="w-3 h-3" /></button>
                </td>
              </tr>
            ))}
            {triggers.length === 0 && (
              <tr><td colSpan={6} className="px-3 py-6 text-center text-[10px] font-mono text-[#444]">No triggers configured</td></tr>
            )}
          </tbody>
        </table>
      </ResponsiveTable>

      {/* Editor */}
      {editing && (
        <TriggerEditor trigger={editing} onSave={saveTrigger} onCancel={() => setEditing(null)} saving={saving} />
      )}

      {!editing && (
        <button
          onClick={() => setEditing({ keyword: '', match_type: 'contains', source: 'any', response_template: '', is_active: true })}
          className="flex items-center gap-1.5 px-3 py-1.5 text-[9px] font-mono text-[#888] border border-dashed border-[#333] rounded hover:text-[#00ff88] hover:border-[#00ff88]/30 transition-colors mb-6"
        >
          <Plus className="w-3 h-3" /> ADD TRIGGER
        </button>
      )}

      {/* Test section */}
      <div className="bg-[#0d0d0d] border border-[#1a1a1a] rounded-lg p-4 mt-6">
        <div className="flex items-center gap-1.5 mb-3">
          <Zap className="w-3 h-3 text-[#00ff88]" />
          <span className="text-[9px] font-mono text-[#00ff88] uppercase tracking-wider">Test Triggers</span>
        </div>
        <div className="flex gap-2">
          <input
            value={testText}
            onChange={(e) => { setTestText(e.target.value); setTestResults(null) }}
            placeholder="Enter test message..."
            className="flex-1 bg-[#111] border border-[#1a1a1a] rounded px-2.5 py-1.5 text-[10px] font-mono text-[#ccc] placeholder:text-[#333] outline-none focus:border-[#00ff88]/30"
          />
          <button onClick={runTest} className="px-3 py-1.5 text-[9px] font-mono text-[#888] border border-[#222] rounded hover:text-[#00ff88] hover:border-[#00ff88]/30">
            TEST
          </button>
        </div>
        {testResults !== null && (
          <p className="text-[10px] font-mono mt-2 text-[#888]">
            {testResults.length > 0 ? `Matches: ${testResults.join(', ')}` : 'No triggers matched.'}
          </p>
        )}
      </div>

      <ConfirmDialog
        open={!!deleteTriggerId}
        title="Delete Trigger"
        description="This keyword trigger will be permanently removed."
        onConfirm={() => { if (deleteTriggerId) deleteTrigger(deleteTriggerId) }}
        onCancel={() => setDeleteTriggerId(null)}
      />
    </div>
  )
}

function TriggerEditor({ trigger, onSave, onCancel, saving }: {
  trigger: Trigger; onSave: (t: Trigger) => void; onCancel: () => void; saving: boolean
}) {
  const [t, setT] = useState(trigger)

  // Split stored template into individual messages (||| delimiter)
  const messages = (t.response_template || '').split('|||').map((m) => m.trim()).filter(Boolean)
  if (messages.length === 0) messages.push('')

  const updateMessages = (msgs: string[]) => {
    setT({ ...t, response_template: msgs.join('|||') })
  }

  const setMessage = (idx: number, val: string) => {
    const updated = [...messages]
    updated[idx] = val
    updateMessages(updated)
  }

  const addMessage = () => {
    updateMessages([...messages, ''])
  }

  const removeMessage = (idx: number) => {
    if (messages.length <= 1) return
    const updated = messages.filter((_, i) => i !== idx)
    updateMessages(updated)
  }

  return (
    <div className="bg-[#0d0d0d] border border-[#1a1a1a] rounded-lg p-4 mb-4 space-y-3">
      <div className="flex justify-between items-center">
        <span className="text-[9px] font-mono text-[#00ff88] uppercase">{trigger.id ? 'Edit' : 'New'} Trigger</span>
        <button onClick={onCancel} className="text-[#444] hover:text-[#888]"><X className="w-3 h-3" /></button>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="text-[8px] font-mono text-[#555] uppercase block mb-1">Keyword</label>
          <input value={t.keyword} onChange={(e) => setT({ ...t, keyword: e.target.value })}
            className="w-full bg-[#111] border border-[#1a1a1a] rounded px-2.5 py-1.5 text-[10px] font-mono text-[#ccc] outline-none focus:border-[#00ff88]/30" />
        </div>
        <div>
          <label className="text-[8px] font-mono text-[#555] uppercase block mb-1">Match Type</label>
          <select value={t.match_type} onChange={(e) => setT({ ...t, match_type: e.target.value })}
            className="w-full bg-[#111] border border-[#1a1a1a] rounded px-2.5 py-1.5 text-[10px] font-mono text-[#ccc] outline-none">
            <option value="exact">Exact</option>
            <option value="contains">Contains</option>
            <option value="starts_with">Starts With</option>
            <option value="regex">Regex</option>
          </select>
        </div>
        <div>
          <label className="text-[8px] font-mono text-[#555] uppercase block mb-1">Source</label>
          <select value={t.source} onChange={(e) => setT({ ...t, source: e.target.value })}
            className="w-full bg-[#111] border border-[#1a1a1a] rounded px-2.5 py-1.5 text-[10px] font-mono text-[#ccc] outline-none">
            <option value="any">Any</option>
            <option value="dm">DM</option>
            <option value="story_reply">Story Reply</option>
            <option value="comment">Comment</option>
          </select>
        </div>
      </div>
      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="text-[8px] font-mono text-[#555] uppercase">Messages</label>
          <span className="text-[8px] font-mono text-[#444]">{messages.length} message{messages.length > 1 ? 's' : ''} &middot; sent 1.5s apart</span>
        </div>
        <div className="space-y-2">
          {messages.map((msg, idx) => (
            <div key={idx} className="flex gap-2 items-start">
              <span className="text-[8px] font-mono text-[#444] mt-2 shrink-0 w-4 text-right">{idx + 1}.</span>
              <textarea
                value={msg}
                onChange={(e) => setMessage(idx, e.target.value)}
                rows={2}
                placeholder={idx === 0 ? 'Hey {first_name}!' : 'Next message...'}
                className="flex-1 bg-[#111] border border-[#1a1a1a] rounded px-2.5 py-1.5 text-[10px] font-mono text-[#ccc] placeholder:text-[#333] outline-none resize-none focus:border-[#00ff88]/30"
              />
              {messages.length > 1 && (
                <button onClick={() => removeMessage(idx)} className="text-[#444] hover:text-[#f05050] mt-1.5 shrink-0">
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          ))}
        </div>
        <button
          onClick={addMessage}
          className="flex items-center gap-1 mt-2 px-2 py-1 text-[8px] font-mono text-[#666] border border-dashed border-[#333] rounded hover:text-[#00ff88] hover:border-[#00ff88]/30 transition-colors"
        >
          <Plus className="w-2.5 h-2.5" /> ADD MESSAGE
        </button>
        <p className="text-[8px] font-mono text-[#444] mt-1.5">Variables: {'{username}'} {'{first_name}'}</p>
      </div>
      <div className="flex gap-2">
        <button onClick={() => onSave(t)} disabled={saving || !t.keyword}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-[#00ff88]/10 border border-[#00ff88]/30 rounded text-[9px] font-mono text-[#00ff88] hover:bg-[#00ff88]/20 disabled:opacity-50">
          {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />} SAVE
        </button>
        <button onClick={onCancel} className="px-3 py-1.5 text-[9px] font-mono text-[#666] border border-[#222] rounded hover:text-[#ccc]">CANCEL</button>
      </div>
    </div>
  )
}
