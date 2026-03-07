import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { NotificationType } from '@/types'

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createServerSupabaseClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Transfer conversation to AI
  const { error: convError } = await supabase
    .from('conversations')
    .update({
      assigned_to: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)

  if (convError) return NextResponse.json({ error: convError.message }, { status: 500 })

  // Get lead_id and update lead assignment
  const { data: conv } = await supabase
    .from('conversations')
    .select('lead_id, lead:leads!conversations_lead_id_fkey(username)')
    .eq('id', id)
    .single()

  if (conv) {
    await supabase
      .from('leads')
      .update({
        assigned_to: null,
        assignment_type: 'ai',
        updated_at: new Date().toISOString(),
      })
      .eq('id', conv.lead_id)

    const leadData = conv.lead as unknown as { username: string }

    // Create notification
    await supabase.from('notifications').insert({
      user_id: null,
      type: NotificationType.AITakeover,
      lead_id: conv.lead_id,
      conversation_id: id,
      message: `@${leadData?.username || 'Lead'} transferred to AI autopilot`,
      read: false,
      slack_sent: false,
    })
  }

  return NextResponse.json({ status: 'transferred', conversationId: id })
}
