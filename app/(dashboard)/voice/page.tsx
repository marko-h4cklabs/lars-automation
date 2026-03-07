'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import {
  Save, Loader2, Mic, Play, Square, Download, Copy, Check,
  Plus, X, Trash2, RefreshCw, Volume2, ChevronDown, ChevronRight,
  ToggleLeft, ToggleRight, CheckCircle2, AlertCircle, Pencil,
} from 'lucide-react'
import { cn } from '@/lib/utils'

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface VoiceProfile {
  voice_id: string
  voice_name: string
  model_id: string
  stability: number
  similarity_boost: number
  style: number
  use_speaker_boost: boolean
  language_hint: string
}

interface AutoVoiceSettings {
  mode: string
  match_threshold_seconds: number
  max_length_seconds: number
  prefix_silence_ms: number
}

interface VoiceTemplate {
  id: string
  name: string
  script: string
  category: string
  created_at: string
}

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const TEMPLATE_CATEGORIES: { value: string; label: string }[] = [
  { value: 'opener', label: 'Opener' },
  { value: 'qualifying', label: 'Qualifying' },
  { value: 'booking', label: 'Booking' },
  { value: 'follow_up', label: 'Follow-up' },
]

const CAT_COLORS: Record<string, string> = {
  opener: 'text-[#54a0ff] bg-[#54a0ff]/10 border-[#54a0ff]/30',
  qualifying: 'text-[#ff9f43] bg-[#ff9f43]/10 border-[#ff9f43]/30',
  booking: 'text-[#00ff88] bg-[#00ff88]/10 border-[#00ff88]/30',
  follow_up: 'text-[#5f27cd] bg-[#5f27cd]/10 border-[#5f27cd]/30',
}

/* ------------------------------------------------------------------ */
/*  Main Page                                                          */
/* ------------------------------------------------------------------ */

