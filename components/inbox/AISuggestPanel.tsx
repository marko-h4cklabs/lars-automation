'use client'

import { useState } from 'react'
import { Sparkles, Send, Copy, Check, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useInboxStore } from '@/store/inboxStore'

interface SuggestionOption {
  messages: string[]
  confidence: number
  reasoning: string
  targeting_field: string
}

interface AISuggestPanelProps {
  conversationId: string
  onSend: (messages: string[]) => void
}

export function AISuggestPanel({ conversationId, onSend }: AISuggestPanelProps) {
  const [selected, setSelected] = useState<'a' | 'b' | null>(null)
  const [copied, setCopied] = useState(false)
  const { aiSuggestions, isGeneratingSuggestions, setGeneratingSuggestions, setAISuggestions } = useInboxStore()

  const generateSuggestions = async () => {
    setGeneratingSuggestions(true)
    try {
      const res = await fetch(`/api/conversations/${conversationId}/suggest`, { method: 'POST' })
      if (res.ok) {
        const data = await res.json()
        setAISuggestions(data)
        setSelected(data.recommended === 'a' ? 'a' : 'b')
      }
    } finally {
      setGeneratingSuggestions(false)
    }
  }

  const parseSuggestion = (key: 'a' | 'b'): SuggestionOption | null => {
    if (!aiSuggestions) return null
    const raw = key === 'a' ? aiSuggestions.suggestion_1 : aiSuggestions.suggestion_2
    try {
      const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw
      return parsed as SuggestionOption
    } catch {
      return null
    }
  }

  const optionA = parseSuggestion('a')
  const optionB = parseSuggestion('b')

  const handleCopy = (msgs: string[]) => {
    navigator.clipboard.writeText(msgs.join('\n'))
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="border-t border-[#1a1a1a] bg-[#080808]">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2">
        <div className="flex items-center gap-1.5">
          <Sparkles className="w-3 h-3 text-[#00ff88]" />
          <span className="text-[9px] font-mono text-[#00ff88] uppercase tracking-wider">Co-Pilot</span>
        </div>
        <button
          onClick={generateSuggestions}
          disabled={isGeneratingSuggestions}
          className="flex items-center gap-1 px-2 py-0.5 text-[8px] font-mono text-[#888] bg-[#111] border border-[#222] rounded hover:text-[#00ff88] hover:border-[#00ff88]/30 transition-colors disabled:opacity-50"
        >
          {isGeneratingSuggestions ? (
            <>
              <Loader2 className="w-2.5 h-2.5 animate-spin" />
              THINKING...
            </>
          ) : (
            'SUGGEST'
          )}
        </button>
      </div>

      {/* Context summary */}
      {aiSuggestions?.reasoning && (
        <p className="px-3 pb-1.5 text-[9px] font-mono text-[#555] italic">
          {aiSuggestions.reasoning}
        </p>
      )}

      {/* Suggestion cards */}
      {(optionA || optionB) && (
        <div className="px-3 pb-3 grid grid-cols-2 gap-2">
          {[
            { key: 'a' as const, option: optionA, label: 'Option A' },
            { key: 'b' as const, option: optionB, label: 'Option B' },
          ].map(({ key, option, label }) =>
            option ? (
              <button
                key={key}
                onClick={() => setSelected(key)}
                className={cn(
                  'text-left p-2 rounded border transition-all',
                  selected === key
                    ? 'bg-[#00ff88]/5 border-[#00ff88]/30'
                    : 'bg-[#111] border-[#1a1a1a] hover:border-[#333]'
                )}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[8px] font-mono text-[#666] uppercase">{label}</span>
                  <span className={cn(
                    'text-[8px] font-mono',
                    option.confidence >= 0.8 ? 'text-[#00ff88]' : 'text-[#666]'
                  )}>
                    {Math.round(option.confidence * 100)}%
                  </span>
                </div>
                {option.messages.map((msg, i) => (
                  <p key={i} className="text-[10px] font-mono text-[#ccc] leading-relaxed mb-1">
                    {msg}
                  </p>
                ))}
                <p className="text-[8px] font-mono text-[#444] mt-1">{option.reasoning}</p>
              </button>
            ) : null
          )}
        </div>
      )}

      {/* Action buttons */}
      {selected && (
        <div className="flex items-center gap-2 px-3 pb-3">
          <button
            onClick={() => {
              const opt = selected === 'a' ? optionA : optionB
              if (opt) onSend(opt.messages)
            }}
            className="flex-1 flex items-center justify-center gap-1.5 py-1.5 bg-[#00ff88]/10 border border-[#00ff88]/30 rounded text-[10px] font-mono text-[#00ff88] hover:bg-[#00ff88]/20 transition-colors"
          >
            <Send className="w-3 h-3" />
            SEND OPTION {selected.toUpperCase()}
          </button>
          <button
            onClick={() => {
              const opt = selected === 'a' ? optionA : optionB
              if (opt) handleCopy(opt.messages)
            }}
            className="flex items-center gap-1 px-3 py-1.5 bg-[#111] border border-[#222] rounded text-[10px] font-mono text-[#888] hover:text-[#ccc] transition-colors"
          >
            {copied ? <Check className="w-3 h-3 text-[#00ff88]" /> : <Copy className="w-3 h-3" />}
          </button>
        </div>
      )}
    </div>
  )
}
