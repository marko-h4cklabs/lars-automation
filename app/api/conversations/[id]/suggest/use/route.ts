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

  const body = await request.json()
  const { suggestion_id, used_option, action } = body as {
    suggestion_id: string
    used_option: 'a' | 'b'
    action: 'use' | 'send' // 'use' = copied to input, 'send' = sent directly
  }

  if (!suggestion_id || !used_option) {
    return NextResponse.json({ error: 'suggestion_id and used_option required' }, { status: 400 })
  }

  // Update the suggestion record
  const { error } = await supabase
    .from('ai_suggestions')
    .update({
      used: true,
      used_suggestion: used_option === 'a' ? 1 : 2,
    })
    .eq('id', suggestion_id)
    .eq('conversation_id', id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Log to audit trail for learning system
  await supabase.from('audit_logs').insert({
    actor: session.user.id,
    action: `suggestion_${action}`,
    entity_type: 'ai_suggestion',
    entity_id: suggestion_id,
    metadata: {
      conversation_id: id,
      used_option,
      action,
    },
  })

  return NextResponse.json({ status: 'recorded', suggestion_id, used_option, action })
}
