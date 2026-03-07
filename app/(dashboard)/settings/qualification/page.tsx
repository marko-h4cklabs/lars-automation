'use client'

import { useState, useEffect } from 'react'
import { Save, Plus, Trash2, GripVertical, Loader2, Settings } from 'lucide-react'
import { cn } from '@/lib/utils'
import { LoadingFormSection } from '@/components/ui/loading-pulse'
import { ErrorState } from '@/components/ui/error-state'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { EmptyState } from '@/components/ui/empty-state'

interface QualField {
  id?: string
  field_key: string
  field_label: string
  field_type: string
  options: Record<string, unknown> | null
  weight: number
  is_required: boolean
  display_order: number
}

export default function QualificationPage() {
  const [fields, setFields] = useState<QualField[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [newField, setNewField] = useState<QualField | null>(null)
  const [dragIdx, setDragIdx] = useState<number | null>(null)
  const [error, setError] = useState(false)
  const [deleteFieldId, setDeleteFieldId] = useState<string | null>(null)

  const fetchFields = () => {
    setError(false)
    setLoading(true)
    fetch('/api/settings?section=qualification')
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { if (d?.fields) setFields(d.fields) })
      .catch(() => { setError(true) })
      .finally(() => setLoading(false))
  }

  useEffect(() => { fetchFields() }, [])

  const saveField = async (field: QualField) => {
    setSaving(true)
    try {
      await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ section: 'qualification_field', ...field }),
      })
      if (!field.id) {
        // Refetch to get new IDs
        const res = await fetch('/api/settings?section=qualification')
        const data = await res.json()
        setFields(data.fields)
      }
      setEditingId(null)
      setNewField(null)
    } finally {
      setSaving(false)
    }
  }

  const deleteField = async (id: string) => {
    await fetch(`/api/settings?section=qualification_field&id=${id}`, { method: 'DELETE' })
    setFields((prev) => prev.filter((f) => f.id !== id))
    setDeleteFieldId(null)
  }

  const handleDrop = async (toIdx: number) => {
    if (dragIdx === null || dragIdx === toIdx) { setDragIdx(null); return }
    const reordered = [...fields]
    const [moved] = reordered.splice(dragIdx, 1)
    reordered.splice(toIdx, 0, moved)
    const updated = reordered.map((f, i) => ({ ...f, display_order: i }))
    setFields(updated)
    setDragIdx(null)
    await fetch('/api/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ section: 'qualification_reorder', fields: updated.map((f) => ({ id: f.id, display_order: f.display_order })) }),
    })
  }

  if (loading) return <div className="p-6"><LoadingFormSection /></div>
  if (error) return <div className="p-6"><ErrorState message="Failed to load settings" onRetry={fetchFields} /></div>

  return (
    <div className="p-6 max-w-3xl">
      <h1 className="text-sm font-mono font-bold text-[#f0f0f0] mb-1">Qualification Fields</h1>
      <p className="text-[10px] font-mono text-[#555] mb-6">Configure the fields used to qualify leads before booking a call.</p>

      {/* Fields list */}
      {fields.length === 0 && !newField && !editingId && (
        <EmptyState
          icon={<Settings className="w-12 h-12" />}
          title="No qualification fields"
          description="Add fields to qualify leads before booking a call."
        />
      )}
      <div className="space-y-1.5 mb-4">
        {fields.map((field, idx) => (
          <div
            key={field.id || idx}
            draggable
            onDragStart={() => setDragIdx(idx)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => handleDrop(idx)}
            className={cn(
              'flex items-center gap-3 px-3 py-2 rounded-lg border transition-colors',
              dragIdx === idx ? 'bg-[#00ff88]/5 border-[#00ff88]/20' : 'bg-[#0d0d0d] border-[#1a1a1a]'
            )}
          >
            <GripVertical className="w-3 h-3 text-[#333] cursor-grab shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono text-[#ccc] font-bold">{field.field_label}</span>
                <span className="text-[8px] font-mono text-[#444]">{field.field_key}</span>
                <span className="text-[8px] font-mono text-[#555] px-1 py-0 bg-[#111] rounded">{field.field_type}</span>
                {field.is_required && <span className="text-[8px] font-mono text-[#f05050]">REQ</span>}
              </div>
            </div>
            <span className="text-[9px] font-mono text-[#666]">W:{field.weight}</span>
            <button
              onClick={() => setEditingId(editingId === field.id ? null : (field.id || null))}
              className="text-[8px] font-mono text-[#666] hover:text-[#ccc] px-2 py-0.5 border border-[#222] rounded"
            >
              EDIT
            </button>
            <button
              onClick={() => field.id && setDeleteFieldId(field.id)}
              className="text-[#444] hover:text-[#f05050]"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        ))}
      </div>

      {/* Inline editor */}
      {(editingId || newField) && (
        <FieldEditor
          field={newField || fields.find((f) => f.id === editingId)!}
          onSave={saveField}
          onCancel={() => { setEditingId(null); setNewField(null) }}
          saving={saving}
        />
      )}

      {/* Add button */}
      {!newField && !editingId && (
        <button
          onClick={() => setNewField({
            field_key: '', field_label: '', field_type: 'text',
            options: null, weight: 5, is_required: false, display_order: fields.length,
          })}
          className="flex items-center gap-1.5 px-3 py-1.5 text-[9px] font-mono text-[#888] border border-dashed border-[#333] rounded hover:text-[#00ff88] hover:border-[#00ff88]/30 transition-colors"
        >
          <Plus className="w-3 h-3" /> ADD FIELD
        </button>
      )}

      <ConfirmDialog
        open={!!deleteFieldId}
        title="Delete Field"
        description="Existing lead data using this field will be orphaned."
        onConfirm={() => { if (deleteFieldId) deleteField(deleteFieldId) }}
        onCancel={() => setDeleteFieldId(null)}
      />
    </div>
  )
}

