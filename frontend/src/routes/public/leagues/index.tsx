import { createFileRoute } from '@tanstack/react-router'
import { LeagueDirectory } from '../../../features/public/LeagueDirectory'

export const Route = createFileRoute('/public/leagues/')({
  component: LeagueDirectory,
})
