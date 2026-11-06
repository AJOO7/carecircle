import { useApp } from './context'
import { Layout } from './components/Layout'
import { AlertDetailModal } from './components/AlertDetailModal'
import { ConfirmModal } from './components/ConfirmModal'
import { ToastContainer } from './components/ToastContainer'
import { Dashboard } from './pages/Dashboard'
import { Timeline } from './pages/Timeline'
import { Medicines } from './pages/Medicines'
import { Appointments } from './pages/Appointments'
import { Documents } from './pages/Documents'
import { Digest, Notifications } from './pages/Extended'
import { Account, CareCircle, HealthLog, Help, PatientProfile, Settings, Tasks } from './pages/Management'

export function Workspace() {
  const { state } = useApp()
  const { view, alertDetailId, confirmConfig } = state

  const page = {
    today: <Dashboard />,
    profile: <PatientProfile />,
    tasks: <Tasks />,
    timeline: <Timeline />,
    medicines: <Medicines />,
    appointments: <Appointments />,
    health: <HealthLog />,
    documents: <Documents />,
    circle: <CareCircle />,
    notifications: <Notifications />,
    digest: <Digest />,
    account: <Account />,
    settings: <Settings />,
    help: <Help />,
  }[view]

  return (
    <Layout>
      {page}
      {alertDetailId && <AlertDetailModal />}
      {confirmConfig && <ConfirmModal />}
      <ToastContainer />
    </Layout>
  )
}
