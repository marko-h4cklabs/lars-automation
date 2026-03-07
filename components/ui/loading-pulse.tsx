import { cn } from '@/lib/utils'

interface LoadingPulseProps {
  lines?: number
  className?: string
}

export function LoadingPulse({ lines = 3, className }: LoadingPulseProps) {
  return (
    <div className={cn('space-y-3', className)}>
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className="h-3 bg-[#1a1a1a] rounded animate-pulse"
          style={{ width: `${100 - i * 15}%` }}
        />
      ))}
    </div>
  )
}

export function LoadingCard({ className }: { className?: string }) {
  return (
    <div className={cn('bg-[#111] border border-[#222] rounded p-4', className)}>
      <div className="flex items-center gap-3 mb-3">
        <div className="w-9 h-9 rounded-full bg-[#1a1a1a] animate-pulse" />
        <div className="flex-1 space-y-2">
          <div className="h-3 bg-[#1a1a1a] rounded animate-pulse w-1/2" />
          <div className="h-2 bg-[#1a1a1a] rounded animate-pulse w-1/3" />
        </div>
      </div>
      <LoadingPulse lines={2} />
    </div>
  )
}
