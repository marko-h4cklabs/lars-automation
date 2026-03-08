'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  BarChart3, Calendar, MessageSquare, Users, Phone, Zap,
  Flame, Bot, UserCheck, Activity, Bell, Shield, UserMinus,
  AlertTriangle,
} from 'lucide-react'
import { MetricCard } from '@/components/ui/metric-card'
import { LoadingMetricCards, LoadingChart } from '@/components/ui/loading-pulse'
import { ErrorState } from '@/components/ui/error-state'
import { ResponsiveTable } from '@/components/ui/responsive-table'
import { cn } from '@/lib/utils'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell,
  BarChart, Bar,
} from 'recharts'

// ═══════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════

interface AnalyticsData {
  kpis: {
    totalDms: number
    callsOffered: number
    callsBooked: number
    bookingRate: number
    aiBookings: number
    setterBookings: number
    avgHeatScore: number
  }
  dailyMetrics: { day: string; inboundDms: number; bookings: number }[]
  stageDistribution: Record<string, number>
  setterPerformance: {
    id: string; name: string; type: string
    leads: number; replied: number; qualified: number; booked: number
    convRate: number; avgSpeed: number
  }[]
  funnel: { totalDms: number; replied: number; qualifying: number; callOffered: number; booked: number }
  bookingsBySource: Record<string, number>
  bookingsByHour: number[]
  aiMetrics: {
    generated: number; used: number; usedRate: number
    copilotAccuracy: number; autopilotBookingRate: number
  }
  activityFeed: {
    id: string; type: string; message: string
    leadId: string | null; createdAt: string; source: string
  }[]
}

type DatePreset = 'today' | 'week' | 'month' | 'custom'

// ═══════════════════════════════════════════════════════════════
// Constants
// ═══════════════════════════════════════════════════════════════

const STAGE_COLORS: Record<string, string> = {
  new: '#00ff88',
  contacted: '#54a0ff',
  qualifying: '#ff9f43',
  call_offered: '#f05050',
  call_booked: '#5f27cd',
  showed: '#10ac84',
  no_show: '#ee5a24',
}

const STAGE_LABELS: Record<string, string> = {
  new: 'New',
  contacted: 'Contacted',
  qualifying: 'Qualifying',
  call_offered: 'Call Offered',
  call_booked: 'Call Booked',
  showed: 'Showed',
  no_show: 'No Show',
}

const SOURCE_COLORS: Record<string, string> = {
  dm: '#00ff88',
  story_reply: '#54a0ff',
  comment: '#ff9f43',
  follow: '#5f27cd',
  keyword: '#f05050',
}

const SOURCE_LABELS: Record<string, string> = {
  dm: 'DM',
  story_reply: 'Story Reply',
  comment: 'Comment',
  follow: 'Follow',
  keyword: 'Keyword',
}

const ACTIVITY_ICONS: Record<string, typeof Bell> = {
  call_booked: Phone,
  hot_lead: Flame,
  setter_offline: UserMinus,
  ai_takeover: Bot,
  disqualified: AlertTriangle,
}

// ═══════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════

function getDateRange(preset: DatePreset): { from: string; to: string } {
  const now = new Date()
  const to = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999)

  if (preset === 'today') {
    const from = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0)
    return { from: from.toISOString(), to: to.toISOString() }
  }
  if (preset === 'week') {
    const from = new Date(now)
    from.setDate(now.getDate() - now.getDay())
    from.setHours(0, 0, 0, 0)
    return { from: from.toISOString(), to: to.toISOString() }
  }
  // month
  const from = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0)
  return { from: from.toISOString(), to: to.toISOString() }
}

