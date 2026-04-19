import { type ReactNode } from 'react'
import { Navigate, useLocation } from '@tanstack/react-router'
import { useAuth } from './hooks'
import { Skeleton } from '../../components/Skeleton'

interface AuthGuardProps {
  children: ReactNode
}

export function AuthGuard({ children }: AuthGuardProps) {
  const { isLoading, isAuthenticated } = useAuth()
  const location = useLocation()

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="space-y-4 w-full max-w-md p-8">
          <Skeleton className="h-8 w-48 mx-auto" />
          <Skeleton className="h-4 w-64 mx-auto" />
          <Skeleton className="h-32 w-full" />
        </div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" search={{ redirect: location.pathname }} />
  }

  return <>{children}</>
}
