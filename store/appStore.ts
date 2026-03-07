import { create } from 'zustand'
import type {
  User,
  AutopilotSettings,
  DistributionSettings,
  LeadSource,
  LeadStage,
} from '@/types'

interface InboxFilters {
  assignedTo: string | null
  stage: LeadStage | null
  source: LeadSource | null
  dateRange: { from: string | null; to: string | null }
}

interface AppState {
  // User
  currentUser: User | null
  setCurrentUser: (user: User | null) => void

  // Online setters
  onlineSetters: User[]
  setOnlineSetters: (setters: User[]) => void

  // Notifications
  unreadNotifications: number
  setUnreadNotifications: (count: number) => void
  incrementUnread: () => void
  resetUnread: () => void

  // Active conversation
  activeConversationId: string | null
  setActiveConversationId: (id: string | null) => void

  // Inbox filters
  inboxFilters: InboxFilters
  setInboxFilters: (filters: Partial<InboxFilters>) => void
  resetInboxFilters: () => void

  // Settings
  distributionSettings: DistributionSettings | null
  setDistributionSettings: (settings: DistributionSettings | null) => void
  autopilotSettings: AutopilotSettings | null
  setAutopilotSettings: (settings: AutopilotSettings | null) => void

  // Realtime connection
  isRealtimeConnected: boolean
  setRealtimeConnected: (connected: boolean) => void
}

const defaultFilters: InboxFilters = {
  assignedTo: null,
  stage: null,
  source: null,
  dateRange: { from: null, to: null },
}

export const useAppStore = create<AppState>((set) => ({
  currentUser: null,
  setCurrentUser: (user) => set({ currentUser: user }),

  onlineSetters: [],
  setOnlineSetters: (setters) => set({ onlineSetters: setters }),

  unreadNotifications: 0,
  setUnreadNotifications: (count) => set({ unreadNotifications: count }),
  incrementUnread: () => set((s) => ({ unreadNotifications: s.unreadNotifications + 1 })),
  resetUnread: () => set({ unreadNotifications: 0 }),

  activeConversationId: null,
  setActiveConversationId: (id) => set({ activeConversationId: id }),

  inboxFilters: defaultFilters,
  setInboxFilters: (filters) =>
    set((s) => ({ inboxFilters: { ...s.inboxFilters, ...filters } })),
  resetInboxFilters: () => set({ inboxFilters: defaultFilters }),

  distributionSettings: null,
  setDistributionSettings: (settings) => set({ distributionSettings: settings }),
  autopilotSettings: null,
  setAutopilotSettings: (settings) => set({ autopilotSettings: settings }),

  isRealtimeConnected: false,
  setRealtimeConnected: (connected) => set({ isRealtimeConnected: connected }),
}))
