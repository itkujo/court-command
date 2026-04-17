import { createFileRoute, Link, useNavigate, useSearch } from '@tanstack/react-router'
import { useState, type FormEvent } from 'react'
import { useLogin } from '../features/auth/hooks'
import { Button } from '../components/Button'
import { Input } from '../components/Input'
import { FormField } from '../components/FormField'
import { AdSlot } from '../components/AdSlot'

export const Route = createFileRoute('/login')({
  component: LoginPage,
  validateSearch: (search: Record<string, unknown>) => ({
    redirect: (search.redirect as string) || '/',
  }),
})

function LoginPage() {
  const navigate = useNavigate()
  const { redirect } = useSearch({ from: '/login' })
  const login = useLogin()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    if (!email || !password) { setError('Email and password are required'); return }
    try {
      await login.mutateAsync({ email, password })
      navigate({ to: redirect })
    } catch (err) {
      setError((err as Error).message || 'Invalid email or password')
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-(--color-bg-primary) p-4">
      <div className="w-full max-w-sm">
        <div className="flex justify-center mb-8">
          <img src="/logo-wordmark.svg" alt="Court Command" className="h-10 dark:block hidden" decoding="async" />
          <img src="/logo-wordmark-dark.svg" alt="Court Command" className="h-10 dark:hidden" decoding="async" />
        </div>
        <div className="rounded-xl border border-(--color-border) bg-(--color-bg-secondary) p-6">
          <h1 className="text-xl font-semibold text-(--color-text-primary) mb-6">Log in</h1>
          <form onSubmit={handleSubmit} className="space-y-4">
            <FormField label="Email" htmlFor="email" required>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" autoComplete="email" autoFocus />
            </FormField>
            <FormField label="Password" htmlFor="password" required>
              <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Your password" autoComplete="current-password" />
            </FormField>
            {error && <p className="text-sm text-red-500" role="alert">{error}</p>}
            <Button type="submit" className="w-full" loading={login.isPending}>Log in</Button>
          </form>
        </div>
        <p className="mt-4 text-center text-sm text-(--color-text-secondary)">
          Don&apos;t have an account?{' '}
          <Link to="/register" className="text-cyan-400 hover:text-cyan-300 font-medium">Register</Link>
        </p>

        <AdSlot size="medium-rectangle" slot="login-bottom" className="mt-6" />
      </div>
    </div>
  )
}
