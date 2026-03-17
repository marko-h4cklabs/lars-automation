'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Search, Plus, Star, FileText, Save, Loader2, X, Trash2, Copy,
  Eye, Pencil, Upload,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { LoadingConversationList } from '@/components/ui/loading-pulse'
import { ErrorState } from '@/components/ui/error-state'

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface Template {
  id: string
  name: string
  category: string
  content: string
  tags: string[]
  is_active: boolean
  created_at: string
  usage_count: number
  is_favorite: boolean
}

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const CATEGORIES: { value: string; label: string; color: string; emoji: string }[] = [
  { value: 'opener', label: 'Openers', color: '#00ff88', emoji: '🟢' },
  { value: 'qualifying', label: 'Qualifying', color: '#54a0ff', emoji: '🔵' },
  { value: 'nurturing', label: 'Nurturing', color: '#ff9f43', emoji: '🟡' },
  { value: 'booking_push', label: 'Booking Push', color: '#f05050', emoji: '🔴' },
  { value: 'follow_up', label: 'Follow-ups', color: '#aaaaaa', emoji: '⚪' },
  { value: 'objection', label: 'Objection Handling', color: '#5f27cd', emoji: '🟣' },
  { value: 'closer', label: 'Closers', color: '#666666', emoji: '⚫' },
]

const CAT_COLORS: Record<string, string> = {
  opener: 'text-[#00ff88] bg-[#00ff88]/10 border-[#00ff88]/30',
  qualifying: 'text-[#54a0ff] bg-[#54a0ff]/10 border-[#54a0ff]/30',
  nurturing: 'text-[#ff9f43] bg-[#ff9f43]/10 border-[#ff9f43]/30',
  booking_push: 'text-[#f05050] bg-[#f05050]/10 border-[#f05050]/30',
  follow_up: 'text-[#aaa] bg-[#aaa]/10 border-[#aaa]/30',
  objection: 'text-[#5f27cd] bg-[#5f27cd]/10 border-[#5f27cd]/30',
  closer: 'text-[#666] bg-[#666]/10 border-[#666]/30',
}

const VARIABLES = [
  { key: 'lead_name', desc: "Lead's full name" },
  { key: 'lead_username', desc: 'Instagram @username' },
  { key: 'lead_goal', desc: "Lead's stated goal" },
  { key: 'calendly_link', desc: 'Booking link' },
  { key: 'coach_name', desc: "Coach's name (Lars)" },
]

