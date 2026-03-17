'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { LogOut, ChevronDown, Circle } from 'lucide-react'
import { createBrowserSupabaseClient } from '@/lib/supabase'
import { useUser } from '@/hooks/useUser'

export function UserMenu() {
  const { user, updateStatus } = useUser()
  const [open, setOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const router = useRouter()

  // Close on click outside
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  if (!user) return null

  const isOnline = user.status === 'online'

  const roleBadgeColor: Record<string, string> = {
    admin: 'bg-[#00ff88]/20 text-[#00ff88]',
    setter: 'bg-blue-500/20 text-blue-400',
    viewer: 'bg-[#444]/30 text-[#888]',
  }

  async function handleSignOut() {
    const supabase = createBrowserSupabaseClient()
    await updateStatus('offline')
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  async function toggleStatus() {
    const newStatus = isOnline ? 'offline' : 'online'
    await updateStatus(newStatus)
  }

  return (
    <div ref={menuRef} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-3 py-1.5 rounded hover:bg-[#1a1a1a] transition-colors"
      >
        {/* Avatar */}
        <div className="relative">
          <div className="w-7 h-7 rounded-full bg-[#222] flex items-center justify-center text-[#f0f0f0] text-xs font-mono font-bold uppercase">
            {user.name?.charAt(0) || '?'}
          </div>
          <Circle
            className={`absolute -bottom-0.5 -right-0.5 w-4 h-4 ${
              isOnline ? 'text-[#00ff88] fill-[#00ff88]' : 'text-[#444] fill-[#444]'
            }`}
          />
        </div>

        <span className="text-[#f0f0f0] text-xs font-mono hidden sm:inline">
          {user.name}
        </span>
        <ChevronDown className="w-4 h-4 text-[#666]" />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 w-56 bg-[#111] border border-[#222] rounded shadow-xl z-50">
          {/* User info */}
          <div className="px-4 py-3 border-b border-[#222]">
            <p className="text-[#f0f0f0] text-sm font-mono">{user.name}</p>
            <p className="text-[#666] text-xs font-mono mt-0.5">{user.email}</p>
            <span
              className={`inline-block mt-2 px-2 py-0.5 rounded text-[13px] font-mono uppercase tracking-wider ${
                roleBadgeColor[user.role] || roleBadgeColor.viewer
              }`}
            >
              {user.role}
            </span>
          </div>

          {/* Online/Offline toggle */}
          <div className="px-4 py-2.5 border-b border-[#222]">
            <button
              onClick={toggleStatus}
              className="w-full flex items-center justify-between text-xs font-mono"
            >
              <span className="text-[#888]">Status</span>
              <div className="flex items-center gap-2">
                <Circle
                  className={`w-3.5 h-3.5 ${
                    isOnline ? 'text-[#00ff88] fill-[#00ff88]' : 'text-[#444] fill-[#444]'
                  }`}
                />
                <span className={isOnline ? 'text-[#00ff88]' : 'text-[#666]'}>
                  {isOnline ? 'Online' : 'Offline'}
                </span>
              </div>
            </button>
          </div>

          {/* Sign out */}
          <div className="px-2 py-2">
            <button
              onClick={handleSignOut}
              className="w-full flex items-center gap-2 px-2 py-2 rounded text-xs font-mono text-[#888] hover:bg-[#1a1a1a] hover:text-red-400 transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" />
              Sign Out
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
