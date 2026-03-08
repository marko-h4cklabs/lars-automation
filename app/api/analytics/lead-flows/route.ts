import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

export async function GET(req: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const url = req.nextUrl
  const dateFrom = url.searchParams.get('dateFrom') || new Date(Date.now() - 30 * 86400000).toISOString()
  const dateTo = url.searchParams.get('dateTo') || new Date().toISOString()

  // Get trigger outbound messages grouped by trigger_type
  const { data: triggerMessages } = await supabase
    .from('messages')
    .select('id, trigger_type, trigger_reply_tracked, sent_at')
    .eq('is_trigger_outbound', true)
    .gte('sent_at', dateFrom)
    .lte('sent_at', dateTo)
    .order('sent_at', { ascending: true })

  const messages = triggerMessages || []

  // Define 3 lead flows
  const flows = [
    {
      id: 'comment',
      label: 'Comment Flow',
      description: 'User comments with keyword, receives outbound DM',
      types: ['comment_keyword'],
    },
    {
      id: 'story',
      label: 'Story Reply Flow',
      description: 'User replies to story, receives outbound',
      types: ['story_keyword'],
    },
    {
      id: 'follow',
      label: 'Follow Flow',
      description: 'User follows page, receives outbound DM',
      types: ['follow'],
    },
  ]

  // Build 7-day buckets for sparkline
  const dayMs = 86400000
  const toDate = new Date(dateTo).getTime()
  const last7Start = toDate - 7 * dayMs

  const results = flows.map((flow) => {
    const flowMsgs = messages.filter((m) => flow.types.includes(m.trigger_type || ''))
    const sent = flowMsgs.length
    const replied = flowMsgs.filter((m) => m.trigger_reply_tracked).length
    const replyRate = sent > 0 ? Math.round((replied / sent) * 1000) / 10 : 0

    // 7-day sparkline
    const sparkline: number[] = []
    for (let i = 0; i < 7; i++) {
      const dayStart = last7Start + i * dayMs
      const dayEnd = dayStart + dayMs
      const dayMsgs = flowMsgs.filter((m) => {
        const t = new Date(m.sent_at).getTime()
        return t >= dayStart && t < dayEnd
      })
      const dayReplied = dayMsgs.filter((m) => m.trigger_reply_tracked).length
      const dayTotal = dayMsgs.length
      sparkline.push(dayTotal > 0 ? Math.round((dayReplied / dayTotal) * 100) : 0)
    }

    return {
      ...flow,
      sent,
      replied,
      replyRate,
      sparkline,
    }
  })

  return NextResponse.json({ flows: results })
}
