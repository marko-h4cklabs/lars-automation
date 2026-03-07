import { cn } from '@/lib/utils'

interface HeatScoreProps {
  score: number
  size?: 'sm' | 'md' | 'lg'
  showBar?: boolean
  className?: string
}

function getScoreColor(score: number): string {
  if (score >= 80) return '#ff4500'
  if (score >= 60) return '#ff8c00'
  if (score >= 40) return '#ffd700'
  if (score >= 20) return '#90ee90'
  return '#00ff88'
}

function getScoreTextColor(score: number): string {
  if (score >= 80) return 'text-[#ff4500]'
  if (score >= 60) return 'text-orange-400'
  if (score >= 40) return 'text-yellow-400'
  return 'text-[#00ff88]'
}

const sizeStyles = {
  sm: 'text-xs',
  md: 'text-sm',
  lg: 'text-lg font-bold',
}

export function HeatScore({ score, size = 'md', showBar = true, className }: HeatScoreProps) {
  const color = getScoreColor(score)

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <span className={cn('font-mono', sizeStyles[size], getScoreTextColor(score))}>
        {score}
      </span>
      {showBar && (
        <div className="flex-1 h-1.5 bg-[#222] rounded-sm overflow-hidden min-w-[40px]">
          <div
            className="h-full rounded-sm transition-all duration-500"
            style={{
              width: `${score}%`,
              backgroundColor: color,
            }}
          />
        </div>
      )}
    </div>
  )
}
