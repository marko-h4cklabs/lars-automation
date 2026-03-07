import { cn } from '@/lib/utils'

interface StatusDotProps {
  status: 'online' | 'offline' | 'away'
  size?: 'sm' | 'md'
  className?: string
}

const statusColors = {
  online: 'bg-[#00ff88]',
  away: 'bg-orange-400',
  offline: 'bg-[#444]',
}

const pulseColors = {
  online: 'bg-[#00ff88]',
  away: 'bg-orange-400',
  offline: '',
}

const sizeStyles = {
  sm: 'w-2.5 h-2.5',
  md: 'w-3 h-3',
}

export function StatusDot({ status, size = 'sm', className }: StatusDotProps) {
  return (
    <span className={cn('relative inline-flex', className)}>
      {status !== 'offline' && (
        <span
          className={cn(
            'absolute inline-flex h-full w-full rounded-full opacity-75 animate-ping',
            pulseColors[status]
          )}
        />
      )}
      <span
        className={cn('relative inline-flex rounded-full', sizeStyles[size], statusColors[status])}
      />
    </span>
  )
}
