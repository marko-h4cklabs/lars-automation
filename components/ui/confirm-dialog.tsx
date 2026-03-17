'use client'

import { useEffect } from 'react'
import { AlertTriangle, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ConfirmDialogProps {
  open: boolean
  title: string
  description?: string
  confirmLabel?: string
  variant?: 'danger' | 'warning'
  loading?: boolean
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = 'DELETE',
  variant = 'danger',
  loading = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  useEffect(() => {
    if (!open) return
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel()
      if (e.key === 'Enter') onConfirm()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [open, onCancel, onConfirm])

  if (!open) return null

  const isDanger = variant === 'danger'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={onCancel} />
      <div className="relative bg-[#0a0a0a] border border-[#1a1a1a] rounded-lg p-6 max-w-sm w-full mx-4 animate-scale-in">
        <div className="flex items-start gap-3 mb-4">
          <div
            className={cn(
              'w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0',
              isDanger ? 'bg-[#f05050]/10' : 'bg-[#ff9f43]/10'
            )}
          >
            <AlertTriangle
              className={cn('w-4 h-4', isDanger ? 'text-[#f05050]' : 'text-[#ff9f43]')}
            />
          </div>
          <div>
            <h3 className="text-[#f0f0f0] font-mono text-sm font-bold">{title}</h3>
            {description && (
              <p className="text-[#555] font-mono text-[13px] mt-1">{description}</p>
            )}
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <button
            onClick={onCancel}
            disabled={loading}
            className="px-4 py-2 text-[13px] font-mono text-[#888] border border-[#222] rounded hover:border-[#333] hover:text-[#ccc] transition-colors disabled:opacity-50"
          >
            CANCEL
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className={cn(
              'px-4 py-2 text-[13px] font-mono rounded transition-colors disabled:opacity-50 flex items-center gap-1.5',
              isDanger
                ? 'bg-[#f05050]/10 border border-[#f05050]/30 text-[#f05050] hover:bg-[#f05050]/20'
                : 'bg-[#ff9f43]/10 border border-[#ff9f43]/30 text-[#ff9f43] hover:bg-[#ff9f43]/20'
            )}
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
