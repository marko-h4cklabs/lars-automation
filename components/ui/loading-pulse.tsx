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

export function LoadingMetricCards({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="bg-[#0d0d0d] border border-[#1a1a1a] rounded-lg p-4">
          <div className="h-2 bg-[#1a1a1a] rounded animate-pulse w-1/2 mb-3" />
          <div className="h-5 bg-[#1a1a1a] rounded animate-pulse w-2/3 mb-2" />
          <div className="h-2 bg-[#1a1a1a] rounded animate-pulse w-1/3" />
        </div>
      ))}
    </div>
  )
}

export function LoadingTable({ columns = 5, rows = 8 }: { columns?: number; rows?: number }) {
  return (
    <div className="bg-[#0d0d0d] border border-[#1a1a1a] rounded-lg overflow-hidden">
      <div className="flex gap-4 px-4 py-3 border-b border-[#1a1a1a]">
        {Array.from({ length: columns }).map((_, i) => (
          <div
            key={i}
            className="h-2 bg-[#1a1a1a] rounded animate-pulse"
            style={{ width: `${60 + Math.random() * 40}px` }}
          />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex gap-4 px-4 py-3 border-b border-[#111]">
          {Array.from({ length: columns }).map((_, j) => (
            <div
              key={j}
              className="h-3 bg-[#1a1a1a] rounded animate-pulse"
              style={{ width: `${40 + Math.random() * 60}px` }}
            />
          ))}
        </div>
      ))}
    </div>
  )
}

export function LoadingChart({ className }: { className?: string }) {
  return (
    <div className={cn('bg-[#0d0d0d] border border-[#1a1a1a] rounded-lg p-4', className)}>
      <div className="h-2 bg-[#1a1a1a] rounded animate-pulse w-1/4 mb-4" />
      <div className="flex items-end gap-1 h-[200px]">
        {Array.from({ length: 12 }).map((_, i) => (
          <div
            key={i}
            className="flex-1 bg-[#1a1a1a] rounded-t animate-pulse"
            style={{ height: `${20 + Math.random() * 80}%` }}
          />
        ))}
      </div>
    </div>
  )
}

export function LoadingConversationList({ count = 6 }: { count?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 p-3 rounded">
          <div className="w-8 h-8 rounded-full bg-[#1a1a1a] animate-pulse flex-shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="h-3 bg-[#1a1a1a] rounded animate-pulse w-2/3" />
            <div className="h-2 bg-[#1a1a1a] rounded animate-pulse w-full" />
          </div>
          <div className="h-2 bg-[#1a1a1a] rounded animate-pulse w-8" />
        </div>
      ))}
    </div>
  )
}

export function LoadingFormSection({ fields = 4 }: { fields?: number }) {
  return (
    <div className="space-y-6 max-w-2xl">
      <div className="h-3 bg-[#1a1a1a] rounded animate-pulse w-1/3 mb-6" />
      {Array.from({ length: fields }).map((_, i) => (
        <div key={i}>
          <div className="h-2 bg-[#1a1a1a] rounded animate-pulse w-1/4 mb-2" />
          <div className="h-9 bg-[#111] border border-[#1a1a1a] rounded animate-pulse" />
        </div>
      ))}
      <div className="h-9 bg-[#1a1a1a] rounded animate-pulse w-32 mt-4" />
    </div>
  )
}
