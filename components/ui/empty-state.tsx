import { cn } from '@/lib/utils'
import { Inbox } from 'lucide-react'

interface EmptyStateProps {
  icon?: React.ReactNode
  title: string
  description?: string
  action?: React.ReactNode
  className?: string
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center py-16 px-4', className)}>
      <div className="text-[#333] mb-4">
        {icon || <Inbox className="w-12 h-12" />}
      </div>
      <h3 className="text-[#666] font-mono text-sm uppercase tracking-wider mb-1">{title}</h3>
      {description && (
        <p className="text-[#444] font-mono text-xs text-center max-w-xs">{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}