/* ------------------------------------------------------------------ */
/*  Main Page                                                          */
/* ------------------------------------------------------------------ */

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<Template[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [category, setCategory] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [showImport, setShowImport] = useState(false)

  const fetchTemplates = useCallback(async () => {
    const params = new URLSearchParams()
    if (category) params.set('category', category)
    if (search) params.set('search', search)

    try {
      setError(false)
      const res = await fetch(`/api/templates?${params}`)
      if (res.ok) {
        const data = await res.json()
        setTemplates(data.templates || [])
      }
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [category, search])

  useEffect(() => { fetchTemplates() }, [fetchTemplates])

  const selected = templates.find((t) => t.id === selectedId) || null

  const handleCreated = (id: string) => {
    setSelectedId(id)
    fetchTemplates()
  }

  const handleUpdated = () => fetchTemplates()

  const handleDeleted = () => {
    setSelectedId(null)
    fetchTemplates()
  }

  const toggleFavorite = async (id: string, current: boolean) => {
    await fetch(`/api/templates/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_favorite: !current }),
    })
    setTemplates((prev) => prev.map((t) => t.id === id ? { ...t, is_favorite: !current } : t))
  }

  // Group templates by category for sidebar counts
  const categoryCounts: Record<string, number> = {}
  templates.forEach((t) => { categoryCounts[t.category] = (categoryCounts[t.category] || 0) + 1 })

  // Sort: favorites first, then by usage
  const sortedTemplates = [...templates]
    .filter((t) => !category || t.category === category)
    .sort((a, b) => {
      if (a.is_favorite !== b.is_favorite) return a.is_favorite ? -1 : 1
      return b.usage_count - a.usage_count
    })

  return (
    <div className="flex h-[calc(100vh-48px)]">
      {/* LEFT: Category sidebar + template list */}
      <div className="w-[300px] shrink-0 border-r border-[#1a1a1a] flex flex-col bg-[#080808]">
        {/* Header */}
        <div className="p-4 border-b border-[#1a1a1a]">
          <div className="flex items-center justify-between mb-3">
            <h1 className="text-sm font-mono font-bold text-[#f0f0f0]">Templates</h1>
            <div className="flex gap-1.5">
              <button
                onClick={() => setShowImport(true)}
                className="p-1 text-[#444] hover:text-[#00ff88] transition-colors" title="Import"
              >
                <Upload className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setSelectedId('new')}
                className="flex items-center gap-1 px-3 py-1.5 bg-[#00ff88]/10 border border-[#00ff88]/30 rounded text-[11px] font-mono text-[#00ff88] hover:bg-[#00ff88]/20 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" /> NEW
              </button>
            </div>
          </div>

          {/* Search */}
          <div className="relative mb-3">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-[#444]" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search templates..."
              className="w-full bg-[#111] border border-[#1a1a1a] rounded pl-7 pr-2.5 py-1.5 text-[13px] font-mono text-[#ccc] placeholder:text-[#333] outline-none focus:border-[#00ff88]/30"
            />
          </div>

          {/* Category tabs */}
          <div className="space-y-0.5">
            <button
              onClick={() => setCategory(null)}
              className={cn(
                'w-full flex items-center justify-between px-3 py-1.5 rounded text-xs font-mono transition-colors',
                !category ? 'bg-[#111] text-[#f0f0f0]' : 'text-[#666] hover:text-[#ccc]'
              )}
            >
              <span>All Templates</span>
              <span className="text-[11px] text-[#555]">{templates.length}</span>
            </button>
            {CATEGORIES.map((c) => (
              <button
                key={c.value}
                onClick={() => setCategory(category === c.value ? null : c.value)}
                className={cn(
                  'w-full flex items-center justify-between px-3 py-1.5 rounded text-xs font-mono transition-colors',
                  category === c.value ? 'bg-[#111] text-[#f0f0f0]' : 'text-[#666] hover:text-[#ccc]'
                )}
              >
                <span className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: c.color }} />
                  {c.label}
                </span>
                <span className="text-[11px] text-[#555]">{categoryCounts[c.value] || 0}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Template list */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="p-3"><LoadingConversationList count={5} /></div>
          ) : error ? (
            <ErrorState message="Failed to load templates" onRetry={fetchTemplates} />
          ) : sortedTemplates.length === 0 ? (
            <div className="p-4 text-center">
              <FileText className="w-6 h-6 text-[#222] mx-auto mb-2" />
              <p className="text-[13px] font-mono text-[#444]">No templates</p>
            </div>
          ) : (
            <div className="p-2 space-y-0.5">
              {sortedTemplates.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setSelectedId(t.id)}
                  className={cn(
                    'w-full text-left p-2 rounded-lg border transition-colors',
                    selectedId === t.id
                      ? 'bg-[#0d0d0d] border-[#00ff88]/20'
                      : 'bg-transparent border-transparent hover:bg-[#0d0d0d] hover:border-[#1a1a1a]'
                  )}
                >
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <button
                      onClick={(e) => { e.stopPropagation(); toggleFavorite(t.id, t.is_favorite) }}
                      className={cn('shrink-0', t.is_favorite ? 'text-[#ff9f43]' : 'text-[#222] hover:text-[#555]')}
                    >
                      <Star className="w-4 h-4" fill={t.is_favorite ? 'currentColor' : 'none'} />
                    </button>
                    <span className="text-[13px] font-mono font-bold text-[#f0f0f0] truncate">{t.name}</span>
                    <span className={cn('text-[10px] font-mono uppercase px-1 py-0.5 rounded border shrink-0',
                      CAT_COLORS[t.category] || CAT_COLORS.closer)}>
                      {t.category.replace('_', ' ')}
                    </span>
                  </div>
                  <p className="text-xs font-mono text-[#555] truncate pl-[18px]">{t.content.slice(0, 60)}</p>
                  <div className="flex items-center gap-2 mt-0.5 pl-[18px]">
                    {t.tags.slice(0, 3).map((tag) => (
                      <span key={tag} className="text-[10px] font-mono text-[#444] bg-[#111] px-1 rounded">{tag}</span>
                    ))}
                    {t.usage_count > 0 && (
                      <span className="text-[10px] font-mono text-[#444] ml-auto">{t.usage_count}x used</span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* RIGHT: Editor / Viewer */}
      <div className="flex-1 overflow-y-auto bg-[#0a0a0a]">
        {selectedId === 'new' ? (
          <TemplateEditor
            template={null}
            onSaved={handleCreated}
            onCancel={() => setSelectedId(null)}
          />
        ) : selected ? (
          <TemplateEditor
            template={selected}
            onSaved={() => handleUpdated()}
            onDeleted={handleDeleted}
            onCancel={() => {}}
          />
        ) : (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <FileText className="w-8 h-8 text-[#1a1a1a] mx-auto mb-3" />
              <p className="text-sm font-mono text-[#555] mb-1">Select a template to edit</p>
              <p className="text-xs font-mono text-[#333]">or create a new one</p>
            </div>
          </div>
        )}
      </div>

      {/* Import modal */}
      {showImport && <ImportModal onClose={() => setShowImport(false)} onImported={() => { setShowImport(false); fetchTemplates() }} />}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Template Editor                                                    */
/* ------------------------------------------------------------------ */

function TemplateEditor({
  template,
  onSaved,
  onDeleted,
  onCancel,
}: {
  template: Template | null
  onSaved: (id: string) => void
  onDeleted?: () => void
  onCancel: () => void
}) {
  const isNew = !template
  const [name, setName] = useState(template?.name || '')
  const [cat, setCat] = useState(template?.category || 'opener')
  const [content, setContent] = useState(template?.content || '')
  const [tags, setTags] = useState<string[]>(template?.tags || [])
  const [tagInput, setTagInput] = useState('')
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [mode, setMode] = useState<'edit' | 'preview'>('edit')

  // Reset when template changes
  useEffect(() => {
    setName(template?.name || '')
    setCat(template?.category || 'opener')
    setContent(template?.content || '')
    setTags(template?.tags || [])
    setMode('edit')
    setShowDeleteConfirm(false)
  }, [template])

  const save = async () => {
    if (!name || !content) return
    setSaving(true)
    try {
      if (isNew) {
        const res = await fetch('/api/templates', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, category: cat, content, tags }),
        })
        if (res.ok) {
          const data = await res.json()
          onSaved(data.id)
        }
      } else {
        await fetch(`/api/templates/${template!.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, category: cat, content, tags }),
        })
        onSaved(template!.id)
      }
    } finally {
      setSaving(false)
    }
  }

  const duplicate = async () => {
    setSaving(true)
    try {
      const res = await fetch('/api/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: `${name} (copy)`, category: cat, content, tags }),
      })
      if (res.ok) {
        const data = await res.json()
        onSaved(data.id)
      }
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!template) return
    setDeleting(true)
    try {
      await fetch(`/api/templates/${template.id}`, { method: 'DELETE' })
      onDeleted?.()
    } finally {
      setDeleting(false)
    }
  }

  const addTag = () => {
    const t = tagInput.trim().toLowerCase()
    if (t && !tags.includes(t)) {
      setTags([...tags, t])
    }
    setTagInput('')
  }

  // Parse multi-message segments
  const segments = content.split(/\n---\n|\n---$|^---\n/).map((s) => s.trim()).filter(Boolean)

  // Example variable replacement for preview
  const replaceVars = (text: string) =>
    text
      .replace(/\{lead_name\}/g, 'Marcus')
      .replace(/\{lead_username\}/g, '@marcus.fit')
      .replace(/\{lead_goal\}/g, 'build muscle and lose fat')
      .replace(/\{calendly_link\}/g, 'https://calendly.com/lars/discovery')
      .replace(/\{coach_name\}/g, 'Lars')

  return (
    <div className="p-6 max-w-3xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-mono font-bold text-[#f0f0f0]">
          {isNew ? 'New Template' : 'Edit Template'}
        </h2>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setMode(mode === 'edit' ? 'preview' : 'edit')}
            className="flex items-center gap-1 px-3 py-1.5 text-[11px] font-mono text-[#888] border border-[#222] rounded hover:text-[#ccc] transition-colors"
          >
            {mode === 'edit' ? <Eye className="w-3.5 h-3.5" /> : <Pencil className="w-3.5 h-3.5" />}
            {mode === 'edit' ? 'PREVIEW' : 'EDIT'}
          </button>
          {isNew && (
            <button onClick={onCancel} className="px-3 py-1.5 text-[11px] font-mono text-[#666] border border-[#222] rounded hover:text-[#ccc]">
              CANCEL
            </button>
          )}
        </div>
      </div>

      {mode === 'edit' ? (
        <div className="space-y-4">
          {/* Name + Category */}
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label className="text-[11px] font-mono text-[#555] uppercase block mb-1">Template Name</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Warm opener — story reply"
                className="w-full bg-[#111] border border-[#1a1a1a] rounded px-3 py-2 text-[13px] font-mono text-[#ccc] outline-none focus:border-[#00ff88]/30"
              />
            </div>
            <div>
              <label className="text-[11px] font-mono text-[#555] uppercase block mb-1">Category</label>
              <select
                value={cat}
                onChange={(e) => setCat(e.target.value)}
                className="w-full bg-[#111] border border-[#1a1a1a] rounded px-3 py-2 text-[13px] font-mono text-[#ccc] outline-none"
              >
                {CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Tags */}
          <div>
            <label className="text-[11px] font-mono text-[#555] uppercase block mb-1">Tags</label>
            <div className="flex flex-wrap gap-1 mb-1.5">
              {tags.map((tag) => (
                <span key={tag} className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-[#111] border border-[#1a1a1a] rounded text-[11px] font-mono text-[#888]">
                  {tag}
                  <button onClick={() => setTags(tags.filter((t) => t !== tag))} className="text-[#444] hover:text-[#f05050]">
                    <X className="w-2 h-2" />
                  </button>
                </span>
              ))}
            </div>
            <div className="flex gap-1.5">
              <input
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addTag()}
                placeholder="Add tag..."
                className="bg-[#111] border border-[#1a1a1a] rounded px-3 py-1.5 text-xs font-mono text-[#ccc] outline-none focus:border-[#00ff88]/30 w-40"
              />
              <button onClick={addTag} className="text-[11px] font-mono text-[#555] hover:text-[#00ff88]">
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Content */}
          <div>
            <label className="text-[11px] font-mono text-[#555] uppercase block mb-1">Message Content</label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={10}
              placeholder={"Hey {lead_name}! Thanks for reaching out...\n\n---\n\nWhat's your main goal right now?"}
              className="w-full bg-[#111] border border-[#1a1a1a] rounded-lg px-3 py-2.5 text-[13px] font-mono text-[#ccc] placeholder:text-[#333] outline-none resize-y focus:border-[#00ff88]/30 leading-relaxed"
            />
            <div className="flex items-center justify-between mt-1">
              <span className="text-[11px] font-mono text-[#444]">
                Use &quot;---&quot; on a new line to split into multiple messages
              </span>
              <div className="flex items-center gap-3">
                {segments.length > 1 && (
                  <span className="text-[11px] font-mono text-[#00ff88]">{segments.length} messages</span>
                )}
                <span className="text-[11px] font-mono text-[#444]">{content.length} chars</span>
              </div>
            </div>
          </div>

          {/* Per-segment char counts */}
          {segments.length > 1 && (
            <div className="flex gap-2">
              {segments.map((seg, i) => (
                <span key={i} className="text-[11px] font-mono text-[#555] bg-[#111] px-1.5 py-0.5 rounded">
                  Msg {i + 1}: {seg.length} chars
                </span>
              ))}
            </div>
          )}

          {/* Variable reference */}
          <div className="bg-[#0d0d0d] border border-[#1a1a1a] rounded-lg p-3">
            <span className="text-[11px] font-mono text-[#555] uppercase block mb-1.5">Available Variables</span>
            <div className="grid grid-cols-2 gap-1">
              {VARIABLES.map((v) => (
                <button
                  key={v.key}
                  onClick={() => setContent((prev) => prev + `{${v.key}}`)}
                  className="flex items-center gap-2 text-left px-3 py-1.5 rounded hover:bg-[#111] transition-colors"
                >
                  <code className="text-xs font-mono text-[#00ff88]">{`{${v.key}}`}</code>
                  <span className="text-[11px] font-mono text-[#555]">{v.desc}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 pt-2 border-t border-[#1a1a1a]">
            <button
              onClick={save}
              disabled={saving || !name || !content}
              className="flex items-center gap-1.5 px-4 py-2 bg-[#00ff88]/10 border border-[#00ff88]/30 rounded text-[13px] font-mono text-[#00ff88] hover:bg-[#00ff88]/20 disabled:opacity-50 transition-colors"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {isNew ? 'CREATE TEMPLATE' : 'SAVE CHANGES'}
            </button>
            {!isNew && (
              <>
                <button
                  onClick={duplicate}
                  disabled={saving}
                  className="flex items-center gap-1 px-3 py-2 text-xs font-mono text-[#888] border border-[#222] rounded hover:text-[#ccc] disabled:opacity-50 transition-colors"
                >
                  <Copy className="w-4 h-4" /> DUPLICATE
                </button>
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  className="flex items-center gap-1 px-3 py-2 text-xs font-mono text-[#f05050] border border-[#f05050]/30 rounded hover:bg-[#f05050]/10 transition-colors ml-auto"
                >
                  <Trash2 className="w-4 h-4" /> DELETE
                </button>
              </>
            )}
          </div>

          {/* Delete confirm */}
          {showDeleteConfirm && (
            <div className="p-3 bg-[#f05050]/5 border border-[#f05050]/20 rounded-lg">
              <p className="text-[13px] font-mono text-[#f05050] mb-2">Delete this template?</p>
              <div className="flex gap-2">
                <button onClick={handleDelete} disabled={deleting}
                  className="px-3 py-1 bg-[#f05050]/10 border border-[#f05050]/30 rounded text-[11px] font-mono text-[#f05050] disabled:opacity-50">
                  {deleting ? 'DELETING...' : 'YES, DELETE'}
                </button>
                <button onClick={() => setShowDeleteConfirm(false)}
                  className="px-3 py-1 text-[11px] font-mono text-[#666] border border-[#222] rounded">CANCEL</button>
              </div>
            </div>
          )}
        </div>
      ) : (
        /* PREVIEW MODE */
        <div className="space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <span className={cn('text-[11px] font-mono uppercase px-1.5 py-0.5 rounded border',
              CAT_COLORS[cat] || CAT_COLORS.closer)}>
              {cat.replace('_', ' ')}
            </span>
            {tags.map((tag) => (
              <span key={tag} className="text-[10px] font-mono text-[#444] bg-[#111] px-1 rounded">{tag}</span>
            ))}
          </div>

          <p className="text-[11px] font-mono text-[#555] mb-4">
            Preview with example values — each bubble is a separate message
          </p>

          {/* Chat bubbles preview */}
          <div className="space-y-2 max-w-md ml-auto">
            {segments.map((seg, i) => (
              <div key={i} className="flex justify-end">
                <div className="bg-[#00ff88]/5 border border-[#00ff88]/10 rounded-lg px-3 py-2 max-w-[90%]">
                  <span className="text-[13px] font-mono text-[#ccc] leading-relaxed whitespace-pre-wrap">
                    {replaceVars(seg)}
                  </span>
                  <div className="flex items-center justify-end gap-2 mt-1">
                    <span className="text-[10px] font-mono text-[#444]">{seg.length} chars</span>
                    {i === 0 && segments.length > 1 && (
                      <span className="text-[10px] font-mono text-[#555]">{i + 1}/{segments.length}</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {segments.length > 1 && (
            <p className="text-[11px] font-mono text-[#555] text-right">
              {segments.length} messages sent with burst delay
            </p>
          )}
        </div>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Import Modal                                                       */
/* ------------------------------------------------------------------ */

function ImportModal({ onClose, onImported }: { onClose: () => void; onImported: () => void }) {
  const [mode, setMode] = useState<'json' | 'text'>('json')
  const [input, setInput] = useState('')
  const [importCat, setImportCat] = useState('opener')
  const [importing, setImporting] = useState(false)
  const [error, setError] = useState('')
  const [count, setCount] = useState(0)

  const importTemplates = async () => {
    setImporting(true)
    setError('')
    let items: { name: string; content: string; category?: string; tags?: string[] }[] = []

    try {
      if (mode === 'json') {
        items = JSON.parse(input)
        if (!Array.isArray(items)) items = [items]
      } else {
        // Each paragraph = one template
        const paragraphs = input.split(/\n\n+/).map((p) => p.trim()).filter(Boolean)
        items = paragraphs.map((p, i) => ({
          name: `Imported ${i + 1}`,
          content: p,
        }))
      }

      let created = 0
      for (const item of items) {
        const res = await fetch('/api/templates', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: item.name || `Imported template`,
            category: item.category || importCat,
            content: item.content,
            tags: item.tags || ['imported'],
          }),
        })
        if (res.ok) created++
      }

      setCount(created)
      if (created > 0) {
        setTimeout(() => { onImported() }, 1000)
      }
    } catch {
      setError('Invalid format. Check your JSON syntax.')
    } finally {
      setImporting(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-xl w-full max-w-lg">
        <div className="flex items-center justify-between p-4 border-b border-[#1a1a1a]">
          <span className="text-sm font-mono font-bold text-[#f0f0f0]">Import Templates</span>
          <button onClick={onClose} className="text-[#444] hover:text-[#888]"><X className="w-4 h-4" /></button>
        </div>

        <div className="p-4 space-y-4">
          <div className="flex gap-2">
            <button onClick={() => setMode('json')}
              className={cn('px-3 py-1 rounded text-xs font-mono border',
                mode === 'json' ? 'text-[#00ff88] border-[#00ff88]/30 bg-[#00ff88]/5' : 'text-[#666] border-[#222]')}>
              JSON
            </button>
            <button onClick={() => setMode('text')}
              className={cn('px-3 py-1 rounded text-xs font-mono border',
                mode === 'text' ? 'text-[#00ff88] border-[#00ff88]/30 bg-[#00ff88]/5' : 'text-[#666] border-[#222]')}>
              Plain Text
            </button>
          </div>

          {mode === 'text' && (
            <div>
              <label className="text-[11px] font-mono text-[#555] uppercase block mb-1">Default Category</label>
              <select value={importCat} onChange={(e) => setImportCat(e.target.value)}
                className="bg-[#111] border border-[#1a1a1a] rounded px-3 py-2 text-[13px] font-mono text-[#ccc] outline-none">
                {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
          )}

          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            rows={10}
            placeholder={mode === 'json'
              ? '[{"name":"Warm opener","content":"Hey {lead_name}!","category":"opener","tags":["warm"]}]'
              : 'Paste templates separated by blank lines...\n\nEach paragraph becomes a separate template.'}
            className="w-full bg-[#111] border border-[#1a1a1a] rounded-lg px-3 py-2.5 text-[13px] font-mono text-[#ccc] placeholder:text-[#333] outline-none resize-none focus:border-[#00ff88]/30"
          />

          {error && <p className="text-xs font-mono text-[#f05050]">{error}</p>}
          {count > 0 && <p className="text-xs font-mono text-[#00ff88]">{count} templates imported!</p>}

          <div className="flex gap-2">
            <button onClick={onClose} className="px-3 py-1.5 text-xs font-mono text-[#666] border border-[#222] rounded hover:text-[#ccc]">CANCEL</button>
            <button onClick={importTemplates} disabled={importing || !input.trim()}
              className="flex items-center gap-1.5 px-4 py-1.5 bg-[#00ff88]/10 border border-[#00ff88]/30 rounded text-xs font-mono text-[#00ff88] hover:bg-[#00ff88]/20 disabled:opacity-50">
              {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />} IMPORT
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
