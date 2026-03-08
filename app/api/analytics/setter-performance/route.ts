import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

export async function GET(req: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const url = req.nextUrl
  const dateFrom = url.searchParams.get('dateFrom') || new Date(Date.now() - 30 * 86400000).toISOString()
  const dateTo = url.searchParams.get('dateTo') || new Date().toISOString()

  // Get all conversations with first_setter_message_id set in period
  const { data: conversations } = await supabase
    .from('conversations')
    .select('id, assigned_to, first_setter_message_id, lead_replied_after_first_contact, created_at')
    .not('first_setter_message_id', 'is', null)
    .gte('created_at', dateFrom)
    .lte('created_at', dateTo)

  // Get all active users
  const { data: users } = await supabase
    .from('users')
    .select('id, name, role, receives_leads')
    .in('role', ['setter', 'admin'])

  const convos = conversations || []
  const allUsers = users || []

  interface SetterStat {
    id: string
    name: string
    firstContacts: number
    replied: number
    continuationRate: number
  }

  const stats: SetterStat[] = []

  // Per-setter stats
  for (const u of allUsers) {
    const theirs = convos.filter((c) => c.assigned_to === u.id)
    const firstContacts = theirs.length
    const replied = theirs.filter((c) => c.lead_replied_after_first_contact).length
    const continuationRate = firstContacts > 0 ? Math.round((replied / firstContacts) * 1000) / 10 : 0

    stats.push({
      id: u.id,
      name: u.name,
      firstContacts,
      replied,
      continuationRate,
    })
  }

  // AI stats
  const aiConvos = convos.filter((c) => !c.assigned_to)
  const aiFirstContacts = aiConvos.length
  const aiReplied = aiConvos.filter((c) => c.lead_replied_after_first_contact).length
  stats.push({
    id: 'ai',
    name: 'AI Agent',
    firstContacts: aiFirstContacts,
    replied: aiReplied,
    continuationRate: aiFirstContacts > 0 ? Math.round((aiReplied / aiFirstContacts) * 1000) / 10 : 0,
  })

  // Sort by continuation rate desc
  stats.sort((a, b) => b.continuationRate - a.continuationRate)

  return NextResponse.json({ performance: stats })
}
