'use client'

import { useState, useEffect } from 'react'
import { Plus, Trash2, Save, Loader2, Timer, ChevronDown, ChevronUp, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { LoadingFormSection } from '@/components/ui/loading-pulse'
import { ErrorState } from '@/components/ui/error-state'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { EmptyState } from '@/components/ui/empty-state'

interface Step {
  delay_hours: number
  message_type: 'text' | 'ai_personalized' | 'template'
  content: string
  ai_personalized: boolean
}

interface Sequence {
  id?: string
  name: string
  is_active: boolean
  steps: Step[]
}

export default function FollowupsPage() {
  const [sequences, setSequences] = useState<Sequence[]>([])
  const [loading, setLoading] = useState(true)
  const [editingIdx, setEditingIdx] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(false)
  const [deleteSeqId, setDeleteSeqId] = useState<string | null>(null)

  const fetchSequences = () => {
    setError(false)
    setLoading(true)
    fetch('/api/settings?section=followups')
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { if (d?.sequences) setSequences(d.sequences) })
      .catch(() => { setError(true) })
      .finally(() => setLoading(false))
  }

  useEffect(() => { fetchSequences() }, [])

  const saveSequence = async (seq: Sequence) => {
    setSaving(true)
    try {
      await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ section: 'followup', ...seq }),
      })
      const res = await fetch('/api/settings?section=followups')
      const data = await res.json()
      setSequences(data.sequences)
      setEditingIdx(null)
    } finally {
      setSaving(false)
    }
  }

  const deleteSequence = async (id: string) => {
    await fetch(`/api/settings?section=followup&id=${id}`, { method: 'DELETE' })
    setSequences((prev) => prev.filter((s) => s.id !== id))
    setDeleteSeqId(null)
  }

  if (loading) return <div className="p-6"><LoadingFormSection /></div>
  if (error) return <div className="p-6"><ErrorState message="Failed to load settings" onRetry={fetchSequences} /></div>

  return (
    <div className="p-6 max-w-3xl">
      <h1 className="text-sm font-mono font-bold text-[#f0f0f0] mb-1">Follow-Up Sequences</h1>
      <p className="text-[10px] font-mono text-[#555] mb-6">Automated follow-up message chains for leads who go quiet.</p>

      {sequences.length === 0 && (
        <EmptyState
          icon={<Timer className="w-12 h-12" />}
          title="No follow-up sequences"
          description="Create automated follow-up chains for leads who go quiet."
        />
      )}
      <div className="space-y-3 mb-4">
        {sequences.map((seq, idx) => (
          <div key={seq.id || idx} className="bg-[#0d0d0d] border border-[#1a1a1a] rounded-lg overflow-hidden">
            {/* Header */}
            <button
              onClick={() => setEditingIdx(editingIdx === idx ? null : idx)}
              className="w-full flex items-center justify-between px-4 py-3 hover:bg-[#111] transition-colors"
            >
              <div className="flex items-center gap-2">
                <Timer className="w-3 h-3 text-[#00ff88]" />
                <span className="text-[11px] font-mono text-[#ccc] font-bold">{seq.name || 'Untitled'}</span>
                <span className="text-[8px] font-mono text-[#555]">{seq.steps.length} steps</span>
              </div>
              <div className="flex items-center gap-2">
                <span className={cn('text-[8px] font-mono', seq.is_active ? 'text-[#00ff88]' : 'text-[#555]')}>
                  {seq.is_active ? 'ACTIVE' : 'PAUSED'}
                </span>
                {editingIdx === idx ? <ChevronUp className="w-3 h-3 text-[#444]" /> : <ChevronDown className="w-3 h-3 text-[#444]" />}
              </div>
            </button>

            {/* Editor */}
            {editingIdx === idx && (
              <SequenceEditor
                sequence={seq}
                onSave={saveSequence}
                onDelete={() => seq.id && setDeleteSeqId(seq.id)}
                onCancel={() => setEditingIdx(null)}
                saving={saving}
              />
            )}
          </div>
        ))}
      </div>

      <button
        onClick={() => {
          setSequences((prev) => [...prev, { name: '', is_active: false, steps: [{ delay_hours: 24, message_type: 'text', content: '', ai_personalized: false }] }])
          setEditingIdx(sequences.length)
        }}
        className="flex items-center gap-1.5 px-3 py-1.5 text-[9px] font-mono text-[#888] border border-dashed border-[#333] rounded hover:text-[#00ff88] hover:border-[#00ff88]/30 transition-colors"
      >
        <Plus className="w-3 h-3" /> ADD SEQUENCE
      </button>

      <ConfirmDialog
        open={!!deleteSeqId}
        title="Delete Sequence"
        description="This follow-up sequence will be permanently removed."
        onConfirm={() => { if (deleteSeqId) deleteSequence(deleteSeqId) }}
        onCancel={() => setDeleteSeqId(null)}
      />
    </div>
  )
}

