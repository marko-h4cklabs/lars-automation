import { cn } from '@/lib/utils'

interface CommandButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger'
  size?: 'sm' | 'md'
  icon?: React.ReactNode
}

const variantStyles = {
  primary: 'border-[#00ff88] text-[#00ff88] hover:bg-[#00ff88]/10',
  secondary: 'border-[#333] text-[#888] hover:bg-[#1a1a1a] hover:text-[#f0f0f0]',
  danger: 'border-red-500/50 text-red-400 hover:bg-red-500/10',
}

const sizeStyles = {
  sm: 'px-3 py-1.5 text-[13px]',
  md: 'px-4 py-2 text-xs',
}

export function CommandButton({
  children,
  variant = 'primary',
  size = 'md',
  icon,
  className,
  disabled,
  ...props
}: CommandButtonProps) {
  return (
    <button
      className={cn(
        'inline-flex items-center gap-2 border rounded font-mono uppercase tracking-wider bg-transparent transition-colors',
        'disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent',
        variantStyles[variant],
        sizeStyles[size],
        className
      )}
      disabled={disabled}
      {...props}
    >
      {icon}
      {children}
    </button>
  )
}