export default function VoicePage() {
  const [profile, setProfile] = useState<VoiceProfile>({
    voice_id: '', voice_name: 'Lars — Official', model_id: 'eleven_multilingual_v2',
    stability: 50, similarity_boost: 75, style: 0, use_speaker_boost: true, language_hint: 'en',
  })
  const [autoSettings, setAutoSettings] = useState<AutoVoiceSettings>({
    mode: 'match', match_threshold_seconds: 30, max_length_seconds: 30, prefix_silence_ms: 300,
  })
  const [templates, setTemplates] = useState<VoiceTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [savingProfile, setSavingProfile] = useState(false)
  const [savingAuto, setSavingAuto] = useState(false)
  const [openSections, setOpenSections] = useState<Set<string>>(
    new Set(['profile', 'generator', 'templates', 'auto'])
  )

  const fetchSettings = useCallback(async () => {
    try {
      const [settingsRes, templatesRes] = await Promise.all([
        fetch('/api/voice/settings'),
        fetch('/api/voice/templates'),
      ])
      if (settingsRes.ok) {
        const data = await settingsRes.json()
        setProfile(data.voice)
        setAutoSettings(data.auto)
      }
      if (templatesRes.ok) {
        const data = await templatesRes.json()
        setTemplates(data.templates || [])
      }
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchSettings() }, [fetchSettings])

  const saveProfile = async () => {
    setSavingProfile(true)
    try {
      await fetch('/api/voice/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ section: 'voice', ...profile }),
      })
    } finally {
      setSavingProfile(false)
    }
  }

  const saveAuto = async () => {
    setSavingAuto(true)
    try {
      await fetch('/api/voice/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ section: 'auto', ...autoSettings }),
      })
    } finally {
      setSavingAuto(false)
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

  if (loading) return <div className="p-8 text-[#444] font-mono text-xs">Loading...</div>

  return (
    <div className="h-[calc(100vh-48px)] overflow-y-auto">
      <div className="p-6 max-w-3xl">
        <h1 className="text-sm font-mono font-bold text-[#f0f0f0] mb-1">Voice System</h1>
        <p className="text-[10px] font-mono text-[#555] mb-6">Configure voice generation, templates, and auto-response behavior.</p>

        {/* ── SECTION 1: Voice Profile ── */}
        <Section
          title="Voice Profile Setup"
          subtitle={profile.voice_id ? 'Configured' : 'Not configured'}
          sectionKey="profile"
          open={openSections.has('profile')}
          onToggle={toggleSection}
          statusColor={profile.voice_id ? '#00ff88' : '#f05050'}
        >
          <VoiceProfileSection
            profile={profile}
            onChange={setProfile}
            onSave={saveProfile}
            saving={savingProfile}
          />
        </Section>

        {/* ── SECTION 2: Voice Generator ── */}
        <Section
          title="Voice Generator"
          subtitle="Generate voice messages for DMs"
          sectionKey="generator"
          open={openSections.has('generator')}
          onToggle={toggleSection}
        >
          <VoiceGenerator templates={templates} />
        </Section>

        {/* ── SECTION 3: Voice Templates ── */}
        <Section
          title="Voice Templates"
          subtitle={`${templates.length} saved`}
          sectionKey="templates"
          open={openSections.has('templates')}
          onToggle={toggleSection}
        >
          <VoiceTemplatesSection
            templates={templates}
            onChange={setTemplates}
          />
        </Section>

        {/* ── SECTION 4: Auto-Voice Settings ── */}
        <Section
          title="Auto-Voice Settings"
          subtitle={`Mode: ${autoSettings.mode}`}
          sectionKey="auto"
          open={openSections.has('auto')}
          onToggle={toggleSection}
        >
          <AutoVoiceSection
            settings={autoSettings}
            onChange={setAutoSettings}
            onSave={saveAuto}
            saving={savingAuto}
          />
        </Section>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Section wrapper                                                    */
/* ------------------------------------------------------------------ */

function Section({
  title, subtitle, sectionKey, open, onToggle, statusColor, children,
}: {
  title: string; subtitle: string; sectionKey: string; open: boolean
  onToggle: (k: string) => void; statusColor?: string; children: React.ReactNode
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
            <span className="text-[11px] font-mono font-bold text-[#f0f0f0] block">{title}</span>
            <div className="flex items-center gap-1.5">
              {statusColor && (
                <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: statusColor }} />
              )}
              <span className="text-[8px] font-mono text-[#555]">{subtitle}</span>
            </div>
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
/*  Voice Profile Section                                              */
/* ------------------------------------------------------------------ */

function VoiceProfileSection({
  profile, onChange, onSave, saving,
}: {
  profile: VoiceProfile; onChange: (p: VoiceProfile) => void
  onSave: () => void; saving: boolean
}) {
  const [testText, setTestText] = useState('Hey, glad you reached out! Let me know what your main fitness goal is right now.')
  const [testing, setTesting] = useState(false)
  const [testUrl, setTestUrl] = useState<string | null>(null)
  const [playing, setPlaying] = useState(false)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  const testVoice = async () => {
    if (!testText) return
    setTesting(true)
    setTestUrl(null)
    try {
      const res = await fetch('/api/voice/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: testText, settings: profile }),
      })
      if (res.ok) {
        const data = await res.json()
        setTestUrl(data.audioUrl)
      }
    } finally {
      setTesting(false)
    }
  }

  const playTest = () => {
    if (!testUrl) return
    if (audioRef.current) { audioRef.current.pause() }
    const audio = new Audio(testUrl)
    audioRef.current = audio
    setPlaying(true)
    audio.onended = () => setPlaying(false)
    audio.play()
  }

  const set = (key: string, val: unknown) => onChange({ ...profile, [key]: val })

  return (
    <div className="space-y-4">
      {/* Status */}
      <div className={cn(
        'flex items-center gap-2 p-2.5 rounded-lg border',
        profile.voice_id ? 'bg-[#00ff88]/5 border-[#00ff88]/20' : 'bg-[#f05050]/5 border-[#f05050]/20'
      )}>
        {profile.voice_id ? <CheckCircle2 className="w-3.5 h-3.5 text-[#00ff88]" /> : <AlertCircle className="w-3.5 h-3.5 text-[#f05050]" />}
        <span className={cn('text-[10px] font-mono', profile.voice_id ? 'text-[#00ff88]' : 'text-[#f05050]')}>
          {profile.voice_id ? 'Voice model configured' : 'Voice model not configured — enter your ElevenLabs Voice ID'}
        </span>
      </div>

      {/* Voice ID + Name */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-[8px] font-mono text-[#555] uppercase block mb-1">ElevenLabs Voice ID</label>
          <input
            value={profile.voice_id}
            onChange={(e) => set('voice_id', e.target.value)}
            placeholder="Enter Voice ID from ElevenLabs"
            className="w-full bg-[#111] border border-[#1a1a1a] rounded px-2.5 py-1.5 text-[10px] font-mono text-[#ccc] placeholder:text-[#333] outline-none focus:border-[#00ff88]/30"
          />
        </div>
        <div>
          <label className="text-[8px] font-mono text-[#555] uppercase block mb-1">Voice Name</label>
          <input
            value={profile.voice_name}
            onChange={(e) => set('voice_name', e.target.value)}
            className="w-full bg-[#111] border border-[#1a1a1a] rounded px-2.5 py-1.5 text-[10px] font-mono text-[#ccc] outline-none focus:border-[#00ff88]/30"
          />
        </div>
      </div>

      {/* Settings sliders */}
      <div className="grid grid-cols-2 gap-4">
        <SliderField label="Stability" value={profile.stability} onChange={(v) => set('stability', v)}
          desc="Lower = more expressive, higher = more consistent" />
        <SliderField label="Similarity Boost" value={profile.similarity_boost} onChange={(v) => set('similarity_boost', v)}
          desc="How closely to match the original voice" />
        <SliderField label="Style Exaggeration" value={profile.style} onChange={(v) => set('style', v)}
          desc="Amplifies style of the original voice" />
        <div>
          <label className="text-[8px] font-mono text-[#555] uppercase block mb-1">Speaker Boost</label>
          <button
            onClick={() => set('use_speaker_boost', !profile.use_speaker_boost)}
            className="flex items-center gap-2"
          >
            {profile.use_speaker_boost ? <ToggleRight className="w-5 h-5 text-[#00ff88]" /> : <ToggleLeft className="w-5 h-5 text-[#333]" />}
            <span className="text-[9px] font-mono text-[#888]">{profile.use_speaker_boost ? 'ON' : 'OFF'}</span>
          </button>
          <span className="text-[8px] font-mono text-[#444]">Enhances voice clarity</span>
        </div>
      </div>

      {/* Model + Language */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-[8px] font-mono text-[#555] uppercase block mb-1">Model</label>
          <select
            value={profile.model_id}
            onChange={(e) => set('model_id', e.target.value)}
            className="w-full bg-[#111] border border-[#1a1a1a] rounded px-2.5 py-1.5 text-[10px] font-mono text-[#ccc] outline-none"
          >
            <option value="eleven_multilingual_v2">Multilingual v2 (recommended)</option>
            <option value="eleven_monolingual_v1">Monolingual v1</option>
            <option value="eleven_turbo_v2_5">Turbo v2.5 (fastest)</option>
          </select>
        </div>
        <div>
          <label className="text-[8px] font-mono text-[#555] uppercase block mb-1">Language Hint</label>
          <input
            value={profile.language_hint}
            onChange={(e) => set('language_hint', e.target.value)}
            placeholder="en"
            className="w-full bg-[#111] border border-[#1a1a1a] rounded px-2.5 py-1.5 text-[10px] font-mono text-[#ccc] outline-none focus:border-[#00ff88]/30"
          />
          <span className="text-[8px] font-mono text-[#444]">Norwegian-English: use &quot;en&quot;</span>
        </div>
      </div>

      {/* Test Voice */}
      <div className="bg-[#0d0d0d] rounded-lg border border-[#1a1a1a] p-3 space-y-2">
        <span className="text-[9px] font-mono text-[#00ff88] uppercase tracking-wider">Test Voice</span>
        <textarea
          value={testText}
          onChange={(e) => setTestText(e.target.value)}
          rows={2}
          className="w-full bg-[#111] border border-[#1a1a1a] rounded px-2.5 py-1.5 text-[10px] font-mono text-[#ccc] outline-none resize-none focus:border-[#00ff88]/30"
        />
        <div className="flex items-center gap-2">
          <button
            onClick={testVoice}
            disabled={testing || !testText || !profile.voice_id}
            className="flex items-center gap-1.5 px-3 py-1.5 text-[9px] font-mono text-[#888] border border-[#222] rounded hover:text-[#00ff88] hover:border-[#00ff88]/30 disabled:opacity-50 transition-colors"
          >
            {testing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Volume2 className="w-3 h-3" />}
            {testing ? 'GENERATING...' : 'GENERATE & PLAY'}
          </button>
          {testUrl && (
            <button
              onClick={playTest}
              className="flex items-center gap-1 px-2 py-1.5 text-[9px] font-mono text-[#00ff88] border border-[#00ff88]/30 rounded hover:bg-[#00ff88]/10 transition-colors"
            >
              {playing ? <Square className="w-3 h-3" /> : <Play className="w-3 h-3" />}
              {playing ? 'PLAYING' : 'REPLAY'}
            </button>
          )}
        </div>
      </div>

      {/* Save */}
      <button
        onClick={onSave}
        disabled={saving}
        className="flex items-center gap-2 px-4 py-2 bg-[#00ff88]/10 border border-[#00ff88]/30 rounded text-[10px] font-mono text-[#00ff88] hover:bg-[#00ff88]/20 disabled:opacity-50 transition-colors"
      >
        {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />} SAVE VOICE PROFILE
      </button>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Voice Generator                                                    */
/* ------------------------------------------------------------------ */

function VoiceGenerator({ templates }: { templates: VoiceTemplate[] }) {
  const [script, setScript] = useState('')
  const [generating, setGenerating] = useState(false)
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const [durationMs, setDurationMs] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [copied, setCopied] = useState(false)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  const generate = async () => {
    if (!script.trim()) return
    setGenerating(true)
    setAudioUrl(null)
    try {
      const res = await fetch('/api/voice/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: script }),
      })
      if (res.ok) {
        const data = await res.json()
        setAudioUrl(data.audioUrl)
        setDurationMs(data.durationMs || 0)
      }
    } finally {
      setGenerating(false)
    }
  }

  const playAudio = () => {
    if (!audioUrl) return
    if (audioRef.current) { audioRef.current.pause() }
    const audio = new Audio(audioUrl)
    audioRef.current = audio
    setPlaying(true)
    audio.onended = () => setPlaying(false)
    audio.play()
  }

  const stopAudio = () => {
    if (audioRef.current) { audioRef.current.pause(); setPlaying(false) }
  }

  const copyUrl = () => {
    if (!audioUrl) return
    navigator.clipboard.writeText(audioUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const loadTemplate = (t: VoiceTemplate) => {
    setScript(t.script)
    setAudioUrl(null)
  }

  return (
    <div className="space-y-4">
      {/* Quick-load templates */}
      {templates.length > 0 && (
        <div>
          <span className="text-[8px] font-mono text-[#555] uppercase block mb-1.5">Quick Load Template</span>
          <div className="flex gap-1.5 flex-wrap">
            {templates.slice(0, 6).map((t) => (
              <button
                key={t.id}
                onClick={() => loadTemplate(t)}
                className="px-2 py-0.5 text-[8px] font-mono text-[#888] bg-[#111] border border-[#1a1a1a] rounded hover:text-[#00ff88] hover:border-[#00ff88]/30 transition-colors"
              >
                {t.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Script input */}
      <div>
        <label className="text-[8px] font-mono text-[#555] uppercase block mb-1">Script</label>
        <textarea
          value={script}
          onChange={(e) => { setScript(e.target.value); setAudioUrl(null) }}
          rows={4}
          placeholder="Type what you want to say in the voice message..."
          className="w-full bg-[#111] border border-[#1a1a1a] rounded-lg px-3 py-2.5 text-[10px] font-mono text-[#ccc] placeholder:text-[#333] outline-none resize-none focus:border-[#00ff88]/30"
        />
        <div className="flex justify-between mt-1">
          <span className="text-[8px] font-mono text-[#444]">
            Variables: {'{lead_name}'}, {'{goal_mention}'}
          </span>
          <span className={cn('text-[8px] font-mono', script.length > 500 ? 'text-[#ff9f43]' : 'text-[#444]')}>
            {script.length}/500 recommended
          </span>
        </div>
      </div>

      {/* Generate + Audio */}
      <div className="flex items-center gap-2">
        <button
          onClick={generate}
          disabled={generating || !script.trim()}
          className="flex items-center gap-1.5 px-4 py-2 bg-[#00ff88]/10 border border-[#00ff88]/30 rounded text-[10px] font-mono text-[#00ff88] hover:bg-[#00ff88]/20 disabled:opacity-50 transition-colors"
        >
          {generating ? <Loader2 className="w-3 h-3 animate-spin" /> : <Mic className="w-3 h-3" />}
          {generating ? 'GENERATING...' : 'GENERATE VOICE'}
        </button>
        {audioUrl && (
          <button
            onClick={generate}
            className="flex items-center gap-1 px-2.5 py-2 text-[9px] font-mono text-[#888] border border-[#222] rounded hover:text-[#ccc] transition-colors"
          >
            <RefreshCw className="w-3 h-3" /> REGENERATE
          </button>
        )}
      </div>

      {/* Loading waveform animation */}
      {generating && (
        <div className="flex items-center gap-0.5 h-8 px-4">
          {Array.from({ length: 40 }).map((_, i) => (
            <div
              key={i}
              className="w-0.5 bg-[#00ff88]/60 rounded-full animate-pulse"
              style={{
                height: `${Math.random() * 20 + 4}px`,
                animationDelay: `${i * 50}ms`,
              }}
            />
          ))}
        </div>
      )}

      {/* Audio player */}
      {audioUrl && !generating && (
        <div className="bg-[#0d0d0d] rounded-lg border border-[#1a1a1a] p-3 space-y-3">
          <div className="flex items-center gap-3">
            <button
              onClick={playing ? stopAudio : playAudio}
              className="w-9 h-9 flex items-center justify-center bg-[#00ff88]/10 rounded-full text-[#00ff88] hover:bg-[#00ff88]/20 transition-colors"
            >
              {playing ? <Square className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            </button>
            {/* Waveform */}
            <div className="flex-1 flex items-center gap-0.5 h-6">
              {Array.from({ length: 50 }).map((_, i) => (
                <div
                  key={i}
                  className={cn('w-0.5 rounded-full transition-colors',
                    playing ? 'bg-[#00ff88]' : 'bg-[#00ff88]/30'
                  )}
                  style={{ height: `${Math.sin(i * 0.3) * 8 + 10}px` }}
                />
              ))}
            </div>
            <span className="text-[9px] font-mono text-[#666] shrink-0">
              {durationMs > 0 ? `${(durationMs / 1000).toFixed(1)}s` : '--'}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <a
              href={audioUrl}
              download="voice-message.mp3"
              className="flex items-center gap-1 px-2 py-1 text-[8px] font-mono text-[#888] border border-[#222] rounded hover:text-[#ccc] transition-colors"
            >
              <Download className="w-2.5 h-2.5" /> DOWNLOAD
            </a>
            <button
              onClick={copyUrl}
              className="flex items-center gap-1 px-2 py-1 text-[8px] font-mono text-[#888] border border-[#222] rounded hover:text-[#ccc] transition-colors"
            >
              {copied ? <Check className="w-2.5 h-2.5 text-[#00ff88]" /> : <Copy className="w-2.5 h-2.5" />}
              {copied ? 'COPIED' : 'COPY URL'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Voice Templates Section                                            */
/* ------------------------------------------------------------------ */

function VoiceTemplatesSection({
  templates, onChange,
}: {
  templates: VoiceTemplate[]; onChange: (t: VoiceTemplate[]) => void
}) {
  const [editing, setEditing] = useState<VoiceTemplate | null>(null)
  const [saving, setSaving] = useState(false)
  const [filter, setFilter] = useState('all')

  const filtered = filter === 'all' ? templates : templates.filter((t) => t.category === filter)

  const saveTemplate = async (t: VoiceTemplate) => {
    setSaving(true)
    try {
      const res = await fetch('/api/voice/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(t),
      })
      if (res.ok) {
        const data = await res.json()
        onChange(data.templates)
        setEditing(null)
      }
    } finally {
      setSaving(false)
    }
  }

  const deleteTemplate = async (id: string) => {
    if (!confirm('Delete this template?')) return
    await fetch(`/api/voice/templates?id=${id}`, { method: 'DELETE' })
    onChange(templates.filter((t) => t.id !== id))
  }

  return (
    <div className="space-y-3">
      {/* Category filter */}
      <div className="flex gap-1.5">
        <button
          onClick={() => setFilter('all')}
          className={cn('px-2 py-0.5 rounded text-[7px] font-mono uppercase border transition-colors',
            filter === 'all' ? 'text-[#00ff88] bg-[#00ff88]/10 border-[#00ff88]/30' : 'text-[#555] border-[#1a1a1a]'
          )}
        >
          ALL
        </button>
        {TEMPLATE_CATEGORIES.map((c) => (
          <button
            key={c.value}
            onClick={() => setFilter(c.value)}
            className={cn('px-2 py-0.5 rounded text-[7px] font-mono uppercase border transition-colors',
              filter === c.value ? 'text-[#00ff88] bg-[#00ff88]/10 border-[#00ff88]/30' : 'text-[#555] border-[#1a1a1a]'
            )}
          >
            {c.label}
          </button>
        ))}
      </div>

      {/* Template list */}
      <div className="space-y-1.5">
        {filtered.map((t) => (
          <div key={t.id} className="flex items-start gap-2 p-2.5 bg-[#0d0d0d] rounded-lg border border-[#1a1a1a]">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[10px] font-mono font-bold text-[#ccc]">{t.name}</span>
                <span className={cn('text-[7px] font-mono uppercase px-1 py-0.5 rounded border', CAT_COLORS[t.category] || CAT_COLORS.opener)}>
                  {t.category}
                </span>
              </div>
              <p className="text-[9px] font-mono text-[#666] truncate">{t.script}</p>
            </div>
            <div className="flex gap-1 shrink-0">
              <button
                onClick={() => setEditing(t)}
                className="p-1 text-[#555] hover:text-[#ccc]"
              >
                <Pencil className="w-3 h-3" />
              </button>
              <button
                onClick={() => deleteTemplate(t.id)}
                className="p-1 text-[#555] hover:text-[#f05050]"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <p className="text-[10px] font-mono text-[#444] py-4 text-center">No templates in this category</p>
        )}
      </div>

      {/* Editor */}
      {editing && (
        <TemplateEditor
          template={editing}
          onSave={saveTemplate}
          onCancel={() => setEditing(null)}
          saving={saving}
        />
      )}

      {!editing && (
        <button
          onClick={() => setEditing({ id: '', name: '', script: '', category: 'opener', created_at: '' })}
          className="flex items-center gap-1.5 px-3 py-1.5 text-[9px] font-mono text-[#888] border border-dashed border-[#333] rounded hover:text-[#00ff88] hover:border-[#00ff88]/30 transition-colors"
        >
          <Plus className="w-3 h-3" /> ADD TEMPLATE
        </button>
      )}
    </div>
  )
}

function TemplateEditor({
  template, onSave, onCancel, saving,
}: {
  template: VoiceTemplate; onSave: (t: VoiceTemplate) => void
  onCancel: () => void; saving: boolean
}) {
  const [t, setT] = useState(template)
  return (
    <div className="bg-[#0d0d0d] border border-[#1a1a1a] rounded-lg p-3 space-y-3">
      <div className="flex justify-between items-center">
        <span className="text-[9px] font-mono text-[#00ff88] uppercase">{template.id ? 'Edit' : 'New'} Template</span>
        <button onClick={onCancel} className="text-[#444] hover:text-[#888]"><X className="w-3 h-3" /></button>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div className="col-span-2">
          <label className="text-[8px] font-mono text-[#555] uppercase block mb-1">Name</label>
          <input value={t.name} onChange={(e) => setT({ ...t, name: e.target.value })}
            placeholder="e.g., Warm opener"
            className="w-full bg-[#111] border border-[#1a1a1a] rounded px-2.5 py-1.5 text-[10px] font-mono text-[#ccc] outline-none focus:border-[#00ff88]/30" />
        </div>
        <div>
          <label className="text-[8px] font-mono text-[#555] uppercase block mb-1">Category</label>
          <select value={t.category} onChange={(e) => setT({ ...t, category: e.target.value })}
            className="w-full bg-[#111] border border-[#1a1a1a] rounded px-2.5 py-1.5 text-[10px] font-mono text-[#ccc] outline-none">
            {TEMPLATE_CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>
        </div>
      </div>
      <div>
        <label className="text-[8px] font-mono text-[#555] uppercase block mb-1">Script</label>
        <textarea value={t.script} onChange={(e) => setT({ ...t, script: e.target.value })} rows={3}
          placeholder="Hey {lead_name}! Thanks for reaching out..."
          className="w-full bg-[#111] border border-[#1a1a1a] rounded px-2.5 py-1.5 text-[10px] font-mono text-[#ccc] placeholder:text-[#333] outline-none resize-none focus:border-[#00ff88]/30" />
      </div>
      <div className="flex gap-2">
        <button onClick={() => onSave(t)} disabled={saving || !t.name || !t.script}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-[#00ff88]/10 border border-[#00ff88]/30 rounded text-[9px] font-mono text-[#00ff88] hover:bg-[#00ff88]/20 disabled:opacity-50">
          {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />} SAVE
        </button>
        <button onClick={onCancel} className="px-3 py-1.5 text-[9px] font-mono text-[#666] border border-[#222] rounded hover:text-[#ccc]">CANCEL</button>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Auto-Voice Settings Section                                        */
/* ------------------------------------------------------------------ */

function AutoVoiceSection({
  settings, onChange, onSave, saving,
}: {
  settings: AutoVoiceSettings; onChange: (s: AutoVoiceSettings) => void
  onSave: () => void; saving: boolean
}) {
  const set = (key: string, val: unknown) => onChange({ ...settings, [key]: val })

  const modes: { value: string; label: string; desc: string }[] = [
    { value: 'always', label: 'Always', desc: 'Always respond to voice messages with voice' },
    { value: 'never', label: 'Never', desc: 'Never send auto voice replies' },
    { value: 'match', label: 'Match', desc: "Respond with voice if lead's voice is under threshold" },
  ]

  return (
    <div className="space-y-4">
      <p className="text-[9px] font-mono text-[#555]">
        Configure how the AI responds when a lead sends a voice message.
      </p>

      {/* Mode selector */}
      <div>
        <label className="text-[8px] font-mono text-[#555] uppercase block mb-2">Voice Reply Mode</label>
        <div className="grid grid-cols-3 gap-2">
          {modes.map((m) => (
            <button
              key={m.value}
              onClick={() => set('mode', m.value)}
              className={cn(
                'p-3 rounded-lg border text-left transition-colors',
                settings.mode === m.value
                  ? 'bg-[#00ff88]/5 border-[#00ff88]/30'
                  : 'bg-[#0d0d0d] border-[#1a1a1a] hover:border-[#333]'
              )}
            >
              <span className={cn('text-[10px] font-mono font-bold block mb-0.5',
                settings.mode === m.value ? 'text-[#00ff88]' : 'text-[#888]')}>
                {m.label}
              </span>
              <span className="text-[8px] font-mono text-[#555]">{m.desc}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Match threshold */}
      {settings.mode === 'match' && (
        <SliderField
          label="Match Threshold"
          value={settings.match_threshold_seconds}
          onChange={(v) => set('match_threshold_seconds', v)}
          min={5} max={120}
          desc={`Respond with voice if lead's message is under ${settings.match_threshold_seconds}s`}
          unit="s"
        />
      )}

      {/* Max length */}
      <SliderField
        label="Max Voice Length"
        value={settings.max_length_seconds}
        onChange={(v) => set('max_length_seconds', v)}
        min={5} max={60}
        desc={`AI voice responses capped at ${settings.max_length_seconds} seconds`}
        unit="s"
      />

      {/* Prefix silence */}
      <SliderField
        label="Prefix Silence"
        value={settings.prefix_silence_ms}
        onChange={(v) => set('prefix_silence_ms', v)}
        min={0} max={2000}
        desc={`${settings.prefix_silence_ms}ms pause before voice plays — more natural`}
        unit="ms"
      />

      {/* Save */}
      <button
        onClick={onSave}
        disabled={saving}
        className="flex items-center gap-2 px-4 py-2 bg-[#00ff88]/10 border border-[#00ff88]/30 rounded text-[10px] font-mono text-[#00ff88] hover:bg-[#00ff88]/20 disabled:opacity-50 transition-colors"
      >
        {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />} SAVE AUTO-VOICE SETTINGS
      </button>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Slider field                                                       */
/* ------------------------------------------------------------------ */

function SliderField({
  label, value, onChange, min = 0, max = 100, desc, unit = '%',
}: {
  label: string; value: number; onChange: (v: number) => void
  min?: number; max?: number; desc?: string; unit?: string
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <label className="text-[8px] font-mono text-[#555] uppercase">{label}</label>
        <span className="text-[9px] font-mono text-[#00ff88] font-bold">{value}{unit}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(parseInt(e.target.value))}
        className="w-full accent-[#00ff88] h-1"
      />
      {desc && <span className="text-[8px] font-mono text-[#444]">{desc}</span>}
    </div>
  )
}
