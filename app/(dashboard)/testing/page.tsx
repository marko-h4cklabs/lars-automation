'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import {
  FlaskConical, Play, User, Zap, Brain, Flame, Target,
  FileText, AlertTriangle, Sparkles, RotateCcw, Save, Copy,
  ChevronRight,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { showToast } from '@/components/ui/toast-notification'

// ═══════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════

interface SimMessage {
  id: string
  role: 'lead' | 'setter' | 'ai'
  content: string
  timestamp: string
  reasoning?: string
}

interface Analysis {
  heatScore: number
  detectedStage: string
  qualificationUpdates: Record<string, unknown>
  confidence: number
  redFlags: string[]
  summary?: string
  nextBestAction?: string
}

interface KBChunk {
  title: string
  type: string
  similarity: number
}

interface SimConfig {
  mode: 'copilot'
  personaId: string
  useKB: boolean
  responseStyle: string
  customPrompt: string
}

interface LeadProfile {
  username: string
  bio: string
  source: string
  writingStyle: string
  ageHint: string
  firstMessage: string
}

interface Suggestion {
  messages: string[]
  reasoning: string
  confidence: number
}

// ═══════════════════════════════════════════════════════════════
// Constants
// ═══════════════════════════════════════════════════════════════

const STAGE_COLORS: Record<string, string> = {
  new: '#00ff88', contacted: '#54a0ff', qualifying: '#ff9f43',
  call_offered: '#f05050', call_booked: '#5f27cd', showed: '#10ac84',
}

const STAGE_LABELS: Record<string, string> = {
  new: 'New', contacted: 'Contacted', qualifying: 'Qualifying',
  call_offered: 'Call Offered', call_booked: 'Call Booked', showed: 'Showed',
}

const RULE_LABELS: Record<string, string> = {
  never_use_em_dash: 'No em dashes',
  vary_capitalization: 'Vary caps',
  use_contractions: 'Contractions',
  use_casual_shortcuts: 'Casual shortcuts',
  match_lead_vibe: 'Vibe matching',
  max_sentences_per_bubble: 'Sentence limit',
  max_messages_per_burst: 'Burst limit',
  max_emojis_per_burst: 'Emoji limit',
}

// ═══════════════════════════════════════════════════════════════
// Main Component
// ═══════════════════════════════════════════════════════════════

