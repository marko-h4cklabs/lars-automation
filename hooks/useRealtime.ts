'use client'

import { useEffect, useRef, useCallback } from 'react'
import { createBrowserSupabaseClient } from '@/lib/supabase'
import { useAppStore } from '@/store/appStore'
import { useInboxStore } from '@/store/inboxStore'
import { showToast } from '@/components/ui/toast-notification'
import type { RealtimeChannel } from '@supabase/supabase-js'
import type { Conversation, Message, Notification, User } from '@/types'

export function useRealtime() {
  const supabaseRef = useRef<ReturnType<typeof createBrowserSupabaseClient> | null>(null)
  const channelRef = useRef<RealtimeChannel | null>(null)

  const {
    setRealtimeConnected,
    incrementUnread,
    setOnlineSetters,
    activeConversationId,
  } = useAppStore()

  const {
    addConversation,
    updateConversation,
    addMessage,
  } = useInboxStore()

  function getSupabase() {
    if (!supabaseRef.current) {
      supabaseRef.current = createBrowserSupabaseClient()
    }
    return supabaseRef.current
  }

  const connect = useCallback(() => {
    const supabase = getSupabase()

    // Clean up existing channel
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current)
    }

    const channel = supabase
      .channel('blackops-realtime')
      // Conversation changes
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'conversations' },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            addConversation(payload.new as Conversation)
          } else if (payload.eventType === 'UPDATE') {
            updateConversation(
              (payload.new as Conversation).id,
              payload.new as Partial<Conversation>
            )
          }
        }
      )
      // New messages
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages' },
        (payload) => {
          const message = payload.new as Message
          // Only append if viewing this conversation
          if (message.conversation_id === activeConversationId) {
            addMessage(message)
          }
          // Update conversation's last_message preview in sidebar
          updateConversation(message.conversation_id, {
            updated_at: message.sent_at,
          })
        }
      )
      // New notifications
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications' },
        (payload) => {
          const notification = payload.new as Notification
          incrementUnread()
          showToast(
            notification.message,
            notification.type === 'hot_lead'
              ? 'hot_lead'
              : notification.type === 'call_booked'
                ? 'call_booked'
                : 'info'
          )
        }
      )
      // User status changes (online setters)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'users' },
        async () => {
          // Refetch online setters
          const { data } = await supabase
            .from('users')
            .select('*')
            .eq('role', 'setter')
            .eq('status', 'online')
          if (data) {
            setOnlineSetters(data as User[])
          }
        }
      )
      // Lead heat_score changes
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'leads' },
        (payload) => {
          const lead = payload.new as { id: string; heat_score: number }
          // Update any conversation with this lead
          const conversations = useInboxStore.getState().conversations
          const convo = conversations.find((c) => c.lead_id === lead.id)
          if (convo && convo.lead) {
            updateConversation(convo.id, {
              lead: { ...convo.lead, heat_score: lead.heat_score },
            })
          }
        }
      )
      .subscribe((status) => {
        setRealtimeConnected(status === 'SUBSCRIBED')
      })

    channelRef.current = channel
  }, [
    activeConversationId,
    addConversation,
    addMessage,
    incrementUnread,
    setOnlineSetters,
    setRealtimeConnected,
    updateConversation,
  ])

  const reconnect = useCallback(() => {
    connect()
  }, [connect])

  useEffect(() => {
    connect()

    return () => {
      if (channelRef.current) {
        getSupabase().removeChannel(channelRef.current)
      }
    }
  }, [connect])

  return {
    isConnected: useAppStore((s) => s.isRealtimeConnected),
    reconnect,
  }
}
