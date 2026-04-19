import { createFileRoute } from '@tanstack/react-router'
import { RefHome } from '../../features/referee/RefHome'

export const Route = createFileRoute('/ref/')({
  component: RefHome,
})
