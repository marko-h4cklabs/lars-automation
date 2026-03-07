'use client'

import toast, { Toaster } from 'react-hot-toast'
import { X } from 'lucide-react'

type ToastType = 'success' | 'error' | 'info' | 'hot_lead' | 'call_booked'

const borderColors: Record<ToastType, string> = {
  success: '#00ff88',
  error: '#ff4500',
  info: '#3b82f6',
  hot_lead: '#ff4500',
  call_booked: '#00ff88',
}

export function showToast(message: string, type: ToastType = 'info') {
  toast.custom(
    (t) => (
      <div
        className={`${
          t.visible ? 'animate-in fade-in slide-in-from-right' : 'animate-out fade-out slide-out-to-right'
        } flex items-start gap-3 bg-[#111] border border-[#222] rounded shadow-xl px-4 py-3 max-w-sm`}
        style={{ borderLeftColor: borderColors[type], borderLeftWidth: 3 }}
      >
        <p className="text-[#f0f0f0] text-xs font-mono flex-1">{message}</p>
        <button
          onClick={() => toast.dismiss(t.id)}
          className="text-[#666] hover:text-[#f0f0f0] transition-colors shrink-0"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    ),
    { duration: 4000 }
  )
}

export function ToastProvider() {
  return (
    <Toaster
      position="top-right"
      toastOptions={{
        duration: 4000,
      }}
    />
  )
}
