import { createFileRoute, Navigate } from '@tanstack/react-router'

export const Route = createFileRoute('/')({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  component: () => <Navigate to={'/players' as any} />,
})
