import { Component, type ReactNode } from 'react'
import { Button } from './Button'

type FallbackRender = (error: Error, reset: () => void) => ReactNode

interface Props {
  children: ReactNode
  /**
   * Optional custom fallback. `null` renders nothing on error (e.g. on-air
   * overlays that must stay transparent). A render function receives the
   * thrown error plus a reset callback that clears the error state without
   * a full page reload. A node replaces the default error panel.
   */
  fallback?: ReactNode | FallbackRender | null
  /** Optional callback fired once when an error is caught. Useful for logging. */
  onError?: (error: Error) => void
}

interface State { hasError: boolean; error?: Error }

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error) {
    try {
      this.props.onError?.(error)
    } catch {
      // swallow — never let logging itself break the boundary
    }
    // eslint-disable-next-line no-console
    console.error('[ErrorBoundary]', error)
  }

  reset = () => {
    this.setState({ hasError: false, error: undefined })
  }

  render() {
    if (!this.state.hasError) return this.props.children

    const { fallback } = this.props
    const error = this.state.error ?? new Error('Unknown error')

    if (fallback === null) return null
    if (typeof fallback === 'function') return fallback(error, this.reset)
    if (fallback !== undefined) return fallback

    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-center p-8">
        <h2 className="text-xl font-semibold text-(--color-text-primary) mb-2">Something went wrong</h2>
        <p className="text-sm text-(--color-text-secondary) mb-4 max-w-md">An unexpected error occurred. Please try reloading the page.</p>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={this.reset}>Try again</Button>
          <Button onClick={() => window.location.reload()}>Reload page</Button>
        </div>
      </div>
    )
  }
}
