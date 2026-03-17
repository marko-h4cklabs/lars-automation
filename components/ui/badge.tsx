import { cn } from '@/lib/utils'

type BadgeVariant = 'default' | 'hot' | 'booked' | 'disqualified' | 'stage' | 'source' | 'ai'

interface BadgeProps {
  children: React.ReactNode
  variant?: BadgeVariant
  className?: string
  pulse?: boolean
}

const variantStyles: Record<BadgeVariant, string> = {
  default: 'bg-[#222] text-[#888] border-[#333]',
  hot: 'bg-red-500/15 text-red-400 border-red-500/30',
  booked: 'bg-[#00ff88]/15 text-[#00ff88] border-[#00ff88]/30',
  disqualified: 'bg-[#333]/50 text-[#666] border-[#444]',
  stage: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
  source: 'bg-purple-500/15 text-purple-400 border-purple-500/30',
  ai: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
}

export function Badge({ children, variant = 'default', className, pulse }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 px-2 py-0.5 rounded text-[13px] font-mono uppercase tracking-wider border',
        variantStyles[variant],
        pulse && 'animate-pulse',
        className
      )}
    >
      {variant === 'hot' && (
        <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-ping inline-block" />
      )}
      {children}
    </span>
  )
}

// Stage-specific badge helper
export function StageBadge({ stage }: { stage: string }) {
  const stageVariants: Record<string, BadgeVariant> = {
    new: 'default',
    contacted: 'stage',
    qualifying: 'stage',
    call_offered: 'booked',
    call_booked: 'booked',
    showed: 'booked',
    no_show: 'hot',
    won: 'booked',
    lost: 'disqualified',
    disqualified: 'disqualified',
  }

  const label = stage.replace(/_/g, ' ')
  return <Badge variant={stageVariants[stage] || 'default'}>{label}</Badge>
}
