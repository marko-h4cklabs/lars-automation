'use client'

import { useState, useEffect } from 'react'
import { Plus, Loader2, Shield, ShieldCheck, UserX, UserCheck, X, Send } from 'lucide-react'
import { cn } from '@/lib/utils'

interface TeamMember {
  id: string
  email: string
  full_name: string
  role: string
  is_active: boolean
  last_seen_at: string | null
  telegram_chat_id: string | null
  created_at: string
}

export default function TeamPage() {
  const [members, setMembers] = useState<TeamMember[]>([])
  const [loading, setLoading] = useState(true)
  const [showInvite, setShowInvite] = useState(false)
  const [editTelegramId, setEditTelegramId] = useState<string | null>(null)
  const [telegramInput, setTelegramInput] = useState('')
  const [saving, setSaving] = useState(false)

  const fetchMembers = async () => {
    try {
      const res = await fetch('/api/settings?section=team')
      if (res.ok) {
        const data = await res.json()
        if (data?.members) setMembers(data.members)
      }
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchMembers() }, [])

  const changeRole = async (userId: string, newRole: string) => {
    setSaving(true)
    try {
      await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ section: 'team', userId, role: newRole }),
      })
      setMembers((prev) => prev.map((m) => m.id === userId ? { ...m, role: newRole } : m))
    } finally {
      setSaving(false)
    }
  }

  const toggleActive = async (userId: string, isActive: boolean) => {
    if (!confirm(isActive ? 'Deactivate this user?' : 'Reactivate this user?')) return
    setSaving(true)
    try {
      await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ section: 'team', userId, is_active: !isActive }),
      })
      setMembers((prev) => prev.map((m) => m.id === userId ? { ...m, is_active: !isActive } : m))
    } finally {
      setSaving(false)
    }
  }

  const saveTelegram = async (userId: string) => {
    setSaving(true)
    try {
      await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ section: 'team', userId, telegram_chat_id: telegramInput || null }),
      })
      setMembers((prev) => prev.map((m) => m.id === userId ? { ...m, telegram_chat_id: telegramInput || null } : m))
      setEditTelegramId(null)
      setTelegramInput('')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="p-8 text-[#444] font-mono text-xs">Loading...</div>

  return (
    <div className="p-6 max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-sm font-mono font-bold text-[#f0f0f0] mb-1">Team Management</h1>
          <p className="text-[10px] font-mono text-[#555]">Manage users, roles, and access to the platform.</p>
        </div>
        <button
          onClick={() => setShowInvite(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-[#00ff88]/10 border border-[#00ff88]/30 rounded text-[9px] font-mono text-[#00ff88] hover:bg-[#00ff88]/20 transition-colors"
        >
          <Plus className="w-3 h-3" /> INVITE USER
        </button>
      </div>

      {/* Invite dialog */}
      {showInvite && (
        <InviteDialog onClose={() => setShowInvite(false)} onInvited={fetchMembers} />
      )}

      {/* Team table */}
      <div className="border border-[#1a1a1a] rounded-lg overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-[#0d0d0d] border-b border-[#1a1a1a]">
              <th className="px-3 py-2 text-left text-[8px] font-mono text-[#555] uppercase">Name</th>
              <th className="px-3 py-2 text-left text-[8px] font-mono text-[#555] uppercase">Email</th>
              <th className="px-3 py-2 text-left text-[8px] font-mono text-[#555] uppercase">Role</th>
              <th className="px-3 py-2 text-left text-[8px] font-mono text-[#555] uppercase">Status</th>
              <th className="px-3 py-2 text-left text-[8px] font-mono text-[#555] uppercase">Last Seen</th>
              <th className="px-3 py-2 text-left text-[8px] font-mono text-[#555] uppercase">Telegram ID</th>
              <th className="px-3 py-2 text-left text-[8px] font-mono text-[#555] uppercase">Actions</th>
            </tr>
          </thead>
          <tbody>
            {members.map((m) => (
              <tr key={m.id} className="border-b border-[#111] hover:bg-[#0d0d0d]">
                <td className="px-3 py-2">
                  <span className="text-[10px] font-mono font-bold text-[#f0f0f0]">{m.full_name || '-'}</span>
                </td>
                <td className="px-3 py-2">
                  <span className="text-[10px] font-mono text-[#888]">{m.email}</span>
                </td>
                <td className="px-3 py-2">
                  <select
                    value={m.role}
                    onChange={(e) => changeRole(m.id, e.target.value)}
                    disabled={saving}
                    className="bg-[#111] border border-[#1a1a1a] rounded px-2 py-0.5 text-[9px] font-mono text-[#ccc] outline-none"
                  >
                    <option value="admin">Admin</option>
                    <option value="setter">Setter</option>
                    <option value="viewer">Viewer</option>
                  </select>
                </td>
                <td className="px-3 py-2">
                  <span className={cn(
                    'inline-flex items-center gap-1 text-[8px] font-mono uppercase px-1.5 py-0.5 rounded',
                    m.is_active
                      ? 'text-[#00ff88] bg-[#00ff88]/10'
                      : 'text-[#f05050] bg-[#f05050]/10'
                  )}>
                    {m.is_active ? <ShieldCheck className="w-2.5 h-2.5" /> : <Shield className="w-2.5 h-2.5" />}
                    {m.is_active ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="px-3 py-2">
                  <span className="text-[9px] font-mono text-[#555]">
                    {m.last_seen_at ? formatTimeAgo(m.last_seen_at) : 'Never'}
                  </span>
                </td>
                <td className="px-3 py-2">
                  {editTelegramId === m.id ? (
                    <div className="flex items-center gap-1">
                      <input
                        value={telegramInput}
                        onChange={(e) => setTelegramInput(e.target.value)}
                        placeholder="Chat ID"
                        className="w-24 bg-[#111] border border-[#1a1a1a] rounded px-2 py-0.5 text-[9px] font-mono text-[#ccc] outline-none focus:border-[#00ff88]/30"
                      />
                      <button onClick={() => saveTelegram(m.id)} className="text-[#00ff88] hover:text-[#00ff88]/80">
                        <ShieldCheck className="w-3 h-3" />
                      </button>
                      <button onClick={() => { setEditTelegramId(null); setTelegramInput('') }} className="text-[#444] hover:text-[#888]">
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => { setEditTelegramId(m.id); setTelegramInput(m.telegram_chat_id || '') }}
                      className="text-[9px] font-mono text-[#666] hover:text-[#ccc]"
                    >
                      {m.telegram_chat_id || 'Set...'}
                    </button>
                  )}
                </td>
                <td className="px-3 py-2">
                  <button
                    onClick={() => toggleActive(m.id, m.is_active)}
                    disabled={saving}
                    className={cn(
                      'flex items-center gap-1 text-[8px] font-mono px-1.5 py-0.5 border rounded transition-colors disabled:opacity-50',
                      m.is_active
                        ? 'text-[#f05050] border-[#f05050]/30 hover:bg-[#f05050]/10'
                        : 'text-[#00ff88] border-[#00ff88]/30 hover:bg-[#00ff88]/10'
                    )}
                  >
                    {m.is_active ? <UserX className="w-2.5 h-2.5" /> : <UserCheck className="w-2.5 h-2.5" />}
                    {m.is_active ? 'DEACTIVATE' : 'ACTIVATE'}
                  </button>
                </td>
              </tr>
            ))}
            {members.length === 0 && (
              <tr>
                <td colSpan={7} className="px-3 py-8 text-center text-[10px] font-mono text-[#444]">
                  No team members yet. Invite your first user above.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function InviteDialog({ onClose, onInvited }: { onClose: () => void; onInvited: () => void }) {
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [role, setRole] = useState('setter')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  const invite = async () => {
    if (!email) return
    setSending(true)
    setError('')
    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ section: 'team_invite', email, full_name: name, role }),
      })
      if (!res.ok) {
        const data = await res.json()
        setError(data.error || 'Failed to send invite')
      } else {
        setSuccess(true)
        onInvited()
        setTimeout(onClose, 1500)
      }
    } catch {
      setError('Network error')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="bg-[#0d0d0d] border border-[#1a1a1a] rounded-lg p-4 mb-6 space-y-3">
      <div className="flex justify-between items-center">
        <span className="text-[9px] font-mono text-[#00ff88] uppercase">Invite New User</span>
        <button onClick={onClose} className="text-[#444] hover:text-[#888]">
          <X className="w-3 h-3" />
        </button>
      </div>

      {success ? (
        <p className="text-[10px] font-mono text-[#00ff88]">Invite sent successfully!</p>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-[8px] font-mono text-[#555] uppercase block mb-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="user@example.com"
                className="w-full bg-[#111] border border-[#1a1a1a] rounded px-2.5 py-1.5 text-[10px] font-mono text-[#ccc] outline-none focus:border-[#00ff88]/30"
              />
            </div>
            <div>
              <label className="text-[8px] font-mono text-[#555] uppercase block mb-1">Full Name</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="John Doe"
                className="w-full bg-[#111] border border-[#1a1a1a] rounded px-2.5 py-1.5 text-[10px] font-mono text-[#ccc] outline-none focus:border-[#00ff88]/30"
              />
            </div>
            <div>
              <label className="text-[8px] font-mono text-[#555] uppercase block mb-1">Role</label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="w-full bg-[#111] border border-[#1a1a1a] rounded px-2.5 py-1.5 text-[10px] font-mono text-[#ccc] outline-none"
              >
                <option value="admin">Admin</option>
                <option value="setter">Setter</option>
                <option value="viewer">Viewer</option>
              </select>
            </div>
          </div>
          {error && <p className="text-[9px] font-mono text-[#f05050]">{error}</p>}
          <button
            onClick={invite}
            disabled={sending || !email}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#00ff88]/10 border border-[#00ff88]/30 rounded text-[9px] font-mono text-[#00ff88] hover:bg-[#00ff88]/20 disabled:opacity-50"
          >
            {sending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />} SEND INVITE
          </button>
        </>
      )}
    </div>
  )
}

function formatTimeAgo(dateStr: string): string {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000)
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}
