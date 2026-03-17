'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Save, Loader2, Plus, X, MessageSquare, Zap,
  ToggleLeft, ToggleRight, ChevronDown, ChevronRight,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { LoadingFormSection } from '@/components/ui/loading-pulse'
import { ErrorState } from '@/components/ui/error-state'

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface StyleRules {
  never_use_em_dash: boolean
  vary_capitalization: boolean
  use_contractions: boolean
  use_casual_shortcuts: boolean
  multi_message_bursts: boolean
  match_lead_vibe: boolean
  imperfect_punctuation: boolean
  no_bullet_points: boolean
  max_sentences_per_bubble: number
  max_messages_per_burst: number
  burst_delay_ms: number
  variable_emoji: boolean
  max_emojis_per_burst: number
  prohibited_phrases: string[]
  signature_phrases: string[]
  custom_rules: string[]
  vibe_formality_matching: boolean
  vibe_emoji_mirroring: boolean
  vibe_length_matching: boolean
  vibe_pace_matching: boolean
}

interface LanguageRules {
  tone: string
  primary_language: string
  accent_notes: string
}

interface PersonaState {
  id?: string
  name: string
  base_prompt: string
  style_rules: StyleRules
  language_rules: LanguageRules
  is_global: boolean
}

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const TONE_OPTIONS: { value: string; label: string; desc: string }[] = [
  { value: 'casual', label: 'Casual', desc: 'Relaxed, bro-vibe, low-pressure. Like texting a friend who happens to have what they need.' },
  { value: 'balanced', label: 'Balanced', desc: 'Warm but professional. Friendly enough to build rapport, direct enough to move conversations forward.' },
  { value: 'direct', label: 'Direct', desc: 'Straight to the point. Confident, no fluff. Works best for leads who value efficiency.' },
]

interface WritingRule {
  key: keyof StyleRules
  title: string
  desc: string
}

const WRITING_RULES: WritingRule[] = [
  { key: 'never_use_em_dash', title: 'No double dash (-- or —)', desc: 'Avoid em dashes and double hyphens which look robotic in DMs' },
  { key: 'vary_capitalization', title: 'Variable capitalization', desc: "Don't always capitalize the first word — lowercase starters feel more natural" },
  { key: 'use_casual_shortcuts', title: 'Use casual shortcuts (rn, lmk, ngl, tbh, bet, fr)', desc: 'Sprinkle in common texting abbreviations to match DM culture' },
  { key: 'multi_message_bursts', title: 'Multi-message bursts', desc: 'Split one thought into 2-3 short messages instead of one long block' },
  { key: 'match_lead_vibe', title: "Match lead's energy and writing style", desc: 'Adapt tone, length, and formality to mirror how the lead communicates' },
  { key: 'imperfect_punctuation', title: 'Imperfect punctuation', desc: 'Occasional missing periods, no question marks on rhetorical questions' },
  { key: 'no_bullet_points', title: 'Never use bullet points in messages', desc: 'Bullet points scream corporate/AI — use natural flowing text instead' },
  { key: 'variable_emoji', title: 'Variable emoji use', desc: 'Only use emojis if the lead uses them first, and match their frequency' },
  { key: 'use_contractions', title: 'Always use contractions', desc: "Use don't, won't, can't — never write do not, will not, cannot" },
]

const VIBE_SETTINGS: { key: keyof StyleRules; title: string; desc: string }[] = [
  { key: 'vibe_formality_matching', title: 'Formality matching', desc: 'Detect if lead is formal or casual and adjust language register accordingly' },
  { key: 'vibe_emoji_mirroring', title: 'Emoji mirroring', desc: "Mirror the lead's emoji usage — if they don't use any, don't use any" },
  { key: 'vibe_length_matching', title: 'Response length matching', desc: 'If lead sends short messages, keep responses short. Long messages get longer replies.' },
  { key: 'vibe_pace_matching', title: 'Pace matching', desc: 'If lead sends fast short messages, respond with quick short messages instead of paragraphs' },
]

/* ------------------------------------------------------------------ */
/*  Main Page                                                          */
/* ------------------------------------------------------------------ */

