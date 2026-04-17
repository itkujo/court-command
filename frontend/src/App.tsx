import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider, createRouter } from '@tanstack/react-router'
import { ToastProvider } from './components/Toast'
import { SearchProvider } from './features/search/SearchContext'
import { OfflineBanner } from './components/OfflineBanner'
import { UpdatePrompt } from './components/UpdatePrompt'
import { InstallBanner } from './components/InstallBanner'
import { useServiceWorker } from './hooks/useServiceWorker'
import { useInstallPrompt } from './hooks/useInstallPrompt'
import { routeTree } from './routeTree.gen'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
})

const router = createRouter({
  routeTree,
  context: {},
  defaultPreload: 'intent',
})

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

export default function App() {
  const sw = useServiceWorker()
  const install = useInstallPrompt()

  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <SearchProvider>
          <RouterProvider router={router} />
          <OfflineBanner />
          <UpdatePrompt sw={sw} />
          <InstallBanner install={install} />
        </SearchProvider>
      </ToastProvider>
    </QueryClientProvider>
  )
}
