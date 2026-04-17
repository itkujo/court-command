import { createFileRoute } from '@tanstack/react-router'
import { AdminGuard } from '../../../features/admin/AdminGuard'

function UserDetailStub() {
  const { userId } = Route.useParams()
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-(--color-text-primary)">User Detail</h1>
      <p className="text-(--color-text-secondary)">User {userId} — Coming in Phase 6B.</p>
    </div>
  )
}

export const Route = createFileRoute('/admin/users/$userId')({
  component: () => (
    <AdminGuard>
      <UserDetailStub />
    </AdminGuard>
  ),
})
