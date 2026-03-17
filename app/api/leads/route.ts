import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

export async function GET(request: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const url = request.nextUrl.searchParams
  const page = parseInt(url.get('page') || '0')
  const limit = parseInt(url.get('limit') || '50')
  const search = url.get('search') || ''
  const sort = url.get('sort') || 'updated_at'
  const sortDir = url.get('sortDir') || 'desc'
  const stages = url.get('stages')?.split(',').filter(Boolean) || []
  const sources = url.get('sources')?.split(',').filter(Boolean) || []
  const assignedTo = url.get('assignedTo') || ''
  const heatMin = parseInt(url.get('heatMin') || '0')
  const heatMax = parseInt(url.get('heatMax') || '100')
  const qualMin = parseInt(url.get('qualMin') || '0')
  const qualMax = parseInt(url.get('qualMax') || '100')
  const dateFrom = url.get('dateFrom') || ''
  const dateTo = url.get('dateTo') || ''

  let query = supabase
    .from('leads')
    .select('*, conversations!conversations_lead_id_fkey(id, status, qualification_score, assigned_to)', { count: 'exact' })

  // Filters
  if (search) {
    query = query.or(`username.ilike.%${search}%,full_name.ilike.%${search}%`)
  }
  if (stages.length > 0) {
    query = query.in('stage', stages)
  }
  if (sources.length > 0) {
    query = query.in('source', sources)
  }
  if (assignedTo === 'unassigned') {
    query = query.is('assigned_to', null)
  } else if (assignedTo) {
    query = query.eq('assigned_to', assignedTo)
  }
  if (heatMin > 0) query = query.gte('heat_score', heatMin)
  if (heatMax < 100) query = query.lte('heat_score', heatMax)
  if (dateFrom) query = query.gte('created_at', dateFrom)
  if (dateTo) query = query.lte('created_at', dateTo)

  // Sort
  const validSorts = ['updated_at', 'created_at', 'heat_score', 'username', 'stage', 'last_message_at']
  const sortColumn = validSorts.includes(sort) ? sort : 'updated_at'
  query = query.order(sortColumn, { ascending: sortDir === 'asc' })

  // Pagination
  const from = page * limit
  query = query.range(from, from + limit - 1)

  const { data, count, error } = await query

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Filter by qualification completeness on the client side
  let leads = data || []
  if (qualMin > 0 || qualMax < 100) {
    leads = leads.filter((lead) => {
      const conv = (lead.conversations as { qualification_score: number }[])?.[0]
      const score = conv?.qualification_score || 0
      return score >= qualMin && score <= qualMax
    })
  }

  // Get last message for each lead
  const leadIds = leads.map((l) => l.id)
  const lastMessages: Record<string, { content: string; sent_at: string; direction: string }> = {}

  if (leadIds.length > 0) {
    const { data: msgs } = await supabase
      .from('messages')
      .select('lead_id, content, sent_at, direction')
      .in('lead_id', leadIds)
      .order('sent_at', { ascending: false })

    if (msgs) {
      const seen = new Set<string>()
      for (const m of msgs) {
        if (!seen.has(m.lead_id)) {
          seen.add(m.lead_id)
          lastMessages[m.lead_id] = { content: m.content, sent_at: m.sent_at, direction: m.direction }
        }
      }
    }
  }

  const enriched = leads.map((lead) => ({
    ...lead,
    last_message: lastMessages[lead.id] || null,
    conversation: (lead.conversations as Record<string, unknown>[])?.[0] || null,
    conversations: undefined,
  }))

  return NextResponse.json({
    leads: enriched,
    total: count || 0,
    hasMore: (count || 0) > from + limit,
    page,
  })
}
