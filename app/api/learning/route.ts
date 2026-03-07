import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import type { TrainingOutcome } from '@/types'

/**
 * GET /api/learning — List training conversations with filters.
 * Query: ?outcome=success|failure|partial&approved=true|false&page=0&limit=20
 */
export async function GET(req: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const url = req.nextUrl
  const outcome = url.searchParams.get('outcome') as TrainingOutcome | null
  const approved = url.searchParams.get('approved')
  const page = parseInt(url.searchParams.get('page') || '0')
  const limit = parseInt(url.searchParams.get('limit') || '20')

  let query = supabase
    .from('training_conversations')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(page * limit, (page + 1) * limit - 1)

  if (outcome) query = query.eq('outcome', outcome)
  if (approved === 'true') query = query.eq('approved', true)
  if (approved === 'false') query = query.eq('approved', false)

  const { data, count, error } = await query

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({
    conversations: data || [],
    total: count || 0,
    page,
    hasMore: (count || 0) > (page + 1) * limit,
  })
}

/**
 * POST /api/learning — Create a training conversation.
 * Body: { title, conversationData, outcome?, feedbackNotes? }
 */
export async function POST(req: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { title, conversationData, outcome, feedbackNotes } = body as {
    title: string
    conversationData: Record<string, unknown>
    outcome?: TrainingOutcome
    feedbackNotes?: string
  }

  if (!title || !conversationData) {
    return NextResponse.json({ error: 'title and conversationData required' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('training_conversations')
    .insert({
      title,
      conversation_data: conversationData,
      outcome: outcome || 'partial',
      feedback_notes: feedbackNotes || null,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Audit log
  await supabase.from('audit_log').insert({
    actor: user.id,
    action: 'create',
    entity_type: 'training_conversation',
    entity_id: data.id,
    metadata: { title, outcome: outcome || 'partial' },
  })

  return NextResponse.json({ conversation: data })
}

/**
 * PATCH /api/learning — Update a training conversation.
 * Body: { id, title?, outcome?, feedbackNotes?, approved? }
 */
export async function PATCH(req: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { id, title, outcome, feedbackNotes, approved } = body as {
    id: string
    title?: string
    outcome?: TrainingOutcome
    feedbackNotes?: string
    approved?: boolean
  }

  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const updates: Record<string, unknown> = {}
  if (title !== undefined) updates.title = title
  if (outcome !== undefined) updates.outcome = outcome
  if (feedbackNotes !== undefined) updates.feedback_notes = feedbackNotes
  if (approved !== undefined) {
    updates.approved = approved
    updates.approved_by = approved ? user.id : null
  }

  const { data, error } = await supabase
    .from('training_conversations')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Audit log
  await supabase.from('audit_log').insert({
    actor: user.id,
    action: approved !== undefined ? (approved ? 'approve' : 'unapprove') : 'update',
    entity_type: 'training_conversation',
    entity_id: id,
    metadata: updates,
  })

  return NextResponse.json({ conversation: data })
}

/**
 * DELETE /api/learning — Delete a training conversation.
 * Body: { id }
 */
export async function DELETE(req: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { id } = body as { id: string }

  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const { error } = await supabase
    .from('training_conversations')
    .delete()
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Audit log
  await supabase.from('audit_log').insert({
    actor: user.id,
    action: 'delete',
    entity_type: 'training_conversation',
    entity_id: id,
    metadata: {},
  })

  return NextResponse.json({ success: true })
}
