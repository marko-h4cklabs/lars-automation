import { cn } from '@/lib/utils'

interface SectionHeaderProps {
  title: string
  action?: React.ReactNode
  className?: string
}

export function SectionHeader({ title, action, className }: SectionHeaderProps) {
  return (
    <div className={cn('flex items-center justify-between mb-4', className)}>
      <div className="flex items-center gap-3 flex-1">
        <h3 className="text-[#888] font-mono text-[11px] uppercase tracking-[0.15em] whitespace-nowrap">
          {title}
        </h3>
        <div className="flex-1 h-[1px] bg-[#222]" />
      </div>
      {action && <div className="ml-3">{action}</div>}
    </div>
  )
}
