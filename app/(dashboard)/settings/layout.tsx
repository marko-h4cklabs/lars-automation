'use client'

import { useState, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import {
  Percent, ClipboardCheck, Key, Timer, Bot, UserRound, Bell, Plug, Users, Settings
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

interface NavItem {
  href: string
  label: string
  icon: LucideIcon
}

const STATIC_BEFORE: NavItem[] = [
  { href: '/settings/distribution', label: 'Distribution', icon: Percent },
  { href: '/settings/qualification', label: 'Qualification', icon: ClipboardCheck },
  { href: '/settings/keywords', label: 'Keyword Triggers', icon: Key },
  { href: '/settings/followups', label: 'Follow-up Sequences', icon: Timer },
  { href: '/settings/autopilot', label: 'Autopilot AI', icon: Bot },
]

const STATIC_AFTER: NavItem[] = [
  { href: '/settings/notifications', label: 'Notifications', icon: Bell },
  { href: '/settings/integrations', label: 'Integrations', icon: Plug },
  { href: '/settings/team', label: 'Team', icon: Users },
]

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const [setterItems, setSetterItems] = useState<NavItem[]>([])

  useEffect(() => {
    fetch('/api/team')
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        const users = (data?.users || []) as { id: string; name: string; role: string; receives_leads?: boolean }[]
        const items: NavItem[] = users
          .filter((u) => u.role === 'setter' || u.role === 'admin')
          .map((u) => ({
            href: `/settings/copilot/${u.id}`,
            label: `${u.name} Co-Pilot`,
            icon: UserRound,
          }))
        setSetterItems(items)
      })
      .catch(() => {})
  }, [])

  const navItems = [...STATIC_BEFORE, ...setterItems, ...STATIC_AFTER]

  return (
    <div className="flex h-full overflow-hidden">
      {/* Left nav */}
      <div className="w-[220px] border-r border-[#1a1a1a] bg-[#0a0a0a] flex flex-col shrink-0 overflow-y-auto">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-[#1a1a1a]">
          <Settings className="w-3.5 h-3.5 text-[#00ff88]" />
          <span className="text-[10px] font-mono text-[#00ff88] uppercase tracking-wider font-bold">Settings</span>
        </div>
        <nav className="py-1">
          {navItems.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center gap-2.5 px-4 py-2 text-[10px] font-mono transition-colors',
                  isActive
                    ? 'text-[#00ff88] bg-[#00ff88]/[0.05] border-r-2 border-r-[#00ff88]'
                    : 'text-[#666] hover:text-[#999] hover:bg-[#0d0d0d]'
                )}
              >
                <item.icon className="w-3 h-3 shrink-0" />
                {item.label}
              </Link>
            )
          })}
        </nav>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {children}
      </div>
    </div>
  )
}
