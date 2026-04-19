import { Search } from 'lucide-react'
import { cn } from '../lib/cn'
import { forwardRef, type InputHTMLAttributes } from 'react'

interface SearchInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> { className?: string }

export const SearchInput = forwardRef<HTMLInputElement, SearchInputProps>(
  ({ className, ...props }, ref) => {
    return (
      <div className={cn('relative', className)}>
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-(--color-text-secondary)" />
        <input ref={ref} type="search" aria-label="Search" className={cn('w-full rounded-lg border border-(--color-border) pl-10 pr-3 py-2 text-sm bg-(--color-bg-input) text-(--color-text-primary) placeholder:text-(--color-text-secondary) focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:border-transparent')} {...props} />
      </div>
    )
  },
)
SearchInput.displayName = 'SearchInput'
