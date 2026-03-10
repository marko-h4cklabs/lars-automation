'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import {
  Search, Plus, FileText, Upload, Trash2, Save, Loader2, X, RefreshCw,
  ChevronDown, ChevronRight, Zap, BookOpen, CheckCircle2, AlertCircle,
  Eye, Pencil, ToggleLeft, ToggleRight,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { LoadingConversationList } from '@/components/ui/loading-pulse'
import { ErrorState } from '@/components/ui/error-state'

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type DocType = 'offer' | 'script' | 'persona' | 'training' | 'general'

interface KBDoc {
  id: string
  title: string
  content: string
  type: DocType
  file_type: string | null
  is_active: boolean
  created_at: string
  char_count: number
  chunk_count: number
  has_embedding: boolean
}

interface DocDetail extends KBDoc {
  chunks: { id: string; title: string; char_count: number; has_embedding: boolean }[]
}

interface RetrievalResult {
  id: string
  title: string
  content: string
  type: string
  similarity: number
  parent_doc_id: string | null
}

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const CATEGORIES: { value: string; label: string }[] = [
  { value: 'all', label: 'ALL' },
  { value: 'offer', label: 'OFFER' },
  { value: 'script', label: 'SCRIPTS' },
  { value: 'persona', label: 'PERSONA' },
  { value: 'training', label: 'TRAINING' },
  { value: 'general', label: 'GENERAL' },
]

const TYPE_COLORS: Record<string, string> = {
  offer: 'text-[#ff9f43] bg-[#ff9f43]/10 border-[#ff9f43]/30',
  script: 'text-[#54a0ff] bg-[#54a0ff]/10 border-[#54a0ff]/30',
  persona: 'text-[#ff6b6b] bg-[#ff6b6b]/10 border-[#ff6b6b]/30',
  training: 'text-[#5f27cd] bg-[#5f27cd]/10 border-[#5f27cd]/30',
  general: 'text-[#666] bg-[#666]/10 border-[#666]/30',
}

const KB_GUIDE: { type: string; title: string; tips: string[] }[] = [
  {
    type: 'OFFER',
    title: 'What to put in OFFER documents',
    tips: [
      "Describe Lars's transformation program in detail — what it includes, how it works",
      'Price range and payment options (so AI can handle pricing questions)',
      'Key results and transformations clients achieve',
      'Who the program is for (ideal client avatar) and who it\'s NOT for',
      'Guarantee details, bonuses, any urgency elements',
    ],
  },
  {
    type: 'SCRIPTS',
    title: 'What to put in SCRIPTS documents',
    tips: [
      'Successful conversation patterns that led to bookings',
      'Best opening messages for different lead sources (DM, story reply, comment)',
      'Objection handling scripts (price, timing, skepticism, need to think)',
      'Qualifying questions sequence — what to ask and in what order',
      'Closing scripts — how to transition from chat to booking a call',
    ],
  },
  {
    type: 'PERSONA',
    title: 'What to put in PERSONA documents',
    tips: [
      "Lars's writing style — how he actually types in DMs (casual, abbreviations, emoji usage)",
      'Tone guidelines — motivational but not pushy, authentic, direct',
      "Catchphrases or expressions Lars commonly uses",
      "Things Lars would NEVER say (e.g., overpromises, medical claims)",
      'Response length preferences — short punchy messages vs. longer explanations',
    ],
  },
  {
    type: 'TRAINING',
    title: 'What to put in TRAINING documents',
    tips: [
      'Real DM conversations that successfully converted to calls (anonymized)',
      'Failed conversations with notes on what went wrong',
      'Edge case scenarios — how to handle specific situations',
      'Common lead profiles and best approaches for each',
      'Label examples as [GOOD] or [BAD] so the AI learns from both',
    ],
  },
]

/* ------------------------------------------------------------------ */
/*  Main Page                                                          */
/* ------------------------------------------------------------------ */

