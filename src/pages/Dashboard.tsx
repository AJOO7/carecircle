import '../dashboard-refresh.css'
import { focusTask } from '../lib/taskNavigation'
import { useApp } from '../context'
import { CalendarIcon, CheckCircleIcon, PlusIcon, ChevronRightIcon, PillIcon, ClockIcon } from '../components/icons'
import { AlertSourceStatus } from '../components/AlertSourceStatus'
import { Button, Card } from '../components/ui'
import { canMemberSeeParentReplies, eventTextForMember, shortTime } from '../lib/careEvents'
import { useState } from 'react'
import type { CareEvent, CareTask, Appointment, Medication, MedicationAlert, View } from '../types'
import { deriveStage, isNewInvitee } from '../lib/stage'
import { setupProgress } from '../lib/setupProgress'
import { currentNextStep } from '../lib/nextStep'
import { prioritizedDashboardNudge } from '../lib/nudges'
import { dismissFor14Days, isDismissed } from '../lib/dismissals'
import { DayStrip } from '../components/DayStrip'
import { clockLabel as fmt12h, clockOf, dayAndClock, lateBy } from '../lib/time'
function dueLabel(value: string) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value || 'No due date' : dayAndClock(date)
}
function TaskStatus({ task }: { task: CareTask }) {
  const label = task.status === 'Completed' ? 'Done' : task.response === 'Declined' ? 'Declined' : task.status === 'In progress' ? 'In progress' : task.response === 'Accepted' ? 'Accepted' : task.assigneeId ? 'Awaiting response' : 'Needs an owner'
  return <span className={'cc-status ' + (task.status === 'Completed' ? 'cc-status-done' : task.response === 'Declined' ? 'cc-status-warning' : task.assigneeId ? 'cc-status-pending' : 'cc-status-neutral')}>{label}</span>
}

function NewInviteeWelcome() {
  const { state, actions } = useApp()
  const joined = [...state.careEvents].reverse().find(event =>
    event.kind === 'member_added' &&
    (event.memberId === state.currentUser?.id || event.targetId === state.currentUser?.id)
  )
  const inviter = state.members.find(member => (member.userId ?? member.id) === joined?.actorId)
    ?? state.members.find(member => member.role === 'coordinator')
  const task = state.tasks.find(item => item.patientId === state.activePatientId && item.assigneeId === state.currentUser?.id && item.status !== 'Completed')
    ?? state.tasks.find(item => item.patientId === state.activePatientId && !item.assigneeId && item.status !== 'Completed')
  const canRespond = Boolean(task && (!task.assigneeId || task.assigneeId === state.currentUser?.id) && task.response === 'Waiting')
  return <div className="max-w-2xl mx-auto space-y-5"><Card className="p-7"><p className="text-xs font-semibold uppercase tracking-wider text-[#477E78]">Welcome to the circle</p><h1 className="text-3xl font-semibold text-slate-800 mt-2">{inviter?.name ?? 'The coordinator'} invited you</h1><p className="text-sm text-slate-500 mt-3">Start with one care task. You can explore the rest of the circle after responding.</p></Card>{task ? <Card className="p-6"><p className="text-xs font-semibold text-slate-400">One task to start</p><h2 className="text-lg font-semibold text-slate-800 mt-2">{task.title}</h2><p className="text-sm text-slate-500 mt-2">{task.description}</p><p className="text-xs text-slate-400 mt-3">Due {dueLabel(task.due)}</p><div className="flex gap-2 mt-5">{canRespond ? <><Button onClick={() => actions.respondToTask(task.id, 'Accepted')}>Accept</Button><Button variant="secondary" onClick={() => actions.respondToTask(task.id, 'Declined', 'Not available')}>Decline</Button></> : <p className="text-sm text-slate-500">This task is already in progress.</p>}</div></Card> : <Card className="p-6"><p className="text-sm text-slate-500">There is no open task assigned to you yet.</p></Card>}</div>
}
const WEEK_MS = 7 * 24 * 60 * 60 * 1000
const CLOSING_KINDS: CareEvent['kind'][] = ['family_confirmed', 'task_completed', 'refill_done']

