'use client'

import { useState, useCallback } from 'react'
import { ConversationList } from '@/components/inbox/ConversationList'
import { ActiveConversation } from '@/components/inbox/ActiveConversation'
import { useAppStore } from '@/store/appStore'

export default function InboxPage() {
  const { activeConversationId, setActiveConversationId } = useAppStore()
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const activeId = selectedId || activeConversationId

  const handleSelect = useCallback((id: string) => {
    setSelectedId(id)
    setActiveConversationId(id)
  }, [setActiveConversationId])

  return (
    <div className="flex h-full w-full overflow-hidden">
      {/* Left panel — conversation list */}
      <ConversationList activeId={activeId} onSelect={handleSelect} />

      {/* Right panel — active conversation */}
      {activeId ? (
        <ActiveConversation key={activeId} conversationId={activeId} />
      ) : (
        <div className="flex-1 flex items-center justify-center bg-[#080808]">
          <div className="text-center">
            <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-[#111] flex items-center justify-center">
              <span className="text-[#333] text-xl font-mono">&larr;</span>
            </div>
            <p className="text-[#444] font-mono text-xs">Select a conversation</p>
            <p className="text-[#333] font-mono text-[13px] mt-1">Choose a lead from the list to start</p>
          </div>
        </div>
      )}
    </div>
  )
}
