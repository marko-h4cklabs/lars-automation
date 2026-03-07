import { createAdminClient } from '@/lib/supabase'
import { generateVoice, transcribeVoice, getVoiceSettings } from '@/lib/voice'
import { generate } from '@/lib/ai'
import { sendVoiceMessage } from '@/lib/manychat'
import { assembleContext } from '@/lib/workers/contextAssembly'
import type { Message, Conversation, VoiceReplyMode } from '@/types'

/**
 * Handle an incoming voice message from a lead.
 * 1. Transcribe with Whisper
 * 2. Generate text response with Sonnet 4
 * 3. Convert to voice with ElevenLabs
 * 4. Send back via ManyChat
 * 5. Store transcription + voice response in messages
 */
export async function handleIncomingVoice(
  message: Message,
  conversation: Conversation
): Promise<void> {
  const supabase = createAdminClient()

  if (!message.voice_url) {
    console.error('Voice handler: no voice_url on message', message.id)
    return
  }

  // Check auto-voice settings
  const { data: autopilotData } = await supabase
    .from('autopilot_settings')
    .select('voice_reply_on_voice')
    .limit(1)
    .single()

  const voiceReplyMode: VoiceReplyMode = autopilotData?.voice_reply_on_voice || 'contextual'

  // Load voice-specific auto settings
  const { data: voiceAutoData } = await supabase
    .from('app_settings')
    .select('value')
    .eq('key', 'auto_voice_settings')
    .single()

  const autoVoiceSettings = (voiceAutoData?.value || {}) as {
    mode?: string
    match_threshold_seconds?: number
    max_length_seconds?: number
    prefix_silence_ms?: number
  }

  // Determine if we should respond with voice
  const shouldRespondVoice = shouldUseVoiceReply(voiceReplyMode, autoVoiceSettings)
  if (!shouldRespondVoice) return

  // Step 1: Transcribe the incoming voice
  let transcription: string
  try {
    transcription = await transcribeVoice(message.voice_url)
  } catch (err) {
    console.error('Whisper transcription failed:', err)
    return
  }

  // Store the transcription on the original message
  await supabase
    .from('messages')
    .update({ content: transcription })
    .eq('id', message.id)

  // Step 2: Build context and generate AI text response
  const context = await assembleContext(conversation.id)
  if (!context) return

  const systemPrompt = buildVoiceSystemPrompt(context.persona?.base_prompt || '')

  const response = await generate({
    model: 'sonnet',
    system: systemPrompt,
    messages: [
      ...context.messages.slice(-10).map((m) => ({
        role: (m.direction === 'inbound' ? 'user' : 'assistant') as 'user' | 'assistant',
        content: m.content,
      })),
      { role: 'user', content: transcription },
    ],
    maxTokens: 300,
    temperature: 0.8,
  })

  // Step 3: Convert response to voice
  const voiceSettings = await getVoiceSettings()
  const maxLength = autoVoiceSettings.max_length_seconds || 30
  // Trim text to fit within max voice length (~150 chars per 10 seconds)
  const trimmedResponse = response.slice(0, maxLength * 15)

  const { audioUrl, durationMs } = await generateVoice(trimmedResponse, voiceSettings)

  // Add prefix silence delay if configured
  const prefixMs = autoVoiceSettings.prefix_silence_ms || 0
  if (prefixMs > 0) {
    await new Promise((r) => setTimeout(r, prefixMs))
  }

  // Step 4: Send via ManyChat
  const { data: lead } = await supabase
    .from('leads')
    .select('instagram_id')
    .eq('id', conversation.lead_id)
    .single()

  if (!lead?.instagram_id) {
    console.error('Voice handler: no instagram_id for lead', conversation.lead_id)
    return
  }

  await sendVoiceMessage(lead.instagram_id, audioUrl)

  // Step 5: Store the AI voice response in messages
  await supabase.from('messages').insert({
    conversation_id: conversation.id,
    direction: 'outbound',
    type: 'voice',
    content: trimmedResponse,
    voice_url: audioUrl,
    sent_by: 'ai',
    sent_at: new Date().toISOString(),
    is_ai_generated: true,
    metadata: { duration_ms: durationMs, transcription_of_reply: trimmedResponse },
  })

  // Update conversation last_message_at
  await supabase
    .from('conversations')
    .update({ last_message_at: new Date().toISOString() })
    .eq('id', conversation.id)
}

function shouldUseVoiceReply(
  mode: VoiceReplyMode,
  autoSettings: { mode?: string; match_threshold_seconds?: number }
): boolean {
  const effectiveMode = autoSettings.mode || mode

  switch (effectiveMode) {
    case 'always':
      return true
    case 'never':
      return false
    case 'contextual':
    case 'match':
      // In match/contextual mode, we always try (threshold check happens at caller level)
      return true
    default:
      return true
  }
}

function buildVoiceSystemPrompt(basePrompt: string): string {
  return `${basePrompt}

VOICE RESPONSE MODE:
You are responding to a voice message from a lead. Your response will be converted to speech.

VOICE STYLE RULES:
- Keep it concise — under 3 sentences, conversational
- Write as if speaking aloud, not texting
- Use natural speech patterns, pauses with "..."
- No emojis, no text abbreviations (they'll be read aloud)
- Sound warm, confident, and genuine
- Match the energy of a voice memo from a friend
- Avoid any formatting (bullet points, lists, etc.)
- Start naturally, don't open with greetings every time`
}