// Who closed care items this week. Listed by name, never ranked or scored.
function HelpedThisWeek({ patientId }: { patientId: string }) {
  const { state, now } = useApp()
  const since = now().getTime() - WEEK_MS
  const counts = new Map<string, number>()
  for (const event of state.careEvents) {
    if (event.patientId !== patientId || event.actorType !== 'member' || !CLOSING_KINDS.includes(event.kind) || Date.parse(event.at) < since) continue
    counts.set(event.actorId, (counts.get(event.actorId) ?? 0) + 1)
  }
  const rows = [...counts].map(([id, closed]) => ({ id, closed, member: state.members.find(member => (member.userId ?? member.id) === id) }))
    .filter(row => row.member)
    .sort((a, b) => a.member!.name.localeCompare(b.member!.name))
  return <section className="cc-helped" aria-labelledby="helped-heading">
    <h2 id="helped-heading">Who closed items this week</h2>
    {rows.length ? <ul>{rows.map(row => <li key={row.id}><span className="cc-avatar cc-avatar-small">{row.member!.initials}</span><span>{row.member!.name}</span><span className="cc-helped-count">{row.closed} {row.closed === 1 ? 'item' : 'items'}</span></li>)}</ul>
      : <p className="cc-side-empty">When someone confirms a dose, finishes a task or restocks a medicine, it shows here.</p>}
  </section>
}

// One line in place of the four glance tiles: each part links to where it is handled.
function TodaySummary({ alerts, meds, tasks, nextAppt, time, onView, onAppt }: {
  alerts: MedicationAlert[]
  meds: Medication[]
  tasks: CareTask[]
  nextAppt?: Appointment
  time: Date
  onView: (view: View) => void
  onAppt: () => void
}) {
  const waiting = meds.filter(medicine => {
    const alert = alerts.find(item => item.medicationId === medicine.id)
    return alert && alert.status !== 'Confirmed' && alert.status !== 'Missed'
  }).length
  const open = tasks.filter(task => task.status !== 'Completed').length
  const days = nextAppt ? Math.round((Date.UTC(new Date(nextAppt.datetime).getFullYear(), new Date(nextAppt.datetime).getMonth(), new Date(nextAppt.datetime).getDate()) - Date.UTC(time.getFullYear(), time.getMonth(), time.getDate())) / 86400000) : null
  const low = meds.filter(medicine => medicine.stock <= medicine.refillThreshold)
  const parts: { key: string; label: string; onClick: () => void }[] = [
    { key: 'doses', label: waiting ? waiting + (waiting === 1 ? ' dose waiting for a reply' : ' doses waiting for a reply') : 'No doses waiting', onClick: () => onView('medicines') },
    { key: 'tasks', label: open + (open === 1 ? ' task open' : ' tasks open'), onClick: () => onView('tasks') },
    { key: 'visit', label: days === null ? 'No visit booked' : days === 0 ? 'Visit today' : days === 1 ? 'Visit tomorrow' : 'Visit in ' + days + ' days', onClick: () => nextAppt ? onAppt() : onView('appointments') },
  ]
  if (low.length) parts.push({ key: 'stock', label: low.length === 1 ? low[0].name + ' running low' : low.length + ' medicines running low', onClick: () => onView('medicines') })
  return <nav className="cc-summary" aria-label="Today in brief"><ul>
    {parts.map(part => <li key={part.key}><button type="button" className={part.key === 'stock' ? 'cc-summary-warn' : ''} onClick={part.onClick}>{part.label}<ChevronRightIcon className="w-4 h-4" aria-hidden="true" /></button></li>)}
  </ul></nav>
}

