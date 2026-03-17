'use client'

import { useState, useEffect } from 'react'
import { FileText, X, Search, Star, Clock, Send } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Template {
  id: string
  name: string
  category: string
  content: string
  tags: string[]
  usage_count: number
  is_favorite: boolean
}

interface TemplateSelectorProps {
  open: boolean
  onClose: () => void
  onSelect: (content: string) => void
  onSendDirect?: (templateId: string) => void
}

const CATEGORIES = [
  { value: 'all', label: 'ALL', color: '' },
  { value: 'opener', label: 'OPEN', color: 'text-[#00ff88]' },
  { value: 'qualifying', label: 'QUAL', color: 'text-[#54a0ff]' },
  { value: 'nurturing', label: 'NURT', color: 'text-[#ff9f43]' },
  { value: 'booking_push', label: 'BOOK', color: 'text-[#f05050]' },
  { value: 'follow_up', label: 'F/UP', color: 'text-[#aaa]' },
  { value: 'objection', label: 'OBJ', color: 'text-[#5f27cd]' },
  { value: 'closer', label: 'CLOSE', color: 'text-[#333]' },
]

const CAT_COLORS: Record<string, string> = {
  opener: 'text-[#00ff88] bg-[#00ff88]/10',
  qualifying: 'text-[#54a0ff] bg-[#54a0ff]/10',
  nurturing: 'text-[#ff9f43] bg-[#ff9f43]/10',
  booking_push: 'text-[#f05050] bg-[#f05050]/10',
  follow_up: 'text-[#aaa] bg-[#aaa]/10',
  objection: 'text-[#5f27cd] bg-[#5f27cd]/10',
  closer: 'text-[#666] bg-[#666]/10',
}

export function TemplateSelector({ open, onClose, onSelect, onSendDirect }: TemplateSelectorProps) {
  const [templates, setTemplates] = useState<Template[]>([])
  const [recentIds] = useState<string[]>([])
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('all')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!open) return
    setLoading(true)
    fetch('/api/templates')
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (data?.templates) setTemplates(data.templates)
      })
      .catch(() => {})
      .finally(() => setLoading(false))

    // Load recent
    fetch('/api/templates?recent=true')
      .catch(() => {})
  }, [open])

  if (!open) return null

  const filtered = templates.filter((t) => {
    if (category !== 'all' && t.category !== category) return false
    if (search) {
      const q = search.toLowerCase()
      if (!t.name.toLowerCase().includes(q) && !t.content.toLowerCase().includes(q) && !t.tags.some((tag) => tag.toLowerCase().includes(q))) return false
    }
    return true
  })

  // Split into favorites + recent + rest
  const favorites = filtered.filter((t) => t.is_favorite)
  const recent = recentIds.length > 0
    ? filtered.filter((t) => recentIds.includes(t.id) && !t.is_favorite)
    : []
  const rest = filtered.filter((t) => !t.is_favorite && !recentIds.includes(t.id))

  return (
    <div className="absolute bottom-full left-0 right-0 bg-[#0a0a0a] border border-[#1a1a1a] rounded-t-lg shadow-2xl flex flex-col z-50" style={{ height: '400px' }}>
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-[#1a1a1a] shrink-0">
        <div className="flex items-center gap-1.5">
          <FileText className="w-4 h-4 text-[#00ff88]" />
          <span className="text-xs font-mono text-[#00ff88] uppercase tracking-wider">Templates</span>
          <span className="text-[11px] font-mono text-[#444]">({filtered.length})</span>
        </div>
        <button onClick={onClose} className="text-[#444] hover:text-[#888]">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Search + categories */}
      <div className="px-3 py-2 border-b border-[#111] space-y-2 shrink-0">
        <div className="flex items-center gap-2 bg-[#111] rounded px-3 py-1.5">
          <Search className="w-4 h-4 text-[#444]" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search templates..."
            className="bg-transparent text-[#ccc] text-[13px] font-mono placeholder:text-[#333] outline-none flex-1"
            autoFocus
          />
        </div>
        <div className="flex gap-1 flex-wrap">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.value}
              onClick={() => setCategory(cat.value)}
              className={cn(
                'px-1.5 py-0.5 rounded text-[10px] font-mono uppercase transition-colors',
                category === cat.value
                  ? 'bg-[#00ff88]/10 text-[#00ff88] border border-[#00ff88]/20'
                  : 'text-[#555] hover:text-[#888] border border-transparent'
              )}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* Template list */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <p className="text-center text-[13px] font-mono text-[#444] py-6">Loading...</p>
        ) : (
          <>
            {/* Favorites */}
            {favorites.length > 0 && (
              <div>
                <div className="px-3 py-1 flex items-center gap-1">
                  <Star className="w-3.5 h-3.5 text-[#ff9f43]" />
                  <span className="text-[10px] font-mono text-[#555] uppercase tracking-wider">Favorites</span>
                </div>
                {favorites.map((t) => (
                  <TemplateRow key={t.id} template={t} onSelect={onSelect} onClose={onClose} onSendDirect={onSendDirect} />
                ))}
              </div>
            )}

            {/* Recent */}
            {recent.length > 0 && (
              <div>
                <div className="px-3 py-1 flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-[#555]" />
                  <span className="text-[10px] font-mono text-[#555] uppercase tracking-wider">Recent</span>
                </div>
                {recent.map((t) => (
                  <TemplateRow key={t.id} template={t} onSelect={onSelect} onClose={onClose} onSendDirect={onSendDirect} />
                ))}
              </div>
            )}

            {/* All */}
            {rest.map((t) => (
              <TemplateRow key={t.id} template={t} onSelect={onSelect} onClose={onClose} onSendDirect={onSendDirect} />
            ))}

            {filtered.length === 0 && (
              <p className="text-center text-[13px] font-mono text-[#444] py-6">No templates found</p>
            )}
          </>
        )}
      </div>
    </div>
  )
}

function TemplateRow({
  template, onSelect, onClose, onSendDirect,
}: {
  template: Template; onSelect: (content: string) => void
  onClose: () => void; onSendDirect?: (id: string) => void
}) {
  return (
    <div className="flex items-center gap-1 px-3 py-1.5 hover:bg-[#111] border-b border-[#0d0d0d] transition-colors group">
      <button
        onClick={() => { onSelect(template.content); onClose() }}
        className="flex-1 text-left min-w-0"
      >
        <div className="flex items-center gap-1.5 mb-0.5">
          <span className="text-[13px] font-mono text-[#ccc] font-bold truncate">{template.name}</span>
          <span className={cn('text-[10px] font-mono uppercase px-1 py-0.5 rounded shrink-0',
            CAT_COLORS[template.category] || 'text-[#666] bg-[#666]/10')}>
            {template.category.replace('_', ' ')}
          </span>
          {template.tags.slice(0, 2).map((tag) => (
            <span key={tag} className="text-[10px] font-mono text-[#444] bg-[#111] px-1 rounded shrink-0">{tag}</span>
          ))}
        </div>
        <p className="text-xs font-mono text-[#555] truncate">{template.content.slice(0, 60)}</p>
      </button>
      {onSendDirect && (
        <button
          onClick={() => { onSendDirect(template.id); onClose() }}
          className="p-1 text-[#333] hover:text-[#00ff88] opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
          title="Send directly"
        >
          <Send className="w-4 h-4" />
        </button>
      )}
    </div>
  )
}
