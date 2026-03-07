import axios from 'axios'
import OpenAI from 'openai'
import { createAdminClient } from '@/lib/supabase'

let _openai: OpenAI | null = null
function getOpenAI() {
  if (!_openai) {
    _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! })
  }
  return _openai
}

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface VoiceSettings {
  voice_id?: string
  model_id?: string
  stability?: number
  similarity_boost?: number
  style?: number
  use_speaker_boost?: boolean
  language_hint?: string
}

export interface VoiceResult {
  audioUrl: string
  durationMs: number
}

const DEFAULT_SETTINGS: Required<VoiceSettings> = {
  voice_id: process.env.ELEVENLABS_VOICE_ID || '',
  model_id: 'eleven_multilingual_v2',
  stability: 0.5,
  similarity_boost: 0.75,
  style: 0,
  use_speaker_boost: true,
  language_hint: 'en',
}

/* ------------------------------------------------------------------ */
/*  ElevenLabs TTS — generate + store in Supabase Storage              */
/* ------------------------------------------------------------------ */

export async function generateVoice(
  text: string,
  settings?: VoiceSettings
): Promise<VoiceResult> {
  const s = { ...DEFAULT_SETTINGS, ...settings }
  const voiceId = s.voice_id || process.env.ELEVENLABS_VOICE_ID!

  // Call ElevenLabs with retry on rate limit
  let audioBuffer: Buffer | null = null
  let attempts = 0
  const maxAttempts = 3

  while (!audioBuffer && attempts < maxAttempts) {
    attempts++
    try {
      const response = await axios.post(
        `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
        {
          text,
          model_id: s.model_id,
          voice_settings: {
            stability: s.stability,
            similarity_boost: s.similarity_boost,
            style: s.style,
            use_speaker_boost: s.use_speaker_boost,
          },
          ...(s.language_hint ? { language_code: s.language_hint } : {}),
        },
        {
          headers: {
            'xi-api-key': process.env.ELEVENLABS_API_KEY!,
            'Content-Type': 'application/json',
            Accept: 'audio/mpeg',
          },
          responseType: 'arraybuffer',
        }
      )
      audioBuffer = Buffer.from(response.data)
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.status === 429 && attempts < maxAttempts) {
        // Rate limited — wait and retry
        const retryAfter = parseInt(err.response.headers['retry-after'] || '5', 10)
        await new Promise((r) => setTimeout(r, retryAfter * 1000))
      } else {
        throw err
      }
    }
  }

  if (!audioBuffer) throw new Error('Voice generation failed after retries')

  // Estimate duration: MP3 at ~128kbps ≈ 16KB per second
  const estimatedDurationMs = Math.round((audioBuffer.length / 16000) * 1000)

  // Store in Supabase Storage
  const supabase = createAdminClient()
  const filename = `voice-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.mp3`
  const path = `voice-messages/${filename}`

  const { error: uploadError } = await supabase.storage
    .from('media')
    .upload(path, audioBuffer, {
      contentType: 'audio/mpeg',
      upsert: false,
    })

  if (uploadError) {
    console.error('Storage upload error:', uploadError.message)
    throw new Error(`Failed to upload voice file: ${uploadError.message}`)
  }

  const { data: urlData } = supabase.storage.from('media').getPublicUrl(path)

  return {
    audioUrl: urlData.publicUrl,
    durationMs: estimatedDurationMs,
  }
}

/* ------------------------------------------------------------------ */
/*  OpenAI Whisper transcription                                       */
/* ------------------------------------------------------------------ */

export async function transcribeVoice(audioUrl: string): Promise<string> {
  const audioResponse = await axios.get(audioUrl, { responseType: 'arraybuffer' })
  const audioBuffer = Buffer.from(audioResponse.data)
  const file = new File([audioBuffer], 'audio.ogg', { type: 'audio/ogg' })

  const transcription = await getOpenAI().audio.transcriptions.create({
    model: 'whisper-1',
    file,
  })

  return transcription.text
}

/* ------------------------------------------------------------------ */
/*  Load voice settings from Supabase                                  */
/* ------------------------------------------------------------------ */

export async function getVoiceSettings(): Promise<VoiceSettings> {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('app_settings')
    .select('value')
    .eq('key', 'voice_settings')
    .single()

  if (data?.value) {
    return { ...DEFAULT_SETTINGS, ...(data.value as VoiceSettings) }
  }
  return DEFAULT_SETTINGS
}
