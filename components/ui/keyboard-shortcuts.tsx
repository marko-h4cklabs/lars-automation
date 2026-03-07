'use client'

import { useEffect } from 'react'
import { X, Keyboard } from 'lucide-react'

interface KeyboardShortcutsModalProps {
  open: boolean
  onClose: () => void
}

const isMac = typeof navigator !== 'undefined' && navigator.platform.includes('Mac')
const mod = isMac ? '\u2318' : 'Ctrl'

const SHORTCUTS = [
  { keys: `${mod} + Enter`, label: 'Send message', scope: 'Inbox' },
  { keys: `${mod} + K`, label: 'AI Suggest', scope: 'Inbox' },
  { keys: `${mod} + T`, label: 'Open templates', scope: 'Inbox' },
  { keys: `${mod} + V`, label: 'Open voice panel', scope: 'Inbox' },
  { keys: `${mod} + /`, label: 'Show shortcuts', scope: 'Global' },
  { keys: 'Escape', label: 'Close panel / modal', scope: 'Global' },
]

export function KeyboardShortcutsModal({ open, onClose }: KeyboardShortcutsModalProps) {
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative bg-[#0a0a0a] border border-[#1a1a1a] rounded-lg p-6 max-w-md w-full mx-4 animate-scale-in">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Keyboard className="w-4 h-4 text-[#00ff88]" />
            <h3 className="text-[#f0f0f0] font-mono text-sm font-bold">Keyboard Shortcuts</h3>
          </div>
          <button
            onClick={onClose}
            className="text-[#555] hover:text-[#888] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="space-y-1">
          {SHORTCUTS.map((s) => (
            <div key={s.keys} className="flex items-center justify-between py-2 border-b border-[#111]">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono text-[#ccc]">{s.label}</span>
                <span className="text-[8px] font-mono text-[#444]">{s.scope}</span>
              </div>
              <kbd className="px-2 py-0.5 bg-[#111] border border-[#222] rounded text-[10px] font-mono text-[#888]">
                {s.keys}
              </kbd>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
