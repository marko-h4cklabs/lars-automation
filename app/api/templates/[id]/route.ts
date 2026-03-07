import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

/**
 * GET /api/templates/[id] — Get a single template.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('templates')
    .select('*')
    .eq('id', params.id)
    .single()

  if (error || !data) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(data)
}

/**
 * PATCH /api/templates/[id] — Update a template.
 * Body: { name?, category?, content?, tags?, is_active?, is_favorite? }
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()

  // Handle favorite toggle separately (stored per-user)
  if (body.is_favorite !== undefined) {
    const key = `template_favorites_${user.id}`
    const { data: existing } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', key)
      .single()

    const favorites: string[] = (existing?.value || []) as string[]
    const updated = body.is_favorite
      ? Array.from(new Set([...favorites, params.id]))
      : favorites.filter((id) => id !== params.id)

    if (existing) {
      await supabase.from('app_settings').update({ value: updated }).eq('key', key)
    } else {
      await supabase.from('app_settings').insert({ key, value: updated })
    }

    return NextResponse.json({ status: 'favorite_updated' })
  }

  // Regular update
  const updateData: Record<string, unknown> = {}
  if (body.name !== undefined) updateData.name = body.name
  if (body.category !== undefined) updateData.category = body.category
  if (body.content !== undefined) updateData.content = body.content
  if (body.tags !== undefined) updateData.tags = body.tags
  if (body.is_active !== undefined) updateData.is_active = body.is_active

  const { error } = await supabase
    .from('templates')
    .update(updateData)
    .eq('id', params.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ status: 'updated' })
}

/**
 * DELETE /api/templates/[id] — Soft delete (set is_active=false).
 */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
  }

  const { error } = await supabase
    .from('templates')
    .update({ is_active: false })
    .eq('id', params.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ status: 'deleted' })
}
