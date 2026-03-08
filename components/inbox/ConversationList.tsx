'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Search, SlidersHorizontal, MessageSquare, ChevronDown, Users } from 'lucide-react'
import { ConversationCard } from './ConversationCard'
import { ScrollArea } from '@/components/ui/scroll-area'
import { LoadingPulse, LoadingConversationList } from '@/components/ui/loading-pulse'
import { EmptyState } from '@/components/ui/empty-state'
import { ErrorState } from '@/components/ui/error-state'
import { cn } from '@/lib/utils'
import { useInboxStore } from '@/store/inboxStore'
import { useAppStore } from '@/store/appStore'
import { useUser } from '@/hooks/useUser'
import type { Conversation, Lead, Message, User } from '@/types'

type ConversationWithMeta = Conversation & {
  lead: Lead
  last_message: Pick<Message, 'content' | 'direction' | 'sent_at' | 'type'> | null
  unread_count: number
}

interface ConversationListProps {
  activeId: string | null
  onSelect: (id: string) => void
}

export function ConversationList({ activeId, onSelect }: ConversationListProps) {
  const [search, setSearch] = useState('')
  const [assignedTo, setAssignedTo] = useState('all') // 'all' | 'me' | userId
  const [assignedLabel, setAssignedLabel] = useState('ALL')
  const [sort] = useState('last_message')
  const [localConversations, setLocalConversations] = useState<ConversationWithMeta[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [page, setPage] = useState(0)
  const [showSetterDropdown, setShowSetterDropdown] = useState(false)
  const [setters, setSetters] = useState<User[]>([])
  const observerRef = useRef<HTMLDivElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const { conversations: storeConversations } = useInboxStore()
  const { activeConversationId } = useAppStore()
  const { user } = useUser()

  const isAdmin = user?.role === 'admin'

  // Fetch active setters for dropdown (admin only)
  useEffect(() => {
    if (!isAdmin) return
    async function fetchSetters() {
      try {
        const res = await fetch('/api/team')
        if (!res.ok) return
        const data = await res.json()
        const activeSetters = (data.users || []).filter(
          (u: User & { receives_leads?: boolean }) =>
            (u.role === 'setter' || u.role === 'admin') && u.id !== user?.id
        )
        setSetters(activeSetters)
      } catch {
        // Silently fail — dropdown just won't show setters
      }
    }
    fetchSetters()
  }, [isAdmin, user?.id])

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowSetterDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const fetchConversations = useCallback(async (pageNum: number, append: boolean = false) => {
    try {
      setLoading(true)
      setError(false)
      const params = new URLSearchParams({
        page: String(pageNum),
        limit: '20',
        assignedTo,
        search,
        sort,
      })

      const res = await fetch(`/api/conversations?${params}`)
      if (!res.ok) throw new Error('Failed to load')

      const data = await res.json()
      const convos = data.conversations as ConversationWithMeta[]

      if (append) {
        setLocalConversations((prev) => [...prev, ...convos])
      } else {
        setLocalConversations(convos)
      }
      setHasMore(data.hasMore)
    } catch {
      if (!append) setError(true)
    } finally {
      setLoading(false)
    }
  }, [assignedTo, search, sort])

  // Initial fetch + refetch on filter/search change
  useEffect(() => {
    setPage(0)
    fetchConversations(0)
  }, [fetchConversations])

  // Infinite scroll
  useEffect(() => {
    if (!observerRef.current || !hasMore || loading) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loading) {
          const nextPage = page + 1
          setPage(nextPage)
          fetchConversations(nextPage, true)
        }
      },
      { threshold: 0.5 }
    )

    observer.observe(observerRef.current)
    return () => observer.disconnect()
  }, [hasMore, loading, page, fetchConversations])

  // Merge realtime updates from store
  useEffect(() => {
    if (storeConversations.length === 0) return
    setLocalConversations((prev) => {
      const map = new Map(prev.map((c) => [c.id, c]))
      for (const sc of storeConversations) {
        if (map.has(sc.id)) {
          map.set(sc.id, { ...map.get(sc.id)!, ...sc } as ConversationWithMeta)
        }
      }
      return Array.from(map.values())
    })
  }, [storeConversations])

  function selectFilter(value: string, label: string) {
    setAssignedTo(value)
    setAssignedLabel(label)
    setShowSetterDropdown(false)
  }

  return (
    <div className="w-[380px] h-full bg-[#0a0a0a] border-r border-[#1a1a1a] flex flex-col shrink-0">
      {/* Search */}
      <div className="px-3 py-2 border-b border-[#1a1a1a]">
        <div className="flex items-center gap-2 bg-[#111] rounded px-2.5 py-1.5">
          <Search className="w-3.5 h-3.5 text-[#444] shrink-0" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search leads..."
            className="bg-transparent text-[#f0f0f0] text-xs font-mono placeholder:text-[#333] outline-none flex-1"
          />
          <SlidersHorizontal className="w-3 h-3 text-[#333] shrink-0" />
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex border-b border-[#1a1a1a] relative">
        {/* ALL tab */}
        <button
          onClick={() => selectFilter('all', 'ALL')}
          className={cn(
            'flex-1 py-2 text-[9px] font-mono uppercase tracking-wider transition-colors',
            assignedTo === 'all'
              ? 'text-[#00ff88] border-b border-[#00ff88]'
              : 'text-[#444] hover:text-[#666]'
          )}
        >
          ALL
        </button>

        {/* MY LEADS tab */}
        <button
          onClick={() => selectFilter('me', 'MY LEADS')}
          className={cn(
            'flex-1 py-2 text-[9px] font-mono uppercase tracking-wider transition-colors',
            assignedTo === 'me'
              ? 'text-[#00ff88] border-b border-[#00ff88]'
              : 'text-[#444] hover:text-[#666]'
          )}
        >
          MY LEADS
        </button>

        {/* VIEW BY SETTER dropdown — admin only */}
        {isAdmin && (
          <div ref={dropdownRef} className="relative flex-1">
            <button
              onClick={() => setShowSetterDropdown(!showSetterDropdown)}
              className={cn(
                'w-full py-2 text-[9px] font-mono uppercase tracking-wider transition-colors flex items-center justify-center gap-1',
                assignedTo !== 'all' && assignedTo !== 'me'
                  ? 'text-[#00ff88] border-b border-[#00ff88]'
                  : 'text-[#444] hover:text-[#666]'
              )}
            >
              <Users className="w-3 h-3" />
              <span>SETTER</span>
              <ChevronDown className="w-3 h-3" />
            </button>

            {showSetterDropdown && (
              <div className="absolute top-full left-0 right-0 z-50 bg-[#111] border border-[#1a1a1a] rounded-b shadow-lg max-h-[200px] overflow-y-auto">
                {setters.length === 0 ? (
                  <div className="px-3 py-2 text-[10px] font-mono text-[#444]">No setters found</div>
                ) : (
                  setters.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => selectFilter(s.id, `${s.name}'s Leads`)}
                      className={cn(
                        'w-full text-left px-3 py-2 text-[10px] font-mono transition-colors hover:bg-[#1a1a1a] flex items-center gap-2',
                        assignedTo === s.id ? 'text-[#00ff88]' : 'text-[#999]'
                      )}
                    >
                      <div className={cn(
                        'w-1.5 h-1.5 rounded-full',
                        s.status === 'online' ? 'bg-[#00ff88]' : 'bg-[#333]'
                      )} />
                      {s.name}
                      <span className="text-[#444] text-[8px] ml-auto">{s.role}</span>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
        )}

        {/* HOT tab */}
        <button
          onClick={() => {
            setAssignedTo('all')
            setAssignedLabel('HOT')
            // For HOT we use legacy filter param
          }}
          className={cn(
            'flex-1 py-2 text-[9px] font-mono uppercase tracking-wider transition-colors',
            assignedLabel === 'HOT'
              ? 'text-[#00ff88] border-b border-[#00ff88]'
              : 'text-[#444] hover:text-[#666]'
          )}
        >
          HOT
        </button>
      </div>

      {/* Active filter badge */}
      {assignedTo !== 'all' && assignedLabel !== 'ALL' && assignedLabel !== 'HOT' && (
        <div className="px-3 py-1.5 border-b border-[#1a1a1a] flex items-center gap-2">
          <span className="text-[8px] font-mono uppercase tracking-wider text-[#00ff88] bg-[#00ff8810] px-2 py-0.5 rounded">
            {assignedLabel}
          </span>
          <button
            onClick={() => selectFilter('all', 'ALL')}
            className="text-[8px] font-mono text-[#444] hover:text-[#666]"
          >
            CLEAR
          </button>
        </div>
      )}

      {/* Conversation list */}
      <ScrollArea className="flex-1">
        {loading && localConversations.length === 0 ? (
          <div className="p-3">
            <LoadingConversationList count={6} />
          </div>
        ) : error ? (
          <ErrorState message="Failed to load conversations" onRetry={() => fetchConversations(0)} />
        ) : localConversations.length === 0 ? (
          <EmptyState
            icon={<MessageSquare className="w-10 h-10" />}
            title="No conversations"
            description="Messages will appear here as DMs come in"
          />
        ) : (
          <>
            {localConversations.map((conv) => (
              <ConversationCard
                key={conv.id}
                conversation={conv}
                isActive={conv.id === (activeId || activeConversationId)}
                onClick={() => onSelect(conv.id)}
              />
            ))}
            {/* Infinite scroll sentinel */}
            {hasMore && (
              <div ref={observerRef} className="p-3">
                <LoadingPulse lines={1} />
              </div>
            )}
          </>
        )}
      </ScrollArea>
    </div>
  )
}
