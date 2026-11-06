import { Link, NavLink, Outlet, useNavigate, useSearchParams } from 'react-router'
import { useEffect, useState } from 'react'
import { useAuthStatus } from '../auth/AuthStatus'
import { Button, Card, Dialog } from '../components/ui'
import { HeartIcon, PillIcon, UsersIcon, HomeIcon, ChatBubbleIcon } from '../components/icons'
import { useApp } from '../context'
import { AlertDetailModal } from '../components/AlertDetailModal'
import { ConfirmModal } from '../components/ConfirmModal'
import { PhonePane } from '../components/PhonePane'
import { ToastContainer } from '../components/ToastContainer'
import type { View } from '../types'

export function PublicLanding() {
  const auth = useAuthStatus()
  return <main className="min-h-screen bg-[#FAF8F3] flex items-center justify-center p-6">
    <Card className="w-full max-w-4xl p-8 lg:p-12">
      <div className="flex items-center gap-3"><span className="w-11 h-11 rounded-2xl bg-[#DEEDE7] flex items-center justify-center"><HeartIcon className="w-6 h-6 text-[#346B63]" /></span><strong className="text-xl text-slate-800">CareCircle</strong></div>
      <div className="mt-12 max-w-2xl"><p className="text-sm font-semibold text-[#477E78]">A calmer way for families to coordinate care.</p><h1 className="text-4xl lg:text-5xl font-semibold tracking-tight text-slate-800 mt-3">Keep medicines, tasks and family follow-ups in one shared circle.</h1><p className="text-slate-500 mt-5">CareCircle coordinates family care; it does not diagnose, prescribe, change doses, or contact emergency services.</p></div>
      <div className="flex flex-wrap gap-3 mt-10">
        <Link to="/sample"><Button variant="secondary">See a sample day</Button></Link>
        <Link to="/create-account"><Button>Create my circle</Button></Link>
        <Link to="/login"><Button variant="ghost">Log in</Button></Link>
      </div>
      {auth.loading && <p className="text-xs text-slate-400 mt-5">Checking your sign-in status…</p>}
    </Card>
  </main>
}

// The sample is routed by URL, but dashboard buttons ask the app to switch views. Pages the sample
// has are opened by address; the rest explain that they live in the family's own circle.
const SAMPLE_PATHS: Partial<Record<View, string>> = { today: '/sample', medicines: '/sample/medicines', circle: '/sample/circle' }
const VIEW_NAMES: Partial<Record<View, [title: string, noun: string]>> = {
  tasks: ['Care tasks are in your own circle', 'care tasks'],
  appointments: ['Appointments are in your own circle', 'appointments'],
  timeline: ['The care timeline is in your own circle', 'the care timeline'],
  documents: ['Records are in your own circle', 'records'],
  digest: ['The weekly digest is in your own circle', 'the weekly digest'],
}

export function SampleShell() {
  const { state, actions } = useApp()
  const navigate = useNavigate()
  const [ownCircleView, setOwnCircleView] = useState<View | null>(null)
  useEffect(() => {
    if (state.view === 'today') return
    const path = SAMPLE_PATHS[state.view]
    if (path) navigate(path)
    else setOwnCircleView(state.view)
    actions.setView('today')
  }, [actions, navigate, state.view])
  const [searchParams, setSearchParams] = useSearchParams()
  useEffect(() => {
    const action = searchParams.get('action')
    const alertId = action?.startsWith('confirm-dose:') ? action.slice('confirm-dose:'.length) : ''
    if (alertId && state.alertDetailId !== alertId) {
      actions.openAlertDetail(alertId)
      const next = new URLSearchParams(searchParams)
      next.delete('action')
      setSearchParams(next, { replace: true })
    }
  }, [actions, searchParams, setSearchParams, state.alertDetailId])
  return <div className="min-h-screen bg-[#FAF8F3]">
    <div className="bg-[#F5E8C8] text-[#6B5425] text-xs font-semibold text-center px-4 py-2">Sample — nothing is saved or sent</div>
    <header className="bg-white border-b border-slate-200 sticky top-0 z-20">
      <div className="max-w-[1440px] mx-auto px-4 lg:px-8 h-16 flex items-center gap-4">
        <Link to="/" className="flex items-center gap-2 mr-auto"><span className="w-9 h-9 rounded-xl bg-[#DEEDE7] flex items-center justify-center"><HeartIcon className="w-5 h-5 text-[#346B63]" /></span><strong className="text-slate-800">CareCircle sample</strong></Link>
        <nav className="flex items-center gap-1" aria-label="Sample navigation">
          {[
            ['/sample', 'Today', HomeIcon],
            ['/sample/medicines', 'Medicines', PillIcon],
            ['/sample/circle', 'Circle', UsersIcon],
          ].map(([to, label, Icon]) => <NavLink key={to as string} to={to as string} end={to === '/sample'} className={({ isActive }) => `flex items-center gap-2 min-h-10 px-3 rounded-xl text-sm font-semibold ${isActive ? 'bg-[#E9F1EC] text-[#346B63]' : 'text-slate-500'}`}><Icon className="w-4 h-4" />{label as string}</NavLink>)}
        </nav>
        <Button variant="ghost" onClick={() => actions.togglePhonePane()}><ChatBubbleIcon className="w-4 h-4" /> Parent phone</Button>
      </div>
    </header>
    <main className="max-w-[1440px] mx-auto px-4 py-6 lg:px-8 lg:py-8"><Outlet /></main>
    {state.alertDetailId && <AlertDetailModal />}
    {state.confirmConfig && <ConfirmModal />}
    <PhonePane />
    <ToastContainer />
    {ownCircleView && <Dialog title={VIEW_NAMES[ownCircleView]?.[0] ?? 'This page is in your own circle'} onClose={() => setOwnCircleView(null)}>
      <p className="text-sm text-slate-600">The sample shows Today, Medicines and Circle. Log in or create an account to open {VIEW_NAMES[ownCircleView]?.[1] ?? 'this page'} for your own family.</p>
      <div className="grid grid-cols-2 gap-3 mt-5">
        <Link to="/login"><Button className="w-full">Log in</Button></Link>
        <Link to="/create-account"><Button variant="secondary" className="w-full">Create account</Button></Link>
      </div>
      <button type="button" className="cc-text-link mt-3" onClick={() => setOwnCircleView(null)}>Keep exploring the sample</button>
    </Dialog>}
  </div>
}