export function Dashboard() {
  const { state, actions, now } = useApp()
  const [taskFilter, setTaskFilter] = useState<'all' | 'needs' | 'waiting' | 'handling'>('all')
  const { activePatientId, alerts, tasks, medications, appointments } = state
  const patient = state.patients.find(item => item.id === activePatientId)
  const time = now()
  const today = time.getFullYear() + '-' + String(time.getMonth() + 1).padStart(2, '0') + '-' + String(time.getDate()).padStart(2, '0')
  const todayAlerts = alerts.filter(alert => alert.scheduledDate === today && (!alert.patientId || alert.patientId === activePatientId))
  const openTasks = tasks.filter(task => task.patientId === activePatientId && task.status !== 'Completed').sort((a, b) => (Date.parse(a.due) || Infinity) - (Date.parse(b.due) || Infinity))
  const followups = todayAlerts.filter(alert => ['Unconfirmed', 'Assigned', 'In Progress', 'Missed'].includes(alert.status))
  const count = openTasks.length + followups.length
  const nextAppt = appointments.filter(item => (!item.patientId || item.patientId === activePatientId) && ['Upcoming', 'Confirmed'].includes(item.status) && Date.parse(item.datetime) >= time.getTime()).sort((a, b) => Date.parse(a.datetime) - Date.parse(b.datetime))[0]
  const events = state.careEvents.filter(event => event.patientId === activePatientId).sort((a, b) => Date.parse(b.at) - Date.parse(a.at))
  const firstReply = [...events].reverse().find(event => event.kind === 'parent_replied' && event.alertId)
  const replyAlert = alerts.find(alert => alert.id === firstReply?.alertId)
  const memberFor = (id?: string) => state.members.find(member => (member.userId ?? member.id) === id)
  const activeMeds = medications.filter(medicine => medicine.status !== 'Stopped' && (!medicine.patientId || medicine.patientId === activePatientId)).sort((a, b) => a.scheduleTime.localeCompare(b.scheduleTime))
  // Order by urgency: every dose follow-up first (earliest, so most overdue, first), then tasks with
  // no owner, then the rest by due date. Doses are never cut off; tasks fill up to three rows.
  const doseItems = [...followups].sort((a, b) => a.scheduledTime.localeCompare(b.scheduledTime)).map(alert => ({ kind: 'alert' as const, alert }))
  const taskItems = [...openTasks].sort((a, b) => Number(Boolean(a.assigneeId)) - Number(Boolean(b.assigneeId))).slice(0, Math.max(0, 3 - doseItems.length)).map(task => ({ kind: 'task' as const, task }))
  const attention = [...doseItems, ...taskItems]
  const allAttention = [...doseItems, ...openTasks.map(task => ({ kind: 'task' as const, task }))]
  const isUrgent = (item: (typeof attention)[number]) => item.kind === 'alert' ? item.alert.status === 'Missed' || lateBy(item.alert.scheduledDate, item.alert.scheduledTime, time) > 0 : !item.task.assigneeId || item.task.response === 'Declined'
  const myTasks = openTasks.filter(task => task.assigneeId === state.currentUser?.id)
  const filteredAttention = (taskFilter === 'all' ? attention : allAttention).filter(item => taskFilter === 'all' || (item.kind === 'task' ? taskFilter === 'needs' ? !item.task.assigneeId || item.task.response === 'Declined' : taskFilter === 'waiting' ? !!item.task.assigneeId && item.task.response === 'Waiting' : item.task.response === 'Accepted' : taskFilter === 'needs' ? !item.alert.assignedTo : taskFilter === 'handling' ? item.alert.status === 'In Progress' : item.alert.status === 'Assigned'))
  const unowned = openTasks.filter(task => !task.assigneeId).length + followups.filter(alert => !alert.assignedTo).length
  const shownTaskIds = new Set(attention.flatMap(item => item.kind === 'task' ? [item.task.id] : []))
  const shownMedIds = new Set(attention.flatMap(item => item.kind === 'alert' ? [item.alert.medicationId] : []))
  const planMeds = activeMeds.filter(medicine => !shownMedIds.has(medicine.id))
  const planTasks = tasks.filter(task => task.patientId === activePatientId && !shownTaskIds.has(task.id)).slice(0, 6)
  const openAppointment = () => { if (nextAppt) { actions.setView('appointments'); actions.openAppointmentDetail(nextAppt.id) } }
  const canWrite = state.activeCircleRole !== 'view-only'
  const greeting = time.getHours() < 12 ? 'Good morning' : time.getHours() < 17 ? 'Good afternoon' : 'Good evening'
  const firstName = state.currentUser?.name.split(' ')[0] ?? ''
  const stage = deriveStage(state)
  const [sessionDismissed, setSessionDismissed] = useState<string[]>([])
  const setup = setupProgress(state)
  const nextStep = currentNextStep(state, time, sessionDismissed)
  const nudge = prioritizedDashboardNudge(state, time, sessionDismissed)
  const setupHidden = sessionDismissed.includes('setup-checklist') || (!state.isSample && isDismissed('setup-checklist', time))
  const dismiss = (id: string) => {
    setSessionDismissed(current => [...new Set([...current, id])])
    if (!state.isSample) dismissFor14Days(id, time)
  }
  const tomorrowFirstDose = [...activeMeds].sort((a, b) => a.scheduleTime.localeCompare(b.scheduleTime))[0]
  const patientTasks = tasks.filter(task => task.patientId === activePatientId)
  const hasCarePlan = activeMeds.length > 0 || patientTasks.length > 0
  if (isNewInvitee(state)) return <NewInviteeWelcome />
  return <div className="cc-dashboard">
    <header className="cc-dashboard-heading">
      <svg className="cc-hero-art" viewBox="0 0 320 220" aria-hidden="true">
        <circle cx="200" cy="110" r="96" fill="#1E6B5B" />
        <circle cx="200" cy="110" r="64" fill="#2A7F6C" />
        <circle cx="200" cy="110" r="76" fill="none" stroke="#F5C45E" strokeWidth="2" strokeDasharray="3 9" />
        <circle cx="200" cy="34" r="13" fill="#F5C45E" /><circle cx="200" cy="34" r="5" fill="#14574A" />
        <circle cx="272" cy="86" r="11" fill="#F4A9BC" /><circle cx="272" cy="86" r="4" fill="#14574A" />
        <circle cx="252" cy="170" r="12" fill="#9FD3BE" /><circle cx="252" cy="170" r="4.5" fill="#14574A" />
        <circle cx="148" cy="170" r="10" fill="#B9A6E6" /><circle cx="148" cy="170" r="4" fill="#14574A" />
        <circle cx="128" cy="86" r="11" fill="#F7D9A0" /><circle cx="128" cy="86" r="4" fill="#14574A" />
        <path d="M200 132s-26-15-26-34a14 14 0 0 1 26-7 14 14 0 0 1 26 7c0 19-26 34-26 34z" fill="#F5C45E" />
        <path d="M44 196c10-30 34-44 62-40-6 26-28 42-62 40z" fill="#2E8B6F" />
        <path d="M44 196c16-12 34-22 56-30" stroke="#9FD3BE" strokeWidth="2" fill="none" strokeLinecap="round" />
        <circle cx="300" cy="24" r="4" fill="#F5C45E" /><circle cx="86" cy="40" r="3" fill="#9FD3BE" /><circle cx="306" cy="190" r="3" fill="#F4A9BC" />
      </svg>
      <p className="cc-greeting">{greeting}{firstName ? ', ' + firstName : ''}</p>
      <p className="cc-date">{time.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
      <h1>Today's shared care</h1>
      <div className="cc-patient-heading">
        <div className="cc-avatar cc-avatar-large">{patient?.initials || 'CC'}</div>
        <div className="cc-patient-title"><div><strong>{patient?.name || 'Choose a patient'}</strong>{patient && <span>Age {patient.age}</span>}</div><p>{state.circleName}</p></div>
      </div>
    </header>
    {patient?.parentChannel.reminders.status === 'Withdrawn' && <div className="cc-consent-note"><b>{patient.parentChannel.preferredName} asked to stop reminders.</b><p>Reminder messages are paused. A coordinator may send a new consent message.</p></div>}
    {myTasks.length > 0 && <section className="cc-my-work" aria-labelledby="my-work-heading"><div><span className="cc-eyebrow">YOUR PART</span><h2 id="my-work-heading">Your care tasks</h2><p>{myTasks.filter(task => task.response === 'Waiting').length} awaiting your response · {myTasks.filter(task => task.response === 'Accepted').length} accepted</p></div><Button variant="secondary" onClick={() => actions.setView('tasks')}>Review your tasks</Button></section>}
    <section className="cc-surface cc-attention" aria-labelledby="attention-heading">
      <div className="cc-section-heading">
        <div><span className="cc-dash-section-kicker">YOUR CARE PRIORITIES</span><h2 id="attention-heading">Needs attention now</h2><p className="cc-attention-sum">{count === 0 ? 'Nothing needs attention' : count + ' open' + (unowned ? ' · ' + unowned + ' needs an owner' : '')}</p></div>
        {canWrite && <Button variant="secondary" className="cc-attention-add" onClick={() => actions.setView('tasks')}><PlusIcon className="w-4 h-4" />Review tasks</Button>}
      </div>
      <div className="cc-filters" aria-label="Filter care items">{([['all','All'],['needs','Needs an owner'],['waiting','Awaiting response'],['handling','Being handled']] as const).map(([value,label]) => <button key={value} type="button" aria-pressed={taskFilter === value} onClick={() => setTaskFilter(value)}>{label}</button>)}</div>
      <div className="cc-care-grid">{state.commitError ? <div className="cc-empty"><ClockIcon className="w-7 h-7" /><strong>Some changes are not saved</strong><p>Use Retry in the persistent banner before relying on the latest update.</p></div> : !hasCarePlan ? <div className="cc-empty"><PillIcon className="w-7 h-7" /><strong>Start the care plan</strong><p>Add a medicine or one care task to begin.</p></div> : attention.length === 0 ? <div className="cc-empty"><CheckCircleIcon className="w-7 h-7" /><strong>You're all caught up</strong><p>{tomorrowFirstDose ? `Tomorrow’s first dose is ${tomorrowFirstDose.name} at ${fmt12h(tomorrowFirstDose.scheduleTime)}.` : 'There is no dose scheduled for tomorrow yet.'}</p></div> : filteredAttention.length === 0 ? <div className="cc-filter-empty">No open items in this group. Choose another filter to see more.</div> : filteredAttention.map(item => {
        const isTask = item.kind === 'task'
        const id = isTask ? item.task.id : item.alert.id
        const owner = memberFor(isTask ? item.task.assigneeId : item.alert.assignedTo)
        const title = isTask ? item.task.title : item.alert.medicationName
        return <article className={'cc-care-card' + (isUrgent(item) ? ' is-attention' : '')} key={item.kind + id}>
          <div className="cc-care-card-top"><span className="cc-care-type"><span className="cc-care-type-icon">{isTask ? <CheckCircleIcon className="w-4 h-4" /> : <PillIcon className="w-4 h-4" />}</span>{isTask ? 'CARE TASK' : 'MEDICINE'}</span><span className="cc-care-time"><CalendarIcon className="w-4 h-4" />{isTask ? dueLabel(item.task.due) : 'Today · ' + fmt12h(item.alert.scheduledTime)}</span></div>
          <div className="cc-care-content"><h3>{title}</h3>{isTask && item.task.description && <p>{item.task.description}</p>}</div>
          <div className="cc-care-status">{isTask ? <TaskStatus task={item.task} /> : <AlertSourceStatus alert={item.alert} />}</div>
          <div className="cc-care-footer"><div className="cc-care-person"><span className="cc-avatar cc-avatar-small">{owner?.initials || '—'}</span><span><small>RESPONSIBLE</small><strong>{owner?.name || 'Needs an owner'}</strong></span></div><Button variant="secondary" className="cc-care-action" onClick={() => { if (isTask) { focusTask(id); actions.setView('tasks') } else actions.openAlertDetail(id) }}>{isTask ? 'View task' : 'Follow up'} <span aria-hidden="true">↗</span></Button></div>
        </article>
      })}</div>
      {taskFilter !== 'all' && <p className="cc-filter-note">Showing all open items matching this filter.</p>}
      {count > attention.length && <button className="cc-text-link cc-more" onClick={() => actions.setView(taskItems.length < openTasks.length ? 'tasks' : 'medicines')}>Review more care items <ChevronRightIcon className="w-4 h-4" /></button>}
    </section>
    {state.isSample && <details className="cc-sample-tip"><summary>New here? Try the care loop</summary><p>Open the simulated parent phone, send a reply, then return to Today to see the change. Nothing is sent or saved.</p><Button variant="secondary" onClick={() => actions.togglePhonePane(true)}>Open parent phone</Button></details>}
    <DayStrip hideQuote={Boolean(firstReply?.rawText && patient && canMemberSeeParentReplies(patient, state.currentUser?.id) && !state.dismissedFirstReplyPatientIds.includes(patient.id))} />
    <details className="cc-dashboard-links"><summary>Explore today’s care</summary><TodaySummary alerts={todayAlerts} meds={activeMeds} tasks={patientTasks} nextAppt={nextAppt} time={time} onView={view => actions.setView(view)} onAppt={openAppointment} /></details>
    {firstReply?.rawText && patient && canMemberSeeParentReplies(patient, state.currentUser?.id) && !state.dismissedFirstReplyPatientIds.includes(patient.id) && <Card className="cc-first-reply"><div><strong>{patient.parentChannel.preferredName} replied for the first time</strong><p>“{firstReply.rawText}” · {replyAlert?.medicationName ?? 'Medicine reminder'} · {shortTime(firstReply.at)}</p></div><Button variant="ghost" onClick={() => actions.dismissFirstReply(patient.id)}>Dismiss</Button></Card>}
    {nudge && <section className="cc-insight cc-dash-nudge" aria-label="Suggested next step"><div className="cc-insight-icon" aria-hidden="true"><ClockIcon className="w-5 h-5" /></div><div className="cc-insight-copy"><span className="cc-kicker">SUGGESTED FOR YOUR CIRCLE</span><h2>{nudge.title}</h2><p>{nudge.detail}</p><div className="cc-insight-actions">{nudge.primaryLabel && <Button onClick={() => { if (nudge.action === 'resend-consent' && patient) actions.sendParentConsent(patient.id); else if (nudge.view) actions.setView(nudge.view) }}>{nudge.primaryLabel}</Button>}<Button variant="ghost" onClick={() => dismiss(`nudge:${nudge.id}`)}>{nudge.secondaryLabel}</Button></div></div></section>}
    {!setupHidden && setup.complete && <details className="cc-milestones"><summary>Milestones · {setup.milestones.filter(item => item.complete).length} of {setup.milestones.length} in place</summary><div className="grid sm:grid-cols-2 gap-2 mt-3">{setup.milestones.map(item => <div key={item.id} className="rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-600"><span className="font-semibold">{item.complete ? 'Done' : 'Ahead'}</span> · {item.title}</div>)}</div><button type="button" className="cc-text-link mt-2" onClick={() => dismiss('setup-checklist')}>Hide milestones for 14 days</button></details>}
    {!setupHidden && !setup.complete && <Card className="cc-setup-card p-5 mb-4"><div className="flex items-start justify-between gap-4"><div><strong className="text-slate-800">{setup.complete ? 'Milestones' : `Setting up - ${setup.completed} of 4`}</strong><p className="text-sm text-slate-500 mt-1">{setup.complete ? 'What your circle has in place so far.' : 'A short path to a useful care circle.'}</p></div><Button variant="ghost" onClick={() => dismiss('setup-checklist')}>Hide for 14 days</Button></div><div className="grid sm:grid-cols-2 gap-2 mt-4">{setup.complete ? setup.milestones.map(item => <div key={item.id} className="rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-600"><span className="font-semibold">{item.complete ? 'Done' : 'Ahead'}</span> · {item.title}</div>) : setup.steps.map(item => <Button variant="secondary" key={item.id} onClick={() => actions.setView(item.view)} className="justify-start text-left"><span className="font-semibold">{item.complete ? 'Done' : 'Next'}</span> · {item.title}</Button>)}</div></Card>}
    {nextStep && setupHidden && <Card className="cc-next-step p-5 my-4"><p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Next step</p><div className="flex items-start justify-between gap-4 mt-2"><div><strong className="text-slate-800">{nextStep.title}</strong><p className="text-sm text-slate-500 mt-1">{nextStep.detail}</p></div><div className="flex gap-2"><Button variant="ghost" onClick={() => dismiss(`next-step:${nextStep.id}`)}>Not now</Button><Button onClick={() => actions.setView(nextStep.view)}>Open</Button></div></div></Card>}
    <div className="cc-dashboard-grid">
      <div className="cc-main-column">
        {(planMeds.length > 0 || planTasks.length > 0) && <section className="cc-surface cc-plan" aria-labelledby="responsibility-heading">
          <div className="cc-section-heading"><h2 id="responsibility-heading">Who is doing what</h2></div>
          <div className="cc-table-scroll"><table className="cc-care-table"><thead><tr><th>Activity</th><th>Responsible</th><th>Due</th><th>Status</th><th><span className="sr-only">Action</span></th></tr></thead><tbody>
            {planMeds.map(medicine => {
              const alert = todayAlerts.find(item => item.medicationId === medicine.id)
              const owner = memberFor(alert?.confirmedBy || alert?.assignedTo || patient?.primaryCaregiverId)
              return <tr key={'medicine-' + medicine.id}><td><div className="cc-activity"><span className="cc-icon-tile"><PillIcon className="w-5 h-5" /></span><div><strong>{medicine.name}</strong><span>Medicine schedule</span></div></div></td><td><div className="cc-table-owner">{owner && <span className="cc-avatar cc-avatar-small">{owner.initials}</span>}{owner?.name || 'Unassigned'}</div></td><td>{fmt12h(medicine.scheduleTime)}<span className="cc-secondary-line">Today</span></td><td>{alert ? <AlertSourceStatus alert={alert} /> : <span className="cc-status cc-status-neutral">No reminder sent</span>}</td><td><button className="cc-row-action" aria-label={'View ' + medicine.name} onClick={() => alert ? actions.openAlertDetail(alert.id) : actions.setView('medicines')}><ChevronRightIcon className="w-4 h-4" /></button></td></tr>
            })}
            {planTasks.map(task => {
              const owner = memberFor(task.assigneeId)
              return <tr key={'task-' + task.id}><td><div className="cc-activity"><span className="cc-icon-tile"><CheckCircleIcon className="w-5 h-5" /></span><div><strong>{task.title}</strong><span>Care task</span></div></div></td><td><div className="cc-table-owner">{owner && <span className="cc-avatar cc-avatar-small">{owner.initials}</span>}{owner?.name || 'Unassigned'}</div></td><td>{dueLabel(task.due)}</td><td><TaskStatus task={task} /></td><td><button className="cc-row-action" aria-label={'View ' + task.title} onClick={() => actions.setView('tasks')}><ChevronRightIcon className="w-4 h-4" /></button></td></tr>
            })}
          </tbody></table></div>
        </section>}
      </div>
      <aside className="cc-side-column cc-surface">
        <section aria-labelledby="next-appointment-heading"><h2 id="next-appointment-heading">Next appointment</h2>{nextAppt ? <><div className="cc-appointment"><span className="cc-icon-tile"><CalendarIcon className="w-6 h-6" /></span><div><h3>{nextAppt.type}</h3><p>{nextAppt.location || nextAppt.doctor}</p></div></div><p className="cc-appointment-date">{new Date(nextAppt.datetime).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })} · {clockOf(new Date(nextAppt.datetime))}</p><Button className="cc-prepare" onClick={openAppointment}><CalendarIcon className="w-5 h-5" />Prepare for visit</Button></> : <div className="cc-side-empty"><p>No upcoming appointment.</p><Button variant="secondary" onClick={() => actions.setView('appointments')}>View appointments</Button></div>}</section>
        {patient && stage >= 4 && <HelpedThisWeek patientId={activePatientId} />}
        <section className="cc-latest" aria-labelledby="latest-update-heading"><h2 id="latest-update-heading">Latest update</h2>{events[0] ? <><div className="cc-update-note">{eventTextForMember(events[0], patient, state.currentUser?.id)}</div><p className="cc-event-meta"><ClockIcon className="w-4 h-4" />{memberFor(events[0].actorId)?.name || (events[0].actorType === 'parent' ? patient?.parentChannel.preferredName : 'CareCircle')} · {dayAndClock(new Date(events[0].at))}</p><button className="cc-text-link" onClick={() => actions.setView('timeline')}>View care timeline <ChevronRightIcon className="w-4 h-4" /></button></> : <p className="cc-side-empty">Care updates will appear here as your circle records activity.</p>}</section>
      </aside>
    </div>
  </div>
}
