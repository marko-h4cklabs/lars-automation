import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { generate } from '@/lib/ai'
import type { Message } from '@/types'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createServerSupabaseClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data } = await supabase
    .from('conversations')
    .select('summary, summary_updated_at')
    .eq('id', id)
    .single()

  return NextResponse.json(data || { summary: null, summary_updated_at: null })
}

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createServerSupabaseClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: messages } = await supabase
    .from('messages')
    .select('direction, content, sent_at')
    .eq('conversation_id', id)
    .order('sent_at', { ascending: true })
    .limit(50)

  if (!messages || messages.length === 0) {
    return NextResponse.json({ summary: 'No messages yet.', summary_updated_at: null })
  }

  const { data: conv } = await supabase
    .from('conversations')
    .select('lead:leads!conversations_lead_id_fkey(username, full_name, stage, heat_score)')
    .eq('id', id)
    .single()

  const lead = conv?.lead as unknown as { username: string; full_name: string; stage: string; heat_score: number } | null

  const transcript = (messages as Pick<Message, 'direction' | 'content' | 'sent_at'>[])
    .map((m) => `[${m.direction}] ${m.content}`)
    .join('\n')

  const summary = await generate({
    model: 'haiku',
    system: `Summarize this Instagram DM conversation for a sales team CRM. 3-4 sentences max. Focus on: what the lead wants, qualification status, and recommended next steps. Be direct.`,
    messages: [
      {
        role: 'user',
        content: `Lead: @${lead?.username || 'unknown'} (${lead?.full_name || 'Unknown'})\nStage: ${lead?.stage || 'new'} | Score: ${lead?.heat_score || 0}/100\n\n${transcript}`,
      },
    ],
    maxTokens: 256,
    temperature: 0.3,
  })

  await supabase
    .from('conversations')
    .update({ summary, summary_updated_at: new Date().toISOString() })
    .eq('id', id)

  return NextResponse.json({ summary, summary_updated_at: new Date().toISOString() })
}
