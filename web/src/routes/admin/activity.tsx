import { createFileRoute } from '@tanstack/react-router'
import { AdminGuard } from '../../features/admin/AdminGuard'
import { ActivityLog } from '../../features/admin/ActivityLog'

export const Route = createFileRoute('/admin/activity')({
  component: () => (
    <AdminGuard>
      <ActivityLog />
    </AdminGuard>
  ),
})
