// frontend/src/routes/overlay/index.tsx
import { createFileRoute } from '@tanstack/react-router'

import { OverlayLanding } from '../../features/overlay/OverlayLanding'

export const Route = createFileRoute('/overlay/')({
  component: OverlayLanding,
})
