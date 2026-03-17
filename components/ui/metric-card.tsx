import { cn } from '@/lib/utils'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'

interface MetricCardProps {
  label: string
  value: string | number
  trend?: 'up' | 'down' | 'neutral'
  trendValue?: string
  className?: string
}

export function MetricCard({ label, value, trend, trendValue, className }: MetricCardProps) {
  return (
    <div
      className={cn(
        'bg-[#111] border border-[#222] rounded p-4',
        className
      )}
    >
      <p className="text-[#666] font-mono text-[13px] uppercase tracking-wider mb-2">
        {label}
      </p>
      <div className="flex items-end justify-between">
        <span className="text-[#f0f0f0] font-mono text-2xl font-bold">{value}</span>
        {trend && (
          <div
            className={cn('flex items-center gap-1 text-xs font-mono', {
              'text-[#00ff88]': trend === 'up',
              'text-red-400': trend === 'down',
              'text-[#666]': trend === 'neutral',
            })}
          >
            {trend === 'up' && <TrendingUp className="w-4 h-4" />}
            {trend === 'down' && <TrendingDown className="w-4 h-4" />}
            {trend === 'neutral' && <Minus className="w-4 h-4" />}
            {trendValue && <span>{trendValue}</span>}
          </div>
        )}
      </div>
    </div>
  )
}
