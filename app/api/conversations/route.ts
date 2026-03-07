import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

export async function GET(request: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const page = parseInt(searchParams.get('page') || '0')
  const limit = parseInt(searchParams.get('limit') || '20')
  const filter = searchParams.get('filter') || 'all'
  const search = searchParams.get('search') || ''
  const sort = searchParams.get('sort') || 'last_message'
  const offset = page * limit

  // Get user role
  const { data: user } = await supabase
    .from('users')
    .select('id, role')
    .eq('id', session.user.id)
    .single()

  let query = supabase
    .from('conversations')
    .select(`
      *,
      lead:leads!conversations_lead_id_fkey(
        id, username, full_name, profile_pic_url, heat_score, stage,
        source, follower_count, assignment_type, assigned_to, instagram_user_id
      )
    `, { count: 'exact' })
    .eq('status', 'active')

  // Role-based filtering: setters see only their assigned
  if (user?.role === 'setter') {
    query = query.eq('assigned_to', session.user.id)
  }

  // Filter tabs
  switch (filter) {
    case 'my_leads':
      query = query.eq('assigned_to', session.user.id)
      break
    case 'ai_leads':
      query = query.is('assigned_to', null)
      break
    case 'hot_leads':
      query = query.gte('lead.heat_score', 80)
      break
  }

  // Search by username
  if (search) {
    query = query.ilike('lead.username', `%${search}%`)
  }

  // Sort
  switch (sort) {
    case 'heat_score':
      query = query.order('lead(heat_score)', { ascending: false })
      break
    case 'stage':
      query = query.order('lead(stage)', { ascending: true })
      break
    default:
      query = query.order('updated_at', { ascending: false })
  }

  query = query.range(offset, offset + limit - 1)

  const { data, count, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Get unread counts for each conversation
  const conversationIds = (data || []).map((c: { id: string }) => c.id)
  const unreadMap: Record<string, number> = {}

  if (conversationIds.length > 0) {
    const { data: unreads } = await supabase
      .from('messages')
      .select('conversation_id')
      .in('conversation_id', conversationIds)
      .eq('direction', 'inbound')
      .is('read_at', null)

    if (unreads) {
      for (const msg of unreads) {
        const cid = (msg as { conversation_id: string }).conversation_id
        unreadMap[cid] = (unreadMap[cid] || 0) + 1
      }
    }
  }

  // Get last message for each conversation
  const conversationsWithMeta = await Promise.all(
    (data || []).map(async (conv: Record<string, unknown>) => {
      const { data: lastMsg } = await supabase
        .from('messages')
        .select('content, direction, sent_at, type')
        .eq('conversation_id', conv.id as string)
        .order('sent_at', { ascending: false })
        .limit(1)
        .single()

      return {
        ...conv,
        last_message: lastMsg || null,
        unread_count: unreadMap[conv.id as string] || 0,
      }
    })
  )

  return NextResponse.json({
    conversations: conversationsWithMeta,
    total: count,
    page,
    hasMore: (count || 0) > offset + limit,
  })
}
