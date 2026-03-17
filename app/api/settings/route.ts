import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { invalidateSettingsCache } from '@/lib/notifications'
import { invalidateCache } from '@/lib/cache'

export async function GET(request: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const section = request.nextUrl.searchParams.get('section')

  switch (section) {
    case 'distribution': {
      const { data } = await supabase.from('distribution_settings').select('*').limit(1).single()
      return NextResponse.json(data || {})
    }
    case 'qualification': {
      const { data } = await supabase.from('qualification_fields').select('*').order('display_order', { ascending: true })
      return NextResponse.json({ fields: data || [] })
    }
    case 'keywords': {
      const { data } = await supabase.from('keyword_triggers').select('*').order('created_at', { ascending: true })
      return NextResponse.json({ triggers: data || [] })
    }
    case 'followups': {
      const { data } = await supabase.from('follow_up_sequences').select('*').order('created_at', { ascending: true })
      return NextResponse.json({ sequences: data || [] })
    }
    case 'copilot': {
      const userId = request.nextUrl.searchParams.get('userId') || session.user.id
      const { data } = await supabase.from('setter_ai_settings').select('*').eq('user_id', userId).single()
      return NextResponse.json(data || { user_id: userId, response_style: 'balanced', custom_prompt_additions: '', suggestions_count: 2, auto_score_leads: true })
    }
    case 'notifications': {
      const { data } = await supabase.from('notification_settings').select('*').limit(1).single()
      return NextResponse.json(data || {})
    }
    case 'integrations': {
      // Only return operational settings, never credentials
      const { data } = await supabase.from('integration_settings').select('id, calendly_link, manychat_page_id').limit(1).single()
      return NextResponse.json(data || { calendly_link: '', manychat_page_id: '' })
    }
    case 'team': {
      const { data: user } = await supabase.from('users').select('role').eq('id', session.user.id).single()
      if (user?.role !== 'admin') return NextResponse.json({ error: 'Admin only' }, { status: 403 })
      const { data } = await supabase.from('users').select('*').order('created_at', { ascending: true })
      return NextResponse.json({ users: data || [] })
    }
    default:
      return NextResponse.json({ error: 'Unknown section' }, { status: 400 })
  }
}

export async function PUT(request: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { section, ...data } = body

  switch (section) {
    case 'distribution': {
      const { user_updates, ...distData } = data
      if (!distData.id) {
        const { data: existing } = await supabase.from('distribution_settings').select('id').limit(1).single()
        if (existing) distData.id = existing.id
      }
      const { error } = await supabase.from('distribution_settings').upsert({ ...distData, updated_at: new Date().toISOString() })
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      // Update receives_leads on each user
      if (Array.isArray(user_updates)) {
        for (const u of user_updates as { id: string; receives_leads: boolean }[]) {
          await supabase.from('users').update({ receives_leads: u.receives_leads }).eq('id', u.id)
        }
      }
      invalidateCache('DISTRIBUTION').catch(() => {})
      return NextResponse.json({ status: 'saved' })
    }
    case 'qualification_field': {
      if (data.id) {
        const { error } = await supabase.from('qualification_fields').update(data).eq('id', data.id)
        if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      } else {
        const { error } = await supabase.from('qualification_fields').insert(data)
        if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      }
      return NextResponse.json({ status: 'saved' })
    }
    case 'qualification_reorder': {
      const { fields } = data as { fields: { id: string; display_order: number }[] }
      for (const f of fields) {
        await supabase.from('qualification_fields').update({ display_order: f.display_order }).eq('id', f.id)
      }
      return NextResponse.json({ status: 'saved' })
    }
    case 'keyword': {
      if (data.id) {
        const { error } = await supabase.from('keyword_triggers').update(data).eq('id', data.id)
        if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      } else {
        const { error } = await supabase.from('keyword_triggers').insert(data)
        if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      }
      return NextResponse.json({ status: 'saved' })
    }
    case 'followup': {
      if (data.id) {
        const { error } = await supabase.from('follow_up_sequences').update(data).eq('id', data.id)
        if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      } else {
        const { error } = await supabase.from('follow_up_sequences').insert(data)
        if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      }
      return NextResponse.json({ status: 'saved' })
    }
    case 'persona': {
      if (!data.id) {
        const { data: existing } = await supabase.from('persona_settings').select('id').limit(1).single()
        if (existing) data.id = existing.id
      }
      const { error } = await supabase.from('persona_settings').upsert({ ...data })
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      invalidateCache('PERSONA').catch(() => {})
      return NextResponse.json({ status: 'saved' })
    }
    case 'copilot': {
      const { error } = await supabase.from('setter_ai_settings').upsert({ ...data, updated_at: new Date().toISOString() })
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ status: 'saved' })
    }
    case 'notifications': {
      if (!data.id) {
        const { data: existing } = await supabase.from('notification_settings').select('id').limit(1).single()
        if (existing) data.id = existing.id
      }
      const { error } = await supabase.from('notification_settings').upsert({ ...data })
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      invalidateSettingsCache()
      return NextResponse.json({ status: 'saved' })
    }
    case 'integrations': {
      // Only persist operational settings, strip any credentials
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { manychat_api_key, calendly_webhook_secret, ...safeData } = data as Record<string, unknown>
      // Ensure we have the existing row id for upsert
      if (!safeData.id) {
        const { data: existing } = await supabase.from('integration_settings').select('id').limit(1).single()
        if (existing) safeData.id = existing.id
      }
      const { error } = await supabase.from('integration_settings').upsert({ ...safeData, updated_at: new Date().toISOString() })
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ status: 'saved' })
    }
    case 'app_setting': {
      const { key, value } = data as { key: string; value: unknown }
      const { error } = await supabase.from('app_settings').upsert(
        { key, value: JSON.stringify(value), updated_at: new Date().toISOString() },
        { onConflict: 'key' }
      )
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ status: 'saved' })
    }
    case 'team_update': {
      const { data: user } = await supabase.from('users').select('role').eq('id', session.user.id).single()
      if (user?.role !== 'admin') return NextResponse.json({ error: 'Admin only' }, { status: 403 })
      const { userId, ...updates } = data
      const { error } = await supabase.from('users').update(updates).eq('id', userId)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ status: 'saved' })
    }
    default:
      return NextResponse.json({ error: 'Unknown section' }, { status: 400 })
  }
}

export async function DELETE(request: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const section = request.nextUrl.searchParams.get('section')
  const id = request.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const tableMap: Record<string, string> = {
    qualification_field: 'qualification_fields',
    keyword: 'keyword_triggers',
    followup: 'follow_up_sequences',
  }

  const table = tableMap[section || '']
  if (!table) return NextResponse.json({ error: 'Unknown section' }, { status: 400 })

  const { error } = await supabase.from(table).delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ status: 'deleted' })
}
