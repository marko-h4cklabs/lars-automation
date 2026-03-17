import { AlertCircle, RefreshCw } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ErrorStateProps {
  message?: string
  onRetry?: () => void
  className?: string
}

export function ErrorState({
  message = 'Failed to load data',
  onRetry,
  className,
}: ErrorStateProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center py-12 px-4', className)}>
      <div className="w-10 h-10 rounded-full bg-[#f05050]/10 flex items-center justify-center mb-3">
        <AlertCircle className="w-5 h-5 text-[#f05050]" />
      </div>
      <p className="text-[#666] font-mono text-xs mb-3">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="flex items-center gap-1.5 px-3 py-1.5 text-[13px] font-mono text-[#00ff88] bg-[#00ff88]/10 border border-[#00ff88]/30 rounded hover:bg-[#00ff88]/20 transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          RETRY
        </button>
      )}
    </div>
  )
}
