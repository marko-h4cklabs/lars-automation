import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { sendTextMessage, sendMultipleMessages } from '@/lib/manychat'

/**
 * POST /api/templates/[id]/use — Use a template: log usage and optionally send.
 * Body: { conversationId?, leadId?, variables? }
 * If conversationId + leadId provided, sends the message via ManyChat.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { conversationId, leadId, variables } = body

  // Fetch the template
  const { data: template } = await supabase
    .from('templates')
    .select('*')
    .eq('id', params.id)
    .single()

  if (!template) return NextResponse.json({ error: 'Template not found' }, { status: 404 })

  // Increment usage count
  const { data: usageData } = await supabase
    .from('app_settings')
    .select('value')
    .eq('key', 'template_usage_counts')
    .single()

  const counts = (usageData?.value || {}) as Record<string, number>
  counts[params.id] = (counts[params.id] || 0) + 1

  if (usageData) {
    await supabase.from('app_settings').update({ value: counts }).eq('key', 'template_usage_counts')
  } else {
    await supabase.from('app_settings').insert({ key: 'template_usage_counts', value: counts })
  }

  // Track recent usage for the user
  const recentKey = `template_recent_${user.id}`
  const { data: recentData } = await supabase
    .from('app_settings')
    .select('value')
    .eq('key', recentKey)
    .single()

  const recentIds: string[] = (recentData?.value || []) as string[]
  const updatedRecent = [params.id, ...recentIds.filter((id) => id !== params.id)].slice(0, 10)

  if (recentData) {
    await supabase.from('app_settings').update({ value: updatedRecent }).eq('key', recentKey)
  } else {
    await supabase.from('app_settings').insert({ key: recentKey, value: updatedRecent })
  }

  // If conversation + lead provided, send the message
  if (conversationId && leadId) {
    const { data: lead } = await supabase
      .from('leads')
      .select('instagram_id, full_name, username')
      .eq('id', leadId)
      .single()

    if (!lead?.instagram_id) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 })
    }

    // Replace variables in content
    let content = template.content as string
    const vars: Record<string, string> = {
      lead_name: lead.full_name || lead.username || 'there',
      lead_username: lead.username || '',
      ...variables,
    }
    for (const [key, val] of Object.entries(vars)) {
      content = content.replace(new RegExp(`\\{${key}\\}`, 'g'), val)
    }

    // Split multi-message templates on ---
    const segments = content.split(/\n---\n|\n---$|^---\n/).map((s) => s.trim()).filter(Boolean)

    if (segments.length > 1) {
      await sendMultipleMessages(lead.instagram_id, segments)
    } else {
      await sendTextMessage(lead.instagram_id, content)
    }

    // Store in messages
    for (const segment of segments) {
      await supabase.from('messages').insert({
        conversation_id: conversationId,
        direction: 'outbound',
        type: 'template',
        content: segment,
        sent_by: user.id,
        sent_at: new Date().toISOString(),
        template_id: params.id,
        is_ai_generated: false,
      })
    }

    await supabase
      .from('conversations')
      .update({ last_message_at: new Date().toISOString() })
      .eq('id', conversationId)

    return NextResponse.json({ status: 'sent', segments: segments.length })
  }

  return NextResponse.json({ status: 'logged', usage_count: counts[params.id] })
}
