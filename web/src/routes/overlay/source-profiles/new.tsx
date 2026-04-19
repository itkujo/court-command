import { createFileRoute } from '@tanstack/react-router'
import { SourceProfileEditor } from '../../../features/overlay/profiles/SourceProfileEditor'

export const Route = createFileRoute('/overlay/source-profiles/new')({
  component: NewSourceProfileRoute,
})

function NewSourceProfileRoute() {
  return <SourceProfileEditor mode="create" />
}
