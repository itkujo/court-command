import { Component, type ReactNode } from 'react'
import { Button } from './Button'

interface Props { children: ReactNode }
interface State { hasError: boolean; error?: Error }

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) { super(props); this.state = { hasError: false } }
  static getDerivedStateFromError(error: Error): State { return { hasError: true, error } }
  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[400px] text-center p-8">
          <h2 className="text-xl font-semibold text-(--color-text-primary) mb-2">Something went wrong</h2>
          <p className="text-sm text-(--color-text-secondary) mb-4 max-w-md">An unexpected error occurred. Please try reloading the page.</p>
          <Button onClick={() => window.location.reload()}>Reload Page</Button>
        </div>
      )
    }
    return this.props.children
  }
}