function FieldEditor({ field, onSave, onCancel, saving }: {
  field: QualField; onSave: (f: QualField) => void; onCancel: () => void; saving: boolean
}) {
  const [f, setF] = useState(field)

  return (
    <div className="bg-[#0d0d0d] border border-[#1a1a1a] rounded-lg p-4 mb-4 space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-[8px] font-mono text-[#555] uppercase block mb-1">Field Key</label>
          <input value={f.field_key} onChange={(e) => setF({ ...f, field_key: e.target.value })}
            className="w-full bg-[#111] border border-[#1a1a1a] rounded px-2.5 py-1.5 text-[10px] font-mono text-[#ccc] outline-none focus:border-[#00ff88]/30"
            placeholder="e.g. monthly_budget" />
        </div>
        <div>
          <label className="text-[8px] font-mono text-[#555] uppercase block mb-1">Label</label>
          <input value={f.field_label} onChange={(e) => setF({ ...f, field_label: e.target.value })}
            className="w-full bg-[#111] border border-[#1a1a1a] rounded px-2.5 py-1.5 text-[10px] font-mono text-[#ccc] outline-none focus:border-[#00ff88]/30"
            placeholder="e.g. Monthly Budget" />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="text-[8px] font-mono text-[#555] uppercase block mb-1">Type</label>
          <select value={f.field_type} onChange={(e) => setF({ ...f, field_type: e.target.value })}
            className="w-full bg-[#111] border border-[#1a1a1a] rounded px-2.5 py-1.5 text-[10px] font-mono text-[#ccc] outline-none">
            <option value="text">Text</option>
            <option value="number">Number</option>
            <option value="boolean">Boolean</option>
            <option value="select">Select</option>
          </select>
        </div>
        <div>
          <label className="text-[8px] font-mono text-[#555] uppercase block mb-1">Weight (0-10)</label>
          <input type="number" min={0} max={10} value={f.weight}
            onChange={(e) => setF({ ...f, weight: parseInt(e.target.value) || 0 })}
            className="w-full bg-[#111] border border-[#1a1a1a] rounded px-2.5 py-1.5 text-[10px] font-mono text-[#ccc] outline-none focus:border-[#00ff88]/30" />
        </div>
        <div className="flex items-end gap-3 pb-1">
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input type="checkbox" checked={f.is_required} onChange={(e) => setF({ ...f, is_required: e.target.checked })} className="accent-[#00ff88]" />
            <span className="text-[9px] font-mono text-[#888]">Required</span>
          </label>
        </div>
      </div>
      <div className="flex gap-2">
        <button onClick={() => onSave(f)} disabled={saving || !f.field_key || !f.field_label}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-[#00ff88]/10 border border-[#00ff88]/30 rounded text-[9px] font-mono text-[#00ff88] hover:bg-[#00ff88]/20 disabled:opacity-50">
          {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />} SAVE
        </button>
        <button onClick={onCancel} className="px-3 py-1.5 text-[9px] font-mono text-[#666] border border-[#222] rounded hover:text-[#ccc]">
          CANCEL
        </button>
      </div>
    </div>
  )
}
