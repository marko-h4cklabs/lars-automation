'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Send, FileText, Mic, Loader2, AlertTriangle, ExternalLink } from 'lucide-react'
import { ScrollArea } from '@/components/ui/scroll-area'
import { LoadingPulse } from '@/components/ui/loading-pulse'
import { ErrorState } from '@/components/ui/error-state'
import { Tooltip } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts'
import { useInboxStore } from '@/store/inboxStore'
import { LeadHeader } from './LeadHeader'
import { MessageBubble } from './MessageBubble'
import { AISuggestPanel } from './AISuggestPanel'
import { TemplateSelector } from './TemplateSelector'
import { VoicePanel } from './VoicePanel'
import { QualificationBar } from './QualificationBar'
import { SummaryBox } from './SummaryBox'
import { FollowUpPanel } from './FollowUpPanel'
import type { Conversation, Lead, Message, LeadStage } from '@/types'

type ConversationDetail = Conversation & { lead: Lead }

interface ActiveConversationProps {
  conversationId: string
}

export function ActiveConversation({ conversationId }: ActiveConversationProps) {
  const [conversation, setConversation] = useState<ConversationDetail | null>(null)
  const [loadingConv, setLoadingConv] = useState(true)
  const [errorConv, setErrorConv] = useState(false)
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState<string | null>(null)
  const [templateOpen, setTemplateOpen] = useState(false)
  const [voiceOpen, setVoiceOpen] = useState(false)
  const [messagesPage, setMessagesPage] = useState(0)
  const [hasMoreMessages, setHasMoreMessages] = useState(true)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const { activeMessages, setActiveMessages, addMessage, isLoadingMessages, setLoadingMessages } = useInboxStore()

  // Fetch conversation details
  const fetchConversation = useCallback(() => {
    setLoadingConv(true)
    setErrorConv(false)
    fetch(`/api/conversations/${conversationId}`)
      .then((r) => r.ok ? r.json() : Promise.reject())
      .then((data) => { if (data) setConversation(data) })
      .catch(() => setErrorConv(true))
      .finally(() => setLoadingConv(false))
  }, [conversationId])

  useEffect(() => { fetchConversation() }, [fetchConversation])

  // Keyboard shortcuts
  useKeyboardShortcuts({
    Enter: () => handleSend(),
    k: () => { /* AISuggestPanel handles its own trigger */ },
    t: () => { setTemplateOpen((v) => !v); setVoiceOpen(false) },
    v: () => { setVoiceOpen((v) => !v); setTemplateOpen(false) },
  })

  // Fetch messages (API returns ASC order — oldest first)
  const fetchMessages = useCallback(async (page: number, append: boolean = false) => {
    setLoadingMessages(true)
    try {
      const res = await fetch(`/api/conversations/${conversationId}/messages?page=${page}&limit=30`)
      if (!res.ok) return
      const data = await res.json()
      const msgs = (data.messages || []) as Message[]
      if (append) {
        // Prepend older messages before current ones
        setActiveMessages([...msgs, ...activeMessages])
      } else {
        setActiveMessages(msgs)
      }
      setHasMoreMessages(data.hasMore ?? false)
    } finally {
      setLoadingMessages(false)
    }
  }, [conversationId, setActiveMessages, setLoadingMessages, activeMessages])

  useEffect(() => {
    setMessagesPage(0)
    setHasMoreMessages(true)
    fetchMessages(0)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId])

  // Auto-scroll to bottom on new messages + clear send error on new inbound
  const prevMsgCountRef = useRef(0)
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    // If a new message arrived and it's inbound, clear window-expired error
    if (activeMessages.length > prevMsgCountRef.current && sendError) {
      const lastMsg = activeMessages[activeMessages.length - 1]
      if (lastMsg?.direction === 'inbound') {
        setSendError(null)
      }
    }
    prevMsgCountRef.current = activeMessages.length
  }, [activeMessages.length])

  // Send message
  const handleSend = async (text?: string, voiceUrl?: string) => {
    const content = text || input.trim()
    if (!content) return
    setSending(true)
    setSendError(null)

    try {
      const res = await fetch(`/api/conversations/${conversationId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content,
          type: voiceUrl ? 'voice' : 'text',
          voice_url: voiceUrl || undefined,
        }),
      })
      if (res.ok) {
        const data = await res.json()
        addMessage(data.message)
        setInput('')
      } else {
        const data = await res.json().catch(() => ({ error: 'Failed to send message' }))
        setSendError(data.error || 'Failed to send message')
      }
    } catch {
      setSendError('Network error — could not send message')
    } finally {
      setSending(false)
    }
  }

  const handleSuggestSend = (messages: string[]) => {
    // Send messages sequentially
    messages.forEach((msg, i) => {
      setTimeout(() => handleSend(msg), i * 500)
    })
  }

  const handleSuggestUse = (messages: string[]) => {
    // Copy suggestion text into the input field
    setInput(messages.join('\n'))
  }

  const handleStageChange = async (stage: LeadStage) => {
    if (!conversation) return
    await fetch(`/api/conversations/${conversationId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: conversation.status }),
    })
    // Update lead stage directly
    setConversation((prev) =>
      prev ? { ...prev, lead: { ...prev.lead, stage } } : null
    )
  }

  const loadOlderMessages = () => {
    if (!hasMoreMessages || isLoadingMessages) return
    const next = messagesPage + 1
    setMessagesPage(next)
    fetchMessages(next, true)
  }

  // Loading state
  if (loadingConv) {
    return (
      <div className="flex-1 flex items-center justify-center bg-[#080808]">
        <LoadingPulse lines={3} />
      </div>
    )
  }

  if (errorConv) {
    return (
      <div className="flex-1 bg-[#080808]">
        <ErrorState message="Failed to load conversation" onRetry={fetchConversation} />
      </div>
    )
  }

  if (!conversation) {
    return (
      <div className="flex-1 flex items-center justify-center bg-[#080808]">
        <p className="text-[#333] font-mono text-xs">Conversation not found</p>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col bg-[#080808] h-full">
      {/* Lead header */}
      <LeadHeader
        lead={conversation.lead}
        conversation={conversation}
        onStageChange={handleStageChange}
      />

      {/* Prior history banner */}
      {(conversation as ConversationDetail & { has_prior_history?: boolean }).has_prior_history && (
        <div className="flex items-center gap-2 px-4 py-2 bg-[#f0a030]/10 border-b border-[#f0a030]/20">
          <AlertTriangle className="w-3.5 h-3.5 text-[#f0a030] shrink-0" />
          <span className="text-[13px] font-mono text-[#f0a030] flex-1">
            This lead had prior conversations before migration. History may be incomplete.
          </span>
          <a
            href="https://manychat.com"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-xs font-mono text-[#f0a030] hover:text-[#ffb54c] shrink-0"
          >
            View in ManyChat <ExternalLink className="w-4 h-4" />
          </a>
        </div>
      )}

      {/* Right sidebar panels */}
      <div className="flex flex-1 min-h-0">
        {/* Messages area */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Messages */}
          <ScrollArea className="flex-1 px-4 py-3">
            {/* Load more button */}
            {hasMoreMessages && (
              <button
                onClick={loadOlderMessages}
                className="w-full py-2 text-xs font-mono text-[#444] hover:text-[#666] transition-colors"
                disabled={isLoadingMessages}
              >
                {isLoadingMessages ? 'Loading...' : '↑ Load older messages'}
              </button>
            )}

            {isLoadingMessages && activeMessages.length === 0 ? (
              <LoadingPulse lines={5} />
            ) : activeMessages.length === 0 ? (
              <div className="flex items-center justify-center h-full">
                <p className="text-[#333] font-mono text-xs">No messages yet</p>
              </div>
            ) : (
              activeMessages.map((msg) => (
                <MessageBubble key={msg.id} message={msg} />
              ))
            )}
            <div ref={messagesEndRef} />
          </ScrollArea>

          {/* AI suggest panel */}
          <AISuggestPanel
            conversationId={conversationId}
            onSend={handleSuggestSend}
            onUseThis={handleSuggestUse}
          />

          {/* Send error banner */}
          {sendError && (
            <div className="flex items-center gap-2 px-4 py-2 bg-red-500/10 border-t border-red-500/20">
              <AlertTriangle className="w-3.5 h-3.5 text-red-400 shrink-0" />
              <span className="text-[13px] font-mono text-red-400 flex-1">{sendError}</span>
              <button
                onClick={() => setSendError(null)}
                className="text-xs font-mono text-red-400 hover:text-red-300"
              >
                DISMISS
              </button>
            </div>
          )}

          {/* Input area */}
          <div className="relative border-t border-[#1a1a1a] bg-[#0a0a0a]">
            <TemplateSelector
              open={templateOpen}
              onClose={() => setTemplateOpen(false)}
              onSelect={(content) => setInput(content)}
            />
            <VoicePanel
              open={voiceOpen}
              onClose={() => setVoiceOpen(false)}
              onSend={(text, url) => handleSend(text, url)}
            />

            <div className="flex items-end gap-2 p-3">
              {/* Tool buttons */}
              <div className="flex gap-1 shrink-0">
                <Tooltip content="Templates (\u2318T)" side="top">
                  <button
                    onClick={() => { setTemplateOpen(!templateOpen); setVoiceOpen(false) }}
                    className={cn(
                      'w-7 h-7 flex items-center justify-center rounded transition-colors',
                      templateOpen
                        ? 'bg-[#00ff88]/10 text-[#00ff88]'
                        : 'text-[#444] hover:text-[#888] hover:bg-[#111]'
                    )}
                  >
                    <FileText className="w-3.5 h-3.5" />
                  </button>
                </Tooltip>
                <Tooltip content="Voice (\u2318V)" side="top">
                  <button
                    onClick={() => { setVoiceOpen(!voiceOpen); setTemplateOpen(false) }}
                    className={cn(
                      'w-7 h-7 flex items-center justify-center rounded transition-colors',
                      voiceOpen
                        ? 'bg-[#00ff88]/10 text-[#00ff88]'
                        : 'text-[#444] hover:text-[#888] hover:bg-[#111]'
                    )}
                  >
                    <Mic className="w-3.5 h-3.5" />
                  </button>
                </Tooltip>
              </div>

              {/* Text input */}
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    handleSend()
                  }
                }}
                placeholder="Type a message..."
                rows={1}
                className="flex-1 bg-[#111] border border-[#1a1a1a] rounded-lg px-3 py-2 text-xs font-mono text-[#ccc] placeholder:text-[#333] outline-none resize-none focus:border-[#00ff88]/30 max-h-24"
              />

              {/* Send button */}
              <Tooltip content="Send (\u2318\u21B5)" side="top">
                <button
                  onClick={() => handleSend()}
                  disabled={!input.trim() || sending}
                  className={cn(
                    'w-8 h-8 flex items-center justify-center rounded-lg transition-all shrink-0 active:scale-95',
                    input.trim()
                      ? 'bg-[#00ff88] text-black hover:bg-[#00dd77]'
                      : 'bg-[#111] text-[#333]'
                  )}
                >
                  {sending ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Send className="w-3.5 h-3.5" />
                  )}
                </button>
              </Tooltip>
            </div>
          </div>
        </div>

        {/* Right sidebar */}
        <div className="w-[260px] border-l border-[#1a1a1a] flex flex-col shrink-0 overflow-y-auto">
          <QualificationBar
            conversationId={conversationId}
            collectedFields={conversation.qualified_fields_collected || {}}
          />
          <SummaryBox conversationId={conversationId} />
          <FollowUpPanel conversationId={conversationId} />
        </div>
      </div>
    </div>
  )
}
