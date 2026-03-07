import { cn } from '@/lib/utils'

interface ResponsiveTableProps {
  children: React.ReactNode
  className?: string
}

export function ResponsiveTable({ children, className }: ResponsiveTableProps) {
  return (
    <div
      className={cn(
        'overflow-x-auto',
        '[&_th:first-child]:sticky [&_th:first-child]:left-0 [&_th:first-child]:z-10 [&_th:first-child]:bg-[#0d0d0d]',
        '[&_td:first-child]:sticky [&_td:first-child]:left-0 [&_td:first-child]:z-10 [&_td:first-child]:bg-[#0d0d0d]',
        className
      )}
    >
      {children}
    </div>
  )
}
