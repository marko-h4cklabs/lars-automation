'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Search, SlidersHorizontal, MessageSquare } from 'lucide-react'
import { ConversationCard } from './ConversationCard'
import { ScrollArea } from '@/components/ui/scroll-area'
import { LoadingPulse, LoadingConversationList } from '@/components/ui/loading-pulse'
import { EmptyState } from '@/components/ui/empty-state'
import { ErrorState } from '@/components/ui/error-state'
import { cn } from '@/lib/utils'
import { useInboxStore } from '@/store/inboxStore'
import { useAppStore } from '@/store/appStore'
import type { Conversation, Lead, Message } from '@/types'

type ConversationWithMeta = Conversation & {
  lead: Lead
  last_message: Pick<Message, 'content' | 'direction' | 'sent_at' | 'type'> | null
  unread_count: number
}

const FILTER_TABS = [
  { label: 'ALL', value: 'all' },
  { label: 'MY LEADS', value: 'my_leads' },
  { label: 'AI LEADS', value: 'ai_leads' },
  { label: 'HOT', value: 'hot_leads' },
]

interface ConversationListProps {
  activeId: string | null
  onSelect: (id: string) => void
}

export function ConversationList({ activeId, onSelect }: ConversationListProps) {
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')
  const [sort] = useState('last_message')
  const [localConversations, setLocalConversations] = useState<ConversationWithMeta[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [page, setPage] = useState(0)
  const observerRef = useRef<HTMLDivElement>(null)

  const { conversations: storeConversations } = useInboxStore()
  const { activeConversationId } = useAppStore()

  const fetchConversations = useCallback(async (pageNum: number, append: boolean = false) => {
    try {
      setLoading(true)
      setError(false)
      const params = new URLSearchParams({
        page: String(pageNum),
        limit: '20',
        filter,
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
  }, [filter, search, sort])

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
    // Store conversations from realtime updates — merge with local
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
      <div className="flex border-b border-[#1a1a1a]">
        {FILTER_TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => setFilter(tab.value)}
            className={cn(
              'flex-1 py-2 text-[9px] font-mono uppercase tracking-wider transition-colors',
              filter === tab.value
                ? 'text-[#00ff88] border-b border-[#00ff88]'
                : 'text-[#444] hover:text-[#666]'
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

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
