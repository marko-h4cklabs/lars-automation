'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Inbox,
  Users,
  BarChart3,
  Brain,
  Drama,
  Mic,
  ClipboardList,
  Settings,
  FlaskConical,
  GraduationCap,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useUser } from '@/hooks/useUser'
import { StatusDot } from '@/components/ui/status-dot'

const navItems = [
  { href: '/inbox', label: 'INBOX', icon: Inbox, roles: ['admin', 'setter', 'viewer'] },
  { href: '/crm', label: 'CRM', icon: Users, roles: ['admin', 'setter', 'viewer'] },
  { href: '/dashboard', label: 'DASHBOARD', icon: BarChart3, roles: ['admin', 'viewer'] },
  { href: '/knowledge', label: 'KNOWLEDGE', icon: Brain, roles: ['admin', 'setter'] },
  { href: '/persona', label: 'PERSONA', icon: Drama, roles: ['admin'] },
  { href: '/voice', label: 'VOICE', icon: Mic, roles: ['admin'] },
  { href: '/templates', label: 'TEMPLATES', icon: ClipboardList, roles: ['admin', 'setter'] },
  { href: '/settings', label: 'SETTINGS', icon: Settings, roles: ['admin'] },
  { href: '/testing', label: 'TESTING', icon: FlaskConical, roles: ['admin'] },
  { href: '/learning', label: 'LEARNING', icon: GraduationCap, roles: ['admin'] },
]

export function Sidebar() {
  const pathname = usePathname()
  const { user, updateStatus } = useUser()
  const userRole = user?.role || 'viewer'

  const filteredNav = navItems.filter((item) => item.roles.includes(userRole))

  return (
    <aside className="w-[220px] h-screen bg-[#0d0d0d] border-r border-[#1a1a1a] flex flex-col shrink-0">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-[#1a1a1a]">
        <Link href="/inbox" className="flex items-center gap-2.5">
          <div className="w-5 h-5 bg-[#00ff88] rounded-sm shrink-0" />
          <span className="font-mono text-sm font-bold tracking-[0.2em] text-[#f0f0f0]">
            BLACKOPS
          </span>
        </Link>
        <p className="text-[#333] font-mono text-[9px] tracking-[0.15em] uppercase mt-1 pl-[30px]">
          Control Tower
        </p>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-3 overflow-y-auto">
        {filteredNav.map((item) => {
          const isActive = pathname === item.href || pathname?.startsWith(item.href + '/')
          const Icon = item.icon

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 px-5 py-2.5 text-[11px] font-mono uppercase tracking-wider transition-colors relative',
                isActive
                  ? 'text-[#f0f0f0] bg-[#111]'
                  : 'text-[#555] hover:text-[#888] hover:bg-[#0f0f0f]'
              )}
            >
              {isActive && (
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[2px] h-5 bg-[#00ff88]" />
              )}
              <Icon className="w-4 h-4 shrink-0" />
              {item.label}
            </Link>
          )
        })}
      </nav>

      {/* Bottom: user status */}
      {user && (
        <div className="px-4 py-3 border-t border-[#1a1a1a]">
          <button
            onClick={() => updateStatus(user.status === 'online' ? 'offline' : 'online')}
            className="flex items-center gap-2.5 w-full px-1 py-1.5 rounded hover:bg-[#111] transition-colors"
          >
            <div className="w-7 h-7 rounded-full bg-[#222] flex items-center justify-center text-[#888] text-[10px] font-mono font-bold uppercase shrink-0">
              {user.name?.charAt(0) || '?'}
            </div>
            <div className="flex-1 text-left min-w-0">
              <p className="text-[#888] text-[10px] font-mono truncate">{user.name}</p>
              <div className="flex items-center gap-1.5">
                <StatusDot status={user.status === 'online' ? 'online' : 'offline'} size="sm" />
                <span className="text-[#555] text-[9px] font-mono uppercase">
                  {user.status === 'online' ? 'Online' : 'Offline'}
                </span>
              </div>
            </div>
          </button>
        </div>
      )}
    </aside>
  )
}
