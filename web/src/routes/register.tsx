import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useState, type FormEvent } from 'react'
import { useRegister } from '../features/auth/hooks'
import { Button } from '../components/Button'
import { Input } from '../components/Input'
import { DateInput } from '../components/DateInput'
import { FormField } from '../components/FormField'
import { AdSlot } from '../components/AdSlot'

export const Route = createFileRoute('/register')({
  component: RegisterPage,
})

function RegisterPage() {
  const navigate = useNavigate()
  const register = useRegister()
  const [form, setForm] = useState({ first_name: '', last_name: '', email: '', password: '', date_of_birth: '' })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [serverError, setServerError] = useState('')

  function validate(): boolean {
    const errs: Record<string, string> = {}
    if (!form.first_name.trim()) errs.first_name = 'First name is required'
    if (!form.last_name.trim()) errs.last_name = 'Last name is required'
    if (!form.email.trim()) errs.email = 'Email is required'
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) errs.email = 'Invalid email'
    if (!form.password) errs.password = 'Password is required'
    else if (form.password.length < 8) errs.password = 'At least 8 characters'
    else if (form.password.length > 72) errs.password = 'Maximum 72 characters'
    if (!form.date_of_birth) errs.date_of_birth = 'Date of birth is required'
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setServerError('')
    if (!validate()) return
    try {
      await register.mutateAsync(form)
      navigate({ to: '/' })
    } catch (err) {
      setServerError((err as Error).message || 'Registration failed')
    }
  }

  function updateField(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }))
    setErrors((prev) => ({ ...prev, [field]: '' }))
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-(--color-bg-primary) p-4">
      <div className="w-full max-w-sm">
        <div className="flex justify-center mb-8">
          <img src="/logo-wordmark.svg" alt="Court Command" className="h-10 dark:block hidden" decoding="async" />
          <img src="/logo-wordmark-dark.svg" alt="Court Command" className="h-10 dark:hidden" decoding="async" />
        </div>
        <div className="rounded-xl border border-(--color-border) bg-(--color-bg-secondary) p-6">
          <h1 className="text-xl font-semibold text-(--color-text-primary) mb-6">Create account</h1>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <FormField label="First name" htmlFor="first_name" error={errors.first_name} required>
                <Input id="first_name" value={form.first_name} onChange={(e) => updateField('first_name', e.target.value)} error={!!errors.first_name} autoFocus />
              </FormField>
              <FormField label="Last name" htmlFor="last_name" error={errors.last_name} required>
                <Input id="last_name" value={form.last_name} onChange={(e) => updateField('last_name', e.target.value)} error={!!errors.last_name} />
              </FormField>
            </div>
            <FormField label="Email" htmlFor="email" error={errors.email} required>
              <Input id="email" type="email" value={form.email} onChange={(e) => updateField('email', e.target.value)} placeholder="you@example.com" autoComplete="email" error={!!errors.email} />
            </FormField>
            <FormField label="Password" htmlFor="password" error={errors.password} required>
              <Input id="password" type="password" value={form.password} onChange={(e) => updateField('password', e.target.value)} placeholder="Min 8 characters" autoComplete="new-password" error={!!errors.password} />
            </FormField>
            <FormField label="Date of birth" htmlFor="date_of_birth" error={errors.date_of_birth} required>
              <DateInput id="date_of_birth" value={form.date_of_birth} onChange={(e) => updateField('date_of_birth', e.target.value)} error={!!errors.date_of_birth} />
            </FormField>
            {serverError && <p className="text-sm text-red-500" role="alert">{serverError}</p>}
            <Button type="submit" className="w-full" loading={register.isPending}>Create account</Button>
          </form>
        </div>
        <p className="mt-4 text-center text-sm text-(--color-text-secondary)">
          Already have an account?{' '}
          <Link to="/login" search={{ redirect: '/' }} className="text-cyan-400 hover:text-cyan-300 font-medium">Log in</Link>
        </p>

        <AdSlot size="medium-rectangle" slot="register-bottom" className="mt-6" />
      </div>
    </div>
  )
}