export default function PersonaPage() {
  const [persona, setPersona] = useState<PersonaState | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [openSections, setOpenSections] = useState<Set<string>>(
    new Set(['identity', 'style', 'prohibited', 'signatures', 'vibe'])
  )

  const fetchPersona = useCallback(async () => {
    try {
      setError(false)
      const res = await fetch('/api/persona')
      if (res.ok) {
        const data = await res.json()
        setPersona(data)
      }
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchPersona() }, [fetchPersona])

  const update = (fn: (prev: PersonaState) => PersonaState) => {
    setPersona((prev) => prev ? fn(prev) : prev)
    setDirty(true)
  }

  const updateStyle = (key: string, value: unknown) => {
    update((p) => ({ ...p, style_rules: { ...p.style_rules, [key]: value } }))
  }

  const updateLang = (key: string, value: string) => {
    update((p) => ({ ...p, language_rules: { ...p.language_rules, [key]: value } }))
  }

  const save = async () => {
    if (!persona) return
    setSaving(true)
    try {
      await fetch('/api/persona', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(persona),
      })
      setDirty(false)
    } finally {
      setSaving(false)
    }
  }

  const toggleSection = (key: string) => {
    setOpenSections((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  if (loading) return <div className="p-8"><LoadingFormSection fields={5} /></div>
  if (error) return <ErrorState message="Failed to load persona" onRetry={fetchPersona} />
  if (!persona) return <ErrorState message="Failed to load persona" onRetry={fetchPersona} />

  return (
    <div className="h-[calc(100vh-48px)] overflow-y-auto">
      <div className="p-6 max-w-3xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-sm font-mono font-bold text-[#f0f0f0] mb-1">Persona Configuration</h1>
            <p className="text-[13px] font-mono text-[#555]">
              Configure the AI&apos;s personality, writing style, and human-like behavior. Affects all AI modes globally.
            </p>
          </div>
          <button
            onClick={save}
            disabled={saving || !dirty}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded text-[13px] font-mono transition-colors',
              dirty
                ? 'bg-[#00ff88]/10 border border-[#00ff88]/30 text-[#00ff88] hover:bg-[#00ff88]/20'
                : 'bg-[#111] border border-[#1a1a1a] text-[#555]',
              'disabled:opacity-50'
            )}
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {dirty ? 'SAVE CHANGES' : 'SAVED'}
          </button>
        </div>

        {/* ── SECTION 1: Core Identity ── */}
        <CollapsibleSection
          title="Core Identity"
          subtitle="Base personality and role definition"
          sectionKey="identity"
          open={openSections.has('identity')}
          onToggle={toggleSection}
        >
          {/* AI Name */}
          <div className="mb-4">
            <label className="text-[11px] font-mono text-[#555] uppercase block mb-1">AI Name / Identity</label>
            <input
              value={persona.name}
              onChange={(e) => update((p) => ({ ...p, name: e.target.value }))}
              placeholder="Leave empty — AI acts as anonymous team member, never reveals it's AI"
              className="w-full bg-[#111] border border-[#1a1a1a] rounded px-3 py-2 text-[13px] font-mono text-[#ccc] placeholder:text-[#333] outline-none focus:border-[#00ff88]/30"
            />
            <span className="text-[11px] font-mono text-[#444] mt-0.5 block">
              If empty, the AI never identifies itself by name and acts as a member of the team.
            </span>
          </div>

          {/* Base Role Prompt */}
          <div className="mb-4">
            <label className="text-[11px] font-mono text-[#555] uppercase block mb-1">Base Role Description</label>
            <textarea
              value={persona.base_prompt}
              onChange={(e) => update((p) => ({ ...p, base_prompt: e.target.value }))}
              rows={5}
              placeholder="You are a world-class appointment setter..."
              className="w-full bg-[#111] border border-[#1a1a1a] rounded-lg px-3 py-2.5 text-[13px] font-mono text-[#ccc] placeholder:text-[#333] outline-none resize-none focus:border-[#00ff88]/30"
            />
            <span className="text-[11px] font-mono text-[#444]">{persona.base_prompt.length} characters</span>
          </div>

          {/* Tone Selector */}
          <div className="mb-4">
            <label className="text-[11px] font-mono text-[#555] uppercase block mb-2">Tone</label>
            <div className="grid grid-cols-3 gap-2">
              {TONE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => updateLang('tone', opt.value)}
                  className={cn(
                    'p-3 rounded-lg border text-left transition-colors',
                    persona.language_rules.tone === opt.value
                      ? 'bg-[#00ff88]/5 border-[#00ff88]/30'
                      : 'bg-[#0d0d0d] border-[#1a1a1a] hover:border-[#333]'
                  )}
                >
                  <span className={cn('text-[13px] font-mono font-bold block mb-0.5',
                    persona.language_rules.tone === opt.value ? 'text-[#00ff88]' : 'text-[#888]')}>
                    {opt.label}
                  </span>
                  <span className="text-[11px] font-mono text-[#555] leading-relaxed">{opt.desc}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Language */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-mono text-[#555] uppercase block mb-1">Primary Language</label>
              <input
                value={persona.language_rules.primary_language}
                onChange={(e) => updateLang('primary_language', e.target.value)}
                placeholder="English"
                className="w-full bg-[#111] border border-[#1a1a1a] rounded px-3 py-2 text-[13px] font-mono text-[#ccc] outline-none focus:border-[#00ff88]/30"
              />
            </div>
            <div>
              <label className="text-[11px] font-mono text-[#555] uppercase block mb-1">Accent / Dialect Notes</label>
              <input
                value={persona.language_rules.accent_notes}
                onChange={(e) => updateLang('accent_notes', e.target.value)}
                placeholder="e.g. UK/Norwegian English — use 'yeah' not 'y'all'"
                className="w-full bg-[#111] border border-[#1a1a1a] rounded px-3 py-2 text-[13px] font-mono text-[#ccc] placeholder:text-[#333] outline-none focus:border-[#00ff88]/30"
              />
            </div>
          </div>
        </CollapsibleSection>

        {/* ── SECTION 2: Writing Style Rules ── */}
        <CollapsibleSection
          title="Writing Style Rules"
          subtitle={`${WRITING_RULES.filter((r) => persona.style_rules[r.key] === true).length + persona.style_rules.custom_rules.length} rules active`}
          sectionKey="style"
          open={openSections.has('style')}
          onToggle={toggleSection}
        >
          <div className="space-y-2 mb-4">
            {WRITING_RULES.map((rule) => (
              <RuleCard
                key={rule.key}
                title={rule.title}
                desc={rule.desc}
                enabled={persona.style_rules[rule.key] as boolean}
                onToggle={(v) => updateStyle(rule.key, v)}
              />
            ))}

            {/* Max sentences per bubble */}
            <div className="flex items-center justify-between p-3 bg-[#0d0d0d] rounded-lg border border-[#1a1a1a]">
              <div>
                <span className="text-[13px] font-mono text-[#ccc] block">Max sentences per message bubble</span>
                <span className="text-[11px] font-mono text-[#555]">Keep each message short and punchy</span>
              </div>
              <div className="flex items-center gap-2">
                {[1, 2, 3].map((n) => (
                  <button
                    key={n}
                    onClick={() => updateStyle('max_sentences_per_bubble', n)}
                    className={cn('w-8 h-7 rounded border text-[13px] font-mono font-bold transition-colors',
                      persona.style_rules.max_sentences_per_bubble === n
                        ? 'bg-[#00ff88]/10 text-[#00ff88] border-[#00ff88]/30'
                        : 'text-[#666] border-[#222] hover:border-[#444]'
                    )}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>

            {/* Custom rules */}
            {persona.style_rules.custom_rules.map((rule, i) => (
              <div key={i} className="flex items-center gap-2 p-3 bg-[#0d0d0d] rounded-lg border border-[#1a1a1a]">
                <span className="text-[13px] font-mono text-[#ccc] flex-1">{rule}</span>
                <span className="text-[10px] font-mono text-[#555] uppercase px-1.5 py-0.5 bg-[#111] rounded border border-[#1a1a1a]">Custom</span>
                <button
                  onClick={() => {
                    const next = persona.style_rules.custom_rules.filter((_, j) => j !== i)
                    updateStyle('custom_rules', next)
                  }}
                  className="text-[#444] hover:text-[#f05050]"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>

          <AddItemInput
            placeholder="Add a custom writing rule..."
            onAdd={(val) => updateStyle('custom_rules', [...persona.style_rules.custom_rules, val])}
          />
        </CollapsibleSection>

        {/* ── SECTION 3: Prohibited Phrases ── */}
        <CollapsibleSection
          title="Prohibited Phrases"
          subtitle={`${persona.style_rules.prohibited_phrases.length} blocked`}
          sectionKey="prohibited"
          open={openSections.has('prohibited')}
          onToggle={toggleSection}
        >
          <p className="text-xs font-mono text-[#555] mb-3">
            Phrases the AI must NEVER use in any message. These are hard blocks — the AI will actively avoid them.
          </p>
          <div className="flex flex-wrap gap-1.5 mb-4">
            {persona.style_rules.prohibited_phrases.map((phrase, i) => (
              <span
                key={i}
                className="inline-flex items-center gap-1 px-3 py-1.5 bg-[#f05050]/5 border border-[#f05050]/20 rounded text-xs font-mono text-[#f05050]/80"
              >
                <span className="line-through">{phrase}</span>
                <button
                  onClick={() => {
                    const next = persona.style_rules.prohibited_phrases.filter((_, j) => j !== i)
                    updateStyle('prohibited_phrases', next)
                  }}
                  className="text-[#f05050]/40 hover:text-[#f05050]"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </span>
            ))}
            {persona.style_rules.prohibited_phrases.length === 0 && (
              <span className="text-xs font-mono text-[#444]">No prohibited phrases set</span>
            )}
          </div>
          <AddItemInput
            placeholder="Add a prohibited phrase..."
            onAdd={(val) => updateStyle('prohibited_phrases', [...persona.style_rules.prohibited_phrases, val])}
          />
        </CollapsibleSection>

        {/* ── SECTION 4: Signature Phrases & Openers ── */}
        <CollapsibleSection
          title="Signature Phrases & Openers"
          subtitle={`${persona.style_rules.signature_phrases.length} phrases`}
          sectionKey="signatures"
          open={openSections.has('signatures')}
          onToggle={toggleSection}
        >
          <p className="text-xs font-mono text-[#555] mb-3">
            Words and phrases Lars or the team actually uses in DMs. The AI will naturally incorporate these into conversations to sound authentic.
          </p>
          <div className="flex flex-wrap gap-1.5 mb-4">
            {persona.style_rules.signature_phrases.map((phrase, i) => (
              <span
                key={i}
                className="inline-flex items-center gap-1 px-3 py-1.5 bg-[#00ff88]/5 border border-[#00ff88]/20 rounded text-xs font-mono text-[#00ff88]/80"
              >
                &ldquo;{phrase}&rdquo;
                <button
                  onClick={() => {
                    const next = persona.style_rules.signature_phrases.filter((_, j) => j !== i)
                    updateStyle('signature_phrases', next)
                  }}
                  className="text-[#00ff88]/40 hover:text-[#00ff88]"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </span>
            ))}
            {persona.style_rules.signature_phrases.length === 0 && (
              <span className="text-xs font-mono text-[#444]">No signature phrases set</span>
            )}
          </div>
          <AddItemInput
            placeholder='Add a phrase... (e.g. "lowkey", "for real though")'
            onAdd={(val) => updateStyle('signature_phrases', [...persona.style_rules.signature_phrases, val])}
          />
        </CollapsibleSection>

        {/* ── SECTION 5: Vibe Matching Engine ── */}
        <CollapsibleSection
          title="Vibe Matching Engine"
          subtitle={`${VIBE_SETTINGS.filter((v) => persona.style_rules[v.key] === true).length}/${VIBE_SETTINGS.length} active`}
          sectionKey="vibe"
          open={openSections.has('vibe')}
          onToggle={toggleSection}
        >
          <p className="text-xs font-mono text-[#555] mb-3">
            Controls how the AI detects and adapts to each lead&apos;s unique communication style in real-time.
          </p>
          <div className="space-y-2">
            {VIBE_SETTINGS.map((v) => (
              <RuleCard
                key={v.key}
                title={v.title}
                desc={v.desc}
                enabled={persona.style_rules[v.key] as boolean}
                onToggle={(val) => updateStyle(v.key, val)}
              />
            ))}
          </div>
        </CollapsibleSection>

        {/* ── SECTION 6: Preview / Test ── */}
        <CollapsibleSection
          title="Preview & Test"
          subtitle="Test current persona settings"
          sectionKey="preview"
          open={openSections.has('preview')}
          onToggle={toggleSection}
        >
          <PersonaPreview persona={persona} />
        </CollapsibleSection>

        {/* Bottom save button */}
        {dirty && (
          <div className="sticky bottom-0 py-4 bg-gradient-to-t from-[#0a0a0a] via-[#0a0a0a] to-transparent">
            <button
              onClick={save}
              disabled={saving}
              className="flex items-center gap-2 px-6 py-2.5 bg-[#00ff88]/10 border border-[#00ff88]/30 rounded-lg text-[13px] font-mono text-[#00ff88] hover:bg-[#00ff88]/20 disabled:opacity-50 transition-colors"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} SAVE ALL CHANGES
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Collapsible Section                                                */
/* ------------------------------------------------------------------ */

function CollapsibleSection({
  title,
  subtitle,
  sectionKey,
  open,
  onToggle,
  children,
}: {
  title: string
  subtitle: string
  sectionKey: string
  open: boolean
  onToggle: (key: string) => void
  children: React.ReactNode
}) {
  return (
    <div className="mb-4 border border-[#1a1a1a] rounded-lg overflow-hidden">
      <button
        onClick={() => onToggle(sectionKey)}
        className="w-full flex items-center justify-between p-4 hover:bg-[#0d0d0d] transition-colors"
      >
        <div className="flex items-center gap-3">
          {open ? <ChevronDown className="w-3.5 h-3.5 text-[#00ff88]" /> : <ChevronRight className="w-3.5 h-3.5 text-[#555]" />}
          <div className="text-left">
            <span className="text-sm font-mono font-bold text-[#f0f0f0] block">{title}</span>
            <span className="text-[11px] font-mono text-[#555]">{subtitle}</span>
          </div>
        </div>
      </button>
      {open && (
        <div className="px-4 pb-4 pt-0 border-t border-[#1a1a1a]">
          <div className="pt-4">{children}</div>
        </div>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Rule Card                                                          */
/* ------------------------------------------------------------------ */

function RuleCard({
  title,
  desc,
  enabled,
  onToggle,
}: {
  title: string
  desc: string
  enabled: boolean
  onToggle: (val: boolean) => void
}) {
  return (
    <div className={cn(
      'flex items-center justify-between p-3 rounded-lg border transition-colors',
      enabled ? 'bg-[#0d0d0d] border-[#1a1a1a]' : 'bg-[#080808] border-[#111]'
    )}>
      <div className="flex-1 mr-3">
        <span className={cn('text-[13px] font-mono block', enabled ? 'text-[#ccc]' : 'text-[#555]')}>
          {title}
        </span>
        <span className="text-[11px] font-mono text-[#444]">{desc}</span>
      </div>
      <button
        onClick={() => onToggle(!enabled)}
        className="shrink-0"
      >
        {enabled ? (
          <ToggleRight className="w-5 h-5 text-[#00ff88]" />
        ) : (
          <ToggleLeft className="w-5 h-5 text-[#333]" />
        )}
      </button>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Add Item Input                                                     */
/* ------------------------------------------------------------------ */

function AddItemInput({ placeholder, onAdd }: { placeholder: string; onAdd: (val: string) => void }) {
  const [value, setValue] = useState('')

  const handleAdd = () => {
    const trimmed = value.trim()
    if (!trimmed) return
    onAdd(trimmed)
    setValue('')
  }

  return (
    <div className="flex gap-2">
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
        placeholder={placeholder}
        className="flex-1 bg-[#111] border border-[#1a1a1a] rounded px-3 py-2 text-[13px] font-mono text-[#ccc] placeholder:text-[#333] outline-none focus:border-[#00ff88]/30"
      />
      <button
        onClick={handleAdd}
        disabled={!value.trim()}
        className="flex items-center gap-1 px-3 py-2 text-[11px] font-mono text-[#888] border border-dashed border-[#333] rounded hover:text-[#00ff88] hover:border-[#00ff88]/30 disabled:opacity-30 transition-colors"
      >
        <Plus className="w-3.5 h-3.5" /> ADD
      </button>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Persona Preview / Test                                             */
/* ------------------------------------------------------------------ */

function PersonaPreview({ persona }: { persona: PersonaState }) {
  const [testInput, setTestInput] = useState('')
  const [testOutput, setTestOutput] = useState<string[] | null>(null)
  const [testing, setTesting] = useState(false)
  const [recentMessages, setRecentMessages] = useState<{ content: string; created_at: string }[]>([])
  const [loadingRecent, setLoadingRecent] = useState(false)

  const loadRecentAIMessages = async () => {
    setLoadingRecent(true)
    try {
      const res = await fetch('/api/persona/preview')
      if (res.ok) {
        const data = await res.json()
        setRecentMessages(data.messages || [])
      }
    } catch {
      // ignore
    } finally {
      setLoadingRecent(false)
    }
  }

  const runTest = async () => {
    if (!testInput) return
    setTesting(true)
    try {
      const res = await fetch('/api/persona/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: testInput, persona }),
      })
      if (res.ok) {
        const data = await res.json()
        setTestOutput(data.responses || [])
      }
    } catch {
      setTestOutput(['Error generating preview'])
    } finally {
      setTesting(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* Persona summary */}
      <div className="bg-[#111] rounded-lg p-3 border border-[#1a1a1a]">
        <span className="text-[11px] font-mono text-[#555] uppercase block mb-2">Active Persona Summary</span>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs font-mono">
          <span className="text-[#666]">Tone:</span>
          <span className="text-[#00ff88]">{persona.language_rules.tone}</span>
          <span className="text-[#666]">Language:</span>
          <span className="text-[#ccc]">{persona.language_rules.primary_language || 'Not set'}</span>
          <span className="text-[#666]">Max sentences/bubble:</span>
          <span className="text-[#ccc]">{persona.style_rules.max_sentences_per_bubble}</span>
          <span className="text-[#666]">Active rules:</span>
          <span className="text-[#ccc]">
            {WRITING_RULES.filter((r) => persona.style_rules[r.key] === true).length + persona.style_rules.custom_rules.length}
          </span>
          <span className="text-[#666]">Prohibited phrases:</span>
          <span className="text-[#f05050]">{persona.style_rules.prohibited_phrases.length}</span>
          <span className="text-[#666]">Signature phrases:</span>
          <span className="text-[#00ff88]">{persona.style_rules.signature_phrases.length}</span>
          <span className="text-[#666]">Vibe matching:</span>
          <span className="text-[#ccc]">
            {VIBE_SETTINGS.filter((v) => persona.style_rules[v.key] === true).length}/{VIBE_SETTINGS.length}
          </span>
        </div>
      </div>

      {/* Test persona */}
      <div>
        <div className="flex items-center gap-1.5 mb-2">
          <Zap className="w-4 h-4 text-[#00ff88]" />
          <span className="text-xs font-mono text-[#00ff88] uppercase tracking-wider">Test Persona</span>
        </div>
        <p className="text-[11px] font-mono text-[#555] mb-2">
          Enter a sample lead message to see how the AI would respond with current persona settings.
        </p>
        <div className="flex gap-2 mb-3">
          <input
            value={testInput}
            onChange={(e) => { setTestInput(e.target.value); setTestOutput(null) }}
            onKeyDown={(e) => e.key === 'Enter' && runTest()}
            placeholder='e.g., "how much is your coaching program?"'
            className="flex-1 bg-[#111] border border-[#1a1a1a] rounded px-3 py-2 text-[13px] font-mono text-[#ccc] placeholder:text-[#333] outline-none focus:border-[#00ff88]/30"
          />
          <button
            onClick={runTest}
            disabled={testing || !testInput}
            className="px-3 py-1.5 text-xs font-mono text-[#888] border border-[#222] rounded hover:text-[#00ff88] hover:border-[#00ff88]/30 disabled:opacity-50 transition-colors"
          >
            {testing ? <Loader2 className="w-4 h-4 animate-spin" /> : 'TEST'}
          </button>
        </div>

        {testOutput && (
          <div className="space-y-1.5">
            <span className="text-[11px] font-mono text-[#555] uppercase">AI would respond:</span>
            {testOutput.map((msg, i) => (
              <div key={i} className="flex justify-end">
                <div className="bg-[#00ff88]/5 border border-[#00ff88]/10 rounded-lg px-3 py-2 max-w-[80%]">
                  <span className="text-[13px] font-mono text-[#ccc]">{msg}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Recent AI messages */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5">
            <MessageSquare className="w-4 h-4 text-[#555]" />
            <span className="text-xs font-mono text-[#666] uppercase tracking-wider">Recent AI Messages</span>
          </div>
          <button
            onClick={loadRecentAIMessages}
            disabled={loadingRecent}
            className="text-[11px] font-mono text-[#555] hover:text-[#00ff88] transition-colors"
          >
            {loadingRecent ? <Loader2 className="w-4 h-4 animate-spin inline" /> : 'Load latest →'}
          </button>
        </div>
        {recentMessages.length > 0 ? (
          <div className="space-y-1.5">
            {recentMessages.map((msg, i) => (
              <div key={i} className="flex justify-end">
                <div className="bg-[#111] border border-[#1a1a1a] rounded-lg px-3 py-2 max-w-[80%]">
                  <span className="text-[13px] font-mono text-[#888]">{msg.content}</span>
                  <span className="text-[10px] font-mono text-[#333] block mt-0.5 text-right">
                    {new Date(msg.created_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs font-mono text-[#444]">
            Click &quot;Load latest&quot; to see recent AI-generated messages with current persona.
          </p>
        )}
      </div>
    </div>
  )
}
