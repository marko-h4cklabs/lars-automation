import axios from 'axios'
import OpenAI from 'openai'

let _openai: OpenAI | null = null
function getOpenAI() {
  if (!_openai) {
    _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! })
  }
  return _openai
}

// ElevenLabs TTS
export async function generateVoice(
  text: string,
  voiceId?: string
): Promise<Buffer> {
  const id = voiceId || process.env.ELEVENLABS_VOICE_ID!
  const response = await axios.post(
    `https://api.elevenlabs.io/v1/text-to-speech/${id}`,
    {
      text,
      model_id: 'eleven_monolingual_v1',
      voice_settings: {
        stability: 0.5,
        similarity_boost: 0.75,
      },
    },
    {
      headers: {
        'xi-api-key': process.env.ELEVENLABS_API_KEY!,
        'Content-Type': 'application/json',
      },
      responseType: 'arraybuffer',
    }
  )
  return Buffer.from(response.data)
}

// OpenAI Whisper transcription
export async function transcribeVoice(audioUrl: string): Promise<string> {
  // Download audio from URL
  const audioResponse = await axios.get(audioUrl, {
    responseType: 'arraybuffer',
  })
  const audioBuffer = Buffer.from(audioResponse.data)

  // Create a File-like object for Whisper API
  const file = new File([audioBuffer], 'audio.ogg', { type: 'audio/ogg' })

  const transcription = await getOpenAI().audio.transcriptions.create({
    model: 'whisper-1',
    file,
  })

  return transcription.text
}
