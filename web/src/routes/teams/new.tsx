import { createFileRoute } from '@tanstack/react-router'
import { TeamForm } from '../../features/registry/teams/TeamForm'

export const Route = createFileRoute('/teams/new')({
  component: TeamForm,
})
