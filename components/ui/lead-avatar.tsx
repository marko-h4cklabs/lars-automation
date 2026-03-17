import Image from 'next/image'
import { cn } from '@/lib/utils'
import { StatusDot } from './status-dot'

interface LeadAvatarProps {
  src?: string | null
  name: string
  size?: 'sm' | 'md' | 'lg'
  showStatus?: boolean
  status?: 'online' | 'offline' | 'away'
  className?: string
}

const sizeStyles = {
  sm: 'w-7 h-7 text-[13px]',
  md: 'w-9 h-9 text-xs',
  lg: 'w-12 h-12 text-sm',
}

const dotPosition = {
  sm: '-bottom-0.5 -right-0.5',
  md: '-bottom-0.5 -right-0.5',
  lg: 'bottom-0 right-0',
}

export function LeadAvatar({
  src,
  name,
  size = 'md',
  showStatus = false,
  status = 'offline',
  className,
}: LeadAvatarProps) {
  const initials = name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

  return (
    <div className={cn('relative inline-flex shrink-0', className)}>
      {src ? (
        <Image
          src={src}
          alt={name}
          width={size === 'lg' ? 48 : size === 'md' ? 36 : 28}
          height={size === 'lg' ? 48 : size === 'md' ? 36 : 28}
          className={cn('rounded-full object-cover bg-[#222]', sizeStyles[size])}
        />
      ) : (
        <div
          className={cn(
            'rounded-full bg-[#222] flex items-center justify-center font-mono font-bold text-[#888]',
            sizeStyles[size]
          )}
        >
          {initials}
        </div>
      )}
      {showStatus && (
        <div className={cn('absolute', dotPosition[size])}>
          <StatusDot status={status} size="sm" />
        </div>
      )}
    </div>
  )
}
