import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

interface TimelineEvent {
  id: string
  type: 'stage_change' | 'message_sent' | 'message_received' | 'call_booked' | 'assignment' | 'note' | 'first_contact' | 'ai_suggestion'
  title: string
  detail: string | null
  actor: string | null
  timestamp: string
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createServerSupabaseClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const events: TimelineEvent[] = []

  // Fetch in parallel
  const [auditResult, messagesResult, notesResult, leadResult] = await Promise.all([
    // Audit logs for this lead
    supabase
      .from('audit_logs')
      .select('*')
      .eq('entity_type', 'lead')
      .eq('entity_id', id)
      .order('created_at', { ascending: false })
      .limit(50),

    // Recent messages (summary)
    supabase
      .from('messages')
      .select('id, direction, content, sent_at, sent_by, ai_generated')
      .eq('lead_id', id)
      .order('sent_at', { ascending: false })
      .limit(20),

    // Notes
    supabase
      .from('lead_notes')
      .select('id, content, user_id, created_at')
      .eq('lead_id', id)
      .order('created_at', { ascending: false }),

    // Lead for first contact
    supabase
      .from('leads')
      .select('created_at, calendly_booked_at, username')
      .eq('id', id)
      .single(),
  ])

  // First contact event
  if (leadResult.data) {
    events.push({
      id: `first-${id}`,
      type: 'first_contact',
      title: `@${leadResult.data.username} first contact`,
      detail: null,
      actor: null,
      timestamp: leadResult.data.created_at,
    })

    if (leadResult.data.calendly_booked_at) {
      events.push({
        id: `booked-${id}`,
        type: 'call_booked',
        title: 'Call booked',
        detail: null,
        actor: null,
        timestamp: leadResult.data.calendly_booked_at,
      })
    }
  }

  // Audit log events
  for (const log of auditResult.data || []) {
    const meta = log.metadata as Record<string, string> | null
    let title = log.action
    let detail: string | null = null

    if (log.action === 'stage_change') {
      title = `Stage changed to ${meta?.new_stage || 'unknown'}`
    } else if (log.action === 'suggestion_send' || log.action === 'suggestion_use') {
      title = `AI suggestion ${log.action === 'suggestion_send' ? 'sent' : 'used'}`
      detail = `Option ${meta?.used_option || '?'}`
    }

    events.push({
      id: log.id,
      type: log.action.includes('suggestion') ? 'ai_suggestion' : 'stage_change',
      title,
      detail,
      actor: log.actor,
      timestamp: log.created_at,
    })
  }

  // Message events (sampled — first, last, and every 5th)
  const msgs = messagesResult.data || []
  for (const msg of msgs) {
    events.push({
      id: msg.id,
      type: msg.direction === 'inbound' ? 'message_received' : 'message_sent',
      title: msg.direction === 'inbound' ? 'Message received' : (msg.ai_generated ? 'AI sent message' : 'Setter sent message'),
      detail: msg.content.slice(0, 80) + (msg.content.length > 80 ? '...' : ''),
      actor: msg.sent_by,
      timestamp: msg.sent_at,
    })
  }

  // Notes
  for (const note of notesResult.data || []) {
    events.push({
      id: note.id,
      type: 'note',
      title: 'Note added',
      detail: note.content,
      actor: note.user_id,
      timestamp: note.created_at,
    })
  }

  // Sort all events by timestamp descending
  events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())

  return NextResponse.json({ events })
}
