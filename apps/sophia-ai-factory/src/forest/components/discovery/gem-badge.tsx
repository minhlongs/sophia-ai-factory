import { Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'

interface GemBadgeProps {
  className?: string
  size?: 'sm' | 'md'
}

export function GemBadge({ className, size = 'md' }: GemBadgeProps) {
  return (
    <div
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-amber-200 to-yellow-400 px-3 py-1 text-xs font-bold text-amber-900 shadow-sm ring-1 ring-inset ring-amber-400/50",
        size === 'sm' && "px-2 py-0.5 text-[10px]",
        className
      )}
    >
      <Sparkles className={cn("h-3.5 w-3.5", size === 'sm' && "h-3 w-3")} />
      <span>Hidden Gem</span>
    </div>
  )
}
