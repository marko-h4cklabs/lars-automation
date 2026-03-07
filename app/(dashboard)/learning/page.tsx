'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Brain, Upload, CheckCircle2, XCircle, AlertTriangle, Search,
  Sparkles, BookOpen, TrendingUp, TrendingDown,
  Minus, RefreshCw, Loader2, Trash2, ThumbsUp, ThumbsDown,
  Lightbulb, Target, FileText, Clock, Zap, ArrowRight,
  MessageSquare, BarChart3, Shield,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatDistanceToNow, format } from 'date-fns'
import { LoadingCard, LoadingConversationList } from '@/components/ui/loading-pulse'
import { ErrorState } from '@/components/ui/error-state'
import { EmptyState } from '@/components/ui/empty-state'

// ── Types ──

interface TrainingConversation {
  id: string
  title: string
  conversation_data: { messages?: { role: string; content: string }[] }
  outcome: 'success' | 'failure' | 'partial'
  feedback_notes: string | null
  approved: boolean
  approved_by: string | null
  created_at: string
}

interface Analysis {
  summary: string
  whatWorked: string[]
  whatFailed: string[]
  lessonsLearned: string[]
  promptImprovements: string[]
  kbSuggestions: { title: string; content: string; type: string }[]
  outcomeAssessment: string
  confidence: number
  patternsDetected: string[]
  recommendedStageHandling: Record<string, string>
}

interface FeedbackEntry {
  id: string
  actor: string
  action: string
  entity_type: string
  entity_id: string
  metadata: Record<string, unknown>
  created_at: string
}

interface Insight {
  summary: string
  topPatterns: string[]
  improvementAreas: string[]
  wins: string[]
  promptRecommendations: string[]
  kbGaps: string[]
  performanceTrend: 'improving' | 'stable' | 'declining'
  confidence: number
}

interface InsightMetrics {
  totalConversations: number
  totalLeads: number
  totalBookings: number
  bookingRate: number
  lostLeads: number
  suggestionsTotal: number
  suggestionsUsed: number
  acceptanceRate: number
  approvedTraining: number
}

// ── Outcome badge ──

const outcomeBadge = (outcome: string) => {
  switch (outcome) {
    case 'success':
      return (
        <span className="flex items-center gap-1 text-[8px] font-mono px-1.5 py-0.5 rounded bg-[#00ff88]/10 text-[#00ff88]">
          <CheckCircle2 className="w-2.5 h-2.5" /> Success
        </span>
      )
    case 'failure':
      return (
        <span className="flex items-center gap-1 text-[8px] font-mono px-1.5 py-0.5 rounded bg-[#f05050]/10 text-[#f05050]">
          <XCircle className="w-2.5 h-2.5" /> Failure
        </span>
      )
    default:
      return (
        <span className="flex items-center gap-1 text-[8px] font-mono px-1.5 py-0.5 rounded bg-[#ff9f43]/10 text-[#ff9f43]">
          <AlertTriangle className="w-2.5 h-2.5" /> Partial
        </span>
      )
  }
}

// ── Feedback action label ──

const feedbackLabel = (action: string) => {
  const map: Record<string, { label: string; color: string }> = {
    suggestion_used: { label: 'Suggestion Used', color: '#00ff88' },
    suggestion_rejected: { label: 'Suggestion Rejected', color: '#f05050' },
    suggestion_edited: { label: 'Suggestion Edited', color: '#ff9f43' },
    booking_confirmed: { label: 'Booking Confirmed', color: '#00ff88' },
    lead_lost: { label: 'Lead Lost', color: '#f05050' },
    lead_disqualified: { label: 'Lead Disqualified', color: '#666' },
    stage_override: { label: 'Stage Override', color: '#54a0ff' },
    message_sent: { label: 'Message Sent', color: '#5f27cd' },
    autopilot_override: { label: 'Autopilot Override', color: '#ff9f43' },
  }
  const entry = map[action] || { label: action, color: '#555' }
  return (
    <span className="text-[8px] font-mono px-1.5 py-0.5 rounded" style={{ color: entry.color, backgroundColor: `${entry.color}15` }}>
      {entry.label}
    </span>
  )
}

// ═══════════════════════════════════════
// MAIN PAGE COMPONENT
// ═══════════════════════════════════════

