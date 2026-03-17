'use client'

import { useState, useCallback, useMemo } from 'react'
import { Sidebar } from '@/components/layout/Sidebar'
import { TopBar } from '@/components/layout/TopBar'
import { NotificationPanel } from '@/components/notifications/NotificationPanel'
import { ToastProvider } from '@/components/ui/toast-notification'
import { KeyboardShortcutsModal } from '@/components/ui/keyboard-shortcuts'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { useRealtime } from '@/hooks/useRealtime'
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts'
import { useAppStore } from '@/store/appStore'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [shortcutsOpen, setShortcutsOpen] = useState(false)
  const unreadCount = useAppStore((s) => s.unreadNotifications)

  // Initialize realtime subscriptions
  useRealtime()

  // Global keyboard shortcut: Cmd+/
  const toggleShortcuts = useCallback(() => setShortcutsOpen((v) => !v), [])
  const shortcuts = useMemo(() => ({ '/': toggleShortcuts }), [toggleShortcuts])
  useKeyboardShortcuts(shortcuts)

  return (
    <div className="flex h-screen bg-[#080808] overflow-hidden">
      <ToastProvider />

      {/* Sidebar */}
      <Sidebar />

      {/* Main area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <TopBar
          onToggleNotifications={() => setNotificationsOpen(!notificationsOpen)}
          unreadCount={unreadCount}
        />

        {/* Content */}
        <main className="flex-1 overflow-y-auto p-4">
          <ErrorBoundary>{children}</ErrorBoundary>
        </main>
      </div>

      {/* Notification panel */}
      <NotificationPanel
        open={notificationsOpen}
        onClose={() => setNotificationsOpen(false)}
      />

      {/* Keyboard shortcuts modal */}
      <KeyboardShortcutsModal
        open={shortcutsOpen}
        onClose={() => setShortcutsOpen(false)}
      />
    </div>
  )
}
