import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

/**
 * GET /api/templates — List all templates with optional filters.
 * Query: category?, search?, tag?, sort? (usage/name/created)
 */
export async function GET(req: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const url = req.nextUrl
  const category = url.searchParams.get('category')
  const search = url.searchParams.get('search')
  const tag = url.searchParams.get('tag')

  let query = supabase
    .from('templates')
    .select('*')
    .eq('is_active', true)
    .order('created_at', { ascending: false })

  if (category && category !== 'all') {
    query = query.eq('category', category)
  }

  if (search) {
    query = query.or(`name.ilike.%${search}%,content.ilike.%${search}%`)
  }

  if (tag) {
    query = query.contains('tags', [tag])
  }

  const { data, error } = await query

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Fetch usage counts from app_settings
  const { data: usageData } = await supabase
    .from('app_settings')
    .select('value')
    .eq('key', 'template_usage_counts')
    .single()

  const usageCounts = (usageData?.value || {}) as Record<string, number>

  // Fetch favorites
  const { data: favData } = await supabase
    .from('app_settings')
    .select('value')
    .eq('key', `template_favorites_${user.id}`)
    .single()

  const favorites = (favData?.value || []) as string[]

  const templates = (data || []).map((t) => ({
    ...t,
    usage_count: usageCounts[t.id] || 0,
    is_favorite: favorites.includes(t.id),
  }))

  return NextResponse.json({ templates })
}

/**
 * POST /api/templates — Create a new template.
 * Body: { name, category, content, tags? }
 */
export async function POST(req: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { name, category, content, tags } = body

  if (!name || !category || !content) {
    return NextResponse.json({ error: 'name, category, content required' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('templates')
    .insert({
      name,
      category,
      content,
      tags: tags || [],
      created_by: user.id,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
