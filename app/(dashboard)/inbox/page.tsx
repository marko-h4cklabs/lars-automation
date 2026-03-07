import { EmptyState } from '@/components/ui/empty-state'
import { Inbox } from 'lucide-react'

export default function InboxPage() {
  return (
    <EmptyState
      icon={<Inbox className="w-12 h-12" />}
      title="Inbox"
      description="Your DM conversations will appear here. Connect ManyChat to start receiving messages."
    />
  )
}