export default function LearningPage() {
  // ── Active section ──
  const [activeSection, setActiveSection] = useState<'training' | 'feedback' | 'patterns' | 'kb' | 'insights'>('training')

  // ── Training conversations state ──
  const [conversations, setConversations] = useState<TrainingConversation[]>([])
  const [convTotal, setConvTotal] = useState(0)
  const [convLoading, setConvLoading] = useState(true)
  const [convFilter, setConvFilter] = useState<'all' | 'success' | 'failure' | 'partial'>('all')
  const [convApproved, setConvApproved] = useState<'all' | 'true' | 'false'>('all')
  const [convPage, setConvPage] = useState(0)

  // Upload dialog
  const [showUpload, setShowUpload] = useState(false)
  const [uploadTitle, setUploadTitle] = useState('')
  const [uploadOutcome, setUploadOutcome] = useState<'success' | 'failure' | 'partial'>('partial')
  const [uploadMessages, setUploadMessages] = useState('')
  const [uploadNotes, setUploadNotes] = useState('')
  const [uploading, setUploading] = useState(false)

  // Analysis
  const [selectedConv, setSelectedConv] = useState<TrainingConversation | null>(null)
  const [analysis, setAnalysis] = useState<Analysis | null>(null)
  const [analyzing, setAnalyzing] = useState(false)

  // ── Feedback state ──
  const [feedbackEntries, setFeedbackEntries] = useState<FeedbackEntry[]>([])
  const [feedbackStats, setFeedbackStats] = useState<Record<string, number>>({})
  const [feedbackLoading, setFeedbackLoading] = useState(false)
  const [feedbackFilter, setFeedbackFilter] = useState('all')

  // ── Error states ──
  const [convError, setConvError] = useState(false)
  const [feedbackError, setFeedbackError] = useState(false)
  const [insightError, setInsightError] = useState(false)

  // ── Insights state ──
  const [insight, setInsight] = useState<Insight | null>(null)
  const [insightMetrics, setInsightMetrics] = useState<InsightMetrics | null>(null)
  const [insightLoading, setInsightLoading] = useState(false)
  const [insightPeriod, setInsightPeriod] = useState<'week' | 'month'>('week')
  const [insightCached, setInsightCached] = useState(false)
  const [insightGeneratedAt, setInsightGeneratedAt] = useState('')

  // ── Fetch training conversations ──
  const fetchConversations = useCallback(async () => {
    setConvLoading(true)
    setConvError(false)
    try {
      const params = new URLSearchParams({ page: String(convPage), limit: '20' })
      if (convFilter !== 'all') params.set('outcome', convFilter)
      if (convApproved !== 'all') params.set('approved', convApproved)
      const res = await fetch(`/api/learning?${params}`)
      if (!res.ok) throw new Error('Failed to fetch')
      const data = await res.json()
      setConversations(data.conversations)
      setConvTotal(data.total)
    } catch {
      setConvError(true)
    } finally {
      setConvLoading(false)
    }
  }, [convPage, convFilter, convApproved])

  useEffect(() => {
    if (activeSection === 'training') fetchConversations()
  }, [activeSection, fetchConversations])

  // ── Fetch feedback ──
  const fetchFeedback = useCallback(async () => {
    setFeedbackLoading(true)
    setFeedbackError(false)
    try {
      const params = new URLSearchParams({ type: feedbackFilter, limit: '50' })
      const res = await fetch(`/api/learning/feedback?${params}`)
      if (!res.ok) throw new Error('Failed to fetch')
      const data = await res.json()
      setFeedbackEntries(data.entries)
      setFeedbackStats(data.stats)
    } catch {
      setFeedbackError(true)
    } finally {
      setFeedbackLoading(false)
    }
  }, [feedbackFilter])

  useEffect(() => {
    if (activeSection === 'feedback') fetchFeedback()
  }, [activeSection, fetchFeedback])

  // ── Fetch insights ──
  const fetchInsights = useCallback(async (forceRefresh = false) => {
    setInsightLoading(true)
    setInsightError(false)
    try {
      const params = new URLSearchParams({ period: insightPeriod })
      if (forceRefresh) params.set('refresh', 'true')
      const res = await fetch(`/api/learning/insights?${params}`)
      if (!res.ok) throw new Error('Failed to fetch')
      const data = await res.json()
      setInsight(data.insight)
      setInsightMetrics(data.metrics)
      setInsightCached(data.cached)
      setInsightGeneratedAt(data.generatedAt)
    } catch {
      setInsightError(true)
    } finally {
      setInsightLoading(false)
    }
  }, [insightPeriod])

  useEffect(() => {
    if (activeSection === 'insights') fetchInsights()
  }, [activeSection, fetchInsights])

  // ── Upload training conversation ──
  const handleUpload = async () => {
    if (!uploadTitle || !uploadMessages.trim()) return
    setUploading(true)

    // Parse messages: expect format "role: content" per line
    const lines = uploadMessages.trim().split('\n').filter(Boolean)
    const messages = lines.map((line) => {
      const colonIdx = line.indexOf(':')
      if (colonIdx > 0) {
        return { role: line.slice(0, colonIdx).trim().toLowerCase(), content: line.slice(colonIdx + 1).trim() }
      }
      return { role: 'unknown', content: line.trim() }
    })

    try {
      const res = await fetch('/api/learning', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: uploadTitle,
          conversationData: { messages },
          outcome: uploadOutcome,
          feedbackNotes: uploadNotes || undefined,
        }),
      })
      if (res.ok) {
        setShowUpload(false)
        setUploadTitle('')
        setUploadMessages('')
        setUploadNotes('')
        setUploadOutcome('partial')
        fetchConversations()
      }
    } finally {
      setUploading(false)
    }
  }

  // ── Analyze conversation ──
  const handleAnalyze = async (conv: TrainingConversation) => {
    setSelectedConv(conv)
    setAnalysis(null)
    setAnalyzing(true)
    try {
      const res = await fetch('/api/learning/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversationId: conv.id }),
      })
      if (res.ok) {
        const data = await res.json()
        setAnalysis(data.analysis)
      }
    } finally {
      setAnalyzing(false)
    }
  }

  // ── Toggle approved ──
  const toggleApproved = async (conv: TrainingConversation) => {
    const res = await fetch('/api/learning', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: conv.id, approved: !conv.approved }),
    })
    if (res.ok) fetchConversations()
  }

  // ── Delete conversation ──
  const deleteConversation = async (id: string) => {
    const res = await fetch('/api/learning', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    if (res.ok) {
      if (selectedConv?.id === id) {
        setSelectedConv(null)
        setAnalysis(null)
      }
      fetchConversations()
    }
  }

  // ═══════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════

  const sections = [
    { key: 'training' as const, label: 'Training Data', icon: BookOpen },
    { key: 'feedback' as const, label: 'Feedback Loop', icon: MessageSquare },
    { key: 'patterns' as const, label: 'Pattern Analysis', icon: Brain },
    { key: 'kb' as const, label: 'KB Updates', icon: FileText },
    { key: 'insights' as const, label: 'Insights', icon: BarChart3 },
  ]

  return (
    <div className="flex-1 flex flex-col bg-[#080808] min-h-screen">
      {/* Header */}
      <div className="border-b border-[#1a1a1a] px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Brain className="w-5 h-5 text-[#00ff88]" />
            <div>
              <h1 className="text-sm font-mono font-bold text-white tracking-wide">LEARNING CENTER</h1>
              <p className="text-[9px] font-mono text-[#444] mt-0.5">Continuous AI improvement through feedback loops</p>
            </div>
          </div>
        </div>

        {/* Section tabs */}
        <div className="flex items-center gap-1 mt-4">
          {sections.map((s) => (
            <button
              key={s.key}
              onClick={() => setActiveSection(s.key)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded text-[9px] font-mono transition-colors',
                activeSection === s.key
                  ? 'bg-[#00ff88]/10 text-[#00ff88] border border-[#00ff88]/20'
                  : 'text-[#555] hover:text-[#888] hover:bg-[#111]'
              )}
            >
              <s.icon className="w-3 h-3" />
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {/* ═══════════════════════════════════════ */}
        {/* SECTION 1: TRAINING DATA               */}
        {/* ═══════════════════════════════════════ */}
        {activeSection === 'training' && (
          <div className="flex min-h-0 h-full">
            {/* Left: Conversation list */}
            <div className="w-[400px] border-r border-[#1a1a1a] flex flex-col shrink-0">
              {/* Filters + Upload */}
              <div className="px-4 py-3 border-b border-[#1a1a1a] space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[9px] font-mono text-[#555]">
                    {convTotal} conversation{convTotal !== 1 ? 's' : ''}
                  </span>
                  <button
                    onClick={() => setShowUpload(!showUpload)}
                    className="flex items-center gap-1 px-2 py-1 rounded bg-[#00ff88]/10 text-[#00ff88] text-[8px] font-mono hover:bg-[#00ff88]/20 transition-colors"
                  >
                    <Upload className="w-2.5 h-2.5" /> Upload
                  </button>
                </div>
                <div className="flex gap-1">
                  {(['all', 'success', 'failure', 'partial'] as const).map((f) => (
                    <button
                      key={f}
                      onClick={() => { setConvFilter(f); setConvPage(0) }}
                      className={cn(
                        'px-2 py-0.5 rounded text-[8px] font-mono transition-colors',
                        convFilter === f
                          ? 'bg-[#00ff88]/10 text-[#00ff88]'
                          : 'text-[#444] hover:text-[#666]'
                      )}
                    >
                      {f}
                    </button>
                  ))}
                  <div className="ml-auto flex gap-1">
                    {(['all', 'true', 'false'] as const).map((a) => (
                      <button
                        key={a}
                        onClick={() => { setConvApproved(a); setConvPage(0) }}
                        className={cn(
                          'px-2 py-0.5 rounded text-[8px] font-mono transition-colors',
                          convApproved === a
                            ? 'bg-[#54a0ff]/10 text-[#54a0ff]'
                            : 'text-[#444] hover:text-[#666]'
                        )}
                      >
                        {a === 'all' ? 'all' : a === 'true' ? 'approved' : 'pending'}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Upload dialog */}
              {showUpload && (
                <div className="px-4 py-3 border-b border-[#1a1a1a] bg-[#0a0a0a] space-y-2">
                  <input
                    type="text"
                    value={uploadTitle}
                    onChange={(e) => setUploadTitle(e.target.value)}
                    placeholder="Conversation title..."
                    className="w-full bg-[#111] border border-[#1a1a1a] rounded px-2 py-1.5 text-[10px] font-mono text-[#ccc] placeholder:text-[#333] outline-none focus:border-[#00ff88]/30"
                  />
                  <textarea
                    value={uploadMessages}
                    onChange={(e) => setUploadMessages(e.target.value)}
                    placeholder={'Paste conversation (one message per line):\nlead: hey I saw your post\nai: Thanks for reaching out! What caught your eye?\nlead: the transformation photos'}
                    rows={6}
                    className="w-full bg-[#111] border border-[#1a1a1a] rounded px-2 py-1.5 text-[10px] font-mono text-[#ccc] placeholder:text-[#333] outline-none resize-none focus:border-[#00ff88]/30"
                  />
                  <div className="flex items-center gap-2">
                    <select
                      value={uploadOutcome}
                      onChange={(e) => setUploadOutcome(e.target.value as 'success' | 'failure' | 'partial')}
                      className="bg-[#111] border border-[#1a1a1a] rounded px-2 py-1 text-[9px] font-mono text-[#ccc] outline-none"
                    >
                      <option value="partial">Partial</option>
                      <option value="success">Success</option>
                      <option value="failure">Failure</option>
                    </select>
                    <input
                      type="text"
                      value={uploadNotes}
                      onChange={(e) => setUploadNotes(e.target.value)}
                      placeholder="Notes (optional)"
                      className="flex-1 bg-[#111] border border-[#1a1a1a] rounded px-2 py-1 text-[9px] font-mono text-[#ccc] placeholder:text-[#333] outline-none focus:border-[#00ff88]/30"
                    />
                  </div>
                  <div className="flex justify-end gap-2">
                    <button onClick={() => setShowUpload(false)} className="px-3 py-1 rounded text-[8px] font-mono text-[#555] hover:text-[#888]">Cancel</button>
                    <button
                      onClick={handleUpload}
                      disabled={!uploadTitle || !uploadMessages.trim() || uploading}
                      className="flex items-center gap-1 px-3 py-1 rounded bg-[#00ff88] text-black text-[8px] font-mono font-bold hover:bg-[#00dd77] disabled:opacity-40 transition-colors"
                    >
                      {uploading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
                      Save
                    </button>
                  </div>
                </div>
              )}

              {/* Conversation list */}
              <div className="flex-1 overflow-y-auto">
                {convLoading ? (
                  <div className="px-4 py-4">
                    <LoadingConversationList count={5} />
                  </div>
                ) : convError ? (
                  <ErrorState message="Failed to load conversations" onRetry={fetchConversations} />
                ) : conversations.length === 0 ? (
                  <EmptyState
                    icon={<BookOpen className="w-10 h-10" />}
                    title="No training conversations"
                    description="Upload conversations to start training your AI"
                  />
                ) : (
                  conversations.map((conv) => (
                    <div
                      key={conv.id}
                      className={cn(
                        'px-4 py-3 border-b border-[#111] cursor-pointer transition-colors',
                        selectedConv?.id === conv.id ? 'bg-[#0f0f0f] border-l-2 border-l-[#00ff88]' : 'hover:bg-[#0a0a0a]'
                      )}
                      onClick={() => { setSelectedConv(conv); setAnalysis(null) }}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-mono text-[#ccc] truncate">{conv.title}</span>
                            {conv.approved && <Shield className="w-2.5 h-2.5 text-[#00ff88] shrink-0" />}
                          </div>
                          <div className="flex items-center gap-2 mt-1">
                            {outcomeBadge(conv.outcome)}
                            <span className="text-[7px] font-mono text-[#333]">
                              {conv.conversation_data?.messages?.length || 0} msgs
                            </span>
                            <span className="text-[7px] font-mono text-[#333]">
                              {formatDistanceToNow(new Date(conv.created_at), { addSuffix: true })}
                            </span>
                          </div>
                          {conv.feedback_notes && (
                            <p className="text-[8px] font-mono text-[#444] mt-1 truncate">{conv.feedback_notes}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            onClick={(e) => { e.stopPropagation(); toggleApproved(conv) }}
                            className={cn(
                              'w-6 h-6 flex items-center justify-center rounded transition-colors',
                              conv.approved ? 'text-[#00ff88] hover:bg-[#00ff88]/10' : 'text-[#333] hover:text-[#555] hover:bg-[#111]'
                            )}
                            title={conv.approved ? 'Unapprove' : 'Approve'}
                          >
                            <CheckCircle2 className="w-3 h-3" />
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); deleteConversation(conv.id) }}
                            className="w-6 h-6 flex items-center justify-center rounded text-[#333] hover:text-[#f05050] hover:bg-[#f05050]/10 transition-colors"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                )}

                {/* Pagination */}
                {convTotal > 20 && (
                  <div className="px-4 py-2 flex justify-center gap-2">
                    <button
                      onClick={() => setConvPage(Math.max(0, convPage - 1))}
                      disabled={convPage === 0}
                      className="text-[8px] font-mono text-[#444] hover:text-[#888] disabled:opacity-30"
                    >
                      ← Prev
                    </button>
                    <span className="text-[8px] font-mono text-[#333]">Page {convPage + 1}</span>
                    <button
                      onClick={() => setConvPage(convPage + 1)}
                      disabled={(convPage + 1) * 20 >= convTotal}
                      className="text-[8px] font-mono text-[#444] hover:text-[#888] disabled:opacity-30"
                    >
                      Next →
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Right: Detail / Analysis */}
            <div className="flex-1 overflow-y-auto">
              {!selectedConv ? (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center">
                    <Brain className="w-8 h-8 text-[#1a1a1a] mx-auto mb-2" />
                    <p className="text-[10px] font-mono text-[#333]">Select a conversation to view or analyze</p>
                  </div>
                </div>
              ) : (
                <div className="p-6 space-y-6">
                  {/* Conversation header */}
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-sm font-mono font-bold text-white">{selectedConv.title}</h2>
                      <div className="flex items-center gap-3 mt-1">
                        {outcomeBadge(selectedConv.outcome)}
                        <span className="text-[8px] font-mono text-[#333]">
                          {format(new Date(selectedConv.created_at), 'MMM d, yyyy HH:mm')}
                        </span>
                        {selectedConv.approved && (
                          <span className="text-[8px] font-mono text-[#00ff88]">✓ Approved</span>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => handleAnalyze(selectedConv)}
                      disabled={analyzing}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-[#00ff88] text-black text-[9px] font-mono font-bold hover:bg-[#00dd77] disabled:opacity-50 transition-colors"
                    >
                      {analyzing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                      Analyze with AI
                    </button>
                  </div>

                  {/* Messages preview */}
                  <div className="space-y-1.5">
                    <span className="text-[8px] font-mono text-[#555] uppercase tracking-wider">Conversation</span>
                    <div className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-lg p-4 max-h-[300px] overflow-y-auto space-y-2">
                      {(selectedConv.conversation_data?.messages || []).map((msg, i) => (
                        <div key={i} className={cn(
                          'flex gap-2',
                          msg.role === 'lead' ? '' : 'justify-end'
                        )}>
                          <div className={cn(
                            'max-w-[80%] px-3 py-1.5 rounded-lg text-[10px] font-mono',
                            msg.role === 'lead'
                              ? 'bg-[#1a1a1a] text-[#ccc]'
                              : msg.role === 'ai'
                                ? 'bg-[#00ff88]/10 text-[#00ff88] border border-[#00ff88]/20'
                                : 'bg-[#54a0ff]/10 text-[#54a0ff] border border-[#54a0ff]/20'
                          )}>
                            <span className="text-[7px] text-[#555] block mb-0.5">{msg.role}</span>
                            {msg.content}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Feedback notes */}
                  {selectedConv.feedback_notes && (
                    <div className="space-y-1">
                      <span className="text-[8px] font-mono text-[#555] uppercase tracking-wider">Notes</span>
                      <p className="text-[10px] font-mono text-[#888] bg-[#0a0a0a] border border-[#1a1a1a] rounded px-3 py-2">{selectedConv.feedback_notes}</p>
                    </div>
                  )}

                  {/* Analysis results */}
                  {analyzing && (
                    <div className="space-y-3">
                      <LoadingCard />
                      <LoadingCard />
                    </div>
                  )}

                  {analysis && (
                    <div className="space-y-4">
                      <div className="h-px bg-[#1a1a1a]" />

                      {/* Summary */}
                      <div className="space-y-1">
                        <span className="text-[8px] font-mono text-[#555] uppercase tracking-wider">AI Analysis</span>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-[8px] font-mono text-[#333]">Confidence: {analysis.confidence}%</span>
                          <span className="text-[8px] font-mono text-[#333]">Assessment: {analysis.outcomeAssessment}</span>
                        </div>
                        <p className="text-[10px] font-mono text-[#ccc] bg-[#0a0a0a] border border-[#1a1a1a] rounded px-3 py-2">
                          {analysis.summary}
                        </p>
                      </div>

                      {/* What worked / failed */}
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <span className="flex items-center gap-1 text-[8px] font-mono text-[#00ff88]">
                            <ThumbsUp className="w-2.5 h-2.5" /> What Worked
                          </span>
                          <div className="space-y-1">
                            {analysis.whatWorked.map((item, i) => (
                              <div key={i} className="text-[9px] font-mono text-[#888] bg-[#00ff88]/5 border border-[#00ff88]/10 rounded px-2 py-1">
                                {item}
                              </div>
                            ))}
                          </div>
                        </div>
                        <div className="space-y-1.5">
                          <span className="flex items-center gap-1 text-[8px] font-mono text-[#f05050]">
                            <ThumbsDown className="w-2.5 h-2.5" /> What Failed
                          </span>
                          <div className="space-y-1">
                            {analysis.whatFailed.map((item, i) => (
                              <div key={i} className="text-[9px] font-mono text-[#888] bg-[#f05050]/5 border border-[#f05050]/10 rounded px-2 py-1">
                                {item}
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* Lessons learned */}
                      <div className="space-y-1.5">
                        <span className="flex items-center gap-1 text-[8px] font-mono text-[#ff9f43]">
                          <Lightbulb className="w-2.5 h-2.5" /> Lessons Learned
                        </span>
                        <div className="space-y-1">
                          {analysis.lessonsLearned.map((item, i) => (
                            <div key={i} className="text-[9px] font-mono text-[#888] bg-[#ff9f43]/5 border border-[#ff9f43]/10 rounded px-2 py-1 flex items-start gap-2">
                              <span className="text-[#ff9f43] shrink-0">{i + 1}.</span>
                              {item}
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Prompt improvements */}
                      {analysis.promptImprovements.length > 0 && (
                        <div className="space-y-1.5">
                          <span className="flex items-center gap-1 text-[8px] font-mono text-[#54a0ff]">
                            <Target className="w-2.5 h-2.5" /> Prompt Improvements
                          </span>
                          <div className="space-y-1">
                            {analysis.promptImprovements.map((item, i) => (
                              <div key={i} className="text-[9px] font-mono text-[#888] bg-[#54a0ff]/5 border border-[#54a0ff]/10 rounded px-2 py-1">
                                {item}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* KB suggestions */}
                      {analysis.kbSuggestions.length > 0 && (
                        <div className="space-y-1.5">
                          <span className="flex items-center gap-1 text-[8px] font-mono text-[#5f27cd]">
                            <FileText className="w-2.5 h-2.5" /> Knowledge Base Suggestions
                          </span>
                          <div className="space-y-2">
                            {analysis.kbSuggestions.map((kb, i) => (
                              <div key={i} className="bg-[#5f27cd]/5 border border-[#5f27cd]/10 rounded px-3 py-2">
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="text-[9px] font-mono text-[#ccc] font-bold">{kb.title}</span>
                                  <span className="text-[7px] font-mono text-[#5f27cd] px-1 py-0.5 rounded bg-[#5f27cd]/10">{kb.type}</span>
                                </div>
                                <p className="text-[9px] font-mono text-[#888]">{kb.content}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Patterns */}
                      {analysis.patternsDetected.length > 0 && (
                        <div className="space-y-1.5">
                          <span className="flex items-center gap-1 text-[8px] font-mono text-[#10ac84]">
                            <Brain className="w-2.5 h-2.5" /> Patterns Detected
                          </span>
                          <div className="flex flex-wrap gap-1">
                            {analysis.patternsDetected.map((p, i) => (
                              <span key={i} className="text-[8px] font-mono text-[#10ac84] bg-[#10ac84]/10 px-2 py-0.5 rounded">
                                {p}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Stage handling */}
                      {Object.keys(analysis.recommendedStageHandling).length > 0 && (
                        <div className="space-y-1.5">
                          <span className="text-[8px] font-mono text-[#555] uppercase tracking-wider">Stage Handling Recommendations</span>
                          <div className="space-y-1">
                            {Object.entries(analysis.recommendedStageHandling).map(([stage, rec]) => (
                              <div key={stage} className="flex items-start gap-2 text-[9px] font-mono bg-[#0a0a0a] border border-[#1a1a1a] rounded px-2 py-1.5">
                                <span className="text-[#ff9f43] font-bold shrink-0">{stage}:</span>
                                <span className="text-[#888]">{rec}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════ */}
        {/* SECTION 2: FEEDBACK LOOP                */}
        {/* ═══════════════════════════════════════ */}
        {activeSection === 'feedback' && (
          <div className="p-6 space-y-4">
            {/* Stats row */}
            <div className="grid grid-cols-5 gap-3">
              {[
                { label: 'Suggestions Used', key: 'suggestion_used', color: '#00ff88', icon: ThumbsUp },
                { label: 'Suggestions Rejected', key: 'suggestion_rejected', color: '#f05050', icon: ThumbsDown },
                { label: 'Bookings Confirmed', key: 'booking_confirmed', color: '#00ff88', icon: CheckCircle2 },
                { label: 'Leads Lost', key: 'lead_lost', color: '#f05050', icon: XCircle },
                { label: 'Stage Overrides', key: 'stage_override', color: '#54a0ff', icon: RefreshCw },
              ].map((s) => (
                <div key={s.key} className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-lg px-4 py-3">
                  <div className="flex items-center gap-1.5 mb-1">
                    <s.icon className="w-3 h-3" style={{ color: s.color }} />
                    <span className="text-[8px] font-mono text-[#555] uppercase">{s.label}</span>
                  </div>
                  <span className="text-lg font-mono font-bold" style={{ color: s.color }}>
                    {feedbackStats[s.key] || 0}
                  </span>
                </div>
              ))}
            </div>

            {/* Filter */}
            <div className="flex items-center gap-1">
              <span className="text-[8px] font-mono text-[#444] mr-2">Filter:</span>
              {['all', 'suggestion_used', 'suggestion_rejected', 'booking_confirmed', 'lead_lost', 'stage_override'].map((f) => (
                <button
                  key={f}
                  onClick={() => setFeedbackFilter(f)}
                  className={cn(
                    'px-2 py-0.5 rounded text-[8px] font-mono transition-colors',
                    feedbackFilter === f
                      ? 'bg-[#00ff88]/10 text-[#00ff88]'
                      : 'text-[#444] hover:text-[#666]'
                  )}
                >
                  {f === 'all' ? 'All' : f.replace(/_/g, ' ')}
                </button>
              ))}
            </div>

            {/* Entries */}
            {feedbackLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <LoadingCard key={i} />
                ))}
              </div>
            ) : feedbackError ? (
              <ErrorState message="Failed to load feedback" onRetry={fetchFeedback} />
            ) : feedbackEntries.length === 0 ? (
              <EmptyState
                icon={<MessageSquare className="w-10 h-10" />}
                title="No feedback entries"
                description="Feedback is recorded automatically as you use the system"
              />
            ) : (
              <div className="space-y-1">
                {feedbackEntries.map((entry) => (
                  <div key={entry.id} className="flex items-center gap-3 bg-[#0a0a0a] border border-[#1a1a1a] rounded px-4 py-2.5">
                    <Clock className="w-3 h-3 text-[#333] shrink-0" />
                    <span className="text-[8px] font-mono text-[#444] w-24 shrink-0">
                      {formatDistanceToNow(new Date(entry.created_at), { addSuffix: true })}
                    </span>
                    {feedbackLabel(entry.action)}
                    <span className="text-[8px] font-mono text-[#555] truncate flex-1">
                      {entry.entity_type}{entry.entity_id ? ` → ${entry.entity_id.slice(0, 8)}` : ''}
                    </span>
                    {entry.metadata && Object.keys(entry.metadata).length > 0 && (
                      <span className="text-[7px] font-mono text-[#333] max-w-[200px] truncate">
                        {JSON.stringify(entry.metadata).slice(0, 60)}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ═══════════════════════════════════════ */}
        {/* SECTION 3: PATTERN ANALYSIS             */}
        {/* ═══════════════════════════════════════ */}
        {activeSection === 'patterns' && (
          <PatternAnalysisSection />
        )}

        {/* ═══════════════════════════════════════ */}
        {/* SECTION 4: KB UPDATES                   */}
        {/* ═══════════════════════════════════════ */}
        {activeSection === 'kb' && (
          <KBUpdatesSection />
        )}

        {/* ═══════════════════════════════════════ */}
        {/* SECTION 5: PERFORMANCE INSIGHTS         */}
        {/* ═══════════════════════════════════════ */}
        {activeSection === 'insights' && (
          <div className="p-6 space-y-6">
            {/* Controls */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {(['week', 'month'] as const).map((p) => (
                  <button
                    key={p}
                    onClick={() => setInsightPeriod(p)}
                    className={cn(
                      'px-3 py-1 rounded text-[9px] font-mono transition-colors',
                      insightPeriod === p
                        ? 'bg-[#00ff88]/10 text-[#00ff88] border border-[#00ff88]/20'
                        : 'text-[#444] hover:text-[#666] border border-[#1a1a1a]'
                    )}
                  >
                    {p === 'week' ? 'This Week' : 'This Month'}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-3">
                {insightCached && (
                  <span className="text-[7px] font-mono text-[#333]">
                    Cached • {insightGeneratedAt && formatDistanceToNow(new Date(insightGeneratedAt), { addSuffix: true })}
                  </span>
                )}
                <button
                  onClick={() => fetchInsights(true)}
                  disabled={insightLoading}
                  className="flex items-center gap-1 px-3 py-1 rounded bg-[#00ff88]/10 text-[#00ff88] text-[8px] font-mono hover:bg-[#00ff88]/20 disabled:opacity-50 transition-colors"
                >
                  {insightLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                  {insightLoading ? 'Generating...' : 'Refresh'}
                </button>
              </div>
            </div>

            {insightError ? (
              <ErrorState message="Failed to load insights" onRetry={() => fetchInsights(true)} />
            ) : insightLoading && !insight ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <LoadingCard key={i} />
                ))}
              </div>
            ) : !insight ? (
              <EmptyState
                icon={<BarChart3 className="w-10 h-10" />}
                title="No insights yet"
                description="Click Refresh to generate AI-powered insights"
              />
            ) : (
              <>
                {/* Metrics cards */}
                {insightMetrics && (
                  <div className="grid grid-cols-5 gap-3">
                    {[
                      { label: 'Conversations', value: insightMetrics.totalConversations, color: '#ccc' },
                      { label: 'New Leads', value: insightMetrics.totalLeads, color: '#54a0ff' },
                      { label: 'Bookings', value: insightMetrics.totalBookings, color: '#00ff88' },
                      { label: 'Booking Rate', value: `${insightMetrics.bookingRate}%`, color: '#ff9f43' },
                      { label: 'AI Acceptance', value: `${insightMetrics.acceptanceRate}%`, color: '#5f27cd' },
                    ].map((m) => (
                      <div key={m.label} className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-lg px-4 py-3">
                        <span className="text-[8px] font-mono text-[#555] uppercase block mb-1">{m.label}</span>
                        <span className="text-lg font-mono font-bold" style={{ color: m.color }}>{m.value}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Trend + Summary */}
                <div className="flex items-start gap-4">
                  <div className={cn(
                    'flex items-center gap-2 px-4 py-3 rounded-lg border shrink-0',
                    insight.performanceTrend === 'improving'
                      ? 'bg-[#00ff88]/5 border-[#00ff88]/20 text-[#00ff88]'
                      : insight.performanceTrend === 'declining'
                        ? 'bg-[#f05050]/5 border-[#f05050]/20 text-[#f05050]'
                        : 'bg-[#ff9f43]/5 border-[#ff9f43]/20 text-[#ff9f43]'
                  )}>
                    {insight.performanceTrend === 'improving'
                      ? <TrendingUp className="w-5 h-5" />
                      : insight.performanceTrend === 'declining'
                        ? <TrendingDown className="w-5 h-5" />
                        : <Minus className="w-5 h-5" />
                    }
                    <div>
                      <span className="text-[10px] font-mono font-bold uppercase block">{insight.performanceTrend}</span>
                      <span className="text-[7px] font-mono opacity-70">Confidence: {insight.confidence}%</span>
                    </div>
                  </div>
                  <div className="flex-1 bg-[#0a0a0a] border border-[#1a1a1a] rounded-lg px-4 py-3">
                    <span className="text-[8px] font-mono text-[#555] uppercase block mb-1">Summary</span>
                    <p className="text-[10px] font-mono text-[#ccc] leading-relaxed">{insight.summary}</p>
                  </div>
                </div>

                {/* Wins + Areas */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <span className="flex items-center gap-1 text-[9px] font-mono text-[#00ff88]">
                      <Zap className="w-3 h-3" /> Wins
                    </span>
                    {insight.wins.map((w, i) => (
                      <div key={i} className="text-[9px] font-mono text-[#888] bg-[#00ff88]/5 border border-[#00ff88]/10 rounded px-3 py-2">
                        {w}
                      </div>
                    ))}
                  </div>
                  <div className="space-y-2">
                    <span className="flex items-center gap-1 text-[9px] font-mono text-[#f05050]">
                      <AlertTriangle className="w-3 h-3" /> Improvement Areas
                    </span>
                    {insight.improvementAreas.map((a, i) => (
                      <div key={i} className="text-[9px] font-mono text-[#888] bg-[#f05050]/5 border border-[#f05050]/10 rounded px-3 py-2">
                        {a}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Top patterns */}
                <div className="space-y-2">
                  <span className="flex items-center gap-1 text-[9px] font-mono text-[#ff9f43]">
                    <Brain className="w-3 h-3" /> Top Patterns
                  </span>
                  <div className="space-y-1">
                    {insight.topPatterns.map((p, i) => (
                      <div key={i} className="flex items-start gap-2 text-[9px] font-mono text-[#888] bg-[#ff9f43]/5 border border-[#ff9f43]/10 rounded px-3 py-2">
                        <span className="text-[#ff9f43] font-bold shrink-0">{i + 1}.</span>
                        {p}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Prompt recommendations */}
                <div className="space-y-2">
                  <span className="flex items-center gap-1 text-[9px] font-mono text-[#54a0ff]">
                    <Target className="w-3 h-3" /> Prompt Recommendations
                  </span>
                  <div className="space-y-1">
                    {insight.promptRecommendations.map((r, i) => (
                      <div key={i} className="text-[9px] font-mono text-[#888] bg-[#54a0ff]/5 border border-[#54a0ff]/10 rounded px-3 py-2 flex items-start gap-2">
                        <ArrowRight className="w-3 h-3 text-[#54a0ff] shrink-0 mt-0.5" />
                        {r}
                      </div>
                    ))}
                  </div>
                </div>

                {/* KB gaps */}
                {insight.kbGaps.length > 0 && (
                  <div className="space-y-2">
                    <span className="flex items-center gap-1 text-[9px] font-mono text-[#5f27cd]">
                      <FileText className="w-3 h-3" /> Knowledge Base Gaps
                    </span>
                    <div className="flex flex-wrap gap-2">
                      {insight.kbGaps.map((g, i) => (
                        <span key={i} className="text-[8px] font-mono text-[#5f27cd] bg-[#5f27cd]/10 border border-[#5f27cd]/20 px-2.5 py-1 rounded">
                          {g}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ═══════════════════════════════════════
// PATTERN ANALYSIS SUB-COMPONENT
// ═══════════════════════════════════════

function PatternAnalysisSection() {
  const [loading, setLoading] = useState(false)
  const [patterns, setPatterns] = useState<Analysis | null>(null)

  const runAnalysis = async () => {
    setLoading(true)
    try {
      // Fetch approved training conversations
      const convRes = await fetch('/api/learning?approved=true&limit=10')
      if (!convRes.ok) return
      const convData = await convRes.json()
      const conversations = convData.conversations as TrainingConversation[]

      if (conversations.length === 0) {
        setPatterns(null)
        return
      }

      // Combine all messages for bulk analysis
      const allMessages = conversations.flatMap((c) => {
        const msgs = c.conversation_data?.messages || []
        return msgs.map((m) => ({ ...m, conversationTitle: c.title, outcome: c.outcome }))
      })

      // Use analyze endpoint with combined data
      const res = await fetch('/api/learning/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: `Bulk analysis of ${conversations.length} approved conversations`,
          conversationData: { messages: allMessages },
        }),
      })
      if (res.ok) {
        const data = await res.json()
        setPatterns(data.analysis)
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xs font-mono font-bold text-white">Pattern Analysis</h3>
          <p className="text-[8px] font-mono text-[#444] mt-0.5">AI analyzes approved training data to extract patterns and suggest improvements</p>
        </div>
        <button
          onClick={runAnalysis}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-[#00ff88] text-black text-[9px] font-mono font-bold hover:bg-[#00dd77] disabled:opacity-50 transition-colors"
        >
          {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Brain className="w-3 h-3" />}
          {loading ? 'Analyzing...' : 'Run Pattern Analysis'}
        </button>
      </div>

      {loading && (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <LoadingCard key={i} />
          ))}
        </div>
      )}

      {!loading && !patterns && (
        <EmptyState
          icon={<Brain className="w-10 h-10" />}
          title="No pattern analysis"
          description="Click &quot;Run Pattern Analysis&quot; to analyze approved conversations. Requires at least 1 approved training conversation."
        />
      )}

      {patterns && (
        <div className="space-y-4">
          {/* Summary */}
          <div className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-lg px-4 py-3">
            <span className="text-[8px] font-mono text-[#555] uppercase block mb-1">Analysis Summary</span>
            <p className="text-[10px] font-mono text-[#ccc]">{patterns.summary}</p>
          </div>

          {/* Lessons + Prompt */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <span className="flex items-center gap-1 text-[9px] font-mono text-[#ff9f43]">
                <Lightbulb className="w-3 h-3" /> Lessons Learned
              </span>
              {patterns.lessonsLearned.map((l, i) => (
                <div key={i} className="text-[9px] font-mono text-[#888] bg-[#ff9f43]/5 border border-[#ff9f43]/10 rounded px-3 py-2">
                  {l}
                </div>
              ))}
            </div>
            <div className="space-y-2">
              <span className="flex items-center gap-1 text-[9px] font-mono text-[#54a0ff]">
                <Target className="w-3 h-3" /> Prompt Improvements
              </span>
              {patterns.promptImprovements.map((p, i) => (
                <div key={i} className="text-[9px] font-mono text-[#888] bg-[#54a0ff]/5 border border-[#54a0ff]/10 rounded px-3 py-2">
                  {p}
                </div>
              ))}
            </div>
          </div>

          {/* Patterns */}
          {patterns.patternsDetected.length > 0 && (
            <div className="space-y-2">
              <span className="flex items-center gap-1 text-[9px] font-mono text-[#10ac84]">
                <Search className="w-3 h-3" /> Detected Patterns
              </span>
              <div className="flex flex-wrap gap-2">
                {patterns.patternsDetected.map((p, i) => (
                  <span key={i} className="text-[8px] font-mono text-[#10ac84] bg-[#10ac84]/10 border border-[#10ac84]/20 px-2.5 py-1 rounded">
                    {p}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* KB suggestions */}
          {patterns.kbSuggestions.length > 0 && (
            <div className="space-y-2">
              <span className="flex items-center gap-1 text-[9px] font-mono text-[#5f27cd]">
                <FileText className="w-3 h-3" /> Suggested KB Content
              </span>
              {patterns.kbSuggestions.map((kb, i) => (
                <div key={i} className="bg-[#5f27cd]/5 border border-[#5f27cd]/10 rounded px-3 py-2">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[9px] font-mono text-[#ccc] font-bold">{kb.title}</span>
                    <span className="text-[7px] font-mono text-[#5f27cd] px-1 py-0.5 rounded bg-[#5f27cd]/10">{kb.type}</span>
                  </div>
                  <p className="text-[9px] font-mono text-[#888]">{kb.content}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════
// KB UPDATES SUB-COMPONENT
// ═══════════════════════════════════════

function KBUpdatesSection() {
  const [loading, setLoading] = useState(false)
  const [suggestions, setSuggestions] = useState<{ title: string; content: string; type: string }[]>([])

  const generateSuggestions = async () => {
    setLoading(true)
    try {
      // Fetch recent approved conversations
      const convRes = await fetch('/api/learning?approved=true&limit=5')
      if (!convRes.ok) return
      const convData = await convRes.json()
      const conversations = convData.conversations as TrainingConversation[]

      if (conversations.length === 0) return

      // Analyze to get KB suggestions
      const allMessages = conversations.flatMap((c) => c.conversation_data?.messages || [])
      const res = await fetch('/api/learning/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: 'KB gap analysis',
          conversationData: { messages: allMessages },
        }),
      })
      if (res.ok) {
        const data = await res.json()
        setSuggestions(data.analysis?.kbSuggestions || [])
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xs font-mono font-bold text-white">Knowledge Base Updates</h3>
          <p className="text-[8px] font-mono text-[#444] mt-0.5">AI suggests content to add to the KB based on training conversation analysis</p>
        </div>
        <button
          onClick={generateSuggestions}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-[#00ff88] text-black text-[9px] font-mono font-bold hover:bg-[#00dd77] disabled:opacity-50 transition-colors"
        >
          {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
          {loading ? 'Generating...' : 'Suggest KB Updates'}
        </button>
      </div>

      {loading && (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <LoadingCard key={i} />
          ))}
        </div>
      )}

      {!loading && suggestions.length === 0 && (
        <EmptyState
          icon={<FileText className="w-10 h-10" />}
          title="No KB suggestions"
          description="Click &quot;Suggest KB Updates&quot; to generate content suggestions based on approved training data."
        />
      )}

      {suggestions.length > 0 && (
        <div className="space-y-3">
          {suggestions.map((s, i) => (
            <div key={i} className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono text-[#ccc] font-bold">{s.title}</span>
                  <span className={cn(
                    'text-[7px] font-mono px-1.5 py-0.5 rounded',
                    s.type === 'objection_handling' ? 'text-[#f05050] bg-[#f05050]/10'
                      : s.type === 'faq' ? 'text-[#54a0ff] bg-[#54a0ff]/10'
                        : 'text-[#ff9f43] bg-[#ff9f43]/10'
                  )}>
                    {s.type}
                  </span>
                </div>
              </div>
              <p className="text-[9px] font-mono text-[#888] leading-relaxed whitespace-pre-wrap">{s.content}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
