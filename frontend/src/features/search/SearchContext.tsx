import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { SearchModal } from './SearchModal'

interface SearchContextValue {
  openSearch: () => void
}

const SearchContext = createContext<SearchContextValue | null>(null)

export function useSearchModal() {
  const ctx = useContext(SearchContext)
  if (!ctx) throw new Error('useSearchModal must be used inside SearchProvider')
  return ctx
}

export function SearchProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false)

  const openSearch = useCallback(() => setOpen(true), [])
  const closeSearch = useCallback(() => setOpen(false), [])

  // Global Cmd+K / Ctrl+K to toggle
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setOpen((prev) => !prev)
      }
      // "/" opens search when not focused on an input/textarea
      if (
        e.key === '/' &&
        !e.metaKey &&
        !e.ctrlKey &&
        !e.altKey &&
        !(e.target instanceof HTMLInputElement) &&
        !(e.target instanceof HTMLTextAreaElement) &&
        !(e.target instanceof HTMLSelectElement)
      ) {
        e.preventDefault()
        setOpen(true)
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [])

  return (
    <SearchContext.Provider value={{ openSearch }}>
      {children}
      <SearchModal open={open} onClose={closeSearch} />
    </SearchContext.Provider>
  )
}
