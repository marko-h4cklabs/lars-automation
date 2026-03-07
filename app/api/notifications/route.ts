import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

// GET — paginated notification history
export async function GET(request: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { session } } = await supabase.auth.getSession()

  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const page = parseInt(searchParams.get('page') || '0')
  const limit = parseInt(searchParams.get('limit') || '30')
  const type = searchParams.get('type')
  const offset = page * limit

  let query = supabase
    .from('notifications')
    .select('*', { count: 'exact' })
    .or(`user_id.eq.${session.user.id},user_id.is.null`)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (type) {
    query = query.eq('type', type)
  }

  const { data, count, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({
    notifications: data,
    total: count,
    page,
    hasMore: (count || 0) > offset + limit,
  })
}

// PATCH — mark notifications as read
export async function PATCH(request: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { session } } = await supabase.auth.getSession()

  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const { ids, markAll } = body as { ids?: string[]; markAll?: boolean }

  if (markAll) {
    const { error } = await supabase
      .from('notifications')
      .update({ read: true })
      .or(`user_id.eq.${session.user.id},user_id.is.null`)
      .eq('read', false)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
  } else if (ids && ids.length > 0) {
    const { error } = await supabase
      .from('notifications')
      .update({ read: true })
      .in('id', ids)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
  } else {
    return NextResponse.json({ error: 'Provide ids or markAll' }, { status: 400 })
  }

  return NextResponse.json({ success: true })
}
