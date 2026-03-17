'use client'

import { useState, useEffect } from 'react'
import { Brain, RefreshCw, Loader2 } from 'lucide-react'

interface SummaryBoxProps {
  conversationId: string
}

export function SummaryBox({ conversationId }: SummaryBoxProps) {
  const [summary, setSummary] = useState<string | null>(null)
  const [updatedAt, setUpdatedAt] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [regenerating, setRegenerating] = useState(false)

  useEffect(() => {
    setLoading(true)
    fetch(`/api/conversations/${conversationId}/summary`)
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (data) {
          setSummary(data.summary)
          setUpdatedAt(data.summary_updated_at)
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [conversationId])

  const regenerate = async () => {
    setRegenerating(true)
    try {
      const res = await fetch(`/api/conversations/${conversationId}/summary`, { method: 'POST' })
      if (res.ok) {
        const data = await res.json()
        setSummary(data.summary)
        setUpdatedAt(data.summary_updated_at)
      }
    } finally {
      setRegenerating(false)
    }
  }

  return (
    <div className="border-t border-[#1a1a1a] bg-[#080808] px-3 py-2">
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-1.5">
          <Brain className="w-4 h-4 text-[#00ff88]" />
          <span className="text-xs font-mono text-[#00ff88] uppercase tracking-wider">Summary</span>
        </div>
        <button
          onClick={regenerate}
          disabled={regenerating}
          className="flex items-center gap-1 text-[11px] font-mono text-[#555] hover:text-[#00ff88] transition-colors disabled:opacity-50"
        >
          {regenerating ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <RefreshCw className="w-3.5 h-3.5" />
          )}
          {regenerating ? 'UPDATING' : 'REFRESH'}
        </button>
      </div>

      {loading ? (
        <div className="h-12 bg-[#111] rounded animate-pulse" />
      ) : summary ? (
        <>
          <p className="text-[13px] font-mono text-[#888] leading-relaxed">{summary}</p>
          {updatedAt && (
            <p className="text-[11px] font-mono text-[#333] mt-1">
              Updated {new Date(updatedAt).toLocaleString()}
            </p>
          )}
        </>
      ) : (
        <p className="text-[13px] font-mono text-[#444] italic">No summary available</p>
      )}
    </div>
  )
}
