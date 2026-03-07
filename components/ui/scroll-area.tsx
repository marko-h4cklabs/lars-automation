import { cn } from '@/lib/utils'

interface ScrollAreaProps {
  children: React.ReactNode
  className?: string
  maxHeight?: string
}

export function ScrollArea({ children, className, maxHeight }: ScrollAreaProps) {
  return (
    <div
      className={cn(
        'overflow-y-auto',
        // Custom scrollbar styles via Tailwind
        '[&::-webkit-scrollbar]:w-1.5',
        '[&::-webkit-scrollbar-track]:bg-[#111]',
        '[&::-webkit-scrollbar-thumb]:bg-[#333]',
        '[&::-webkit-scrollbar-thumb]:rounded-full',
        '[&::-webkit-scrollbar-thumb:hover]:bg-[#00ff88]',
        className
      )}
      style={maxHeight ? { maxHeight } : undefined}
    >
      {children}
    </div>
  )
}
