import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { sendTextMessage, ManyChatWindowExpiredError } from '@/lib/manychat'
import { MessageDirection, MessageType } from '@/types'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createServerSupabaseClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const page = parseInt(searchParams.get('page') || '0')
  const limit = parseInt(searchParams.get('limit') || '50')
  const offset = page * limit

  const { data, count, error } = await supabase
    .from('messages')
    .select('*', { count: 'exact' })
    .eq('conversation_id', id)
    .order('sent_at', { ascending: true })
    .range(offset, offset + limit - 1)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Mark inbound messages as read
  await supabase
    .from('messages')
    .update({ read_at: new Date().toISOString() })
    .eq('conversation_id', id)
    .eq('direction', 'inbound')
    .is('read_at', null)

  const total = count || 0
  const hasMore = offset + limit < total

  return NextResponse.json({ messages: data, total, page, hasMore })
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createServerSupabaseClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { content, type = 'text' } = await request.json()
  if (!content) return NextResponse.json({ error: 'Content required' }, { status: 400 })

  // Get conversation + lead
  const { data: conversation } = await supabase
    .from('conversations')
    .select('lead_id, lead:leads!conversations_lead_id_fkey(instagram_user_id, manychat_subscriber_id)')
    .eq('id', id)
    .single()

  if (!conversation) {
    return NextResponse.json({ error: 'Conversation not found' }, { status: 404 })
  }

  const leadData = conversation.lead as unknown as { instagram_user_id: string; manychat_subscriber_id: string | null }
  const subscriberId = leadData.manychat_subscriber_id || leadData.instagram_user_id

  console.log('[Send] conversation:', id, 'lead_id:', conversation.lead_id)
  console.log('[Send] instagram_user_id:', leadData.instagram_user_id, 'manychat_subscriber_id:', leadData.manychat_subscriber_id)
  console.log('[Send] using subscriberId:', subscriberId)

  if (!leadData.manychat_subscriber_id) {
    console.warn('[Send] WARNING: manychat_subscriber_id is null, falling back to instagram_user_id — this may be wrong!')
  }

  // Send via ManyChat
  try {
    await sendTextMessage(subscriberId, content)
  } catch (err) {
    if (err instanceof ManyChatWindowExpiredError) {
      return NextResponse.json(
        { error: err.message, code: 'WINDOW_EXPIRED' },
        { status: 422 }
      )
    }
    console.error('ManyChat send failed:', err)
    return NextResponse.json({ error: 'Failed to send message' }, { status: 500 })
  }

  // Store message
  const { data: message, error } = await supabase
    .from('messages')
    .insert({
      conversation_id: id,
      lead_id: conversation.lead_id,
      direction: MessageDirection.Outbound,
      type: type === 'voice' ? MessageType.Voice : MessageType.Text,
      content,
      sent_by: session.user.id,
      sent_at: new Date().toISOString(),
      ai_generated: false,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Update conversation timestamp
  await supabase
    .from('conversations')
    .update({ updated_at: new Date().toISOString() })
    .eq('id', id)

  return NextResponse.json({ message })
}
