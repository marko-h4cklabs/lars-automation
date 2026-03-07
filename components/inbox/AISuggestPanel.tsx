'use client'

import { useState, useCallback } from 'react'
import { Sparkles, Send, MessageSquare, Loader2, ChevronDown, ChevronUp, Target } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useInboxStore } from '@/store/inboxStore'

interface SuggestionOption {
  messages: string[]
  confidence: number
  reasoning: string
  targeting_field: string
}

interface SuggestResponse {
  option_a: SuggestionOption
  option_b: SuggestionOption
  context_summary: string
  recommended: 'a' | 'b'
  suggestion_id: string | null
}

interface AISuggestPanelProps {
  conversationId: string
  onSend: (messages: string[]) => void
  onUseThis: (messages: string[]) => void
}

function confidenceColor(score: number): string {
  if (score >= 90) return 'text-[#00ff88]'
  if (score >= 70) return 'text-[#f0c030]'
  return 'text-[#f08030]'
}

function confidenceBg(score: number): string {
  if (score >= 90) return 'bg-[#00ff88]/10 border-[#00ff88]/30'
  if (score >= 70) return 'bg-[#f0c030]/10 border-[#f0c030]/30'
  return 'bg-[#f08030]/10 border-[#f08030]/30'
}

function confidenceLabel(score: number): string {
  if (score >= 90) return 'HIGH'
  if (score >= 70) return 'MED'
  return 'LOW'
}

