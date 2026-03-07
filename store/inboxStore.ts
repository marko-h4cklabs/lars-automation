import { create } from 'zustand'
import type { Conversation, Message, AISuggestion } from '@/types'

interface InboxState {
  // Conversations list (paginated)
  conversations: Conversation[]
  setConversations: (convos: Conversation[]) => void
  addConversation: (convo: Conversation) => void
  updateConversation: (id: string, updates: Partial<Conversation>) => void
  removeConversation: (id: string) => void

  // Pagination
  hasMore: boolean
  setHasMore: (hasMore: boolean) => void
  page: number
  setPage: (page: number) => void
  nextPage: () => void

  // Active conversation messages
  activeMessages: Message[]
  setActiveMessages: (messages: Message[]) => void
  addMessage: (message: Message) => void
  updateMessage: (id: string, updates: Partial<Message>) => void

  // AI suggestions
  aiSuggestions: AISuggestion | null
  setAISuggestions: (suggestions: AISuggestion | null) => void
  isGeneratingSuggestions: boolean
  setGeneratingSuggestions: (generating: boolean) => void

  // Multi-burst message bundling
  pendingMessageBundle: string[]
  addToPendingBundle: (message: string) => void
  clearPendingBundle: () => void

  // Loading states
  isLoadingConversations: boolean
  setLoadingConversations: (loading: boolean) => void
  isLoadingMessages: boolean
  setLoadingMessages: (loading: boolean) => void
}

export const useInboxStore = create<InboxState>((set) => ({
  conversations: [],
  setConversations: (conversations) => set({ conversations }),
  addConversation: (convo) =>
    set((s) => ({
      conversations: [convo, ...s.conversations.filter((c) => c.id !== convo.id)],
    })),
  updateConversation: (id, updates) =>
    set((s) => ({
      conversations: s.conversations.map((c) =>
        c.id === id ? { ...c, ...updates } : c
      ),
    })),
  removeConversation: (id) =>
    set((s) => ({
      conversations: s.conversations.filter((c) => c.id !== id),
    })),

  hasMore: true,
  setHasMore: (hasMore) => set({ hasMore }),
  page: 0,
  setPage: (page) => set({ page }),
  nextPage: () => set((s) => ({ page: s.page + 1 })),

  activeMessages: [],
  setActiveMessages: (messages) => set({ activeMessages: messages }),
  addMessage: (message) =>
    set((s) => ({
      activeMessages: [...s.activeMessages, message],
    })),
  updateMessage: (id, updates) =>
    set((s) => ({
      activeMessages: s.activeMessages.map((m) =>
        m.id === id ? { ...m, ...updates } : m
      ),
    })),

  aiSuggestions: null,
  setAISuggestions: (suggestions) => set({ aiSuggestions: suggestions }),
  isGeneratingSuggestions: false,
  setGeneratingSuggestions: (generating) => set({ isGeneratingSuggestions: generating }),

  pendingMessageBundle: [],
  addToPendingBundle: (message) =>
    set((s) => ({
      pendingMessageBundle: [...s.pendingMessageBundle, message],
    })),
  clearPendingBundle: () => set({ pendingMessageBundle: [] }),

  isLoadingConversations: false,
  setLoadingConversations: (loading) => set({ isLoadingConversations: loading }),
  isLoadingMessages: false,
  setLoadingMessages: (loading) => set({ isLoadingMessages: loading }),
}))
