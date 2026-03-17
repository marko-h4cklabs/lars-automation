'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Clock, Play, Pause, X, ChevronDown, Zap, CheckCircle2,
  AlertCircle, RotateCcw, PenLine,
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
  const [showCustom, setShowCustom] = useState(false)
  const [countdown, setCountdown] = useState('')
  const [error, setError] = useState<string | null>(null)

  // Custom follow-up form state
  const [customDelay, setCustomDelay] = useState(24)
  const [customType, setCustomType] = useState<'text' | 'ai_personalized'>('text')
  const [customContent, setCustomContent] = useState('')

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
    setError(null)
    try {
      await fetch(`/api/conversations/${conversationId}/followup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sequenceId }),
      })
      await fetchStatus()
    } catch {
      setError('Failed to start')
    } finally {
      setActing(false)
      setShowPicker(false)
    }
  }

  const enrollCustom = async () => {
    if (!customContent.trim() && customType === 'text') return
    setActing(true)
    setError(null)
    try {
      await fetch(`/api/conversations/${conversationId}/followup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          custom: true,
          delay_hours: customDelay,
          message_type: customType,
          content: customContent,
        }),
      })
      await fetchStatus()
      setShowCustom(false)
      setShowPicker(false)
      setCustomContent('')
      setCustomDelay(24)
      setCustomType('text')
    } catch {
      setError('Failed to create custom follow-up')
    } finally {
      setActing(false)
    }
  }

  const doAction = async (action: string) => {
    setError(null)
    const prevJob = activeJob

    // Optimistic update — immediately reflect the change
    if (action === 'pause' && activeJob) {
      setActiveJob({ ...activeJob, status: 'paused' })
    } else if (action === 'resume' && activeJob) {
      setActiveJob({ ...activeJob, status: 'active' })
    } else if (action === 'cancel') {
      setActiveJob(null)
    }

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
      // Sync with server to get accurate data
      await fetchStatus()
    } catch {
      // Revert on error
      setActiveJob(prevJob)
      setError(`Failed to ${action}`)
    }
  }

  if (loading) {
    return (
      <div className="border-t border-[#1a1a1a] px-4 py-3">
        <div className="text-sm font-mono text-[#333] animate-pulse">Loading follow-ups...</div>
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
          <Clock className="w-3.5 h-3.5 text-[#ff9f43]" />
          <span className="text-sm font-mono text-[#555] uppercase tracking-wider">Follow-Up</span>
        </div>
        {!activeJob && (
          <button
            onClick={() => { setShowPicker(!showPicker); setShowCustom(false) }}
            className="text-sm font-mono text-[#00ff88] hover:text-[#00dd77] transition-colors"
            disabled={acting}
          >
            + Start
          </button>
        )}
      </div>

      {/* Error message */}
      {error && (
        <div className="px-4 pb-2">
          <p className="text-sm font-mono text-[#f05050]">{error}</p>
        </div>
      )}

      {/* Sequence Picker */}
      {showPicker && !activeJob && !showCustom && (
        <div className="px-4 pb-3 space-y-1">
          {sequences.length === 0 ? (
            <p className="text-sm font-mono text-[#444]">No active sequences configured</p>
          ) : (
            sequences.map((s) => (
              <button
                key={s.id}
                onClick={() => enroll(s.id)}
                disabled={acting}
                className="w-full text-left px-3 py-2 rounded bg-[#111] hover:bg-[#1a1a1a] border border-[#1a1a1a] transition-colors"
              >
                <span className="text-xs font-mono text-[#ccc]">{s.name}</span>
                <span className="text-[13px] font-mono text-[#444] ml-2">{s.steps.length} steps</span>
              </button>
            ))
          )}
          {/* Custom follow-up option */}
          <button
            onClick={() => setShowCustom(true)}
            disabled={acting}
            className="w-full text-left px-3 py-2 rounded bg-[#111] hover:bg-[#1a1a1a] border border-dashed border-[#333] transition-colors flex items-center gap-2"
          >
            <PenLine className="w-3.5 h-3.5 text-[#ff9f43]" />
            <span className="text-xs font-mono text-[#888]">Custom follow-up</span>
          </button>
        </div>
      )}

      {/* Custom follow-up form */}
      {showCustom && !activeJob && (
        <div className="px-4 pb-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[13px] font-mono text-[#ff9f43] uppercase">Custom Follow-Up</span>
            <button onClick={() => setShowCustom(false)} className="text-[#444] hover:text-[#888]">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Delay */}
          <div>
            <label className="text-[13px] font-mono text-[#555] block mb-1">Delay (hours)</label>
            <input
              type="number"
              min={1}
              max={168}
              value={customDelay}
              onChange={(e) => setCustomDelay(parseInt(e.target.value) || 1)}
              className="w-full bg-[#111] border border-[#222] rounded px-3 py-1.5 text-xs font-mono text-[#ccc] outline-none focus:border-[#00ff88]/40"
            />
          </div>

          {/* Type */}
          <div>
            <label className="text-[13px] font-mono text-[#555] block mb-1">Type</label>
            <div className="flex gap-1">
              {(['text', 'ai_personalized'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setCustomType(t)}
                  className={cn(
                    'px-3 py-1.5 rounded text-sm font-mono border transition-colors',
                    customType === t
                      ? 'bg-[#00ff88]/10 text-[#00ff88] border-[#00ff88]/30'
                      : 'text-[#555] border-[#222] hover:border-[#444]'
                  )}
                >
                  {t === 'text' ? 'Text' : 'AI'}
                </button>
              ))}
            </div>
          </div>

          {/* Content */}
          <div>
            <label className="text-[13px] font-mono text-[#555] block mb-1">
              {customType === 'text' ? 'Message' : 'AI instruction/context'}
            </label>
            <textarea
              value={customContent}
              onChange={(e) => setCustomContent(e.target.value)}
              rows={3}
              placeholder={customType === 'text' ? 'Hey {first_name}, just checking in...' : 'Follow up about their fitness goals, mention the transformation program'}
              className="w-full bg-[#111] border border-[#222] rounded px-3 py-2 text-xs font-mono text-[#ccc] placeholder:text-[#333] outline-none focus:border-[#00ff88]/40 resize-none"
            />
          </div>

          <button
            onClick={enrollCustom}
            disabled={acting || (!customContent.trim() && customType === 'text')}
            className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded bg-[#00ff88]/10 text-[#00ff88] text-sm font-mono hover:bg-[#00ff88]/20 transition-colors disabled:opacity-30"
          >
            <Zap className="w-3.5 h-3.5" /> Start Custom Follow-Up
          </button>
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
              <span className="text-xs font-mono text-[#ccc] truncate">{seq.name}</span>
            </div>
            <span className={cn(
              'text-[13px] font-mono uppercase px-1.5 py-0.5 rounded shrink-0',
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
              <span className="text-sm font-mono text-[#555]">
                Step {currentStepIndex + 1} of {totalSteps}
              </span>
              {countdown && activeJob.status === 'active' && (
                <span className="text-sm font-mono text-[#ff9f43]">
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
                  'flex items-center gap-1.5 px-3 py-1.5 rounded text-sm font-mono',
                  i < currentStepIndex
                    ? 'text-[#444]'
                    : i === currentStepIndex
                      ? 'text-[#ccc] bg-[#111] border border-[#1a1a1a]'
                      : 'text-[#333]'
                )}
              >
                {i < currentStepIndex ? (
                  <CheckCircle2 className="w-4 h-4 text-[#00ff88] shrink-0" />
                ) : i === currentStepIndex ? (
                  <AlertCircle className="w-4 h-4 text-[#ff9f43] shrink-0" />
                ) : (
                  <Clock className="w-4 h-4 text-[#333] shrink-0" />
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
                  className="flex items-center gap-1 px-3 py-1.5 rounded bg-[#00ff88]/10 text-[#00ff88] text-sm font-mono hover:bg-[#00ff88]/20 transition-colors"
                >
                  <Zap className="w-4 h-4" /> Fire Now
                </button>
                <button
                  onClick={() => doAction('pause')}
                  disabled={acting}
                  className="flex items-center gap-1 px-3 py-1.5 rounded bg-[#ff9f43]/10 text-[#ff9f43] text-sm font-mono hover:bg-[#ff9f43]/20 transition-colors"
                >
                  <Pause className="w-4 h-4" /> Pause
                </button>
              </>
            ) : (
              <button
                onClick={() => doAction('resume')}
                disabled={acting}
                className="flex items-center gap-1 px-3 py-1.5 rounded bg-[#00ff88]/10 text-[#00ff88] text-sm font-mono hover:bg-[#00ff88]/20 transition-colors"
              >
                <Play className="w-4 h-4" /> Resume
              </button>
            )}
            <button
              onClick={() => doAction('cancel')}
              disabled={acting}
              className="flex items-center gap-1 px-3 py-1.5 rounded bg-[#f05050]/10 text-[#f05050] text-sm font-mono hover:bg-[#f05050]/20 transition-colors"
            >
              <X className="w-4 h-4" /> Cancel
            </button>
            <button
              onClick={() => setShowPicker(!showPicker)}
              disabled={acting}
              className="flex items-center gap-1 px-3 py-1.5 rounded bg-[#111] text-[#555] text-sm font-mono hover:bg-[#1a1a1a] transition-colors ml-auto"
            >
              <RotateCcw className="w-4 h-4" /> Change
            </button>
          </div>

          {/* Change sequence picker (inline) */}
          {showPicker && (
            <div className="space-y-1 pt-1 border-t border-[#111]">
              <span className="text-[13px] font-mono text-[#444] uppercase">Switch to:</span>
              {sequences.filter((s) => s.id !== seq.id).map((s) => (
                <button
                  key={s.id}
                  onClick={() => enroll(s.id)}
                  disabled={acting}
                  className="w-full text-left px-3 py-2 rounded bg-[#111] hover:bg-[#1a1a1a] border border-[#1a1a1a] transition-colors flex items-center gap-2"
                >
                  <ChevronDown className="w-4 h-4 text-[#444] -rotate-90" />
                  <span className="text-xs font-mono text-[#ccc]">{s.name}</span>
                  <span className="text-[13px] font-mono text-[#444]">{s.steps.length} steps</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* No active job, no picker — collapsed state */}
      {!activeJob && !showPicker && !showCustom && (
        <div className="px-4 pb-2">
          <p className="text-sm font-mono text-[#333]">No active follow-up</p>
        </div>
      )}
    </div>
  )
}
