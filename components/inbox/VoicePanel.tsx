'use client'

import { useState } from 'react'
import { Mic, Play, Square, Send, Loader2, X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface VoicePanelProps {
  open: boolean
  onClose: () => void
  onSend: (text: string, voiceUrl: string) => void
}

export function VoicePanel({ open, onClose, onSend }: VoicePanelProps) {
  const [text, setText] = useState('')
  const [generating, setGenerating] = useState(false)
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const [playing, setPlaying] = useState(false)

  if (!open) return null

  const generate = async () => {
    if (!text.trim()) return
    setGenerating(true)
    try {
      const res = await fetch('/api/voice/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      })
      if (res.ok) {
        const data = await res.json()
        setAudioUrl(data.url)
      }
    } finally {
      setGenerating(false)
    }
  }

  const playAudio = () => {
    if (!audioUrl) return
    const audio = new Audio(audioUrl)
    setPlaying(true)
    audio.onended = () => setPlaying(false)
    audio.play()
  }

  const handleSend = () => {
    if (audioUrl && text) {
      onSend(text, audioUrl)
      setText('')
      setAudioUrl(null)
      onClose()
    }
  }

  return (
    <div className="absolute bottom-full left-0 right-0 bg-[#0a0a0a] border border-[#1a1a1a] rounded-t-lg shadow-2xl z-50">
      <div className="flex items-center justify-between px-3 py-2 border-b border-[#1a1a1a]">
        <div className="flex items-center gap-1.5">
          <Mic className="w-4 h-4 text-[#00ff88]" />
          <span className="text-xs font-mono text-[#00ff88] uppercase tracking-wider">Voice Message</span>
        </div>
        <button onClick={onClose} className="text-[#444] hover:text-[#888]">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="p-3 space-y-3">
        {/* Text input */}
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Type what you want to say..."
          rows={2}
          className="w-full bg-[#111] border border-[#1a1a1a] rounded px-3 py-2 text-xs font-mono text-[#ccc] placeholder:text-[#333] outline-none resize-none focus:border-[#00ff88]/30"
        />

        {/* Audio preview */}
        {audioUrl && (
          <div className="flex items-center gap-2 p-2 bg-[#111] rounded border border-[#1a1a1a]">
            <button
              onClick={playAudio}
              className="w-7 h-7 flex items-center justify-center bg-[#00ff88]/10 rounded-full text-[#00ff88]"
            >
              {playing ? <Square className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            </button>
            <div className="flex-1 flex gap-0.5 items-center h-4">
              {Array.from({ length: 30 }).map((_, i) => (
                <div
                  key={i}
                  className={cn(
                    'w-0.5 rounded-full transition-colors',
                    playing ? 'bg-[#00ff88]' : 'bg-[#00ff88]/40'
                  )}
                  style={{ height: `${Math.random() * 12 + 4}px` }}
                />
              ))}
            </div>
            <span className="text-[11px] font-mono text-[#555]">READY</span>
          </div>
        )}

        {/* Buttons */}
        <div className="flex gap-2">
          <button
            onClick={generate}
            disabled={!text.trim() || generating}
            className="flex-1 flex items-center justify-center gap-1.5 py-1.5 bg-[#111] border border-[#222] rounded text-[13px] font-mono text-[#888] hover:text-[#00ff88] hover:border-[#00ff88]/30 transition-colors disabled:opacity-50"
          >
            {generating ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Mic className="w-4 h-4" />
            )}
            {generating ? 'GENERATING...' : 'GENERATE'}
          </button>
          {audioUrl && (
            <button
              onClick={handleSend}
              className="flex items-center gap-1.5 px-4 py-1.5 bg-[#00ff88]/10 border border-[#00ff88]/30 rounded text-[13px] font-mono text-[#00ff88] hover:bg-[#00ff88]/20 transition-colors"
            >
              <Send className="w-4 h-4" />
              SEND
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
