'use client'

import { cn } from '@/lib/utils'

interface TooltipProps {
  content: string
  side?: 'top' | 'bottom' | 'left' | 'right'
  children: React.ReactNode
  className?: string
}

const sideClasses = {
  top: 'bottom-full left-1/2 -translate-x-1/2 mb-1.5',
  bottom: 'top-full left-1/2 -translate-x-1/2 mt-1.5',
  left: 'right-full top-1/2 -translate-y-1/2 mr-1.5',
  right: 'left-full top-1/2 -translate-y-1/2 ml-1.5',
}

export function Tooltip({ content, side = 'top', children, className }: TooltipProps) {
  return (
    <div className={cn('relative group/tooltip inline-flex', className)}>
      {children}
      <div
        className={cn(
          'absolute z-50 px-2 py-1 rounded bg-[#1a1a1a] border border-[#333] text-[#ccc] font-mono text-[9px] whitespace-nowrap',
          'opacity-0 pointer-events-none group-hover/tooltip:opacity-100 transition-opacity duration-150',
          sideClasses[side]
        )}
      >
        {content}
      </div>
    </div>
  )
}
