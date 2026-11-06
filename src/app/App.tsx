import { RouterProvider } from 'react-router'
import { router } from './routes'
import { AppErrorBoundary } from '../components/AppErrorBoundary'
import { AuthStatusProvider } from '../auth/AuthStatus'

export default function App() {
  return (
    <AppErrorBoundary>
      <AuthStatusProvider>
        <RouterProvider router={router} />
      </AuthStatusProvider>
    </AppErrorBoundary>
  )
}