export default function TestingPage() {
  // ── State ──
  const [config, setConfig] = useState<SimConfig>({
    mode: 'copilot',
    personaId: '',
    useKB: true,
    responseStyle: 'balanced',
    customPrompt: '',
  })

  const [lead, setLead] = useState<LeadProfile>({
    username: 'test_lead',
    bio: 'CEO | Fitness enthusiast | 42yo | Busy schedule',
    source: 'dm',
    writingStyle: 'casual',
    ageHint: '42',
    firstMessage: 'hey saw your transformation posts, pretty impressive. been wanting to get in shape but always too busy with work',
  })

  const [messages, setMessages] = useState<SimMessage[]>([])
  const [analysis, setAnalysis] = useState<Analysis | null>(null)
  const [kbChunks, setKbChunks] = useState<KBChunk[]>([])
  const [appliedRules, setAppliedRules] = useState<string[]>([])
  const [metrics, setMetrics] = useState<{ tokenEstimate: number; model: string; kbChunksUsed: number } | null>(null)
  const [suggestions, setSuggestions] = useState<{ optionA: Suggestion; optionB: Suggestion; recommended: string } | null>(null)
  const [personas, setPersonas] = useState<{ id: string; name: string }[]>([])

  const [loading, setLoading] = useState(false)
  const [leadInput, setLeadInput] = useState('')
  const chatEndRef = useRef<HTMLDivElement>(null)
  const initialized = useRef(false)

  // ── Restore session from sessionStorage on mount ──
  useEffect(() => {
    if (initialized.current) return
    initialized.current = true
    try {
      const saved = sessionStorage.getItem('testing-session')
      if (!saved) return
      const s = JSON.parse(saved)
      if (s.config) setConfig(s.config)
      if (s.lead) setLead(s.lead)
      if (s.messages?.length) setMessages(s.messages)
      if (s.analysis) setAnalysis(s.analysis)
      if (s.kbChunks) setKbChunks(s.kbChunks)
      if (s.appliedRules) setAppliedRules(s.appliedRules)
      if (s.metrics) setMetrics(s.metrics)
      if (s.suggestions) setSuggestions(s.suggestions)
      if (s.leadInput) setLeadInput(s.leadInput)
    } catch { /* ignore corrupt data */ }
  }, [])

  // ── Save session to sessionStorage on state changes ──
  const saveSession = useCallback(() => {
    try {
      sessionStorage.setItem('testing-session', JSON.stringify({
        config, lead, messages, analysis, kbChunks, appliedRules, metrics, suggestions, leadInput,
      }))
    } catch { /* ignore */ }
  }, [config, lead, messages, analysis, kbChunks, appliedRules, metrics, suggestions, leadInput])

  useEffect(() => {
    if (initialized.current) saveSession()
  }, [saveSession])

  // ── Fetch personas ──
  useEffect(() => {
    fetch('/api/persona')
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (data?.id) setPersonas([{ id: data.id, name: data.name || 'Global Persona' }])
      })
      .catch(() => showToast('Failed to load personas', 'error'))
  }, [])

  // ── Auto-scroll ──
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length])

  // ── API call helper ──
  const simulate = async (action: string, extraMessages?: SimMessage[]) => {
    setLoading(true)
    setSuggestions(null)
    try {
      const allMsgs = extraMessages || messages
      const res = await fetch('/api/testing/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          config,
          messages: allMsgs.map((m) => ({ role: m.role, content: m.content })),
          leadProfile: lead,
        }),
      })
      if (!res.ok) return null
      return await res.json()
    } finally {
      setLoading(false)
    }
  }

  // ── Actions ──
  const startTest = async () => {
    const firstMsg: SimMessage = {
      id: crypto.randomUUID(),
      role: 'lead',
      content: lead.firstMessage,
      timestamp: new Date().toISOString(),
    }
    setMessages([firstMsg])
    setAnalysis(null)
    setKbChunks([])
    setAppliedRules([])
    setMetrics(null)
    setSuggestions(null)

    // Copilot: auto-suggest
    const data = await simulate('suggest', [firstMsg])
    if (data?.suggestions) setSuggestions(data.suggestions)
    if (data?.analysis) setAnalysis(data.analysis)
    if (data?.retrievedKBChunks) setKbChunks(data.retrievedKBChunks)
    if (data?.appliedRules) setAppliedRules(data.appliedRules)
    if (data?.metrics) setMetrics(data.metrics)
  }

  const playSuggestions = async () => {
    const data = await simulate('suggest')
    if (data?.suggestions) setSuggestions(data.suggestions)
    if (data?.analysis) setAnalysis(data.analysis)
    if (data?.retrievedKBChunks) setKbChunks(data.retrievedKBChunks)
    if (data?.appliedRules) setAppliedRules(data.appliedRules)
    if (data?.metrics) setMetrics(data.metrics)
  }

  const applySuggestion = (msgs: string[]) => {
    const setterMsgs: SimMessage[] = msgs.map((content, i) => ({
      id: crypto.randomUUID(),
      role: 'setter' as const,
      content,
      timestamp: new Date(Date.now() + i * 500).toISOString(),
    }))
    setMessages((prev) => [...prev, ...setterMsgs])
    setSuggestions(null)
  }

  const playLeadResponse = async () => {
    const data = await simulate('lead_response')
    if (data?.leadMessages) {
      const leadMsgs: SimMessage[] = data.leadMessages.map((content: string, i: number) => ({
        id: crypto.randomUUID(),
        role: 'lead' as const,
        content,
        timestamp: new Date(Date.now() + i * 1000).toISOString(),
      }))
      setMessages((prev) => [...prev, ...leadMsgs])
    }
  }

  const injectLeadMessage = () => {
    if (!leadInput.trim()) return
    const msg: SimMessage = {
      id: crypto.randomUUID(),
      role: 'lead',
      content: leadInput.trim(),
      timestamp: new Date().toISOString(),
    }
    setMessages((prev) => [...prev, msg])
    setLeadInput('')
  }

  const sendSetterMessage = (text: string) => {
    if (!text.trim()) return
    const msg: SimMessage = {
      id: crypto.randomUUID(),
      role: 'setter',
      content: text.trim(),
      timestamp: new Date().toISOString(),
    }
    setMessages((prev) => [...prev, msg])
    setLeadInput('')
  }

  return (
    <div className="h-full flex bg-[#080808]">
      {/* ═══════════════════════════════════════ */}
      {/* LEFT — TEST CONFIGURATION */}
      {/* ═══════════════════════════════════════ */}
      <div className="w-[280px] border-r border-[#1a1a1a] flex flex-col shrink-0 overflow-y-auto">
        <div className="px-4 py-3 border-b border-[#1a1a1a] flex items-center gap-2">
          <FlaskConical className="w-3.5 h-3.5 text-[#00ff88]" />
          <span className="text-[13px] font-mono text-[#00ff88] uppercase tracking-wider font-bold">Test Config</span>
        </div>

        <div className="p-4 space-y-4">
          {/* Persona */}
          <div>
            <label className="text-[11px] font-mono text-[#555] uppercase tracking-wider block mb-1.5">Persona</label>
            <select
              value={config.personaId}
              onChange={(e) => setConfig((c) => ({ ...c, personaId: e.target.value }))}
              className="w-full bg-[#111] border border-[#222] rounded px-2 py-1.5 text-xs font-mono text-[#ccc]"
            >
              <option value="">Global (default)</option>
              {personas.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>

          {/* KB toggle */}
          <div className="flex items-center justify-between">
            <label className="text-[11px] font-mono text-[#555] uppercase tracking-wider">Knowledge Base</label>
            <button
              onClick={() => setConfig((c) => ({ ...c, useKB: !c.useKB }))}
              className={cn(
                'w-8 h-4 rounded-full transition-colors relative',
                config.useKB ? 'bg-[#00ff88]/30' : 'bg-[#222]'
              )}
            >
              <span className={cn(
                'absolute top-0.5 w-4 h-4 rounded-full transition-all',
                config.useKB ? 'left-4.5 bg-[#00ff88]' : 'left-0.5 bg-[#555]'
              )} style={{ left: config.useKB ? '18px' : '2px' }} />
            </button>
          </div>

          {/* Response style */}
          <div>
            <label className="text-[11px] font-mono text-[#555] uppercase tracking-wider block mb-1.5">Response Style</label>
            <div className="flex gap-1">
              {['casual', 'balanced', 'aggressive'].map((s) => (
                <button
                  key={s}
                  onClick={() => setConfig((c) => ({ ...c, responseStyle: s }))}
                  className={cn(
                    'flex-1 py-1 rounded text-[11px] font-mono capitalize transition-colors',
                    config.responseStyle === s
                      ? 'bg-[#54a0ff]/10 text-[#54a0ff] border border-[#54a0ff]/30'
                      : 'text-[#444] border border-[#222]'
                  )}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* Custom prompt */}
          <div>
            <label className="text-[11px] font-mono text-[#555] uppercase tracking-wider block mb-1.5">Custom Instructions</label>
            <textarea
              value={config.customPrompt}
              onChange={(e) => setConfig((c) => ({ ...c, customPrompt: e.target.value }))}
              placeholder="Extra instructions for this test..."
              className="w-full bg-[#111] border border-[#222] rounded px-2 py-1.5 text-xs font-mono text-[#ccc] placeholder:text-[#333] resize-none h-14 outline-none"
            />
          </div>

          {/* Divider */}
          <div className="border-t border-[#1a1a1a] pt-3">
            <label className="text-[11px] font-mono text-[#ff9f43] uppercase tracking-wider block mb-2">Fake Lead Profile</label>
          </div>

          {/* Lead fields */}
          <div className="space-y-2">
            <div>
              <label className="text-[10px] font-mono text-[#444] uppercase block mb-0.5">Username</label>
              <input
                value={lead.username}
                onChange={(e) => setLead((l) => ({ ...l, username: e.target.value }))}
                className="w-full bg-[#111] border border-[#222] rounded px-3 py-1.5 text-xs font-mono text-[#ccc] outline-none"
              />
            </div>
            <div>
              <label className="text-[10px] font-mono text-[#444] uppercase block mb-0.5">Bio</label>
              <textarea
                value={lead.bio}
                onChange={(e) => setLead((l) => ({ ...l, bio: e.target.value }))}
                className="w-full bg-[#111] border border-[#222] rounded px-3 py-1.5 text-xs font-mono text-[#ccc] resize-none h-10 outline-none"
              />
            </div>
            <div className="flex gap-2">
              <div className="flex-1">
                <label className="text-[10px] font-mono text-[#444] uppercase block mb-0.5">Source</label>
                <select
                  value={lead.source}
                  onChange={(e) => setLead((l) => ({ ...l, source: e.target.value }))}
                  className="w-full bg-[#111] border border-[#222] rounded px-3 py-1.5 text-xs font-mono text-[#ccc]"
                >
                  <option value="dm">DM</option>
                  <option value="story_reply">Story Reply</option>
                  <option value="comment">Comment</option>
                  <option value="follow">Follow</option>
                </select>
              </div>
              <div className="flex-1">
                <label className="text-[10px] font-mono text-[#444] uppercase block mb-0.5">Age Hint</label>
                <input
                  value={lead.ageHint}
                  onChange={(e) => setLead((l) => ({ ...l, ageHint: e.target.value }))}
                  className="w-full bg-[#111] border border-[#222] rounded px-3 py-1.5 text-xs font-mono text-[#ccc] outline-none"
                />
              </div>
            </div>
            <div>
              <label className="text-[10px] font-mono text-[#444] uppercase block mb-0.5">Writing Style</label>
              <div className="grid grid-cols-2 gap-1">
                {['casual', 'formal', 'minimal', 'verbose'].map((s) => (
                  <button
                    key={s}
                    onClick={() => setLead((l) => ({ ...l, writingStyle: s }))}
                    className={cn(
                      'py-1 rounded text-[11px] font-mono capitalize transition-colors',
                      lead.writingStyle === s
                        ? 'bg-[#ff9f43]/10 text-[#ff9f43] border border-[#ff9f43]/30'
                        : 'text-[#444] border border-[#222]'
                    )}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-[10px] font-mono text-[#444] uppercase block mb-0.5">First Message</label>
              <textarea
                value={lead.firstMessage}
                onChange={(e) => setLead((l) => ({ ...l, firstMessage: e.target.value }))}
                className="w-full bg-[#111] border border-[#222] rounded px-2 py-1.5 text-xs font-mono text-[#ccc] resize-none h-16 outline-none"
              />
            </div>
          </div>

          {/* Start button */}
          <button
            onClick={startTest}
            disabled={loading || !lead.firstMessage.trim()}
            className="w-full py-2 rounded bg-[#00ff88] text-black text-[13px] font-mono font-bold uppercase tracking-wider hover:bg-[#00dd77] transition-colors disabled:opacity-50"
          >
            {loading ? 'Running...' : 'Start Test'}
          </button>
        </div>
      </div>

      {/* ═══════════════════════════════════════ */}
      {/* CENTER — SIMULATED CHAT */}
      {/* ═══════════════════════════════════════ */}
      <div className="flex-1 flex flex-col min-w-0 min-h-0">
        {/* Chat header */}
        <div className="px-4 py-2.5 border-b border-[#1a1a1a] flex items-center justify-between bg-[#0a0a0a]">
          <div className="flex items-center gap-2">
            <span className="text-[13px] font-mono text-[#ccc]">@{lead.username}</span>
            <span className="text-[10px] font-mono text-[#333] bg-[#111] px-1.5 py-0.5 rounded uppercase">{lead.source}</span>
            <span className="text-[10px] font-mono text-[#ff9f43] bg-[#ff9f43]/10 px-1.5 py-0.5 rounded uppercase">
              copilot
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono text-[#333]">{messages.length} messages</span>
            <button
              onClick={() => { setMessages([]); setAnalysis(null); setSuggestions(null); setKbChunks([]); setAppliedRules([]); setMetrics(null); sessionStorage.removeItem('testing-session') }}
              className="text-[#444] hover:text-[#888] transition-colors"
              title="Reset"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
          {messages.length === 0 && (
            <div className="flex items-center justify-center h-full">
              <div className="text-center space-y-2">
                <FlaskConical className="w-8 h-8 text-[#222] mx-auto" />
                <p className="text-[13px] font-mono text-[#333]">Configure your test and click START TEST</p>
              </div>
            </div>
          )}

          {messages.map((msg) => (
            <div key={msg.id} className={cn('flex animate-slide-in-up', msg.role === 'lead' ? 'justify-start' : 'justify-end')}>
              <div className={cn('max-w-[70%] space-y-1')}>
                {/* Sender tag */}
                <div className={cn('flex items-center gap-1', msg.role === 'lead' ? '' : 'justify-end')}>
                  {msg.role === 'lead' && <User className="w-3.5 h-3.5 text-[#555]" />}
                  {msg.role === 'ai' && <Sparkles className="w-3.5 h-3.5 text-[#00ff88]" />}
                  {msg.role === 'setter' && <User className="w-3.5 h-3.5 text-[#54a0ff]" />}
                  <span className={cn('text-[10px] font-mono uppercase',
                    msg.role === 'lead' ? 'text-[#555]' : msg.role === 'ai' ? 'text-[#00ff88]' : 'text-[#54a0ff]'
                  )}>
                    {msg.role === 'lead' ? `@${lead.username}` : msg.role === 'ai' ? 'AI' : 'Setter'}
                  </span>
                </div>
                {/* Bubble */}
                <div className={cn(
                  'px-3 py-2 rounded-lg text-[13px] font-mono',
                  msg.role === 'lead'
                    ? 'bg-[#151515] text-[#ccc] border border-[#1a1a1a]'
                    : msg.role === 'ai'
                      ? 'bg-[#00ff88]/10 text-[#d0ffd0] border border-[#00ff88]/20'
                      : 'bg-[#54a0ff]/10 text-[#d0e0ff] border border-[#54a0ff]/20'
                )}>
                  {msg.content}
                </div>
                {msg.reasoning && (
                  <div className="px-3 py-1.5 bg-[#111] border border-[#1a1a1a] rounded text-[11px] font-mono text-[#555]">
                    <Sparkles className="w-2 h-2 inline mr-1 text-[#ff9f43]" />
                    {msg.reasoning}
                  </div>
                )}
              </div>
            </div>
          ))}
          <div ref={chatEndRef} />
        </div>

        {/* Copilot suggestions */}
        {suggestions && (
          <div className="border-t border-[#1a1a1a] bg-[#0a0a0a] px-4 py-3 shrink-0 max-h-[40%] overflow-y-auto">
            <div className="flex items-center gap-1.5 mb-2">
              <Sparkles className="w-4 h-4 text-[#ff9f43]" />
              <span className="text-[11px] font-mono text-[#555] uppercase tracking-wider">AI Suggestions</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: 'Option A', data: suggestions.optionA, rec: suggestions.recommended === 'a' },
                { label: 'Option B', data: suggestions.optionB, rec: suggestions.recommended === 'b' },
              ].map((opt) => (
                <div key={opt.label} className={cn(
                  'p-2 rounded border transition-colors cursor-pointer hover:bg-[#151515]',
                  opt.rec ? 'border-[#00ff88]/30 bg-[#00ff88]/5' : 'border-[#1a1a1a] bg-[#111]'
                )} onClick={() => applySuggestion(opt.data.messages)}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[11px] font-mono text-[#888]">{opt.label}</span>
                    {opt.rec && <span className="text-[9px] font-mono text-[#00ff88] bg-[#00ff88]/10 px-1 rounded">REC</span>}
                    <span className="text-[10px] font-mono text-[#444]">{opt.data.confidence}%</span>
                  </div>
                  {opt.data.messages.map((m, i) => (
                    <p key={i} className="text-xs font-mono text-[#ccc] mb-0.5">{m}</p>
                  ))}
                  <p className="text-[10px] font-mono text-[#444] mt-1">{opt.data.reasoning}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Action bar */}
        {messages.length > 0 && (
          <div className="border-t border-[#1a1a1a] bg-[#0a0a0a] px-4 py-2 shrink-0">
            <div className="flex items-center gap-2">
              {/* Inject lead message */}
              <div className="flex-1 flex items-center gap-1">
                <span className="text-[11px] font-mono text-[#555] shrink-0">Lead says:</span>
                <input
                  value={leadInput}
                  onChange={(e) => setLeadInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      injectLeadMessage()
                    }
                  }}
                  placeholder="Type what lead says..."
                  className="flex-1 bg-[#111] border border-[#222] rounded px-3 py-1.5 text-xs font-mono text-[#ccc] placeholder:text-[#333] outline-none"
                />
                <button
                  onClick={injectLeadMessage}
                  disabled={!leadInput.trim()}
                  className="px-3 py-1.5 rounded bg-[#151515] text-[#888] text-[11px] font-mono hover:bg-[#222] transition-colors disabled:opacity-30"
                >
                  Inject
                </button>
              </div>

              {/* Divider */}
              <div className="w-px h-5 bg-[#222]" />

              {/* Action buttons */}
              <button
                onClick={() => sendSetterMessage(leadInput)}
                disabled={!leadInput.trim() || loading}
                className="flex items-center gap-1 px-3 py-1.5 rounded bg-[#54a0ff]/10 text-[#54a0ff] text-[11px] font-mono hover:bg-[#54a0ff]/20 transition-colors disabled:opacity-30"
              >
                <User className="w-3.5 h-3.5" /> Send as Setter
              </button>
              <button
                onClick={playSuggestions}
                disabled={loading}
                className="flex items-center gap-1 px-3 py-1.5 rounded bg-[#ff9f43]/10 text-[#ff9f43] text-[11px] font-mono hover:bg-[#ff9f43]/20 transition-colors disabled:opacity-50"
              >
                <Sparkles className="w-3.5 h-3.5" /> Suggest
              </button>

              <button
                onClick={playLeadResponse}
                disabled={loading}
                className="flex items-center gap-1 px-3 py-1.5 rounded bg-[#151515] text-[#888] text-[11px] font-mono hover:bg-[#222] transition-colors disabled:opacity-50"
              >
                <Play className="w-3.5 h-3.5" /> Sim Lead Reply
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ═══════════════════════════════════════ */}
      {/* RIGHT — AI ANALYSIS PANEL */}
      {/* ═══════════════════════════════════════ */}
      <div className="w-[280px] border-l border-[#1a1a1a] flex flex-col shrink-0 overflow-y-auto">
        <div className="px-4 py-3 border-b border-[#1a1a1a] flex items-center gap-2">
          <Brain className="w-3.5 h-3.5 text-[#5f27cd]" />
          <span className="text-[13px] font-mono text-[#5f27cd] uppercase tracking-wider font-bold">Analysis</span>
        </div>

        {!analysis ? (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-xs font-mono text-[#333] text-center px-6">
              Run a test to see AI analysis
            </p>
          </div>
        ) : (
          <div className="p-4 space-y-4">
            {/* Heat Score */}
            <div className="bg-[#111] border border-[#222] rounded-lg p-3">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5">
                  <Flame className="w-4 h-4 text-[#ff4500]" />
                  <span className="text-[11px] font-mono text-[#555] uppercase">Heat Score</span>
                </div>
                <span className={cn('text-xl font-mono font-bold',
                  analysis.heatScore >= 80 ? 'text-[#ff4500]' :
                  analysis.heatScore >= 60 ? 'text-[#ff8c00]' :
                  analysis.heatScore >= 40 ? 'text-[#ffd700]' :
                  'text-[#00ff88]'
                )}>
                  {analysis.heatScore}
                </span>
              </div>
              <div className="h-1.5 bg-[#1a1a1a] rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${analysis.heatScore}%`,
                    backgroundColor: analysis.heatScore >= 80 ? '#ff4500' :
                      analysis.heatScore >= 60 ? '#ff8c00' :
                      analysis.heatScore >= 40 ? '#ffd700' : '#00ff88',
                  }}
                />
              </div>
            </div>

            {/* Stage Detection */}
            <div>
              <div className="flex items-center gap-1.5 mb-1.5">
                <Target className="w-4 h-4 text-[#54a0ff]" />
                <span className="text-[11px] font-mono text-[#555] uppercase">Detected Stage</span>
              </div>
              <div className="flex items-center gap-2">
                <span
                  className="text-[13px] font-mono font-bold px-3 py-1.5 rounded"
                  style={{
                    color: STAGE_COLORS[analysis.detectedStage] || '#666',
                    backgroundColor: `${STAGE_COLORS[analysis.detectedStage] || '#666'}15`,
                  }}
                >
                  {STAGE_LABELS[analysis.detectedStage] || analysis.detectedStage}
                </span>
                <span className="text-[11px] font-mono text-[#444]">{analysis.confidence}% confident</span>
              </div>
            </div>

            {/* Qualification Fields */}
            {Object.keys(analysis.qualificationUpdates).length > 0 && (
              <div>
                <div className="flex items-center gap-1.5 mb-1.5">
                  <FileText className="w-4 h-4 text-[#00ff88]" />
                  <span className="text-[11px] font-mono text-[#555] uppercase">Fields Detected</span>
                </div>
                <div className="space-y-1">
                  {Object.entries(analysis.qualificationUpdates).map(([key, val]) => (
                    <div key={key} className="flex items-center gap-2 px-3 py-1.5 bg-[#111] rounded">
                      <span className="text-[11px] font-mono text-[#888]">{key}:</span>
                      <span className="text-[11px] font-mono text-[#ccc]">{String(val)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Red Flags */}
            {analysis.redFlags.length > 0 && (
              <div>
                <div className="flex items-center gap-1.5 mb-1.5">
                  <AlertTriangle className="w-4 h-4 text-[#f05050]" />
                  <span className="text-[11px] font-mono text-[#555] uppercase">Red Flags</span>
                </div>
                <div className="space-y-1">
                  {analysis.redFlags.map((flag, i) => (
                    <div key={i} className="px-3 py-1.5 bg-[#f05050]/5 border border-[#f05050]/10 rounded text-[11px] font-mono text-[#f05050]">
                      {flag}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Applied Rules */}
            {appliedRules.length > 0 && (
              <div>
                <div className="flex items-center gap-1.5 mb-1.5">
                  <Zap className="w-4 h-4 text-[#ff9f43]" />
                  <span className="text-[11px] font-mono text-[#555] uppercase">Active Rules</span>
                </div>
                <div className="flex flex-wrap gap-1">
                  {appliedRules.map((rule) => (
                    <span key={rule} className="text-[10px] font-mono text-[#ff9f43] bg-[#ff9f43]/10 px-1.5 py-0.5 rounded">
                      {RULE_LABELS[rule] || rule}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* KB Chunks */}
            {kbChunks.length > 0 && (
              <div>
                <div className="flex items-center gap-1.5 mb-1.5">
                  <Brain className="w-4 h-4 text-[#5f27cd]" />
                  <span className="text-[11px] font-mono text-[#555] uppercase">KB Retrieved</span>
                </div>
                <div className="space-y-1">
                  {kbChunks.map((chunk, i) => (
                    <div key={i} className="px-3 py-1.5 bg-[#111] rounded flex items-center justify-between">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="text-[10px] font-mono text-[#5f27cd] bg-[#5f27cd]/10 px-1 rounded shrink-0">{chunk.type}</span>
                        <span className="text-[11px] font-mono text-[#888] truncate">{chunk.title}</span>
                      </div>
                      <span className="text-[10px] font-mono text-[#444] shrink-0">{chunk.similarity}%</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Metrics */}
            {metrics && (
              <div className="border-t border-[#1a1a1a] pt-3">
                <div className="flex items-center gap-1.5 mb-1.5">
                  <ChevronRight className="w-4 h-4 text-[#444]" />
                  <span className="text-[11px] font-mono text-[#555] uppercase">Metrics</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-[#111] rounded px-2 py-1.5">
                    <span className="text-[10px] font-mono text-[#444] block">Tokens (est)</span>
                    <span className="text-[13px] font-mono text-[#ccc]">~{metrics.tokenEstimate}</span>
                  </div>
                  <div className="bg-[#111] rounded px-2 py-1.5">
                    <span className="text-[10px] font-mono text-[#444] block">Model</span>
                    <span className="text-[13px] font-mono text-[#ccc]">{metrics.model}</span>
                  </div>
                  <div className="bg-[#111] rounded px-2 py-1.5">
                    <span className="text-[10px] font-mono text-[#444] block">KB Chunks</span>
                    <span className="text-[13px] font-mono text-[#ccc]">{metrics.kbChunksUsed}</span>
                  </div>
                  <div className="bg-[#111] rounded px-2 py-1.5">
                    <span className="text-[10px] font-mono text-[#444] block">Messages</span>
                    <span className="text-[13px] font-mono text-[#ccc]">{messages.length}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Export */}
            <div className="border-t border-[#1a1a1a] pt-3 flex gap-2">
              <button
                onClick={() => {
                  const session = { config, leadProfile: lead, messages, analysis, kbChunks, appliedRules, metrics, timestamp: new Date().toISOString() }
                  navigator.clipboard.writeText(JSON.stringify(session, null, 2))
                }}
                className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded bg-[#111] border border-[#222] text-[11px] font-mono text-[#888] hover:bg-[#1a1a1a] transition-colors"
              >
                <Copy className="w-3.5 h-3.5" /> Copy Session
              </button>
              <button
                onClick={async () => {
                  const session = { config, lead_profile: lead, messages, analysis, timestamp: new Date().toISOString() }
                  await fetch('/api/testing/simulate', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'save', session }),
                  }).catch(() => {})
                }}
                className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded bg-[#111] border border-[#222] text-[11px] font-mono text-[#888] hover:bg-[#1a1a1a] transition-colors"
              >
                <Save className="w-3.5 h-3.5" /> Save
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
