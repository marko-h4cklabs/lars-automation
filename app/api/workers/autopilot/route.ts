import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'

export const maxDuration = 60

/**
 * Autopilot response worker — generates and sends AI reply.
 * Scheduled by the process worker with a smart delay.
 * Full implementation in Phase 5 (AI Engine).
 */
export async function POST(request: NextRequest) {
  const supabase = createAdminClient()

  try {
    const { conversationId, leadId } = await request.json()

    if (!conversationId || !leadId) {
      return NextResponse.json({ error: 'Missing conversationId or leadId' }, { status: 400 })
    }

    // Verify conversation still exists and is active
    const { data: conversation } = await supabase
      .from('conversations')
      .select('id, status, assigned_to')
      .eq('id', conversationId)
      .single()

    if (!conversation || conversation.status !== 'active') {
      return NextResponse.json({ status: 'skipped', reason: 'conversation_not_active' })
    }

    // Check if a setter has taken over since scheduling
    if (conversation.assigned_to) {
      return NextResponse.json({ status: 'skipped', reason: 'setter_took_over' })
    }

    // TODO: Phase 5 — Full autopilot response generation
    // 1. Fetch conversation history + lead context + knowledge base
    // 2. Generate response using Claude Sonnet 4
    // 3. Apply persona style rules
    // 4. Send via ManyChat API (multi-burst with delays)
    // 5. Store outbound messages
    // 6. Update qualification fields
    // 7. Check if should send Calendly link

    return NextResponse.json({
      status: 'pending_implementation',
      conversationId,
      leadId,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('Autopilot worker error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
