import { createFileRoute } from '@tanstack/react-router'
import { AdminGuard } from '../../../features/admin/AdminGuard'

function UserSearchStub() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-(--color-text-primary)">User Management</h1>
      <p className="text-(--color-text-secondary)">Coming in Phase 6B.</p>
    </div>
  )
}

export const Route = createFileRoute('/admin/users/')({
  component: () => (
    <AdminGuard>
      <UserSearchStub />
    </AdminGuard>
  ),
})