export function AISuggestPanel({ conversationId, onSend, onUseThis }: AISuggestPanelProps) {
  const [expanded, setExpanded] = useState(true)
  const [hoveredOption, setHoveredOption] = useState<'a' | 'b' | null>(null)
  const [sendingOption, setSendingOption] = useState<'a' | 'b' | null>(null)
  const [suggestionData, setSuggestionData] = useState<SuggestResponse | null>(null)
  const { isGeneratingSuggestions, setGeneratingSuggestions } = useInboxStore()

  const generateSuggestions = useCallback(async () => {
    setGeneratingSuggestions(true)
    setSuggestionData(null)
    try {
      const res = await fetch(`/api/conversations/${conversationId}/suggest`, { method: 'POST' })
      if (res.ok) {
        const data = await res.json() as SuggestResponse
        setSuggestionData(data)
        setExpanded(true)
      }
    } finally {
      setGeneratingSuggestions(false)
    }
  }, [conversationId, setGeneratingSuggestions])

  const trackUsage = (option: 'a' | 'b', action: 'use' | 'send') => {
    if (!suggestionData?.suggestion_id) return
    fetch(`/api/conversations/${conversationId}/suggest/use`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        suggestion_id: suggestionData.suggestion_id,
        used_option: option,
        action,
      }),
    }).catch(() => {})
  }

  const handleUseThis = (option: 'a' | 'b') => {
    const opt = option === 'a' ? suggestionData?.option_a : suggestionData?.option_b
    if (!opt) return
    onUseThis(opt.messages)
    trackUsage(option, 'use')
  }

  const handleSendNow = (option: 'a' | 'b') => {
    const opt = option === 'a' ? suggestionData?.option_a : suggestionData?.option_b
    if (!opt) return
    setSendingOption(option)
    onSend(opt.messages)
    trackUsage(option, 'send')
    setTimeout(() => setSendingOption(null), 1000)
  }

  const optionA = suggestionData?.option_a || null
  const optionB = suggestionData?.option_b || null
  const recommended = suggestionData?.recommended || null

  return (
    <div className="border-t border-[#1a1a1a] bg-[#080808]">
      {/* Header */}
      <button
        onClick={() => optionA ? setExpanded(!expanded) : generateSuggestions()}
        className="w-full flex items-center justify-between px-3 py-2 hover:bg-[#0d0d0d] transition-colors"
      >
        <div className="flex items-center gap-1.5 min-w-0">
          <Sparkles className="w-3 h-3 text-[#00ff88] shrink-0" />
          <span className="text-[9px] font-mono text-[#00ff88] uppercase tracking-wider shrink-0">Co-Pilot</span>
          {suggestionData?.context_summary && expanded && (
            <span className="text-[8px] font-mono text-[#444] ml-2 truncate">
              — {suggestionData.context_summary}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={(e) => { e.stopPropagation(); generateSuggestions() }}
            disabled={isGeneratingSuggestions}
            className="flex items-center gap-1 px-2 py-0.5 text-[8px] font-mono text-[#888] bg-[#111] border border-[#222] rounded hover:text-[#00ff88] hover:border-[#00ff88]/30 transition-colors disabled:opacity-50"
          >
            {isGeneratingSuggestions ? (
              <>
                <Loader2 className="w-2.5 h-2.5 animate-spin" />
                THINKING...
              </>
            ) : optionA ? (
              'REGENERATE'
            ) : (
              'AI SUGGEST'
            )}
          </button>
          {optionA && (
            expanded
              ? <ChevronUp className="w-3 h-3 text-[#444]" />
              : <ChevronDown className="w-3 h-3 text-[#444]" />
          )}
        </div>
      </button>

      {/* Suggestion cards */}
      {expanded && (optionA || optionB) && (
        <div className="px-3 pb-3 space-y-2">
          {([
            { key: 'a' as const, option: optionA, label: 'A' },
            { key: 'b' as const, option: optionB, label: 'B' },
          ]).map(({ key, option, label }) =>
            option ? (
              <div
                key={key}
                onMouseEnter={() => setHoveredOption(key)}
                onMouseLeave={() => setHoveredOption(null)}
                className={cn(
                  'rounded-lg border transition-all',
                  recommended === key
                    ? 'border-[#00ff88]/20 bg-[#00ff88]/[0.03]'
                    : 'border-[#1a1a1a] bg-[#0d0d0d]'
                )}
              >
                {/* Card header */}
                <div className="flex items-center justify-between px-3 pt-2.5 pb-1">
                  <div className="flex items-center gap-2">
                    <span className={cn(
                      'w-5 h-5 rounded flex items-center justify-center text-[9px] font-mono font-bold',
                      recommended === key
                        ? 'bg-[#00ff88]/15 text-[#00ff88]'
                        : 'bg-[#1a1a1a] text-[#666]'
                    )}>
                      {label}
                    </span>
                    {recommended === key && (
                      <span className="text-[7px] font-mono text-[#00ff88] uppercase tracking-widest">
                        RECOMMENDED
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1">
                      <Target className="w-2.5 h-2.5 text-[#444]" />
                      <span className="text-[8px] font-mono text-[#555]">{option.targeting_field}</span>
                    </div>
                    <span className={cn(
                      'px-1.5 py-0.5 rounded text-[8px] font-mono font-bold border',
                      confidenceBg(option.confidence),
                      confidenceColor(option.confidence)
                    )}>
                      {option.confidence}% {confidenceLabel(option.confidence)}
                    </span>
                  </div>
                </div>

                {/* Messages preview */}
                <div className="px-3 py-1.5 space-y-1">
                  {option.messages.map((msg, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <MessageSquare className="w-2.5 h-2.5 text-[#333] shrink-0 mt-0.5" />
                      <p className="text-[11px] font-mono text-[#ccc] leading-relaxed">{msg}</p>
                    </div>
                  ))}
                </div>

                {/* Reasoning */}
                <p className={cn(
                  'px-3 pb-1.5 text-[9px] font-mono italic transition-colors',
                  hoveredOption === key ? 'text-[#888]' : 'text-[#444]'
                )}>
                  {option.reasoning}
                </p>

                {/* Action buttons */}
                <div className="flex items-center gap-2 px-3 pb-2.5">
                  <button
                    onClick={() => handleUseThis(key)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-[#111] border border-[#222] rounded text-[9px] font-mono text-[#888] hover:text-[#ccc] hover:border-[#444] transition-colors"
                  >
                    <MessageSquare className="w-3 h-3" />
                    USE THIS
                  </button>
                  <button
                    onClick={() => handleSendNow(key)}
                    disabled={sendingOption === key}
                    className={cn(
                      'flex items-center gap-1.5 px-3 py-1.5 rounded text-[9px] font-mono transition-colors',
                      recommended === key
                        ? 'bg-[#00ff88]/10 border border-[#00ff88]/30 text-[#00ff88] hover:bg-[#00ff88]/20'
                        : 'bg-[#111] border border-[#222] text-[#888] hover:text-[#00ff88] hover:border-[#00ff88]/30'
                    )}
                  >
                    {sendingOption === key ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <Send className="w-3 h-3" />
                    )}
                    SEND NOW
                  </button>
                </div>
              </div>
            ) : null
          )}
        </div>
      )}
    </div>
  )
}
