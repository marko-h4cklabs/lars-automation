import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createServerSupabaseClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: lead, error } = await supabase
    .from('leads')
    .select(`
      *,
      conversations:conversations!conversations_lead_id_fkey(
        id, status, summary, summary_updated_at,
        qualified_fields_collected, qualification_score, assigned_to
      ),
      assigned_user:users!leads_assigned_to_fkey(id, name, email, avatar_url, role)
    `)
    .eq('id', id)
    .single()

  if (error || !lead) {
    return NextResponse.json({ error: 'Lead not found' }, { status: 404 })
  }

  // Get qualification fields
  const { data: qualFields } = await supabase
    .from('qualification_fields')
    .select('*')
    .order('display_order', { ascending: true })

  // Get follow-up jobs
  const { data: followUps } = await supabase
    .from('follow_up_jobs')
    .select('*, sequence:follow_up_sequences!follow_up_jobs_sequence_id_fkey(name, steps)')
    .eq('lead_id', id)
    .order('created_at', { ascending: false })
    .limit(1)

  // Get notes
  const { data: notes } = await supabase
    .from('lead_notes')
    .select('*')
    .eq('lead_id', id)
    .order('created_at', { ascending: false })

  return NextResponse.json({
    ...lead,
    conversation: (lead.conversations as Record<string, unknown>[])?.[0] || null,
    conversations: undefined,
    qual_field_definitions: qualFields || [],
    follow_up: (followUps || [])[0] || null,
    notes: notes || [],
  })
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createServerSupabaseClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { stage, assigned_to, assignment_type, heat_score, notes, qualification_fields } = body

  // Build update object
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (stage !== undefined) updates.stage = stage
  if (assigned_to !== undefined) updates.assigned_to = assigned_to
  if (assignment_type !== undefined) updates.assignment_type = assignment_type
  if (heat_score !== undefined) updates.heat_score = heat_score
  if (qualification_fields !== undefined) updates.qualification_fields = qualification_fields

  const { error: updateError } = await supabase
    .from('leads')
    .update(updates)
    .eq('id', id)

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 })

  // If notes provided, insert a note
  if (notes) {
    await supabase.from('lead_notes').insert({
      lead_id: id,
      user_id: session.user.id,
      content: notes,
    })
  }

  // If stage changed, log to audit
  if (stage) {
    await supabase.from('audit_logs').insert({
      actor: session.user.id,
      action: 'stage_change',
      entity_type: 'lead',
      entity_id: id,
      metadata: { new_stage: stage },
    })
  }

  // If assignment changed, update conversation too
  if (assigned_to !== undefined) {
    await supabase
      .from('conversations')
      .update({
        assigned_to: assigned_to || null,
        updated_at: new Date().toISOString(),
      })
      .eq('lead_id', id)
  }

  return NextResponse.json({ status: 'updated', id })
}
