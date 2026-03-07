'use client'

import { useState } from 'react'
import { Sidebar } from '@/components/layout/Sidebar'
import { TopBar } from '@/components/layout/TopBar'
import { NotificationPanel } from '@/components/notifications/NotificationPanel'
import { ToastProvider } from '@/components/ui/toast-notification'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const [notificationsOpen, setNotificationsOpen] = useState(false)

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
          unreadCount={0}
        />

        {/* Content */}
        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>

      {/* Notification panel */}
      <NotificationPanel
        open={notificationsOpen}
        onClose={() => setNotificationsOpen(false)}
      />
    </div>
  )
}
