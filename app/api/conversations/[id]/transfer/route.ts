import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { createNotification } from '@/lib/notifications'
import { qstash as getQStash } from '@/lib/queue'
import { NotificationType } from '@/types'
import type { AutopilotSettings } from '@/types'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createServerSupabaseClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Get current lead assignment to determine direction
  const { data: conv } = await supabase
    .from('conversations')
    .select('lead_id, lead:leads!conversations_lead_id_fkey(username, assignment_type)')
    .eq('id', id)
    .single()

  if (!conv) return NextResponse.json({ error: 'Conversation not found' }, { status: 404 })

  const leadData = conv.lead as unknown as { username: string; assignment_type: string }
  const username = leadData?.username || 'Lead'
  const currentType = leadData?.assignment_type
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

  if (currentType === 'ai') {
    // ── AI → HUMAN (take over) ──
    // Assign to the current user who clicked "TAKE OVER"
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

    return NextResponse.json({ status: 'transferred', direction: 'human', conversationId: id })

  } else {
    // ── HUMAN/UNASSIGNED → AI ──
    await supabase
      .from('conversations')
      .update({ assigned_to: null, updated_at: new Date().toISOString() })
      .eq('id', id)

    await supabase
      .from('leads')
      .update({
        assigned_to: null,
        assignment_type: 'ai',
        updated_at: new Date().toISOString(),
      })
      .eq('id', conv.lead_id)

    createNotification({
      type: NotificationType.AITakeover,
      leadId: conv.lead_id,
      conversationId: id,
      message: `@${username} transferred to AI autopilot`,
      metadata: { username, conversationUrl: `${appUrl}/inbox/${id}` },
    }).catch(() => {})

    // Trigger autopilot immediately
    const { data: autopilotSettings } = await supabase
      .from('autopilot_settings')
      .select('*')
      .limit(1)
      .single()

    const settings = autopilotSettings as AutopilotSettings | null

    if (settings?.enabled !== false) {
      const minDelay = settings?.min_delay_seconds || 8
      const maxDelay = settings?.max_delay_seconds || 45
      const delay = Math.floor(Math.random() * (maxDelay - minDelay + 1)) + minDelay

      await getQStash().publishJSON({
        url: `${appUrl}/api/workers/autopilot`,
        body: { conversationId: id, leadId: conv.lead_id },
        delay,
        retries: 3,
      })
    }

    return NextResponse.json({ status: 'transferred', direction: 'ai', conversationId: id })
  }
}
