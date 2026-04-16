import { createFileRoute } from '@tanstack/react-router'
import { SourceProfileList } from '../../../features/overlay/profiles/SourceProfileList'

export const Route = createFileRoute('/overlay/source-profiles/')({
  component: SourceProfileList,
})