function SequenceEditor({ sequence, onSave, onDelete, onCancel, saving }: {
  sequence: Sequence; onSave: (s: Sequence) => void; onDelete: () => void; onCancel: () => void; saving: boolean
}) {
  const [seq, setSeq] = useState(sequence)

  const updateStep = (idx: number, updates: Partial<Step>) => {
    setSeq((prev) => ({
      ...prev,
      steps: prev.steps.map((s, i) => i === idx ? { ...s, ...updates } : s),
    }))
  }

  const addStep = () => {
    setSeq((prev) => ({
      ...prev,
      steps: [...prev.steps, { delay_hours: 24, message_type: 'text', content: '', ai_personalized: false }],
    }))
  }

  const removeStep = (idx: number) => {
    setSeq((prev) => ({ ...prev, steps: prev.steps.filter((_, i) => i !== idx) }))
  }

  return (
    <div className="border-t border-[#1a1a1a] p-4 space-y-4">
      {/* Sequence name + active toggle */}
      <div className="flex gap-3">
        <div className="flex-1">
          <label className="text-[8px] font-mono text-[#555] uppercase block mb-1">Name</label>
          <input value={seq.name} onChange={(e) => setSeq({ ...seq, name: e.target.value })}
            className="w-full bg-[#111] border border-[#1a1a1a] rounded px-2.5 py-1.5 text-[10px] font-mono text-[#ccc] outline-none focus:border-[#00ff88]/30"
            placeholder="e.g. 24h Follow-Up" />
        </div>
        <label className="flex items-end gap-1.5 pb-1 cursor-pointer">
          <input type="checkbox" checked={seq.is_active} onChange={(e) => setSeq({ ...seq, is_active: e.target.checked })} className="accent-[#00ff88]" />
          <span className="text-[9px] font-mono text-[#888]">Active</span>
        </label>
      </div>

      {/* Steps */}
      <div className="space-y-2">
        {seq.steps.map((step, idx) => (
          <div key={idx} className="flex gap-2 items-start bg-[#111] rounded p-2.5 border border-[#1a1a1a]">
            <span className="text-[9px] font-mono text-[#444] mt-1 shrink-0">#{idx + 1}</span>
            <div className="flex-1 space-y-2">
              <div className="flex gap-2">
                <div className="w-24">
                  <label className="text-[7px] font-mono text-[#444] uppercase block mb-0.5">Delay</label>
                  <div className="flex items-center gap-1">
                    <input type="number" min={1} value={step.delay_hours}
                      onChange={(e) => updateStep(idx, { delay_hours: parseInt(e.target.value) || 1 })}
                      className="w-12 bg-[#0a0a0a] border border-[#1a1a1a] rounded px-1.5 py-1 text-[9px] font-mono text-[#ccc] outline-none" />
                    <span className="text-[8px] font-mono text-[#555]">hrs</span>
                  </div>
                </div>
                <div className="flex-1">
                  <label className="text-[7px] font-mono text-[#444] uppercase block mb-0.5">Type</label>
                  <select value={step.message_type}
                    onChange={(e) => updateStep(idx, { message_type: e.target.value as Step['message_type'], ai_personalized: e.target.value === 'ai_personalized' })}
                    className="w-full bg-[#0a0a0a] border border-[#1a1a1a] rounded px-1.5 py-1 text-[9px] font-mono text-[#ccc] outline-none">
                    <option value="text">Text</option>
                    <option value="ai_personalized">AI Personalized</option>
                    <option value="template">Template</option>
                  </select>
                </div>
              </div>
              <textarea
                value={step.content}
                onChange={(e) => updateStep(idx, { content: e.target.value })}
                rows={2}
                placeholder={step.message_type === 'ai_personalized' ? 'AI context/prompt...' : 'Message content...'}
                className="w-full bg-[#0a0a0a] border border-[#1a1a1a] rounded px-2 py-1.5 text-[9px] font-mono text-[#ccc] placeholder:text-[#333] outline-none resize-none focus:border-[#00ff88]/30"
              />
            </div>
            <button onClick={() => removeStep(idx)} className="text-[#444] hover:text-[#f05050] mt-1 shrink-0">
              <X className="w-3 h-3" />
            </button>
          </div>
        ))}
      </div>

      <button onClick={addStep}
        className="text-[8px] font-mono text-[#666] hover:text-[#00ff88] flex items-center gap-1">
        <Plus className="w-2.5 h-2.5" /> Add Step
      </button>

      <div className="flex gap-2 pt-2 border-t border-[#1a1a1a]">
        <button onClick={() => onSave(seq)} disabled={saving || !seq.name}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-[#00ff88]/10 border border-[#00ff88]/30 rounded text-[9px] font-mono text-[#00ff88] hover:bg-[#00ff88]/20 disabled:opacity-50">
          {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />} SAVE
        </button>
        <button onClick={onCancel} className="px-3 py-1.5 text-[9px] font-mono text-[#666] border border-[#222] rounded hover:text-[#ccc]">CANCEL</button>
        {sequence.id && (
          <button onClick={onDelete} className="ml-auto flex items-center gap-1 px-3 py-1.5 text-[9px] font-mono text-[#f05050] border border-[#f05050]/20 rounded hover:bg-[#f05050]/10">
            <Trash2 className="w-3 h-3" /> DELETE
          </button>
        )}
      </div>
    </div>
  )
}
