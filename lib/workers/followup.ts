import { createAdminClient } from '@/lib/supabase'
import { FollowUpJobStatus } from '@/types'
import type { FollowUpStep } from '@/types'

/**
 * Enroll a conversation in a follow-up sequence.
 * Creates a follow_up_job starting from step 0 with next_fire_at = now + step[0].delay_hours.
 */
export async function enrollInSequence(
  conversationId: string,
  sequenceId: string
): Promise<{ jobId: string } | null> {
  const supabase = createAdminClient()

  // Cancel any existing active jobs for this conversation
  await supabase
    .from('follow_up_jobs')
    .update({ status: FollowUpJobStatus.Cancelled })
    .eq('conversation_id', conversationId)
    .eq('status', FollowUpJobStatus.Active)

  // Fetch conversation to get lead_id
  const { data: conversation } = await supabase
    .from('conversations')
    .select('lead_id')
    .eq('id', conversationId)
    .single()

  if (!conversation) return null

  // Fetch sequence to get first step delay
  const { data: sequence } = await supabase
    .from('follow_up_sequences')
    .select('steps')
    .eq('id', sequenceId)
    .single()

  if (!sequence) return null

  const steps = (sequence.steps || []) as FollowUpStep[]
  if (steps.length === 0) return null

  const firstDelay = steps[0].delay_hours
  const nextFireAt = new Date(Date.now() + firstDelay * 3600000).toISOString()

  const { data: job, error } = await supabase
    .from('follow_up_jobs')
    .insert({
      lead_id: conversation.lead_id,
      conversation_id: conversationId,
      sequence_id: sequenceId,
      current_step: 0,
      next_fire_at: nextFireAt,
      status: FollowUpJobStatus.Active,
    })
    .select('id')
    .single()

  if (error || !job) return null

  // Link sequence to conversation
  await supabase
    .from('conversations')
    .update({ follow_up_sequence_id: sequenceId })
    .eq('id', conversationId)

  return { jobId: job.id }
}

/**
 * Cancel all active follow-up jobs for a conversation.
 */
export async function cancelFollowUps(conversationId: string): Promise<void> {
  const supabase = createAdminClient()

  await supabase
    .from('follow_up_jobs')
    .update({ status: FollowUpJobStatus.Cancelled })
    .eq('conversation_id', conversationId)
    .eq('status', FollowUpJobStatus.Active)

  // Also cancel paused jobs
  await supabase
    .from('follow_up_jobs')
    .update({ status: FollowUpJobStatus.Cancelled })
    .eq('conversation_id', conversationId)
    .eq('status', FollowUpJobStatus.Paused)

  // Unlink from conversation
  await supabase
    .from('conversations')
    .update({ follow_up_sequence_id: null })
    .eq('id', conversationId)
}

/**
 * Pause all active follow-up jobs for a conversation.
 */
export async function pauseFollowUps(conversationId: string): Promise<void> {
  const supabase = createAdminClient()

  await supabase
    .from('follow_up_jobs')
    .update({ status: FollowUpJobStatus.Paused })
    .eq('conversation_id', conversationId)
    .eq('status', FollowUpJobStatus.Active)
}

/**
 * Resume paused follow-up jobs for a conversation.
 * Recalculates next_fire_at from now + remaining delay.
 */
export async function resumeFollowUps(conversationId: string): Promise<void> {
  const supabase = createAdminClient()

  const { data: jobs } = await supabase
    .from('follow_up_jobs')
    .select('id, sequence_id, current_step')
    .eq('conversation_id', conversationId)
    .eq('status', FollowUpJobStatus.Paused)

  if (!jobs || jobs.length === 0) return

  for (const job of jobs) {
    // Get step delay
    const { data: seq } = await supabase
      .from('follow_up_sequences')
      .select('steps')
      .eq('id', job.sequence_id)
      .single()

    const steps = ((seq?.steps || []) as FollowUpStep[])
    const step = steps[job.current_step]
    const delayHours = step?.delay_hours || 24
    const nextFireAt = new Date(Date.now() + delayHours * 3600000).toISOString()

    await supabase
      .from('follow_up_jobs')
      .update({ status: FollowUpJobStatus.Active, next_fire_at: nextFireAt })
      .eq('id', job.id)
  }
}

/**
 * Advance a job to the next step, or complete it.
 */
export async function advanceJob(
  jobId: string,
  sequenceSteps: FollowUpStep[]
): Promise<void> {
  const supabase = createAdminClient()

  const { data: job } = await supabase
    .from('follow_up_jobs')
    .select('current_step')
    .eq('id', jobId)
    .single()

  if (!job) return

  const nextStep = job.current_step + 1

  if (nextStep >= sequenceSteps.length) {
    // No more steps — complete
    await supabase
      .from('follow_up_jobs')
      .update({ status: FollowUpJobStatus.Completed, current_step: nextStep })
      .eq('id', jobId)
  } else {
    const nextDelay = sequenceSteps[nextStep].delay_hours
    const nextFireAt = new Date(Date.now() + nextDelay * 3600000).toISOString()

    await supabase
      .from('follow_up_jobs')
      .update({ current_step: nextStep, next_fire_at: nextFireAt })
      .eq('id', jobId)
  }
}
