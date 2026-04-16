// frontend/src/routes/overlay/setup.tsx
import { createFileRoute } from '@tanstack/react-router'

import { SetupWizard } from '../../features/overlay/setup/SetupWizard'

export const Route = createFileRoute('/overlay/setup')({
  component: SetupWizard,
})
