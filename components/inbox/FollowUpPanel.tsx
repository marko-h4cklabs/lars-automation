'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Clock, Play, Pause, X, ChevronDown, Zap, CheckCircle2,
  AlertCircle, RotateCcw,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { FollowUpStep } from '@/types'

interface FollowUpJob {
  id: string
  conversation_id: string
  sequence_id: string
  current_step: number
  next_fire_at: string
  status: 'active' | 'paused' | 'completed' | 'cancelled'
  created_at: string
  follow_up_sequences: {
    id: string
    name: string
    steps: FollowUpStep[]
    is_active: boolean
  } | null
}

interface Sequence {
  id: string
  name: string
  steps: FollowUpStep[]
  is_active: boolean
}

interface FollowUpPanelProps {
  conversationId: string
}

export function FollowUpPanel({ conversationId }: FollowUpPanelProps) {
  const [activeJob, setActiveJob] = useState<FollowUpJob | null>(null)
  const [sequences, setSequences] = useState<Sequence[]>([])
  const [loading, setLoading] = useState(true)
  const [acting, setActing] = useState(false)
  const [showPicker, setShowPicker] = useState(false)
  const [countdown, setCountdown] = useState('')

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch(`/api/conversations/${conversationId}/followup`)
      if (!res.ok) return
      const data = await res.json()
      setActiveJob(data.activeJob)
      setSequences(data.sequences || [])
    } catch { /* ignore */ }
    setLoading(false)
  }, [conversationId])

  useEffect(() => {
    fetchStatus()
  }, [fetchStatus])

  // Countdown timer
  useEffect(() => {
    if (!activeJob || activeJob.status !== 'active') {
      setCountdown('')
      return
    }

    const update = () => {
      const diff = new Date(activeJob.next_fire_at).getTime() - Date.now()
      if (diff <= 0) {
        setCountdown('Due now')
        return
      }
      const hrs = Math.floor(diff / 3600000)
      const mins = Math.floor((diff % 3600000) / 60000)
      const secs = Math.floor((diff % 60000) / 1000)
      if (hrs > 0) {
        setCountdown(`${hrs}h ${mins}m`)
      } else if (mins > 0) {
        setCountdown(`${mins}m ${secs}s`)
      } else {
        setCountdown(`${secs}s`)
      }
    }

    update()
    const interval = setInterval(update, 1000)
    return () => clearInterval(interval)
  }, [activeJob])

  const enroll = async (sequenceId: string) => {
    setActing(true)
    try {
      await fetch(`/api/conversations/${conversationId}/followup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sequenceId }),
      })
      await fetchStatus()
    } finally {
      setActing(false)
      setShowPicker(false)
    }
  }

  const doAction = async (action: string) => {
    setActing(true)
    try {
      if (action === 'cancel') {
        await fetch(`/api/conversations/${conversationId}/followup`, { method: 'DELETE' })
      } else {
        await fetch(`/api/conversations/${conversationId}/followup`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action }),
        })
      }
      await fetchStatus()
    } finally {
      setActing(false)
    }
  }

  if (loading) {
    return (
      <div className="border-t border-[#1a1a1a] px-4 py-3">
        <div className="text-[8px] font-mono text-[#333] animate-pulse">Loading follow-ups...</div>
      </div>
    )
  }

  const seq = activeJob?.follow_up_sequences
  const steps = (seq?.steps || []) as FollowUpStep[]
  const totalSteps = steps.length
  const currentStepIndex = activeJob?.current_step ?? 0

  return (
    <div className="border-t border-[#1a1a1a]">
      {/* Header */}
      <div className="px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Clock className="w-3 h-3 text-[#ff9f43]" />
          <span className="text-[8px] font-mono text-[#555] uppercase tracking-wider">Follow-Up</span>
        </div>
        {!activeJob && (
          <button
            onClick={() => setShowPicker(!showPicker)}
            className="text-[8px] font-mono text-[#00ff88] hover:text-[#00dd77] transition-colors"
            disabled={acting}
          >
            + Start
          </button>
        )}
      </div>

      {/* Sequence Picker */}
      {showPicker && !activeJob && (
        <div className="px-4 pb-3 space-y-1">
          {sequences.length === 0 ? (
            <p className="text-[8px] font-mono text-[#444]">No active sequences configured</p>
          ) : (
            sequences.map((s) => (
              <button
                key={s.id}
                onClick={() => enroll(s.id)}
                disabled={acting}
                className="w-full text-left px-2 py-1.5 rounded bg-[#111] hover:bg-[#1a1a1a] border border-[#1a1a1a] transition-colors"
              >
                <span className="text-[9px] font-mono text-[#ccc]">{s.name}</span>
                <span className="text-[7px] font-mono text-[#444] ml-2">{s.steps.length} steps</span>
              </button>
            ))
          )}
        </div>
      )}

      {/* Active Job */}
      {activeJob && seq && (
        <div className="px-4 pb-3 space-y-2">
          {/* Sequence name + status */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 min-w-0">
              <span className={cn(
                'w-1.5 h-1.5 rounded-full shrink-0',
                activeJob.status === 'active' ? 'bg-[#00ff88] animate-pulse' : 'bg-[#ff9f43]'
              )} />
              <span className="text-[9px] font-mono text-[#ccc] truncate">{seq.name}</span>
            </div>
            <span className={cn(
              'text-[7px] font-mono uppercase px-1.5 py-0.5 rounded shrink-0',
              activeJob.status === 'active'
                ? 'text-[#00ff88] bg-[#00ff88]/10'
                : 'text-[#ff9f43] bg-[#ff9f43]/10'
            )}>
              {activeJob.status}
            </span>
          </div>

          {/* Progress bar */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[8px] font-mono text-[#555]">
                Step {currentStepIndex + 1} of {totalSteps}
              </span>
              {countdown && activeJob.status === 'active' && (
                <span className="text-[8px] font-mono text-[#ff9f43]">
                  Next: {countdown}
                </span>
              )}
            </div>
            <div className="h-1 bg-[#1a1a1a] rounded-full overflow-hidden">
              <div
                className="h-full bg-[#00ff88] rounded-full transition-all"
                style={{ width: `${((currentStepIndex) / totalSteps) * 100}%` }}
              />
            </div>
          </div>

          {/* Steps preview */}
          <div className="space-y-0.5">
            {steps.map((step, i) => (
              <div
                key={i}
                className={cn(
                  'flex items-center gap-1.5 px-2 py-1 rounded text-[8px] font-mono',
                  i < currentStepIndex
                    ? 'text-[#444]'
                    : i === currentStepIndex
                      ? 'text-[#ccc] bg-[#111] border border-[#1a1a1a]'
                      : 'text-[#333]'
                )}
              >
                {i < currentStepIndex ? (
                  <CheckCircle2 className="w-2.5 h-2.5 text-[#00ff88] shrink-0" />
                ) : i === currentStepIndex ? (
                  <AlertCircle className="w-2.5 h-2.5 text-[#ff9f43] shrink-0" />
                ) : (
                  <Clock className="w-2.5 h-2.5 text-[#333] shrink-0" />
                )}
                <span className="truncate flex-1">
                  {step.delay_hours}h — {step.message_type === 'ai_personalized' ? 'AI' : step.message_type}
                </span>
              </div>
            ))}
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-1 pt-1">
            {activeJob.status === 'active' ? (
              <>
                <button
                  onClick={() => doAction('fire_now')}
                  disabled={acting}
                  className="flex items-center gap-1 px-2 py-1 rounded bg-[#00ff88]/10 text-[#00ff88] text-[8px] font-mono hover:bg-[#00ff88]/20 transition-colors"
                >
                  <Zap className="w-2.5 h-2.5" /> Fire Now
                </button>
                <button
                  onClick={() => doAction('pause')}
                  disabled={acting}
                  className="flex items-center gap-1 px-2 py-1 rounded bg-[#ff9f43]/10 text-[#ff9f43] text-[8px] font-mono hover:bg-[#ff9f43]/20 transition-colors"
                >
                  <Pause className="w-2.5 h-2.5" /> Pause
                </button>
              </>
            ) : (
              <button
                onClick={() => doAction('resume')}
                disabled={acting}
                className="flex items-center gap-1 px-2 py-1 rounded bg-[#00ff88]/10 text-[#00ff88] text-[8px] font-mono hover:bg-[#00ff88]/20 transition-colors"
              >
                <Play className="w-2.5 h-2.5" /> Resume
              </button>
            )}
            <button
              onClick={() => doAction('cancel')}
              disabled={acting}
              className="flex items-center gap-1 px-2 py-1 rounded bg-[#f05050]/10 text-[#f05050] text-[8px] font-mono hover:bg-[#f05050]/20 transition-colors"
            >
              <X className="w-2.5 h-2.5" /> Cancel
            </button>
            <button
              onClick={() => setShowPicker(!showPicker)}
              disabled={acting}
              className="flex items-center gap-1 px-2 py-1 rounded bg-[#111] text-[#555] text-[8px] font-mono hover:bg-[#1a1a1a] transition-colors ml-auto"
            >
              <RotateCcw className="w-2.5 h-2.5" /> Change
            </button>
          </div>

          {/* Change sequence picker (inline) */}
          {showPicker && (
            <div className="space-y-1 pt-1 border-t border-[#111]">
              <span className="text-[7px] font-mono text-[#444] uppercase">Switch to:</span>
              {sequences.filter((s) => s.id !== seq.id).map((s) => (
                <button
                  key={s.id}
                  onClick={() => enroll(s.id)}
                  disabled={acting}
                  className="w-full text-left px-2 py-1.5 rounded bg-[#111] hover:bg-[#1a1a1a] border border-[#1a1a1a] transition-colors flex items-center gap-2"
                >
                  <ChevronDown className="w-2.5 h-2.5 text-[#444] -rotate-90" />
                  <span className="text-[9px] font-mono text-[#ccc]">{s.name}</span>
                  <span className="text-[7px] font-mono text-[#444]">{s.steps.length} steps</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* No active job, no picker — collapsed state */}
      {!activeJob && !showPicker && (
        <div className="px-4 pb-2">
          <p className="text-[8px] font-mono text-[#333]">No active follow-up</p>
        </div>
      )}
    </div>
  )
}
