import { createContext, useContext, useState, type ReactNode } from 'react'
import { Link, useLocation } from 'react-router'
import { useAuthStatus } from './AuthStatus'
import { Button, Dialog } from '../components/ui'

interface GateValue {
  requireAccount: (run: () => void, actionId: string) => void
}

const GateContext = createContext<GateValue>({ requireAccount: run => run() })

function gatedReturnPath(pathname: string, actionId: string) {
  if (actionId === 'add-medicine') return '/medicines'
  if (actionId === 'invite-member') return '/circle'
  return pathname
}

export function GateProvider({ children, sample = false }: { children: ReactNode; sample?: boolean }) {
  const auth = useAuthStatus()
  const location = useLocation()
  const [blockedAction, setBlockedAction] = useState<string | null>(null)

  const requireAccount = (run: () => void, actionId: string) => {
    if (!sample || auth.user) {
      run()
      return
    }
    const returnTo = gatedReturnPath(location.pathname, actionId)
    sessionStorage.setItem('carecircle-return-to', JSON.stringify({ path: returnTo, action: actionId }))
    setBlockedAction(actionId)
  }
  const query = `?returnTo=${encodeURIComponent(gatedReturnPath(location.pathname, blockedAction ?? ''))}&action=${encodeURIComponent(blockedAction ?? '')}`

  return <GateContext.Provider value={{ requireAccount }}>
    {children}
    {blockedAction && <Dialog title="Sign in to save this" onClose={() => setBlockedAction(null)}>
      <p className="text-sm text-slate-600">The sample is private to this browser tab and resets on reload. Sign in or create an account to continue this action in your own circle.</p>
      <div className="grid grid-cols-2 gap-3 mt-5">
        <Link to={`/login${query}`}><Button className="w-full">Log in</Button></Link>
        <Link to={`/create-account${query}`}><Button variant="secondary" className="w-full">Create account</Button></Link>
      </div>
    </Dialog>}
  </GateContext.Provider>
}

export function useGate() {
  return useContext(GateContext)
}

export function getReturnTo(search: string) {
  const params = new URLSearchParams(search)
  const path = params.get('returnTo')
  const action = params.get('action')
  if (path) {
    const value = { path, action: action ?? '' }
    sessionStorage.setItem('carecircle-return-to', JSON.stringify(value))
    return value
  }
  try {
    return JSON.parse(sessionStorage.getItem('carecircle-return-to') ?? 'null') as { path: string; action: string } | null
  } catch {
    return null
  }
}

export function returnPath(search: string, fallback: string) {
  const pending = getReturnTo(search)
  if (!pending) return fallback
  sessionStorage.removeItem('carecircle-return-to')
  const query = pending.action ? `?action=${encodeURIComponent(pending.action)}` : ''
  return `${pending.path}${query}`
}
