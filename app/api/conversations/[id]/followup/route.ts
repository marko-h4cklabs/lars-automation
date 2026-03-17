import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import {
  enrollInSequence,
  cancelFollowUps,
  pauseFollowUps,
  resumeFollowUps,
} from '@/lib/workers/followup'

/**
 * GET /api/conversations/[id]/followup — Get follow-up status for conversation.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Get active or paused job
  const { data: job } = await supabase
    .from('follow_up_jobs')
    .select('*, follow_up_sequences(id, name, steps, is_active)')
    .eq('conversation_id', params.id)
    .in('status', ['active', 'paused'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  // Get past follow-up messages (outbound messages sent by follow-up worker)
  const { data: pastJobs } = await supabase
    .from('follow_up_jobs')
    .select('id, sequence_id, current_step, status, created_at')
    .eq('conversation_id', params.id)
    .in('status', ['completed', 'cancelled'])
    .order('created_at', { ascending: false })
    .limit(5)

  // Available sequences
  const { data: sequences } = await supabase
    .from('follow_up_sequences')
    .select('id, name, steps, is_active')
    .eq('is_active', true)
    .order('name', { ascending: true })

  return NextResponse.json({
    activeJob: job || null,
    pastJobs: pastJobs || [],
    sequences: sequences || [],
  })
}

/**
 * POST /api/conversations/[id]/followup — Enroll in a follow-up sequence.
 * Body: { sequenceId: string } OR { custom: true, delay_hours, message_type, content }
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()

  // Custom one-off follow-up
  if (body.custom) {
    const { delay_hours = 24, message_type = 'text', content = '' } = body
    if (!content && message_type === 'text') {
      return NextResponse.json({ error: 'Content required for text follow-ups' }, { status: 400 })
    }

    // Create a temporary single-step sequence
    const { data: seq, error: seqErr } = await supabase
      .from('follow_up_sequences')
      .insert({
        name: `Custom (${delay_hours}h)`,
        is_active: true,
        steps: [{
          delay_hours,
          message_type,
          content,
          ai_personalized: message_type === 'ai_personalized',
          knowledge_source: message_type === 'ai_personalized' ? 'custom_content' : undefined,
          custom_content: message_type === 'ai_personalized' ? content : undefined,
        }],
      })
      .select('id')
      .single()

    if (seqErr || !seq) {
      return NextResponse.json({ error: 'Failed to create custom sequence' }, { status: 500 })
    }

    const result = await enrollInSequence(params.id, seq.id)
    if (!result) {
      return NextResponse.json({ error: 'Failed to enroll' }, { status: 404 })
    }

    return NextResponse.json({ status: 'enrolled', jobId: result.jobId, custom: true })
  }

  // Standard sequence enrollment
  const { sequenceId } = body
  if (!sequenceId) {
    return NextResponse.json({ error: 'sequenceId required' }, { status: 400 })
  }

  const result = await enrollInSequence(params.id, sequenceId)

  if (!result) {
    return NextResponse.json({ error: 'Failed to enroll — sequence or conversation not found' }, { status: 404 })
  }

  return NextResponse.json({ status: 'enrolled', jobId: result.jobId })
}

/**
 * PATCH /api/conversations/[id]/followup — Pause, resume, or fire now.
 * Body: { action: 'pause' | 'resume' | 'fire_now' }
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { action } = body

  if (action === 'pause') {
    await pauseFollowUps(params.id)
    return NextResponse.json({ status: 'paused' })
  }

  if (action === 'resume') {
    await resumeFollowUps(params.id)
    return NextResponse.json({ status: 'resumed' })
  }

  if (action === 'fire_now') {
    // Set next_fire_at to now so the worker picks it up immediately
    const { data: job } = await supabase
      .from('follow_up_jobs')
      .select('id')
      .eq('conversation_id', params.id)
      .eq('status', 'active')
      .limit(1)
      .maybeSingle()

    if (!job) {
      return NextResponse.json({ error: 'No active follow-up job' }, { status: 404 })
    }

    await supabase
      .from('follow_up_jobs')
      .update({ next_fire_at: new Date().toISOString() })
      .eq('id', job.id)

    return NextResponse.json({ status: 'fired' })
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
}

/**
 * DELETE /api/conversations/[id]/followup — Cancel all follow-ups.
 */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  await cancelFollowUps(params.id)

  return NextResponse.json({ status: 'cancelled' })
}
