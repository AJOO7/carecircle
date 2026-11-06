import { clockLabel } from './time'
import type { AppState } from '../types'
import { canMemberSeeParentReplies } from './careEvents'

const CLOSED_KINDS = new Set(['family_confirmed', 'not_taken_recorded', 'task_completed'])
const CARE_ACTION_KINDS = new Set(['family_confirmed', 'not_taken_recorded', 'claimed', 'task_accepted', 'task_taken', 'task_completed', 'refill_done'])

function dateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function closedKey(event: AppState['careEvents'][number]) {
  if (event.alertId) return `alert:${event.alertId}`
  if (event.taskId) return `task:${event.taskId}`
  return event.id
}

export function dayClosure(state: AppState, now = new Date()) {
  const today = dateKey(now)
  const patientId = state.activePatientId
  const todayAlerts = state.alerts.filter(alert => alert.patientId === patientId && alert.scheduledDate === today)
  const todayTasks = state.tasks.filter(task => task.patientId === patientId && dateKey(new Date(task.due)) === today)
  const todaysEvents = state.careEvents.filter(event => event.patientId === patientId && dateKey(new Date(event.at)) === today)
  const closedToday = new Set(todaysEvents.filter(event =>
    CLOSED_KINDS.has(event.kind) || (event.kind === 'parent_replied' && event.replyCategory === 'taken')
  ).map(closedKey))
  const todayItemKeys = new Set([
    ...todayAlerts.map(alert => `alert:${alert.id}`),
    ...todayTasks.map(task => `task:${task.id}`),
  ])
  const openItems = [
    ...todayAlerts.filter(alert => !closedToday.has(`alert:${alert.id}`)).map(alert => ({ label: `${alert.medicationName} at ${clockLabel(alert.scheduledTime)}`, at: `${today}T${alert.scheduledTime}` })),
    ...todayTasks.filter(task => !closedToday.has(`task:${task.id}`)).map(task => ({ label: task.title, at: task.due })),
  ].sort((a, b) => Date.parse(a.at) - Date.parse(b.at))
  const weekStart = now.getTime() - 7 * 24 * 60 * 60 * 1000
  const closedThisWeek = new Set(state.careEvents.filter(event =>
    event.patientId === patientId &&
    Date.parse(event.at) >= weekStart &&
    (CLOSED_KINDS.has(event.kind) || (event.kind === 'parent_replied' && event.replyCategory === 'taken'))
  ).map(closedKey)).size
  const tomorrow = new Date(now)
  tomorrow.setDate(now.getDate() + 1)
  const firstTomorrowDose = state.medications
    .filter(item => item.status !== 'Stopped' && (!item.patientId || item.patientId === patientId))
    .sort((a, b) => a.scheduleTime.localeCompare(b.scheduleTime))[0]
  const patient = state.patients.find(item => item.id === patientId)
  const quotedReply = canMemberSeeParentReplies(patient, state.currentUser?.id)
    ? [...todaysEvents].reverse().find(event => event.kind === 'parent_replied' && event.rawText)
    : undefined
  return {
    closedToday: [...closedToday].filter(key => todayItemKeys.has(key)).length,
    totalToday: todayAlerts.length + todayTasks.length,
    next: openItems[0]?.label,
    closedThisWeek,
    tomorrowPreview: now.getHours() >= 17 && firstTomorrowDose ? `${firstTomorrowDose.name} at ${clockLabel(firstTomorrowDose.scheduleTime)}` : undefined,
    quotedReply: quotedReply ? { speaker: patient?.parentChannel.preferredName ?? 'Parent', text: quotedReply.rawText! } : undefined,
  }
}

export function sharedLoad(state: AppState, now = new Date()) {
  const since = now.getTime() - 30 * 24 * 60 * 60 * 1000
  const counts = new Map<string, number>()
  for (const event of state.careEvents) {
    if (event.actorType !== 'member' || Date.parse(event.at) < since || !CARE_ACTION_KINDS.has(event.kind)) continue
    counts.set(event.actorId, (counts.get(event.actorId) ?? 0) + 1)
  }
  return state.members.filter(member => member.status === 'Active').map(member => ({
    member,
    count: counts.get(member.userId ?? member.id) ?? 0,
  }))
}
