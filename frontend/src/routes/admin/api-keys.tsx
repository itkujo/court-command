import { createFileRoute } from '@tanstack/react-router'
import { AdminGuard } from '../../features/admin/AdminGuard'
import { ApiKeyManager } from '../../features/admin/ApiKeyManager'

export const Route = createFileRoute('/admin/api-keys')({
  component: () => (
    <AdminGuard>
      <ApiKeyManager />
    </AdminGuard>
  ),
})
