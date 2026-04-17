import { createFileRoute } from '@tanstack/react-router'
import { AdminGuard } from '../../features/admin/AdminGuard'
import { VenueApproval } from '../../features/admin/VenueApproval'

export const Route = createFileRoute('/admin/venues')({
  component: () => (
    <AdminGuard>
      <VenueApproval />
    </AdminGuard>
  ),
})