export default function KnowledgePage() {
  const [documents, setDocuments] = useState<KBDoc[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [category, setCategory] = useState('all')
  const [search, setSearch] = useState('')
  const [showUpload, setShowUpload] = useState(false)
  const [showGuide, setShowGuide] = useState(false)

  const fetchDocuments = useCallback(async () => {
    const params = new URLSearchParams()
    if (category !== 'all') params.set('type', category)
    if (search) params.set('search', search)

    try {
      setError(false)
      const res = await fetch(`/api/knowledge?${params}`)
      if (res.ok) {
        const data = await res.json()
        setDocuments(data.documents || [])
      }
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [category, search])

  useEffect(() => { fetchDocuments() }, [fetchDocuments])

  const selectedDoc = documents.find((d) => d.id === selectedId) || null

  const handleCreated = (id: string) => {
    setShowUpload(false)
    setSelectedId(id)
    fetchDocuments()
  }

  const handleDeleted = () => {
    setSelectedId(null)
    fetchDocuments()
  }

  const handleUpdated = () => {
    fetchDocuments()
  }

  return (
    <div className="flex h-[calc(100vh-48px)]">
      {/* LEFT: Document Library */}
      <div className="w-80 shrink-0 border-r border-[#1a1a1a] flex flex-col bg-[#080808]">
        {/* Header */}
        <div className="p-4 border-b border-[#1a1a1a]">
          <div className="flex items-center justify-between mb-3">
            <h1 className="text-sm font-mono font-bold text-[#f0f0f0]">Knowledge Base</h1>
            <div className="flex gap-1.5">
              <button
                onClick={() => setShowGuide(!showGuide)}
                className="p-1 text-[#444] hover:text-[#00ff88] transition-colors"
                title="KB Guide"
              >
                <BookOpen className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setShowUpload(true)}
                className="flex items-center gap-1 px-2 py-1 bg-[#00ff88]/10 border border-[#00ff88]/30 rounded text-[8px] font-mono text-[#00ff88] hover:bg-[#00ff88]/20 transition-colors"
              >
                <Plus className="w-2.5 h-2.5" /> ADD
              </button>
            </div>
          </div>

          {/* Search */}
          <div className="relative mb-3">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-[#444]" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search documents..."
              className="w-full bg-[#111] border border-[#1a1a1a] rounded pl-7 pr-2.5 py-1.5 text-[10px] font-mono text-[#ccc] placeholder:text-[#333] outline-none focus:border-[#00ff88]/30"
            />
          </div>

          {/* Category Tabs */}
          <div className="flex gap-1 flex-wrap">
            {CATEGORIES.map((c) => (
              <button
                key={c.value}
                onClick={() => setCategory(c.value)}
                className={cn(
                  'px-2 py-0.5 rounded text-[7px] font-mono uppercase tracking-wider transition-colors',
                  category === c.value
                    ? 'bg-[#00ff88]/10 text-[#00ff88] border border-[#00ff88]/30'
                    : 'text-[#555] border border-[#1a1a1a] hover:text-[#888]'
                )}
              >
                {c.label}
              </button>
            ))}
          </div>
        </div>

        {/* Document List */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="p-3"><LoadingConversationList count={5} /></div>
          ) : error ? (
            <ErrorState message="Failed to load documents" onRetry={fetchDocuments} />
          ) : documents.length === 0 ? (
            <div className="p-4 text-center">
              <FileText className="w-6 h-6 text-[#222] mx-auto mb-2" />
              <p className="text-[10px] font-mono text-[#444]">No documents found</p>
              <button
                onClick={() => setShowUpload(true)}
                className="mt-2 text-[9px] font-mono text-[#00ff88] hover:underline"
              >
                Add your first document
              </button>
            </div>
          ) : (
            <div className="p-2 space-y-1">
              {documents.map((doc) => (
                <button
                  key={doc.id}
                  onClick={() => setSelectedId(doc.id)}
                  className={cn(
                    'w-full text-left p-2.5 rounded-lg border transition-colors',
                    selectedId === doc.id
                      ? 'bg-[#0d0d0d] border-[#00ff88]/20'
                      : 'bg-transparent border-transparent hover:bg-[#0d0d0d] hover:border-[#1a1a1a]'
                  )}
                >
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <span className="text-[10px] font-mono font-bold text-[#f0f0f0] truncate">{doc.title}</span>
                    <span className={cn('text-[7px] font-mono uppercase px-1 py-0.5 rounded border shrink-0', TYPE_COLORS[doc.type])}>
                      {doc.type}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-[8px] font-mono text-[#555]">
                    <span>{doc.char_count.toLocaleString()} chars</span>
                    {doc.chunk_count > 0 && <span>{doc.chunk_count} chunks</span>}
                    <span className={doc.has_embedding ? 'text-[#00ff88]' : 'text-[#f05050]'}>
                      {doc.has_embedding ? '● embedded' : '○ no embedding'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[8px] font-mono text-[#333]">
                      {new Date(doc.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </span>
                    {!doc.is_active && (
                      <span className="text-[7px] font-mono text-[#f05050] uppercase">inactive</span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Stats footer */}
        <div className="px-4 py-2 border-t border-[#1a1a1a] text-[8px] font-mono text-[#444]">
          {documents.length} documents · {documents.filter((d) => d.has_embedding).length} embedded · {documents.reduce((a, d) => a + d.char_count, 0).toLocaleString()} total chars
        </div>
      </div>

      {/* RIGHT: Viewer / Guide */}
      <div className="flex-1 overflow-y-auto bg-[#0a0a0a]">
        {showGuide ? (
          <GuidePanel onClose={() => setShowGuide(false)} />
        ) : selectedDoc ? (
          <DocumentViewer
            docId={selectedDoc.id}
            onDeleted={handleDeleted}
            onUpdated={handleUpdated}
          />
        ) : (
          <EmptyState onShowGuide={() => setShowGuide(true)} />
        )}
      </div>

      {/* Upload Modal */}
      {showUpload && (
        <UploadModal onClose={() => setShowUpload(false)} onCreated={handleCreated} />
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Empty State                                                        */
/* ------------------------------------------------------------------ */

function EmptyState({ onShowGuide }: { onShowGuide: () => void }) {
  return (
    <div className="flex items-center justify-center h-full">
      <div className="text-center">
        <BookOpen className="w-8 h-8 text-[#1a1a1a] mx-auto mb-3" />
        <p className="text-[11px] font-mono text-[#555] mb-1">Select a document to view</p>
        <p className="text-[9px] font-mono text-[#333] mb-4">or add a new one to the knowledge base</p>
        <button
          onClick={onShowGuide}
          className="text-[9px] font-mono text-[#00ff88] hover:underline"
        >
          View KB Guide →
        </button>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Document Viewer / Editor                                           */
/* ------------------------------------------------------------------ */

function DocumentViewer({
  docId,
  onDeleted,
  onUpdated,
}: {
  docId: string
  onDeleted: () => void
  onUpdated: () => void
}) {
  const [doc, setDoc] = useState<DocDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [editTitle, setEditTitle] = useState('')
  const [editContent, setEditContent] = useState('')
  const [editType, setEditType] = useState<DocType>('general')
  const [saving, setSaving] = useState(false)
  const [embedding, setEmbedding] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  // Test retrieval state
  const [testQuery, setTestQuery] = useState('')
  const [testResults, setTestResults] = useState<RetrievalResult[] | null>(null)
  const [testing, setTesting] = useState(false)

  const fetchDoc = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/knowledge/${docId}`)
      if (res.ok) {
        const data = await res.json()
        setDoc(data)
        setEditTitle(data.title)
        setEditContent(data.content)
        setEditType(data.type)
      }
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }, [docId])

  useEffect(() => {
    fetchDoc()
    setEditing(false)
    setTestResults(null)
  }, [fetchDoc])

  const handleSave = async () => {
    if (!doc) return
    setSaving(true)
    try {
      await fetch(`/api/knowledge/${doc.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: editTitle, content: editContent, type: editType }),
      })
      setEditing(false)
      fetchDoc()
      onUpdated()
    } finally {
      setSaving(false)
    }
  }

  const handleToggleActive = async () => {
    if (!doc) return
    await fetch(`/api/knowledge/${doc.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: !doc.is_active }),
    })
    fetchDoc()
    onUpdated()
  }

  const handleRegenEmbed = async () => {
    if (!doc) return
    setEmbedding(true)
    try {
      const res = await fetch('/api/knowledge/embed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: doc.id }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: 'Unknown error' }))
        alert(`Embedding failed: ${data.error || res.statusText}`)
        return
      }
      fetchDoc()
      onUpdated()
    } finally {
      setEmbedding(false)
    }
  }

  const handleDelete = async () => {
    if (!doc) return
    setDeleting(true)
    try {
      await fetch(`/api/knowledge/${doc.id}`, { method: 'DELETE' })
      onDeleted()
    } finally {
      setDeleting(false)
    }
  }

  const runTestRetrieval = async () => {
    if (!testQuery) return
    setTesting(true)
    try {
      const res = await fetch('/api/knowledge/test-retrieval', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: testQuery, topK: 5 }),
      })
      if (res.ok) {
        const data = await res.json()
        setTestResults(data.results)
      }
    } finally {
      setTesting(false)
    }
  }

  if (loading) return <div className="p-8 text-[10px] font-mono text-[#444]">Loading document...</div>
  if (!doc) return <div className="p-8 text-[10px] font-mono text-[#f05050]">Document not found</div>

  return (
    <div className="p-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1 min-w-0 mr-4">
          {editing ? (
            <input
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              className="w-full bg-[#111] border border-[#1a1a1a] rounded px-3 py-1.5 text-sm font-mono font-bold text-[#f0f0f0] outline-none focus:border-[#00ff88]/30"
            />
          ) : (
            <h2 className="text-sm font-mono font-bold text-[#f0f0f0] truncate">{doc.title}</h2>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {!editing && (
            <button
              onClick={() => setEditing(true)}
              className="flex items-center gap-1 px-2 py-1 text-[8px] font-mono text-[#888] border border-[#222] rounded hover:text-[#ccc] transition-colors"
            >
              <Pencil className="w-2.5 h-2.5" /> EDIT
            </button>
          )}
          {editing && (
            <>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-1 px-2 py-1 bg-[#00ff88]/10 border border-[#00ff88]/30 rounded text-[8px] font-mono text-[#00ff88] hover:bg-[#00ff88]/20 disabled:opacity-50 transition-colors"
              >
                {saving ? <Loader2 className="w-2.5 h-2.5 animate-spin" /> : <Save className="w-2.5 h-2.5" />} SAVE
              </button>
              <button
                onClick={() => { setEditing(false); setEditTitle(doc.title); setEditContent(doc.content); setEditType(doc.type) }}
                className="px-2 py-1 text-[8px] font-mono text-[#666] border border-[#222] rounded hover:text-[#ccc] transition-colors"
              >
                CANCEL
              </button>
            </>
          )}
        </div>
      </div>

      {/* Metadata bar */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        {editing ? (
          <select
            value={editType}
            onChange={(e) => setEditType(e.target.value as DocType)}
            className="bg-[#111] border border-[#1a1a1a] rounded px-2 py-0.5 text-[9px] font-mono text-[#ccc] outline-none"
          >
            <option value="offer">Offer</option>
            <option value="script">Script</option>
            <option value="persona">Persona</option>
            <option value="training">Training</option>
            <option value="general">General</option>
          </select>
        ) : (
          <span className={cn('text-[8px] font-mono uppercase px-1.5 py-0.5 rounded border', TYPE_COLORS[doc.type])}>
            {doc.type}
          </span>
        )}
        <span className="text-[8px] font-mono text-[#555]">{doc.char_count.toLocaleString()} chars</span>
        {doc.chunks.length > 0 && (
          <span className="text-[8px] font-mono text-[#555]">{doc.chunks.length} chunks</span>
        )}
        <span className={cn('flex items-center gap-1 text-[8px] font-mono',
          doc.has_embedding ? 'text-[#00ff88]' : 'text-[#f05050]')}>
          {doc.has_embedding ? <CheckCircle2 className="w-2.5 h-2.5" /> : <AlertCircle className="w-2.5 h-2.5" />}
          {doc.has_embedding ? 'Embedded' : 'Not embedded'}
        </span>
        <span className="text-[8px] font-mono text-[#333]">
          Created {new Date(doc.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
        </span>
      </div>

      {/* Action buttons */}
      {!editing && (
        <div className="flex items-center gap-2 mb-6">
          <button
            onClick={handleToggleActive}
            className={cn('flex items-center gap-1 px-2 py-1 text-[8px] font-mono border rounded transition-colors',
              doc.is_active
                ? 'text-[#00ff88] border-[#00ff88]/30 hover:bg-[#00ff88]/10'
                : 'text-[#666] border-[#333] hover:bg-[#333]/20'
            )}
          >
            {doc.is_active ? <ToggleRight className="w-3 h-3" /> : <ToggleLeft className="w-3 h-3" />}
            {doc.is_active ? 'ACTIVE' : 'INACTIVE'}
          </button>
          <button
            onClick={handleRegenEmbed}
            disabled={embedding}
            className="flex items-center gap-1 px-2 py-1 text-[8px] font-mono text-[#888] border border-[#222] rounded hover:text-[#ccc] disabled:opacity-50 transition-colors"
          >
            {embedding ? <Loader2 className="w-2.5 h-2.5 animate-spin" /> : <RefreshCw className="w-2.5 h-2.5" />}
            REGENERATE EMBEDDING
          </button>
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="flex items-center gap-1 px-2 py-1 text-[8px] font-mono text-[#f05050] border border-[#f05050]/30 rounded hover:bg-[#f05050]/10 transition-colors"
          >
            <Trash2 className="w-2.5 h-2.5" /> DELETE
          </button>
        </div>
      )}

      {/* Delete confirmation */}
      {showDeleteConfirm && (
        <div className="mb-4 p-3 bg-[#f05050]/5 border border-[#f05050]/20 rounded-lg">
          <p className="text-[10px] font-mono text-[#f05050] mb-2">
            Delete &quot;{doc.title}&quot; and all its chunks? This cannot be undone.
          </p>
          <div className="flex gap-2">
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="px-3 py-1 bg-[#f05050]/10 border border-[#f05050]/30 rounded text-[8px] font-mono text-[#f05050] hover:bg-[#f05050]/20 disabled:opacity-50"
            >
              {deleting ? <Loader2 className="w-3 h-3 animate-spin inline" /> : 'YES, DELETE'}
            </button>
            <button
              onClick={() => setShowDeleteConfirm(false)}
              className="px-3 py-1 text-[8px] font-mono text-[#666] border border-[#222] rounded hover:text-[#ccc]"
            >
              CANCEL
            </button>
          </div>
        </div>
      )}

      {/* Content */}
      <div className="mb-6">
        {editing ? (
          <textarea
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            rows={24}
            className="w-full bg-[#111] border border-[#1a1a1a] rounded-lg px-4 py-3 text-[11px] font-mono text-[#ccc] leading-relaxed outline-none resize-y focus:border-[#00ff88]/30"
          />
        ) : (
          <div className="bg-[#0d0d0d] border border-[#1a1a1a] rounded-lg px-4 py-3 max-h-[500px] overflow-y-auto">
            <pre className="text-[11px] font-mono text-[#ccc] leading-relaxed whitespace-pre-wrap break-words">
              {doc.content}
            </pre>
          </div>
        )}
        {editing && (
          <span className="text-[8px] font-mono text-[#444] mt-1 block">{editContent.length.toLocaleString()} characters</span>
        )}
      </div>

      {/* Chunks info */}
      {doc.chunks.length > 0 && !editing && (
        <ChunksSection chunks={doc.chunks} />
      )}

      {/* Test Retrieval */}
      {!editing && (
        <div className="bg-[#0d0d0d] border border-[#1a1a1a] rounded-lg p-4 mt-6">
          <div className="flex items-center gap-1.5 mb-3">
            <Zap className="w-3 h-3 text-[#00ff88]" />
            <span className="text-[9px] font-mono text-[#00ff88] uppercase tracking-wider">Test Retrieval</span>
          </div>
          <p className="text-[8px] font-mono text-[#555] mb-3">
            Enter a sample message to see what the AI would retrieve from the entire knowledge base.
          </p>
          <div className="flex gap-2 mb-3">
            <input
              value={testQuery}
              onChange={(e) => { setTestQuery(e.target.value); setTestResults(null) }}
              placeholder="e.g., How much does the program cost?"
              onKeyDown={(e) => e.key === 'Enter' && runTestRetrieval()}
              className="flex-1 bg-[#111] border border-[#1a1a1a] rounded px-2.5 py-1.5 text-[10px] font-mono text-[#ccc] placeholder:text-[#333] outline-none focus:border-[#00ff88]/30"
            />
            <button
              onClick={runTestRetrieval}
              disabled={testing || !testQuery}
              className="px-3 py-1.5 text-[9px] font-mono text-[#888] border border-[#222] rounded hover:text-[#00ff88] hover:border-[#00ff88]/30 disabled:opacity-50 transition-colors"
            >
              {testing ? <Loader2 className="w-3 h-3 animate-spin" /> : 'TEST'}
            </button>
          </div>
          {testResults !== null && (
            <div className="space-y-2">
              {testResults.length === 0 ? (
                <p className="text-[10px] font-mono text-[#555]">No matches found. Try a different query or lower the similarity threshold.</p>
              ) : (
                testResults.map((r, i) => (
                  <div key={r.id} className="p-2.5 bg-[#111] rounded border border-[#1a1a1a]">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[8px] font-mono text-[#555]">#{i + 1}</span>
                      <span className="text-[10px] font-mono font-bold text-[#f0f0f0]">{r.title}</span>
                      <span className={cn('text-[7px] font-mono uppercase px-1 py-0.5 rounded border', TYPE_COLORS[r.type])}>
                        {r.type}
                      </span>
                      <span className={cn('text-[9px] font-mono font-bold ml-auto',
                        r.similarity >= 80 ? 'text-[#00ff88]' : r.similarity >= 60 ? 'text-[#ff9f43]' : 'text-[#f05050]'
                      )}>
                        {r.similarity}%
                      </span>
                    </div>
                    <p className="text-[9px] font-mono text-[#888] leading-relaxed">{r.content}</p>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Chunks Section                                                     */
/* ------------------------------------------------------------------ */

function ChunksSection({ chunks }: { chunks: DocDetail['chunks'] }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="mb-4">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1 text-[9px] font-mono text-[#666] hover:text-[#ccc] transition-colors"
      >
        {open ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
        {chunks.length} CHUNKS
      </button>
      {open && (
        <div className="mt-2 space-y-1 pl-4">
          {chunks.map((c) => (
            <div key={c.id} className="flex items-center gap-3 text-[9px] font-mono py-1">
              <span className="text-[#888]">{c.title}</span>
              <span className="text-[#555]">{c.char_count.toLocaleString()} chars</span>
              <span className={c.has_embedding ? 'text-[#00ff88]' : 'text-[#f05050]'}>
                {c.has_embedding ? '● embedded' : '○ pending'}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Upload Modal                                                       */
/* ------------------------------------------------------------------ */

function UploadModal({ onClose, onCreated }: { onClose: () => void; onCreated: (id: string) => void }) {
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [type, setType] = useState<DocType>('general')
  const [fileType, setFileType] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [mode, setMode] = useState<'file' | 'paste'>('file')
  const fileRef = useRef<HTMLInputElement>(null)

  const handleFile = async (file: File) => {
    const name = file.name
    const ext = name.split('.').pop()?.toLowerCase() || ''

    // Auto-suggest title from filename
    setTitle(name.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' '))
    setFileType(ext)

    try {
      if (['txt', 'md', 'csv'].includes(ext)) {
        const text = await file.text()
        setContent(text)
      } else if (ext === 'json') {
        const text = await file.text()
        try {
          const parsed = JSON.parse(text)
          setContent(JSON.stringify(parsed, null, 2))
        } catch {
          setContent(text)
        }
      } else if (ext === 'pdf') {
        setContent('')
        setError('PDF files: please copy-paste the text content. Switch to "Paste" mode.')
        setMode('paste')
      } else if (ext === 'docx') {
        setContent('')
        setError('DOCX files: please copy-paste the text content. Switch to "Paste" mode.')
        setMode('paste')
      } else {
        setError(`Unsupported file type: .${ext}`)
      }
    } catch {
      setError('Failed to read file')
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }

  const handleSave = async () => {
    if (!title || !content) {
      setError(`Missing fields: ${!title ? 'title' : ''} ${!content ? 'content' : ''}`.trim())
      return
    }
    setSaving(true)
    setError('')
    try {
      console.log('[KB Upload] Sending:', { title, type, fileType, contentLength: content.length })
      const res = await fetch('/api/knowledge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, content, type, file_type: fileType }),
      })
      console.log('[KB Upload] Response status:', res.status)
      if (res.ok) {
        const data = await res.json()
        console.log('[KB Upload] Success:', data)
        onCreated(data.id)
      } else {
        const data = await res.json().catch(() => ({ error: `HTTP ${res.status}` }))
        console.error('[KB Upload] Failed:', data)
        setError(data.error || `Failed (HTTP ${res.status})`)
      }
    } catch (err) {
      console.error('[KB Upload] Network error:', err)
      setError('Network error — check console for details')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Modal header */}
        <div className="flex items-center justify-between p-4 border-b border-[#1a1a1a]">
          <div className="flex items-center gap-2">
            <Upload className="w-4 h-4 text-[#00ff88]" />
            <span className="text-[11px] font-mono font-bold text-[#f0f0f0]">Add Document</span>
          </div>
          <button onClick={onClose} className="text-[#444] hover:text-[#888]">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {/* Title + Type */}
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label className="text-[8px] font-mono text-[#555] uppercase block mb-1">Title</label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Document title"
                className="w-full bg-[#111] border border-[#1a1a1a] rounded px-2.5 py-1.5 text-[10px] font-mono text-[#ccc] outline-none focus:border-[#00ff88]/30"
              />
            </div>
            <div>
              <label className="text-[8px] font-mono text-[#555] uppercase block mb-1">Type</label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as DocType)}
                className="w-full bg-[#111] border border-[#1a1a1a] rounded px-2.5 py-1.5 text-[10px] font-mono text-[#ccc] outline-none"
              >
                <option value="offer">Offer</option>
                <option value="script">Script</option>
                <option value="persona">Persona</option>
                <option value="training">Training</option>
                <option value="general">General</option>
              </select>
            </div>
          </div>

          {/* Mode toggle */}
          <div className="flex gap-2">
            <button
              onClick={() => setMode('file')}
              className={cn('px-3 py-1 rounded text-[9px] font-mono border transition-colors',
                mode === 'file' ? 'text-[#00ff88] border-[#00ff88]/30 bg-[#00ff88]/5' : 'text-[#666] border-[#222]'
              )}
            >
              <Upload className="w-3 h-3 inline mr-1" /> Upload File
            </button>
            <button
              onClick={() => setMode('paste')}
              className={cn('px-3 py-1 rounded text-[9px] font-mono border transition-colors',
                mode === 'paste' ? 'text-[#00ff88] border-[#00ff88]/30 bg-[#00ff88]/5' : 'text-[#666] border-[#222]'
              )}
            >
              <FileText className="w-3 h-3 inline mr-1" /> Paste Text
            </button>
          </div>

          {/* File upload zone */}
          {mode === 'file' && (
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
              onClick={() => fileRef.current?.click()}
              className="border-2 border-dashed border-[#222] rounded-lg p-8 text-center cursor-pointer hover:border-[#00ff88]/30 transition-colors"
            >
              <Upload className="w-6 h-6 text-[#333] mx-auto mb-2" />
              <p className="text-[10px] font-mono text-[#666] mb-1">Drop a file here or click to browse</p>
              <p className="text-[8px] font-mono text-[#444]">.txt, .md, .json, .csv supported directly</p>
              <p className="text-[8px] font-mono text-[#444]">.pdf, .docx — paste content manually</p>
              <input
                ref={fileRef}
                type="file"
                accept=".txt,.md,.json,.csv,.pdf,.docx"
                onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
                className="hidden"
              />
            </div>
          )}

          {/* Paste zone */}
          {mode === 'paste' && (
            <div>
              <label className="text-[8px] font-mono text-[#555] uppercase block mb-1">Content</label>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={14}
                placeholder="Paste your document content here..."
                className="w-full bg-[#111] border border-[#1a1a1a] rounded-lg px-3 py-2.5 text-[10px] font-mono text-[#ccc] placeholder:text-[#333] outline-none resize-y focus:border-[#00ff88]/30"
              />
            </div>
          )}

          {/* Content preview (when file loaded) */}
          {mode === 'file' && content && (
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[8px] font-mono text-[#555] uppercase">Preview ({content.length.toLocaleString()} chars)</label>
                <button
                  onClick={() => setMode('paste')}
                  className="text-[8px] font-mono text-[#666] hover:text-[#ccc]"
                >
                  <Eye className="w-2.5 h-2.5 inline mr-0.5" /> Edit content
                </button>
              </div>
              <pre className="bg-[#111] border border-[#1a1a1a] rounded-lg px-3 py-2.5 text-[10px] font-mono text-[#888] max-h-[200px] overflow-y-auto whitespace-pre-wrap break-words">
                {content.slice(0, 3000)}{content.length > 3000 ? '\n\n... (truncated preview)' : ''}
              </pre>
            </div>
          )}

          {error && <p className="text-[9px] font-mono text-[#f05050]">{error}</p>}

          {/* Actions */}
          <div className="flex items-center justify-between pt-2 border-t border-[#1a1a1a]">
            <span className="text-[8px] font-mono text-[#444]">
              {content ? `${content.length.toLocaleString()} chars · ~${Math.ceil(content.length / 4000)} chunk(s)` : 'No content yet'}
            </span>
            <div className="flex gap-2">
              <button onClick={onClose} className="px-3 py-1.5 text-[9px] font-mono text-[#666] border border-[#222] rounded hover:text-[#ccc]">
                CANCEL
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !title || !content}
                className="flex items-center gap-1.5 px-4 py-1.5 bg-[#00ff88]/10 border border-[#00ff88]/30 rounded text-[9px] font-mono text-[#00ff88] hover:bg-[#00ff88]/20 disabled:opacity-50 transition-colors"
              >
                {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                SAVE & EMBED
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  KB Guide Panel                                                     */
/* ------------------------------------------------------------------ */

function GuidePanel({ onClose }: { onClose: () => void }) {
  const [openSections, setOpenSections] = useState<Set<number>>(new Set([0]))

  const toggleSection = (i: number) => {
    setOpenSections((prev) => {
      const next = new Set(prev)
      if (next.has(i)) next.delete(i)
      else next.add(i)
      return next
    })
  }

  return (
    <div className="p-6 max-w-3xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-sm font-mono font-bold text-[#f0f0f0] mb-1">Knowledge Base Guide</h2>
          <p className="text-[10px] font-mono text-[#555]">How to build a high-performing AI knowledge base for Lars.</p>
        </div>
        <button onClick={onClose} className="text-[#444] hover:text-[#888]">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Category guides */}
      <div className="space-y-2 mb-8">
        {KB_GUIDE.map((section, i) => (
          <div key={section.type} className="border border-[#1a1a1a] rounded-lg overflow-hidden">
            <button
              onClick={() => toggleSection(i)}
              className="w-full flex items-center justify-between p-3 hover:bg-[#0d0d0d] transition-colors"
            >
              <div className="flex items-center gap-2">
                <span className={cn('text-[8px] font-mono uppercase px-1.5 py-0.5 rounded border',
                  TYPE_COLORS[section.type.toLowerCase()])}>
                  {section.type}
                </span>
                <span className="text-[10px] font-mono text-[#ccc]">{section.title}</span>
              </div>
              {openSections.has(i) ? <ChevronDown className="w-3 h-3 text-[#555]" /> : <ChevronRight className="w-3 h-3 text-[#555]" />}
            </button>
            {openSections.has(i) && (
              <div className="px-3 pb-3 pt-0">
                <ul className="space-y-1.5">
                  {section.tips.map((tip, j) => (
                    <li key={j} className="flex gap-2 text-[9px] font-mono text-[#888] leading-relaxed">
                      <span className="text-[#00ff88] shrink-0 mt-0.5">→</span>
                      {tip}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Best practices */}
      <div className="bg-[#0d0d0d] border border-[#1a1a1a] rounded-lg p-4">
        <h3 className="text-[10px] font-mono font-bold text-[#f0f0f0] mb-3">Best Practices</h3>
        <ul className="space-y-2">
          {[
            'Write in first person as Lars — "I always tell my clients..." not "Lars tells his clients..."',
            'Be specific with numbers and details — "12-week program at $3,997" not "a coaching program"',
            'Include edge cases — what happens when a lead asks about refunds, competitors, or says they need to think?',
            'Update regularly — after every successful (or failed) close, add the conversation pattern',
            'Keep documents focused — one topic per document works better than one massive document',
            'Label training examples clearly — [GOOD: led to booking] or [BAD: lead went cold]',
            'Test retrieval after adding content — use the Test Retrieval tool to verify the AI finds the right info',
          ].map((tip, i) => (
            <li key={i} className="flex gap-2 text-[9px] font-mono text-[#888] leading-relaxed">
              <span className="text-[#00ff88] shrink-0 mt-0.5">✓</span>
              {tip}
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
