import { createFileRoute } from '@tanstack/react-router'
import { SourceProfileEditor } from '../../../features/overlay/profiles/SourceProfileEditor'

export const Route = createFileRoute('/overlay/source-profiles/$profileID')({
  component: EditSourceProfileRoute,
})

function EditSourceProfileRoute() {
  const { profileID } = Route.useParams()
  const id = parseInt(profileID, 10)
  if (Number.isNaN(id)) {
    return (
      <div className="p-6 text-(--color-error)">Invalid profile ID</div>
    )
  }
  return <SourceProfileEditor mode="edit" profileID={id} />
}
