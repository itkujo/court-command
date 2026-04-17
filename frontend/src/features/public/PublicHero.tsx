import { useNavigate } from '@tanstack/react-router'
import { Button } from '../../components/Button'
import { useAuth } from '../auth/hooks'

export function PublicHero() {
  const { isAuthenticated, isLoading } = useAuth()
  const navigate = useNavigate()

  return (
    <section className="text-center py-12 md:py-16">
      <img
        src="/logo-wordmark.svg"
        alt="Court Command"
        width={240}
        height={64}
        className="h-12 md:h-16 w-auto mx-auto mb-6"
      />
      <h1 className="text-3xl md:text-4xl font-bold text-(--color-text-primary) mb-3">
        Pickleball Tournament & League Management
      </h1>
      <p className="text-(--color-text-muted) text-lg mb-8 max-w-xl mx-auto">
        Organize tournaments, manage leagues, and broadcast live scores — all in
        one platform.
      </p>
      <div className="h-12">
        {isLoading ? (
          <div className="h-10 w-36 mx-auto rounded-lg bg-(--color-bg-hover) animate-pulse" />
        ) : isAuthenticated ? (
          <Button
            size="lg"
            onClick={() => navigate({ to: '/dashboard' as string })}
          >
            Go to Dashboard
          </Button>
        ) : (
          <Button
            size="lg"
            onClick={() => navigate({ to: '/login', search: { redirect: '/' } })}
          >
            Sign In
          </Button>
        )}
      </div>
    </section>
  )
}