function formatSpeed(seconds: number): string {
  if (seconds === 0) return '-'
  if (seconds < 60) return `${Math.round(seconds)}s`
  if (seconds < 3600) return `${(seconds / 60).toFixed(1)}min`
  return `${(seconds / 3600).toFixed(1)}hr`
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

function formatDay(day: string): string {
  const d = new Date(day)
  return `${d.getMonth() + 1}/${d.getDate()}`
}

// ═══════════════════════════════════════════════════════════════
// Custom Tooltip
// ═══════════════════════════════════════════════════════════════

function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: { value: number; name: string; color: string }[]; label?: string }) {
  if (!active || !payload) return null
  return (
    <div className="bg-[#111] border border-[#333] rounded px-3 py-2 shadow-xl">
      <p className="text-[9px] font-mono text-[#666] mb-1">{label}</p>
      {payload.map((p) => (
        <p key={p.name} className="text-[10px] font-mono" style={{ color: p.color }}>
          {p.name}: {p.value}
        </p>
      ))}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
// Main Component
// ═══════════════════════════════════════════════════════════════

export default function DashboardPage() {
  const [preset, setPreset] = useState<DatePreset>('month')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')
  const [data, setData] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  const fetchData = useCallback(async (from: string, to: string) => {
    setLoading(true)
    setError(false)
    try {
      const res = await fetch(`/api/analytics?dateFrom=${encodeURIComponent(from)}&dateTo=${encodeURIComponent(to)}`)
      if (!res.ok) throw new Error('Failed')
      const json = await res.json()
      setData(json)
    } catch {
      setError(true)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    if (preset === 'custom') {
      if (customFrom && customTo) {
        fetchData(new Date(customFrom).toISOString(), new Date(customTo + 'T23:59:59.999Z').toISOString())
      }
    } else {
      const { from, to } = getDateRange(preset)
      fetchData(from, to)
    }
  }, [preset, customFrom, customTo, fetchData])

  const k = data?.kpis

  return (
    <div className="h-full overflow-y-auto bg-[#080808]">
      <div className="max-w-[1400px] mx-auto px-6 py-6 space-y-6">

        {/* ── Header + Date Range ── */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-[#00ff88]" />
            <h1 className="text-[13px] font-mono text-[#00ff88] uppercase tracking-wider font-bold">Dashboard</h1>
          </div>
          <div className="flex items-center gap-2">
            {(['today', 'week', 'month'] as DatePreset[]).map((p) => (
              <button
                key={p}
                onClick={() => setPreset(p)}
                className={cn(
                  'px-3 py-1 rounded text-[9px] font-mono uppercase tracking-wider transition-colors',
                  preset === p
                    ? 'bg-[#00ff88]/10 text-[#00ff88] border border-[#00ff88]/30'
                    : 'text-[#555] hover:text-[#888] border border-[#222]'
                )}
              >
                {p === 'week' ? 'This Week' : p === 'month' ? 'This Month' : 'Today'}
              </button>
            ))}
            <button
              onClick={() => setPreset('custom')}
              className={cn(
                'px-2 py-1 rounded text-[9px] font-mono transition-colors',
                preset === 'custom'
                  ? 'bg-[#00ff88]/10 text-[#00ff88] border border-[#00ff88]/30'
                  : 'text-[#555] hover:text-[#888] border border-[#222]'
              )}
            >
              <Calendar className="w-3 h-3" />
            </button>
            {preset === 'custom' && (
              <div className="flex items-center gap-1">
                <input
                  type="date"
                  value={customFrom}
                  onChange={(e) => setCustomFrom(e.target.value)}
                  className="bg-[#111] border border-[#222] rounded px-2 py-1 text-[9px] font-mono text-[#ccc]"
                />
                <span className="text-[#444] text-[9px]">→</span>
                <input
                  type="date"
                  value={customTo}
                  onChange={(e) => setCustomTo(e.target.value)}
                  className="bg-[#111] border border-[#222] rounded px-2 py-1 text-[9px] font-mono text-[#ccc]"
                />
              </div>
            )}
          </div>
        </div>

        {loading && !data ? (
          <div className="space-y-6">
            <LoadingMetricCards count={6} />
            <div className="grid grid-cols-5 gap-4">
              <div className="col-span-3"><LoadingChart /></div>
              <div className="col-span-2"><LoadingChart /></div>
            </div>
          </div>
        ) : error ? (
          <ErrorState
            message="Failed to load analytics"
            onRetry={() => {
              const { from, to } = getDateRange(preset)
              fetchData(from, to)
            }}
          />
        ) : (
          <>
            {/* ── ROW 1: KPI Cards ── */}
            <div className="grid grid-cols-6 gap-3">
              <MetricCard label="Total DMs" value={k?.totalDms ?? 0} />
              <MetricCard label="Calls Offered" value={k?.callsOffered ?? 0} />
              <MetricCard label="Calls Booked" value={k?.callsBooked ?? 0} />
              <MetricCard label="Booking Rate" value={`${k?.bookingRate ?? 0}%`} />
              <MetricCard
                label="AI vs Setter"
                value={`${k?.aiBookings ?? 0} / ${k?.setterBookings ?? 0}`}
              />
              <MetricCard label="Avg Heat Score" value={k?.avgHeatScore ?? 0} />
            </div>

            {/* ── ROW 2: Line Chart + Donut ── */}
            <div className="grid grid-cols-5 gap-4">
              {/* Daily Volume */}
              <div className="col-span-3 bg-[#0a0a0a] border border-[#1a1a1a] rounded-lg p-4">
                <div className="flex items-center gap-2 mb-4">
                  <MessageSquare className="w-3 h-3 text-[#00ff88]" />
                  <span className="text-[9px] font-mono text-[#555] uppercase tracking-wider">Daily Volume</span>
                  <div className="flex items-center gap-3 ml-auto">
                    <span className="flex items-center gap-1 text-[8px] font-mono text-[#00ff88]">
                      <span className="w-2 h-[2px] bg-[#00ff88] rounded" /> DMs
                    </span>
                    <span className="flex items-center gap-1 text-[8px] font-mono text-[#ff9f43]">
                      <span className="w-2 h-[2px] bg-[#ff9f43] rounded" /> Bookings
                    </span>
                  </div>
                </div>
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={data?.dailyMetrics || []}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1a1a1a" />
                    <XAxis dataKey="day" tickFormatter={formatDay} tick={{ fontSize: 9, fontFamily: 'monospace', fill: '#444' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 9, fontFamily: 'monospace', fill: '#444' }} axisLine={false} tickLine={false} />
                    <Tooltip content={<ChartTooltip />} />
                    <Line type="monotone" dataKey="inboundDms" name="DMs" stroke="#00ff88" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="bookings" name="Bookings" stroke="#ff9f43" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              {/* Stage Distribution Donut */}
              <div className="col-span-2 bg-[#0a0a0a] border border-[#1a1a1a] rounded-lg p-4">
                <div className="flex items-center gap-2 mb-4">
                  <Users className="w-3 h-3 text-[#54a0ff]" />
                  <span className="text-[9px] font-mono text-[#555] uppercase tracking-wider">Lead Stages</span>
                </div>
                <ResponsiveContainer width="100%" height={180}>
                  <PieChart>
                    <Pie
                      data={Object.entries(data?.stageDistribution || {}).map(([stage, count]) => ({
                        name: STAGE_LABELS[stage] || stage,
                        value: count,
                        fill: STAGE_COLORS[stage] || '#333',
                      }))}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={75}
                      dataKey="value"
                      strokeWidth={0}
                    >
                      {Object.entries(data?.stageDistribution || {}).map(([stage]) => (
                        <Cell key={stage} fill={STAGE_COLORS[stage] || '#333'} />
                      ))}
                    </Pie>
                    <Tooltip content={<ChartTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2">
                  {Object.entries(data?.stageDistribution || {}).map(([stage, count]) => (
                    <div key={stage} className="flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: STAGE_COLORS[stage] || '#333' }} />
                      <span className="text-[7px] font-mono text-[#555]">{STAGE_LABELS[stage] || stage}</span>
                      <span className="text-[7px] font-mono text-[#333]">{count}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* ── ROW 3: Setter vs AI Performance ── */}
            <div className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-lg p-4">
              <div className="flex items-center gap-2 mb-4">
                <Shield className="w-3 h-3 text-[#5f27cd]" />
                <span className="text-[9px] font-mono text-[#555] uppercase tracking-wider">Setter vs AI Performance</span>
              </div>
              <ResponsiveTable>
                <table className="w-full text-[10px] font-mono">
                  <thead>
                    <tr className="border-b border-[#1a1a1a]">
                      <th className="text-left text-[#444] py-2 px-3 uppercase tracking-wider text-[8px]">Metric</th>
                      {(data?.setterPerformance || []).map((p) => (
                        <th
                          key={p.id}
                          className={cn(
                            'text-center py-2 px-3 uppercase tracking-wider text-[8px]',
                            p.type === 'ai' ? 'text-[#00ff88]' : 'text-[#888]'
                          )}
                        >
                          {p.name}
                        </th>
                      ))}
                      <th className="text-center text-[#888] py-2 px-3 uppercase tracking-wider text-[8px]">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { label: 'Leads', key: 'leads' as const },
                      { label: 'Replied', key: 'replied' as const },
                      { label: 'Qualified', key: 'qualified' as const },
                      { label: 'Booked', key: 'booked' as const },
                    ].map((row) => (
                      <tr key={row.key} className="border-b border-[#111]">
                        <td className="text-[#666] py-2 px-3">{row.label}</td>
                        {(data?.setterPerformance || []).map((p) => (
                          <td key={p.id} className={cn('text-center py-2 px-3', p.type === 'ai' ? 'text-[#00ff88]' : 'text-[#ccc]')}>
                            {p[row.key]}
                          </td>
                        ))}
                        <td className="text-center py-2 px-3 text-[#f0f0f0] font-bold">
                          {(data?.setterPerformance || []).reduce((s, p) => s + p[row.key], 0)}
                        </td>
                      </tr>
                    ))}
                    <tr className="border-b border-[#111]">
                      <td className="text-[#666] py-2 px-3">Conv Rate</td>
                      {(data?.setterPerformance || []).map((p) => (
                        <td key={p.id} className={cn('text-center py-2 px-3', p.type === 'ai' ? 'text-[#00ff88]' : 'text-[#ccc]')}>
                          {p.convRate}%
                        </td>
                      ))}
                      <td className="text-center py-2 px-3 text-[#f0f0f0] font-bold">
                        {(() => {
                          const perf = data?.setterPerformance || []
                          const totalLeads = perf.reduce((s, p) => s + p.leads, 0)
                          const totalBooked = perf.reduce((s, p) => s + p.booked, 0)
                          return totalLeads > 0 ? `${Math.round((totalBooked / totalLeads) * 1000) / 10}%` : '0%'
                        })()}
                      </td>
                    </tr>
                    <tr>
                      <td className="text-[#666] py-2 px-3">Avg Speed</td>
                      {(data?.setterPerformance || []).map((p) => (
                        <td key={p.id} className={cn('text-center py-2 px-3', p.type === 'ai' ? 'text-[#00ff88]' : 'text-[#ccc]')}>
                          {formatSpeed(p.avgSpeed)}
                        </td>
                      ))}
                      <td className="text-center py-2 px-3 text-[#444]">—</td>
                    </tr>
                  </tbody>
                </table>
              </ResponsiveTable>
            </div>

            {/* ── ROW 4: Bookings by Source + Bookings by Hour ── */}
            <div className="grid grid-cols-2 gap-4">
              {/* By Source */}
              <div className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-lg p-4">
                <div className="flex items-center gap-2 mb-4">
                  <Zap className="w-3 h-3 text-[#ff9f43]" />
                  <span className="text-[9px] font-mono text-[#555] uppercase tracking-wider">Bookings by Source</span>
                </div>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={Object.entries(data?.bookingsBySource || {}).map(([source, count]) => ({
                    name: SOURCE_LABELS[source] || source,
                    count,
                    fill: SOURCE_COLORS[source] || '#555',
                  }))}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1a1a1a" />
                    <XAxis dataKey="name" tick={{ fontSize: 8, fontFamily: 'monospace', fill: '#444' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 8, fontFamily: 'monospace', fill: '#444' }} axisLine={false} tickLine={false} />
                    <Tooltip content={<ChartTooltip />} />
                    <Bar dataKey="count" name="Bookings" radius={[3, 3, 0, 0]}>
                      {Object.entries(data?.bookingsBySource || {}).map(([source]) => (
                        <Cell key={source} fill={SOURCE_COLORS[source] || '#555'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* By Hour */}
              <div className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-lg p-4">
                <div className="flex items-center gap-2 mb-4">
                  <Activity className="w-3 h-3 text-[#54a0ff]" />
                  <span className="text-[9px] font-mono text-[#555] uppercase tracking-wider">Bookings by Hour</span>
                </div>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={(data?.bookingsByHour || new Array(24).fill(0)).map((count, hour) => ({
                    hour: `${hour}:00`,
                    count,
                  }))}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1a1a1a" />
                    <XAxis dataKey="hour" tick={{ fontSize: 7, fontFamily: 'monospace', fill: '#444' }} axisLine={false} tickLine={false} interval={2} />
                    <YAxis tick={{ fontSize: 8, fontFamily: 'monospace', fill: '#444' }} axisLine={false} tickLine={false} />
                    <Tooltip content={<ChartTooltip />} />
                    <Bar dataKey="count" name="Bookings" radius={[2, 2, 0, 0]}>
                      {(data?.bookingsByHour || new Array(24).fill(0)).map((count, i) => {
                        const max = Math.max(...(data?.bookingsByHour || [1]))
                        const intensity = max > 0 ? count / max : 0
                        const r = Math.round(0 + intensity * 0)
                        const g = Math.round(100 + intensity * 155)
                        const b = Math.round(50 + intensity * 86)
                        return <Cell key={i} fill={`rgb(${r}, ${g}, ${b})`} />
                      })}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* ── ROW 5: Conversion Funnel ── */}
            <div className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-lg p-4">
              <div className="flex items-center gap-2 mb-4">
                <UserCheck className="w-3 h-3 text-[#00ff88]" />
                <span className="text-[9px] font-mono text-[#555] uppercase tracking-wider">Conversion Funnel</span>
              </div>
              <FunnelChart funnel={data?.funnel || { totalDms: 0, replied: 0, qualifying: 0, callOffered: 0, booked: 0 }} />
            </div>

            {/* ── ROW 6: AI Performance ── */}
            <div className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-lg p-4">
              <div className="flex items-center gap-2 mb-4">
                <Bot className="w-3 h-3 text-[#00ff88]" />
                <span className="text-[9px] font-mono text-[#555] uppercase tracking-wider">AI Performance</span>
              </div>
              <div className="grid grid-cols-5 gap-3">
                <MetricCard label="Suggestions Generated" value={data?.aiMetrics?.generated ?? 0} />
                <MetricCard label="Suggestions Used" value={`${data?.aiMetrics?.used ?? 0} (${data?.aiMetrics?.usedRate ?? 0}%)`} />
                <MetricCard label="Used → Booking" value={data?.aiMetrics?.autopilotBookingRate ?? 0} />
                <MetricCard label="Co-pilot Accuracy" value={`${data?.aiMetrics?.copilotAccuracy ?? 0}%`} />
                <MetricCard label="Autopilot Bookings" value={data?.kpis?.aiBookings ?? 0} />
              </div>
            </div>

            {/* ── ROW 7: Outbound Trigger Performance (FIX 4) ── */}
            <OutboundTriggerSection preset={preset} customFrom={customFrom} customTo={customTo} />

            {/* ── ROW 8: Lead Flow Performance (FIX 6) ── */}
            <LeadFlowSection preset={preset} customFrom={customFrom} customTo={customTo} />

            {/* ── ROW 9: Activity Feed ── */}
            <div className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-lg p-4">
              <div className="flex items-center gap-2 mb-4">
                <Activity className="w-3 h-3 text-[#ff9f43]" />
                <span className="text-[9px] font-mono text-[#555] uppercase tracking-wider">Recent Activity</span>
              </div>
              <div className="space-y-0 max-h-[300px] overflow-y-auto">
                {(data?.activityFeed || []).length === 0 && (
                  <p className="text-[10px] font-mono text-[#333] text-center py-6">No recent activity</p>
                )}
                {(data?.activityFeed || []).map((event) => {
                  const Icon = ACTIVITY_ICONS[event.type] || Bell
                  return (
                    <div key={event.id} className="flex items-center gap-3 py-2 px-2 border-b border-[#111] last:border-0">
                      <Icon className="w-3 h-3 text-[#444] shrink-0" />
                      <span className="text-[10px] font-mono text-[#888] flex-1 truncate">{event.message}</span>
                      <span className="text-[8px] font-mono text-[#333] shrink-0">{timeAgo(event.createdAt)}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
// Funnel Component
// ═══════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════
// Outbound Trigger Performance (FIX 4)
// ═══════════════════════════════════════════════════════════════

interface TriggerData {
  triggerType: string; label: string; sent: number; replied: number; replyRate: number
}

function OutboundTriggerSection({ preset, customFrom, customTo }: { preset: DatePreset; customFrom: string; customTo: string }) {
  const [triggers, setTriggers] = useState<TriggerData[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const range = preset === 'custom' && customFrom && customTo
      ? { from: new Date(customFrom).toISOString(), to: new Date(customTo + 'T23:59:59.999Z').toISOString() }
      : getDateRange(preset)

    setLoading(true)
    fetch(`/api/analytics/trigger-performance?dateFrom=${encodeURIComponent(range.from)}&dateTo=${encodeURIComponent(range.to)}`)
      .then((r) => r.json())
      .then((d) => setTriggers(d.triggers || []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [preset, customFrom, customTo])

  if (loading) return <div className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-lg p-4"><LoadingChart /></div>

  return (
    <div className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-lg p-4">
      <div className="flex items-center gap-2 mb-4">
        <Zap className="w-3 h-3 text-[#ff9f43]" />
        <span className="text-[9px] font-mono text-[#555] uppercase tracking-wider">Outbound Trigger Performance</span>
      </div>
      <div className="grid grid-cols-4 gap-3">
        {triggers.map((t) => {
          const color = t.replyRate >= 30 ? '#00ff88' : t.replyRate >= 15 ? '#ff9f43' : '#f05050'
          return (
            <div key={t.triggerType} className="bg-[#0d0d0d] border border-[#1a1a1a] rounded-lg p-3">
              <div className="text-[9px] font-mono text-[#666] uppercase tracking-wider mb-2">{t.label}</div>
              <div className="text-[18px] font-mono font-bold text-[#f0f0f0] mb-1">{t.replyRate}%</div>
              <div className="text-[9px] font-mono text-[#444] mb-2">{t.sent} sent / {t.replied} replied</div>
              <div className="h-1.5 bg-[#111] rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{ width: `${Math.min(t.replyRate, 100)}%`, backgroundColor: color }}
                />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
// Lead Flow Performance (FIX 6)
// ═══════════════════════════════════════════════════════════════

interface FlowData {
  id: string; label: string; description: string; sent: number; replied: number; replyRate: number; sparkline: number[]
}

function LeadFlowSection({ preset, customFrom, customTo }: { preset: DatePreset; customFrom: string; customTo: string }) {
  const [flows, setFlows] = useState<FlowData[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const range = preset === 'custom' && customFrom && customTo
      ? { from: new Date(customFrom).toISOString(), to: new Date(customTo + 'T23:59:59.999Z').toISOString() }
      : getDateRange(preset)

    setLoading(true)
    fetch(`/api/analytics/lead-flows?dateFrom=${encodeURIComponent(range.from)}&dateTo=${encodeURIComponent(range.to)}`)
      .then((r) => r.json())
      .then((d) => setFlows(d.flows || []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [preset, customFrom, customTo])

  if (loading) return <div className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-lg p-4"><LoadingChart /></div>

  return (
    <div className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-lg p-4">
      <div className="flex items-center gap-2 mb-4">
        <MessageSquare className="w-3 h-3 text-[#54a0ff]" />
        <span className="text-[9px] font-mono text-[#555] uppercase tracking-wider">Lead Flow Performance</span>
      </div>
      <div className="grid grid-cols-3 gap-3">
        {flows.map((flow) => {
          const color = flow.replyRate >= 30 ? '#00ff88' : flow.replyRate >= 15 ? '#ff9f43' : '#f05050'
          const maxSparkline = Math.max(...flow.sparkline, 1)
          return (
            <div key={flow.id} className="bg-[#0d0d0d] border border-[#1a1a1a] rounded-lg p-3">
              <div className="text-[9px] font-mono text-[#666] uppercase tracking-wider mb-1">{flow.label}</div>
              <div className="text-[8px] font-mono text-[#333] mb-3">{flow.description}</div>
              <div className="flex items-end gap-1 mb-2">
                <span className="text-[22px] font-mono font-bold" style={{ color }}>{flow.replyRate}%</span>
                <span className="text-[9px] font-mono text-[#444] mb-1">reply rate</span>
              </div>
              <div className="text-[9px] font-mono text-[#555] mb-3">
                {flow.sent} triggered / {flow.replied} replied
              </div>
              {/* Mini sparkline */}
              <div className="flex items-end gap-[2px] h-6">
                {flow.sparkline.map((val, i) => (
                  <div
                    key={i}
                    className="flex-1 rounded-t"
                    style={{
                      height: `${Math.max((val / maxSparkline) * 100, 8)}%`,
                      backgroundColor: `${color}40`,
                    }}
                  />
                ))}
              </div>
              <div className="text-[7px] font-mono text-[#333] mt-1">7-day trend</div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
// Funnel Component
// ═══════════════════════════════════════════════════════════════

function FunnelChart({ funnel }: { funnel: { totalDms: number; replied: number; qualifying: number; callOffered: number; booked: number } }) {
  const stages = [
    { label: 'DMs Received', value: funnel.totalDms, color: '#00ff88' },
    { label: 'Replied', value: funnel.replied, color: '#54a0ff' },
    { label: 'Qualifying', value: funnel.qualifying, color: '#ff9f43' },
    { label: 'Call Offered', value: funnel.callOffered, color: '#f05050' },
    { label: 'Booked', value: funnel.booked, color: '#5f27cd' },
  ]

  const max = stages[0].value || 1

  return (
    <div className="space-y-2">
      {stages.map((stage, i) => {
        const width = Math.max((stage.value / max) * 100, 8)
        const prevValue = i > 0 ? stages[i - 1].value : 0
        const dropPct = prevValue > 0 ? Math.round(((prevValue - stage.value) / prevValue) * 100) : 0

        return (
          <div key={stage.label} className="flex items-center gap-3">
            <div className="w-24 text-right">
              <span className="text-[9px] font-mono text-[#666]">{stage.label}</span>
            </div>
            <div className="flex-1 relative">
              <div
                className="h-8 rounded flex items-center px-3 transition-all"
                style={{
                  width: `${width}%`,
                  backgroundColor: `${stage.color}15`,
                  borderLeft: `3px solid ${stage.color}`,
                }}
              >
                <span className="text-[11px] font-mono font-bold" style={{ color: stage.color }}>
                  {stage.value}
                </span>
              </div>
            </div>
            <div className="w-16 text-right">
              {i > 0 && (
                <span className="text-[8px] font-mono text-[#f05050]">
                  −{dropPct}%
                </span>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
