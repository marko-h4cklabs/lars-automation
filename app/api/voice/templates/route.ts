import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

/**
 * GET /api/voice/templates — List voice templates.
 * Query: category? (opener/qualifying/booking/follow_up)
 */
export async function GET(req: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Templates stored in app_settings as JSON array
  const { data } = await supabase
    .from('app_settings')
    .select('value')
    .eq('key', 'voice_templates')
    .single()

  const templates = (data?.value as Template[] | null) || []

  const category = req.nextUrl.searchParams.get('category')
  const filtered = category
    ? templates.filter((t: Template) => t.category === category)
    : templates

  return NextResponse.json({ templates: filtered })
}

/**
 * POST /api/voice/templates — Create or update a voice template.
 * Body: { id?, name, script, category }
 */
export async function POST(req: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { id, name, script, category } = body

  if (!name || !script || !category) {
    return NextResponse.json({ error: 'name, script, category required' }, { status: 400 })
  }

  // Load existing templates
  const { data: existing } = await supabase
    .from('app_settings')
    .select('value')
    .eq('key', 'voice_templates')
    .single()

  const templates: Template[] = (existing?.value as Template[] | null) || []

  if (id) {
    // Update existing
    const idx = templates.findIndex((t) => t.id === id)
    if (idx >= 0) {
      templates[idx] = { ...templates[idx], name, script, category }
    }
  } else {
    // Add new
    templates.push({
      id: `vt_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      name,
      script,
      category,
      created_at: new Date().toISOString(),
    })
  }

  await upsertTemplates(supabase, templates, existing !== null)
  return NextResponse.json({ status: 'saved', templates })
}

/**
 * DELETE /api/voice/templates — Delete a template.
 * Query: id
 */
export async function DELETE(req: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const { data: existing } = await supabase
    .from('app_settings')
    .select('value')
    .eq('key', 'voice_templates')
    .single()

  const templates: Template[] = (existing?.value as Template[] | null) || []
  const filtered = templates.filter((t) => t.id !== id)

  await upsertTemplates(supabase, filtered, existing !== null)
  return NextResponse.json({ status: 'deleted' })
}

interface Template {
  id: string
  name: string
  script: string
  category: string
  created_at: string
}

async function upsertTemplates(
  supabase: ReturnType<typeof import('@/lib/supabase-server').createServerSupabaseClient extends (...args: never[]) => Promise<infer R> ? () => R : never>,
  templates: Template[],
  exists: boolean
) {
  if (exists) {
    await supabase
      .from('app_settings')
      .update({ value: templates })
      .eq('key', 'voice_templates')
  } else {
    await supabase
      .from('app_settings')
      .insert({ key: 'voice_templates', value: templates })
  }
}
