import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createServerSupabaseClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Get conversation to find lead_id
  const { data: conv } = await supabase
    .from('conversations')
    .select('lead_id')
    .eq('id', id)
    .single()

  if (!conv) return NextResponse.json({ error: 'Conversation not found' }, { status: 404 })

  // Assign conversation and lead to the current user (setter takes over)
  await supabase
    .from('conversations')
    .update({ assigned_to: session.user.id, updated_at: new Date().toISOString() })
    .eq('id', id)

  await supabase
    .from('leads')
    .update({
      assigned_to: session.user.id,
      assignment_type: 'setter',
      updated_at: new Date().toISOString(),
    })
    .eq('id', conv.lead_id)

  return NextResponse.json({ status: 'assigned', conversationId: id })
}
