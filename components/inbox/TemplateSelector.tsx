'use client'

import { useState, useEffect } from 'react'
import { FileText, X, Search } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Template {
  id: string
  name: string
  category: string
  content: string
}

interface TemplateSelectorProps {
  open: boolean
  onClose: () => void
  onSelect: (content: string) => void
}

const FALLBACK_TEMPLATES: Template[] = [
  { id: '1', name: 'Intro', category: 'opening', content: 'Hey! Thanks for reaching out 🙏 What made you interested in working with a coach?' },
  { id: '2', name: 'Qualify Budget', category: 'qualifying', content: 'Just so I can point you in the right direction — have you invested in coaching or fitness programs before?' },
  { id: '3', name: 'Qualify Timeline', category: 'qualifying', content: 'What kind of timeline are you looking at for hitting your goals?' },
  { id: '4', name: 'Qualify Commitment', category: 'qualifying', content: 'How many days a week are you currently training?' },
  { id: '5', name: 'Book Call', category: 'closing', content: 'I think you\'d be a great fit. Want me to send you a link to book a quick call with the coach?' },
  { id: '6', name: 'Send Calendly', category: 'closing', content: 'Here\'s the link to book your call: [CALENDLY_LINK]\n\nPick whatever time works best for you!' },
  { id: '7', name: 'Follow Up', category: 'follow_up', content: 'Hey! Just checking in — did you get a chance to look at that link I sent?' },
  { id: '8', name: 'Soft Close', category: 'closing', content: 'No pressure at all — just want to make sure you don\'t miss out. The coach only takes on a few clients per month.' },
]

const CATEGORIES = ['all', 'opening', 'qualifying', 'closing', 'follow_up']

export function TemplateSelector({ open, onClose, onSelect }: TemplateSelectorProps) {
  const [templates, setTemplates] = useState<Template[]>(FALLBACK_TEMPLATES)
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('all')

  useEffect(() => {
    if (!open) return
    fetch('/api/templates')
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (data?.templates?.length > 0) setTemplates(data.templates)
      })
      .catch(() => {})
  }, [open])

  if (!open) return null

  const filtered = templates.filter((t) => {
    if (category !== 'all' && t.category !== category) return false
    if (search && !t.name.toLowerCase().includes(search.toLowerCase()) && !t.content.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  return (
    <div className="absolute bottom-full left-0 right-0 bg-[#0a0a0a] border border-[#1a1a1a] rounded-t-lg shadow-2xl max-h-[320px] flex flex-col z-50">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-[#1a1a1a]">
        <div className="flex items-center gap-1.5">
          <FileText className="w-3 h-3 text-[#00ff88]" />
          <span className="text-[9px] font-mono text-[#00ff88] uppercase tracking-wider">Templates</span>
        </div>
        <button onClick={onClose} className="text-[#444] hover:text-[#888]">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Search + categories */}
      <div className="px-3 py-2 border-b border-[#111] space-y-2">
        <div className="flex items-center gap-2 bg-[#111] rounded px-2 py-1">
          <Search className="w-3 h-3 text-[#444]" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search templates..."
            className="bg-transparent text-[#ccc] text-[10px] font-mono placeholder:text-[#333] outline-none flex-1"
          />
        </div>
        <div className="flex gap-1">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setCategory(cat)}
              className={cn(
                'px-2 py-0.5 rounded text-[8px] font-mono uppercase transition-colors',
                category === cat
                  ? 'bg-[#00ff88]/10 text-[#00ff88] border border-[#00ff88]/20'
                  : 'text-[#555] hover:text-[#888]'
              )}
            >
              {cat.replace('_', ' ')}
            </button>
          ))}
        </div>
      </div>

      {/* Template list */}
      <div className="flex-1 overflow-y-auto">
        {filtered.map((t) => (
          <button
            key={t.id}
            onClick={() => {
              onSelect(t.content)
              onClose()
            }}
            className="w-full text-left px-3 py-2 hover:bg-[#111] border-b border-[#0d0d0d] transition-colors"
          >
            <div className="flex items-center gap-2 mb-0.5">
              <span className="text-[10px] font-mono text-[#ccc] font-bold">{t.name}</span>
              <span className="text-[8px] font-mono text-[#444] uppercase">{t.category}</span>
            </div>
            <p className="text-[9px] font-mono text-[#555] truncate">{t.content}</p>
          </button>
        ))}
        {filtered.length === 0 && (
          <p className="text-center text-[10px] font-mono text-[#444] py-6">No templates found</p>
        )}
      </div>
    </div>
  )
}
