import { createFileRoute } from '@tanstack/react-router'
import { AdminGuard } from '../../features/admin/AdminGuard'
import { UploadBrowser } from '../../features/admin/UploadBrowser'

export const Route = createFileRoute('/admin/uploads')({
  component: () => (
    <AdminGuard>
      <UploadBrowser />
    </AdminGuard>
  ),
})
