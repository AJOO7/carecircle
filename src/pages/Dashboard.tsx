import { useApp } from '../context'
import { CalendarIcon, CheckCircleIcon, PlusIcon, ChevronRightIcon, PillIcon, UsersIcon, ClockIcon } from '../components/icons'
import { AlertSourceStatus } from '../components/AlertSourceStatus'
import { Button, Card } from '../components/ui'
import { awardCarePoints, canMemberSeeParentReplies, eventTextForMember, shortTime } from '../lib/careEvents'
import { useEffect, useState } from 'react'
import type { AppState, CareEvent, CareTask, Appointment, Medication, MedicationAlert, View } from '../types'
import { deriveStage, isNewInvitee } from '../lib/stage'
import { setupProgress } from '../lib/setupProgress'
import { currentNextStep } from '../lib/nextStep'
import { prioritizedDashboardNudge } from '../lib/nudges'
import { dismissFor14Days, isDismissed } from '../lib/dismissals'
import { DayStrip } from '../components/DayStrip'
function fmt12h(time: string) {
  const [h, m] = time.split(':').map(Number)
  if (!Number.isFinite(h)) return time
  return (h % 12 || 12) + ':' + String(m).padStart(2, '0') + (h >= 12 ? ' PM' : ' AM')
}
function dueLabel(value: string) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value || 'No due date' : date.toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })
}
function TaskStatus({ task }: { task: CareTask }) {
  const label = task.status === 'Completed' ? 'Done' : task.response === 'Declined' ? 'Declined' : task.status === 'In progress' ? 'In progress' : task.response === 'Accepted' ? 'Accepted' : task.assigneeId ? 'Awaiting update' : 'Not started'
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
const GARDEN_STAGES = ['Seed', 'Sprout', 'Sapling', 'Blossom', 'Grove']
const CONFETTI = ['#e8a33d', '#d86a77', '#4f9d78', '#5b8fd1', '#9a73c9']

function gardenStats(state: AppState, patientId: string, time: Date) {
  const awards = awardCarePoints(state.careEvents.filter(event => event.patientId === patientId))
  const events = awards.filter(award => award.points > 0).map(award => award.event)
  const points = awards.reduce((sum, award) => sum + award.points, 0)
  const level = Math.floor(Math.sqrt(points / 20)) + 1
  const floor = 20 * (level - 1) ** 2
  const ceiling = 20 * level ** 2
  const progress = Math.min(1, Math.max(0, (points - floor) / (ceiling - floor)))
  const week = events.filter(event => Date.parse(event.at) > time.getTime() - WEEK_MS)
  const inWeek = (kind: CareEvent['kind']) => week.filter(event => event.kind === kind).length
  const activeMembers = state.members.filter(member => member.status === 'Active').length
  const forPatient = state.appointments.filter(item => !item.patientId || item.patientId === patientId)
  const nextAppt = forPatient
    .filter(item => ['Upcoming', 'Confirmed'].includes(item.status) && Date.parse(item.datetime) >= time.getTime())
    .sort((a, b) => Date.parse(a.datetime) - Date.parse(b.datetime))[0]
  const meds = state.medications.filter(item => item.status !== 'Stopped' && (!item.patientId || item.patientId === patientId))
  const quests = [
    { id: 'tasks', title: 'Finish two care tasks', hint: 'Complete tasks from the circle list', done: inWeek('task_completed'), goal: 2 },
    activeMembers >= 2
      ? { id: 'team', title: 'Share the load', hint: 'Two different members take action', done: new Set(week.map(event => event.actorId)).size, goal: 2 }
      : { id: 'invite', title: 'Invite a second member', hint: 'Care is lighter when two people share it', done: 0, goal: 1 },
    nextAppt
      ? { id: 'visit', title: 'Prepare the next visit', hint: nextAppt.type + ': mark preparation complete', done: nextAppt.preparationComplete ? 1 : 0, goal: 1 }
      : { id: 'stock', title: 'Keep medicines stocked', hint: 'Every medicine above its refill level', done: meds.length > 0 && meds.every(item => item.stock > item.refillThreshold) ? 1 : 0, goal: 1 },
  ]
  const count = (kind: CareEvent['kind']) => events.filter(event => event.kind === kind).length
  const badges = [
    { id: 'first', name: 'First dose confirmed', hint: 'Confirm a dose yourself', earned: count('family_confirmed') > 0 },
    { id: 'call', name: 'Reached out', hint: 'Claim a follow-up call', earned: count('claimed') > 0 },
    { id: 'refill', name: 'Refill hero', hint: 'Restock a medicine', earned: count('refill_done') > 0 },
    { id: 'team', name: 'Team player', hint: 'Two members act in the circle', earned: new Set(events.map(event => event.actorId)).size >= 2 },
    { id: 'visit', name: 'Visit ready', hint: 'Complete a visit preparation', earned: forPatient.some(item => item.preparationComplete) },
    { id: 'digest', name: 'Week one', hint: 'Receive the first weekly digest', earned: state.careEvents.some(event => event.patientId === patientId && event.kind === 'weekly_digest') },
  ]
  return { points, level, floor, ceiling, progress, quests, badges }
}

function GardenPlant({ stage }: { stage: number }) {
  const height = 18 + stage * 15
  const top = 100 - height
  const leaves = Array.from({ length: Math.min(stage + 1, 6) }, (_, index) => index)
  const petals = [0, 72, 144, 216, 288]
  return <svg className="cc-plant" viewBox="0 0 120 120" role="img" aria-label={'Garden growth stage ' + stage + ' of 5'}>
    <ellipse cx="60" cy="112" rx="42" ry="7" fill="#cfe5d8" />
    <path d="M42 98 h36 l-4 15 h-28 z" fill="#c9814e" />
    <rect x="40" y="95" width="40" height="6" rx="3" fill="#b06c3d" />
    <g className="cc-sway">
      <path d={'M60 98 C58 ' + (98 - height * 0.5) + ' 62 ' + (98 - height * 0.8) + ' 60 ' + top} stroke="#3f8a62" strokeWidth="4" strokeLinecap="round" fill="none" />
      {leaves.map(index => {
        const y = 92 - index * (height / 7 + 2)
        const side = index % 2 ? 1 : -1
        const x = 60 + side * 11
        return <ellipse key={index} cx={x} cy={y} rx="11" ry="5.5" fill={index % 2 ? '#5db17f' : '#46996b'} transform={'rotate(' + side * -25 + ' ' + x + ' ' + y + ')'} />
      })}
      {stage >= 3 && <g>
        {petals.map(angle => <circle key={angle} cx={60 + 7.5 * Math.cos(angle * Math.PI / 180)} cy={top - 2 + 7.5 * Math.sin(angle * Math.PI / 180)} r="5.5" fill="#f4a9bc" />)}
        <circle cx="60" cy={top - 2} r="4.5" fill="#f6c453" />
      </g>}
      {stage >= 5 && <g>
        {petals.map(angle => <circle key={angle} cx={78 + 5.5 * Math.cos(angle * Math.PI / 180)} cy={top + 16 + 5.5 * Math.sin(angle * Math.PI / 180)} r="4" fill="#b99be3" />)}
        <circle cx="78" cy={top + 16} r="3.2" fill="#f6c453" />
      </g>}
    </g>
  </svg>
}

function CircleGarden({ patientId, name }: { patientId: string; name: string }) {
  const { state, now } = useApp()
  const stats = gardenStats(state, patientId, now())
  const stage = Math.min(stats.level, 5)
  const circumference = 2 * Math.PI * 30
  const storageKey = 'cc-garden-level-' + state.activeCircleId + '-' + patientId
  const [celebrate, setCelebrate] = useState(false)
  useEffect(() => {
    if (state.isSample) return
    try {
      const stored = Number(localStorage.getItem(storageKey))
      if (stored && stats.level > stored) setCelebrate(true)
      localStorage.setItem(storageKey, String(stats.level))
    } catch { /* storage unavailable */ }
  }, [state.isSample, storageKey, stats.level])
  const bloomed = stats.quests.filter(quest => quest.done >= quest.goal).length
  return <section className="cc-garden cc-garden-compact" aria-labelledby="garden-heading">
    <div className="cc-garden-hero">
      <div className="cc-garden-art" aria-hidden={false}>
        <GardenPlant stage={stage} />
        <span className="cc-sparkle cc-sparkle-a" aria-hidden="true" />
        <span className="cc-sparkle cc-sparkle-b" aria-hidden="true" />
      </div>
      <div className="cc-garden-copy">
        <p className="cc-eyebrow">Circle garden · {GARDEN_STAGES[stage - 1]}</p>
        <div className="cc-level-row">
          <svg className="cc-ring" viewBox="0 0 72 72" aria-hidden="true">
            <circle cx="36" cy="36" r="30" className="cc-ring-track" />
            <circle cx="36" cy="36" r="30" className="cc-ring-fill" strokeDasharray={circumference} strokeDashoffset={circumference * (1 - stats.progress)} />
          </svg>
          <span className="cc-ring-level">{stats.level}</span>
          <div>
            <h2 id="garden-heading">Level {stats.level}</h2>
            <p className="cc-garden-lead">{stats.points - stats.floor} of {stats.ceiling - stats.floor} care points to level {stats.level + 1}</p>
          </div>
        </div>
        <div className="cc-xpbar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(stats.progress * 100)} aria-label="Progress to the next level"><span style={{ width: Math.round(stats.progress * 100) + '%' }} /></div>
        <p className="cc-garden-note">Points come from what your family does: calling to confirm a dose, finishing accepted tasks and closing refills. Each action counts once, with a daily limit. They never rate how {name} is.</p>
      </div>
    </div>
    <div className="cc-garden-panels">
      <div>
        <div className="cc-section-heading"><h3 className="cc-panel-title">This week's quests</h3><span className="cc-count">{bloomed} of {stats.quests.length} bloomed</span></div>
        <div className="cc-quests">
          {stats.quests.map(quest => {
            const done = quest.done >= quest.goal
            const shown = Math.min(quest.done, quest.goal)
            return <div key={quest.id} className={'cc-quest' + (done ? ' cc-quest-done' : '')}>
              <div className="cc-quest-head"><strong>{quest.title}</strong><span>{done ? 'Bloomed' : shown + ' of ' + quest.goal}</span></div>
              <p>{quest.hint}</p>
              <div className="cc-quest-bar" aria-hidden="true"><span style={{ width: Math.round(shown / quest.goal * 100) + '%' }} /></div>
            </div>
          })}
        </div>
      </div>
      <div>
        <div className="cc-section-heading"><h3 className="cc-panel-title">Badges</h3><span className="cc-count">{stats.badges.filter(badge => badge.earned).length} of {stats.badges.length}</span></div>
        <ul className="cc-badges">
          {stats.badges.map(badge => <li key={badge.id} className={'cc-badge' + (badge.earned ? ' cc-badge-earned' : '')}>
            <span className="cc-badge-medal" aria-hidden="true">{badge.earned ? '★' : '☆'}</span>
            <span><strong>{badge.name}</strong><em>{badge.earned ? 'Earned' : badge.hint}</em></span>
          </li>)}
        </ul>
      </div>
    </div>
    {celebrate && <div className="cc-levelup" role="status">
      <div className="cc-confetti" aria-hidden="true">{Array.from({ length: 18 }, (_, index) => <i key={index} style={{ left: (index * 5.7 + 3) + '%', background: CONFETTI[index % CONFETTI.length], animationDelay: (index % 6) * 0.12 + 's' }} />)}</div>
      <strong>Level {stats.level} reached</strong>
      <p>Your circle's care helped the garden grow.</p>
      <button type="button" onClick={() => setCelebrate(false)}>Keep going</button>
    </div>}
  </section>
}

type DoseStatus = 'done' | 'waiting' | 'missed' | 'upcoming'
const DOSE_LABEL: Record<DoseStatus, string> = { done: 'Confirmed', waiting: 'Waiting for a reply', missed: 'Not taken', upcoming: 'Later today' }

function minutesOf(time: string) {
  const [h, m] = time.split(':').map(Number)
  return (h || 0) * 60 + (m || 0)
}

function TodayGlance({ name, alerts, meds, tasks, nextAppt, events, time, onAlert, onView, onAppt }: {
  name: string
  alerts: MedicationAlert[]
  meds: Medication[]
  tasks: CareTask[]
  nextAppt?: Appointment
  events: { actorType: string; at: string }[]
  time: Date
  onAlert: (id: string) => void
  onView: (view: View) => void
  onAppt: () => void
}) {
  const doses = meds.map(medicine => {
    const alert = alerts.find(item => item.medicationId === medicine.id)
    const status: DoseStatus = !alert ? 'upcoming' : alert.status === 'Confirmed' ? 'done' : alert.status === 'Missed' ? 'missed' : 'waiting'
    return { id: medicine.id, alertId: alert?.id, name: medicine.name, time: medicine.scheduleTime, status, left: (minutesOf(medicine.scheduleTime) / 1440 * 100).toFixed(1) + '%' }
  })
  const waiting = doses.filter(dose => dose.status === 'waiting').length
  const nowLeft = ((time.getHours() * 60 + time.getMinutes()) / 1440 * 100).toFixed(1) + '%'

  const done = tasks.filter(task => task.status === 'Completed').length
  const open = tasks.length - done
  const donePct = tasks.length ? Math.round(done / tasks.length * 100) : 0

  const days = nextAppt ? Math.max(0, Math.ceil((Date.parse(nextAppt.datetime) - time.getTime()) / 86400000)) : null
  const ring = 2 * Math.PI * 26
  const ringFill = days === null ? 0 : Math.max(0.06, 1 - Math.min(days, 14) / 14)

  const stock = meds.map(medicine => {
    const scale = Math.max(medicine.refillThreshold * 4, medicine.stock, 1)
    return { id: medicine.id, name: medicine.name, stock: medicine.stock, low: medicine.stock <= medicine.refillThreshold, width: Math.round(medicine.stock / scale * 100) + '%', mark: Math.round(medicine.refillThreshold / scale * 100) + '%' }
  })

  const startOfToday = new Date(time)
  startOfToday.setHours(0, 0, 0, 0)
  const week = Array.from({ length: 7 }, (_, index) => {
    const day = new Date(startOfToday)
    day.setDate(day.getDate() - 6 + index)
    const from = day.getTime()
    const count = events.filter(event => event.actorType === 'member' && Date.parse(event.at) >= from && Date.parse(event.at) < from + 86400000).length
    return { key: from, short: day.toLocaleDateString('en-IN', { weekday: 'short' }), long: day.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short' }), count, today: index === 6 }
  })
  const most = Math.max(1, ...week.map(day => day.count))

  return <section className="cc-glance" aria-label="Today at a glance">
    <div className="cc-tile cc-tile-teal">
      <div className="cc-tile-head"><span className="cc-tile-icon"><PillIcon className="w-5 h-5" /></span><span>Doses today</span></div>
      <p className="cc-tile-big">{waiting}<span>{waiting === 1 ? 'reply waiting' : 'replies waiting'}</span></p>
      <div className="cc-dose-track" aria-label="Today's medicine times">
        <span className="cc-dose-now" style={{ left: nowLeft }} aria-hidden="true" />
        {doses.map(dose => <button key={dose.id} type="button" className={'cc-dose cc-dose-' + dose.status} style={{ left: dose.left }} onClick={() => dose.alertId ? onAlert(dose.alertId) : onView('medicines')} aria-label={dose.name + ' at ' + dose.time + ': ' + DOSE_LABEL[dose.status]} title={dose.name + ' · ' + dose.time + ' · ' + DOSE_LABEL[dose.status]}>
          {dose.status === 'done' ? <CheckCircleIcon className="w-4 h-4" /> : <ClockIcon className="w-4 h-4" />}
        </button>)}
      </div>
      <div className="cc-dose-scale" aria-hidden="true"><span>12 AM</span><span>6 AM</span><span>12 PM</span><span>6 PM</span><span>12 AM</span></div>
      <button type="button" className="cc-tile-link" onClick={() => onView('medicines')}>Medicines <ChevronRightIcon className="w-4 h-4" /></button>
    </div>

    <div className="cc-tile cc-tile-amber">
      <div className="cc-tile-head"><span className="cc-tile-icon"><CheckCircleIcon className="w-5 h-5" /></span><span>Care tasks</span></div>
      <p className="cc-tile-big">{open}<span>{open === 1 ? 'task open' : 'tasks open'}</span></p>
      <div className="cc-split" role="img" aria-label={done + ' done, ' + open + ' open'}>
        <span className="cc-split-done" style={{ width: donePct + '%' }} />
      </div>
      <div className="cc-legend"><span><i className="cc-dot cc-dot-done" />{done} done</span><span><i className="cc-dot cc-dot-open" />{open} open</span></div>
      <button type="button" className="cc-tile-link" onClick={() => onView('tasks')}>Tasks <ChevronRightIcon className="w-4 h-4" /></button>
    </div>

    <div className="cc-tile cc-tile-blue">
      <div className="cc-tile-head"><span className="cc-tile-icon"><CalendarIcon className="w-5 h-5" /></span><span>Next visit</span></div>
      <div className="cc-countdown">
        <svg viewBox="0 0 64 64" className="cc-countdown-ring" aria-hidden="true">
          <circle cx="32" cy="32" r="26" className="cc-countdown-track" />
          <circle cx="32" cy="32" r="26" className="cc-countdown-fill" strokeDasharray={ring} strokeDashoffset={ring * (1 - ringFill)} />
        </svg>
        <span className="cc-countdown-num">{days === null ? '–' : days}</span>
        <div className="cc-countdown-text">
          <strong>{days === null ? 'No visit booked' : days === 0 ? 'Today' : days === 1 ? 'Tomorrow' : 'In ' + days + ' days'}</strong>
          <span>{nextAppt ? nextAppt.type : 'Add one in Appointments'}</span>
        </div>
      </div>
      <button type="button" className="cc-tile-link" onClick={() => nextAppt ? onAppt() : onView('appointments')}>{nextAppt ? 'Prepare' : 'Appointments'} <ChevronRightIcon className="w-4 h-4" /></button>
    </div>

    <div className="cc-tile cc-tile-violet">
      <div className="cc-tile-head"><span className="cc-tile-icon"><PillIcon className="w-5 h-5" /></span><span>Medicine stock</span></div>
      <div className="cc-stock-list">
        {stock.length ? stock.map(item => <div key={item.id} className="cc-stock">
          <div className="cc-stock-row"><span>{item.name}</span><strong className={item.low ? 'cc-stock-low' : ''}>{item.stock} left</strong></div>
          <div className="cc-stock-bar" role="img" aria-label={item.name + ': ' + item.stock + ' left' + (item.low ? ', at or below refill level' : '')}>
            <span className={'cc-stock-fill' + (item.low ? ' cc-stock-fill-low' : '')} style={{ width: item.width }} />
            <i className="cc-stock-mark" style={{ left: item.mark }} />
          </div>
        </div>) : <p className="cc-tile-note">No active medicines</p>}
      </div>
      <p className="cc-tile-note">Line marks the refill level</p>
      <button type="button" className="cc-tile-link" onClick={() => onView('medicines')}>Stock <ChevronRightIcon className="w-4 h-4" /></button>
    </div>

    <div className="cc-week">
      <div className="cc-tile-head"><span className="cc-tile-icon"><UsersIcon className="w-5 h-5" /></span><span>Family activity, last 7 days</span></div>
      <div className="cc-week-bars">
        {week.map(day => <button key={day.key} type="button" className={'cc-week-day' + (day.today ? ' cc-week-today' : '')} onClick={() => onView('timeline')} aria-label={day.long + ': ' + day.count + (day.count === 1 ? ' action' : ' actions')} title={day.long + ' · ' + day.count + (day.count === 1 ? ' action' : ' actions')}>
          <span className="cc-week-count">{day.count}</span>
          <span className="cc-week-col"><span className="cc-week-fill" style={{ height: Math.max(6, Math.round(day.count / most * 100)) + '%' }} /></span>
          <span className="cc-week-label">{day.short}</span>
        </button>)}
      </div>
      <p className="cc-tile-note">Things the family recorded. It is not a measure of how {name} is.</p>
    </div>
  </section>
}

export function Dashboard() {
  const { state, actions, now } = useApp()
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
  const attention = [...openTasks.slice(0, 3).map(task => ({ kind: 'task' as const, task })), ...followups.slice(0, Math.max(0, 3 - openTasks.length)).map(alert => ({ kind: 'alert' as const, alert }))]
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
        {canWrite && <Button className="cc-add-task" onClick={() => actions.setView('tasks')}><PlusIcon className="w-5 h-5" />Add care task</Button>}
      </div>
    </header>
    {nudge && <Card className="p-5 mb-4"><div className="flex items-start justify-between gap-4"><div><strong className="text-slate-800">{nudge.title}</strong><p className="text-sm text-slate-500 mt-1">{nudge.detail}</p></div><Button variant="ghost" onClick={() => dismiss(`nudge:${nudge.id}`)}>{nudge.secondaryLabel}</Button></div>{nudge.primaryLabel && <Button variant="secondary" className="mt-4" onClick={() => { if (nudge.action === 'resend-consent' && patient) actions.sendParentConsent(patient.id); else if (nudge.view) actions.setView(nudge.view) }}>{nudge.primaryLabel}</Button>}</Card>}
    {!setupHidden && <Card className="p-5 mb-4"><div className="flex items-start justify-between gap-4"><div><strong className="text-slate-800">{setup.complete ? 'Milestones' : `Setting up - ${setup.completed} of 4`}</strong><p className="text-sm text-slate-500 mt-1">{setup.complete ? 'Progress from the care record, not a score.' : 'A short path to a useful care circle.'}</p></div><Button variant="ghost" onClick={() => dismiss('setup-checklist')}>Hide for 14 days</Button></div><div className="grid sm:grid-cols-2 gap-2 mt-4">{setup.complete ? setup.milestones.map(item => <div key={item.id} className="rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-600"><span className="font-semibold">{item.complete ? 'Done' : 'Ahead'}</span> · {item.title}</div>) : setup.steps.map(item => <Button variant="secondary" key={item.id} onClick={() => actions.setView(item.view)} className="justify-start text-left"><span className="font-semibold">{item.complete ? 'Done' : 'Next'}</span> · {item.title}</Button>)}</div></Card>}
    <DayStrip />
    {nextStep && <Card className="p-5 my-4"><p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Next step</p><div className="flex items-start justify-between gap-4 mt-2"><div><strong className="text-slate-800">{nextStep.title}</strong><p className="text-sm text-slate-500 mt-1">{nextStep.detail}</p></div><div className="flex gap-2"><Button variant="ghost" onClick={() => dismiss(`next-step:${nextStep.id}`)}>Not now</Button><Button onClick={() => actions.setView(nextStep.view)}>Open</Button></div></div></Card>}
    {patient?.parentChannel.reminders.status === 'Withdrawn' && <div className="cc-consent-note"><b>{patient.parentChannel.preferredName} asked to stop reminders.</b><p>Reminder messages are paused. A coordinator may send a new consent message.</p></div>}
    {firstReply?.rawText && patient && canMemberSeeParentReplies(patient, state.currentUser?.id) && !state.dismissedFirstReplyPatientIds.includes(patient.id) && <Card className="cc-first-reply"><div><strong>{patient.parentChannel.preferredName} replied for the first time</strong><p>“{firstReply.rawText}” · {replyAlert?.medicationName ?? 'Medicine reminder'} · {shortTime(firstReply.at)}</p></div><Button variant="ghost" onClick={() => actions.dismissFirstReply(patient.id)}>Dismiss</Button></Card>}
    <TodayGlance name={patient?.parentChannel.preferredName ?? 'your parent'} alerts={todayAlerts} meds={activeMeds} tasks={tasks.filter(task => task.patientId === activePatientId)} nextAppt={nextAppt} events={events} time={time} onAlert={id => actions.openAlertDetail(id)} onView={view => actions.setView(view)} onAppt={openAppointment} />
    <div className="cc-dashboard-grid">
      <div className="cc-main-column">
        <section className="cc-surface" aria-labelledby="attention-heading">
          <div className="cc-section-heading"><h2 id="attention-heading">Needs attention now</h2><span className="cc-count">{count} {count === 1 ? 'item' : 'items'}</span></div>
          {state.commitError ? <div className="cc-empty"><ClockIcon className="w-7 h-7" /><strong>Some changes are not saved</strong><p>Use Retry in the persistent banner before relying on the latest update.</p></div> : !hasCarePlan ? <div className="cc-empty"><PillIcon className="w-7 h-7" /><strong>Start the care plan</strong><p>Add a medicine or one care task to begin.</p></div> : attention.length === 0 ? <div className="cc-empty"><CheckCircleIcon className="w-7 h-7" /><strong>You're all caught up</strong><p>{tomorrowFirstDose ? `Tomorrow’s first dose is ${tomorrowFirstDose.name} at ${fmt12h(tomorrowFirstDose.scheduleTime)}.` : 'There is no dose scheduled for tomorrow yet.'}</p></div> : attention.map(item => {
            const isTask = item.kind === 'task'
            const id = isTask ? item.task.id : item.alert.id
            const owner = memberFor(isTask ? item.task.assigneeId : item.alert.assignedTo)
            const title = isTask ? item.task.title : item.alert.medicationName
            return <div className="cc-attention-row" key={item.kind + id}>
              <div className={'cc-icon-tile ' + (isTask ? 'cc-icon-amber' : '')}>{isTask ? <CheckCircleIcon className="w-5 h-5" /> : <PillIcon className="w-5 h-5" />}</div>
              <div className="cc-attention-title"><h3>{title}</h3>{isTask && item.task.description && <p>{item.task.description}</p>}<span className="cc-due"><CalendarIcon className="w-4 h-4" />{isTask ? dueLabel(item.task.due) : 'Today · ' + fmt12h(item.alert.scheduledTime)}</span></div>
              <div className="cc-owner"><span className="cc-label">Owner</span><div>{owner && <span className="cc-avatar cc-avatar-small">{owner.initials}</span>}<span>{owner?.name || 'Unassigned'}</span></div></div>
              <div className="cc-row-status"><span className="cc-label">Status</span>{isTask ? <TaskStatus task={item.task} /> : <AlertSourceStatus alert={item.alert} />}</div>
              <Button variant="secondary" className="cc-view-task" onClick={() => isTask ? actions.setView('tasks') : actions.openAlertDetail(id)}>{isTask && !owner && canWrite ? 'Assign' : 'View task'}</Button>
            </div>
          })}
          {count > attention.length && <button className="cc-text-link cc-more" onClick={() => actions.setView(openTasks.length > 3 ? 'tasks' : 'medicines')}>Review more care items <ChevronRightIcon className="w-4 h-4" /></button>}
        </section>
        <section className="cc-surface cc-plan" aria-labelledby="responsibility-heading">
          <div className="cc-section-heading"><h2 id="responsibility-heading">Who is doing what</h2></div>
          <div className="cc-table-scroll"><table className="cc-care-table"><thead><tr><th>Activity</th><th>Responsible</th><th>Due</th><th>Status</th><th><span className="sr-only">Action</span></th></tr></thead><tbody>
            {activeMeds.map(medicine => {
              const alert = todayAlerts.find(item => item.medicationId === medicine.id)
              const owner = memberFor(alert?.confirmedBy || alert?.assignedTo || patient?.primaryCaregiverId)
              return <tr key={'medicine-' + medicine.id}><td><div className="cc-activity"><span className="cc-icon-tile"><PillIcon className="w-5 h-5" /></span><div><strong>{medicine.name}</strong><span>Medicine schedule</span></div></div></td><td><div className="cc-table-owner">{owner && <span className="cc-avatar cc-avatar-small">{owner.initials}</span>}{owner?.name || 'Unassigned'}</div></td><td>{fmt12h(medicine.scheduleTime)}<span className="cc-secondary-line">Today</span></td><td>{alert ? <AlertSourceStatus alert={alert} /> : <span className="cc-status cc-status-neutral">No reminder sent</span>}</td><td><button className="cc-row-action" aria-label={'View ' + medicine.name} onClick={() => alert ? actions.openAlertDetail(alert.id) : actions.setView('medicines')}><ChevronRightIcon className="w-4 h-4" /></button></td></tr>
            })}
            {tasks.filter(task => task.patientId === activePatientId).slice(0, 6).map(task => {
              const owner = memberFor(task.assigneeId)
              return <tr key={'task-' + task.id}><td><div className="cc-activity"><span className="cc-icon-tile"><CheckCircleIcon className="w-5 h-5" /></span><div><strong>{task.title}</strong><span>Care task</span></div></div></td><td><div className="cc-table-owner">{owner && <span className="cc-avatar cc-avatar-small">{owner.initials}</span>}{owner?.name || 'Unassigned'}</div></td><td>{dueLabel(task.due)}</td><td><TaskStatus task={task} /></td><td><button className="cc-row-action" aria-label={'View ' + task.title} onClick={() => actions.setView('tasks')}><ChevronRightIcon className="w-4 h-4" /></button></td></tr>
            })}
          </tbody></table></div>
          {!activeMeds.length && !tasks.some(task => task.patientId === activePatientId) && <div className="cc-empty"><UsersIcon className="w-7 h-7" /><strong>Build your shared care plan</strong><p>Add a care task or medicine schedule to see responsibilities here.</p><div className="cc-empty-actions"><Button variant="secondary" onClick={() => actions.setView('tasks')}>Care tasks</Button><Button variant="ghost" onClick={() => actions.setView('medicines')}>Medicines</Button></div></div>}
        </section>
      </div>
      <aside className="cc-side-column cc-surface">
        <section aria-labelledby="next-appointment-heading"><h2 id="next-appointment-heading">Next appointment</h2>{nextAppt ? <><div className="cc-appointment"><span className="cc-icon-tile"><CalendarIcon className="w-6 h-6" /></span><div><h3>{nextAppt.type}</h3><p>{nextAppt.location || nextAppt.doctor}</p></div></div><p className="cc-appointment-date">{new Date(nextAppt.datetime).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })} · {new Date(nextAppt.datetime).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true })}</p><Button className="cc-prepare" onClick={openAppointment}><CalendarIcon className="w-5 h-5" />Prepare for visit</Button></> : <div className="cc-side-empty"><p>No upcoming appointment.</p><Button variant="secondary" onClick={() => actions.setView('appointments')}>View appointments</Button></div>}</section>
        {patient && stage >= 4 && <CircleGarden patientId={activePatientId} name={patient.parentChannel.preferredName} />}
        <section className="cc-latest" aria-labelledby="latest-update-heading"><h2 id="latest-update-heading">Latest update</h2>{events[0] ? <><div className="cc-update-note">{eventTextForMember(events[0], patient, state.currentUser?.id)}</div><p className="cc-event-meta"><ClockIcon className="w-4 h-4" />{memberFor(events[0].actorId)?.name || (events[0].actorType === 'parent' ? patient?.parentChannel.preferredName : 'CareCircle')} · {new Date(events[0].at).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}</p><button className="cc-text-link" onClick={() => actions.setView('timeline')}>View care timeline <ChevronRightIcon className="w-4 h-4" /></button></> : <p className="cc-side-empty">Care updates will appear here as your circle records activity.</p>}</section>
      </aside>
    </div>
  </div>
}
