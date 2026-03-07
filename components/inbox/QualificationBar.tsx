'use client'

import { useState, useEffect } from 'react'
import { CheckCircle2, Circle, ChevronDown, ChevronUp } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { QualificationField } from '@/types'

interface QualificationBarProps {
  conversationId: string
  collectedFields: Record<string, unknown>
}

export function QualificationBar({ conversationId, collectedFields }: QualificationBarProps) {
  const [fields, setFields] = useState<QualificationField[]>([])
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    fetch('/api/qualification-fields')
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (data?.fields) setFields(data.fields)
      })
      .catch(() => {})
  }, [conversationId])

  const collected = fields.filter((f) => collectedFields[f.field_key] != null)
  const total = fields.length
  const pct = total > 0 ? Math.round((collected.length / total) * 100) : 0

  if (total === 0) return null

  return (
    <div className="border-t border-[#1a1a1a] bg-[#080808]">
      {/* Progress bar header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 px-3 py-2 hover:bg-[#0d0d0d] transition-colors"
      >
        <div className="flex-1">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[9px] font-mono text-[#666] uppercase tracking-wider">
              Qualification
            </span>
            <span className={cn(
              'text-[9px] font-mono font-bold',
              pct === 100 ? 'text-[#00ff88]' : pct >= 50 ? 'text-[#f0a030]' : 'text-[#666]'
            )}>
              {collected.length}/{total}
            </span>
          </div>
          {/* Bar */}
          <div className="h-1 bg-[#1a1a1a] rounded-full overflow-hidden">
            <div
              className={cn(
                'h-full rounded-full transition-all duration-500',
                pct === 100 ? 'bg-[#00ff88]' : pct >= 50 ? 'bg-[#f0a030]' : 'bg-[#444]'
              )}
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
        {expanded ? (
          <ChevronUp className="w-3 h-3 text-[#444]" />
        ) : (
          <ChevronDown className="w-3 h-3 text-[#444]" />
        )}
      </button>

      {/* Expanded field list */}
      {expanded && (
        <div className="px-3 pb-2 space-y-1">
          {fields
            .sort((a, b) => a.display_order - b.display_order)
            .map((field) => {
              const value = collectedFields[field.field_key]
              const isCollected = value != null

              return (
                <div key={field.id} className="flex items-center gap-2 py-0.5">
                  {isCollected ? (
                    <CheckCircle2 className="w-3 h-3 text-[#00ff88] shrink-0" />
                  ) : (
                    <Circle className="w-3 h-3 text-[#333] shrink-0" />
                  )}
                  <span className={cn(
                    'text-[10px] font-mono flex-1',
                    isCollected ? 'text-[#888]' : 'text-[#444]'
                  )}>
                    {field.field_label}
                  </span>
                  {isCollected && (
                    <span className="text-[9px] font-mono text-[#00ff88] truncate max-w-[120px]">
                      {String(value)}
                    </span>
                  )}
                </div>
              )
            })}
        </div>
      )}
    </div>
  )
}
