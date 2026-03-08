import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

export async function GET(req: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const url = req.nextUrl
  const dateFrom = url.searchParams.get('dateFrom') || new Date(Date.now() - 30 * 86400000).toISOString()
  const dateTo = url.searchParams.get('dateTo') || new Date().toISOString()

  // Get all trigger outbound messages in period
  const { data: triggerMessages } = await supabase
    .from('messages')
    .select('id, conversation_id, lead_id, trigger_type, sent_at, trigger_reply_tracked')
    .eq('is_trigger_outbound', true)
    .gte('sent_at', dateFrom)
    .lte('sent_at', dateTo)

  const triggers = triggerMessages || []
  const triggerTypes = ['follow', 'comment_keyword', 'story_keyword', 'dm_keyword']

  const results = []

  for (const type of triggerTypes) {
    const ofType = triggers.filter((t) => t.trigger_type === type)
    const sent = ofType.length
    const replied = ofType.filter((t) => t.trigger_reply_tracked).length
    const replyRate = sent > 0 ? Math.round((replied / sent) * 1000) / 10 : 0

    results.push({
      triggerType: type,
      label: type === 'follow' ? 'Follow'
        : type === 'comment_keyword' ? 'Comment Keyword'
        : type === 'story_keyword' ? 'Story Keyword'
        : 'DM Keyword',
      sent,
      replied,
      replyRate,
    })
  }

  return NextResponse.json({ triggers: results })
}
