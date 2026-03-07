import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { sendVoiceMessage } from '@/lib/manychat'

/**
 * POST /api/voice/send — Send a voice message to a lead via ManyChat.
 * Body: { audioUrl, conversationId, leadId }
 * Sends the voice and stores in messages table.
 */
export async function POST(req: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { audioUrl, conversationId, leadId } = await req.json()

  if (!audioUrl || !conversationId) {
    return NextResponse.json({ error: 'audioUrl and conversationId required' }, { status: 400 })
  }

  // Get lead's instagram_id
  const { data: lead } = await supabase
    .from('leads')
    .select('instagram_id')
    .eq('id', leadId)
    .single()

  if (!lead?.instagram_id) {
    return NextResponse.json({ error: 'Lead not found or missing Instagram ID' }, { status: 404 })
  }

  try {
    // Send via ManyChat
    await sendVoiceMessage(lead.instagram_id, audioUrl)

    // Store in messages
    const { error: msgError } = await supabase.from('messages').insert({
      conversation_id: conversationId,
      direction: 'outbound',
      type: 'voice',
      content: '[Voice message]',
      voice_url: audioUrl,
      sent_by: user.id,
      sent_at: new Date().toISOString(),
      is_ai_generated: false,
    })

    if (msgError) {
      console.error('Message insert error:', msgError)
    }

    // Update conversation
    await supabase
      .from('conversations')
      .update({ last_message_at: new Date().toISOString() })
      .eq('id', conversationId)

    return NextResponse.json({ status: 'sent' })
  } catch (err) {
    console.error('Voice send error:', err)
    return NextResponse.json({ error: 'Failed to send voice message' }, { status: 500 })
  }
}
