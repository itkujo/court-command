import { createFileRoute } from '@tanstack/react-router'
import { OrgForm } from '../../features/registry/organizations/OrgForm'

export const Route = createFileRoute('/organizations/new')({
  component: OrgForm,
})
