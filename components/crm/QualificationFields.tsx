'use client'

import { CheckCircle2, Circle } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { QualificationField } from '@/types'

interface QualificationFieldsProps {
  fields: QualificationField[]
  collected: Record<string, unknown>
}

export function QualificationFields({ fields, collected }: QualificationFieldsProps) {
  const filledCount = fields.filter((f) => collected[f.field_key] != null).length
  const total = fields.length
  const pct = total > 0 ? Math.round((filledCount / total) * 100) : 0

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="text-[9px] font-mono text-[#666] uppercase tracking-wider">Qualification</span>
        <span className={cn(
          'text-[10px] font-mono font-bold',
          pct === 100 ? 'text-[#00ff88]' : pct >= 50 ? 'text-[#f0a030]' : 'text-[#666]'
        )}>
          {filledCount}/{total} ({pct}%)
        </span>
      </div>

      {/* Progress bar */}
      <div className="h-1.5 bg-[#1a1a1a] rounded-full overflow-hidden mb-3">
        <div
          className={cn(
            'h-full rounded-full transition-all duration-500',
            pct === 100 ? 'bg-[#00ff88]' : pct >= 50 ? 'bg-[#f0a030]' : 'bg-[#444]'
          )}
          style={{ width: `${pct}%` }}
        />
      </div>

      {/* Fields list */}
      <div className="space-y-1.5">
        {fields.sort((a, b) => a.display_order - b.display_order).map((field) => {
          const value = collected[field.field_key]
          const isFilled = value != null

          return (
            <div key={field.id} className="flex items-center gap-2">
              {isFilled ? (
                <CheckCircle2 className="w-3.5 h-3.5 text-[#00ff88] shrink-0" />
              ) : (
                <Circle className="w-3.5 h-3.5 text-[#333] shrink-0" />
              )}
              <span className={cn(
                'text-[10px] font-mono flex-1',
                isFilled ? 'text-[#999]' : 'text-[#555]'
              )}>
                {field.field_label}
                {field.is_required && <span className="text-[#f05050] ml-0.5">*</span>}
              </span>
              {isFilled && (
                <span className="text-[10px] font-mono text-[#00ff88] truncate max-w-[140px]">
                  {String(value)}
                </span>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
