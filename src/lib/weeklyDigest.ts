import type { AppState, CareEvent } from '../types'

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

export interface WeeklyDigestData {
  remindersSent: number
  replies: number
  takenReplies: number
  noReplyYet: number
  familyConfirmed: number
  callsClaimed: number
  quotedReplies: string[]
  tasksCompleted: number
  refillEvents: CareEvent[]
  medicineChanges: CareEvent[]
  upcomingAppointments: AppState['appointments']
  noReplyDays: string[]
  questions: string[]
}

export function mostRecentDigestDelivery(current: Date, day: number, time: string) {
  const [hours, minutes] = time.split(':').map(Number)
  const delivery = new Date(current)
  delivery.setHours(hours || 0, minutes || 0, 0, 0)
  delivery.setDate(delivery.getDate() - ((delivery.getDay() - day + 7) % 7))
  if (delivery.getTime() > current.getTime()) delivery.setDate(delivery.getDate() - 7)
  return delivery
}

export function nextSundayAtSix(current: Date) {
  const sunday = new Date(current)
  sunday.setHours(18, 0, 0, 0)
  sunday.setDate(sunday.getDate() + ((7 - sunday.getDay()) % 7))
  if (sunday.getTime() <= current.getTime()) sunday.setDate(sunday.getDate() + 7)
  return sunday
}

export function digestEvents(state: AppState, digest: CareEvent) {
  const covered = new Set(digest.coveredEventIds ?? [])
  return state.careEvents.filter(event => covered.has(event.id))
}

export function buildWeeklyDigest(state: AppState, digest: CareEvent): WeeklyDigestData {
  const patientName = state.patients.find(patient => patient.id === digest.patientId)?.parentChannel.preferredName ?? 'Parent'
  const events = digestEvents(state, digest)
  const reminders = events.filter(event => event.kind === 'reminder_sent')
  const replies = events.filter(event => event.kind === 'parent_replied' && event.alertId)
  const replyAlertIds = new Set(replies.map(event => event.alertId))
  const nonTakenReplies = replies.filter(event => event.replyCategory !== 'taken')
  const refillEvents = events.filter(event => event.kind === 'refill_needed' || event.kind === 'refill_done')
  const medicineChanges = events.filter(event => event.kind === 'medicine_changed')
  const windowEnd = Date.parse(digest.at)
  const windowStart = windowEnd - 7 * 24 * 60 * 60 * 1000
  const reminderDays = new Set(reminders.map(event => new Date(event.at).getDay()))
  const replyDays = new Set(replies.map(event => new Date(event.at).getDay()))
  const noReplyDays = [...reminderDays].filter(day => !replyDays.has(day)).sort((a, b) => {
    const offset = (value: number) => (value - new Date(windowStart).getDay() + 7) % 7
    return offset(a) - offset(b)
  }).map(day => DAY_NAMES[day])
  const upcomingAppointments = state.appointments
    .filter(appointment => {
      const at = Date.parse(appointment.datetime)
      return appointment.status !== 'Cancelled' && appointment.status !== 'Completed' && at > windowEnd && at <= windowEnd + 7 * 24 * 60 * 60 * 1000
    })
    .sort((a, b) => Date.parse(a.datetime) - Date.parse(b.datetime))
  const quotedReplies = nonTakenReplies
    .map(event => event.rawText?.trim())
    .filter((text): text is string => Boolean(text))
    .slice(0, 3)
  const questions = [
    ...quotedReplies.map(text => `${patientName} said: “${text}”`),
    ...refillEvents.map(event => event.text),
    ...medicineChanges.map(event => event.text),
  ]

  return {
    remindersSent: reminders.length,
    replies: replies.length,
    takenReplies: replies.filter(event => event.replyCategory === 'taken').length,
    noReplyYet: reminders.filter(event => !replyAlertIds.has(event.alertId)).length,
    familyConfirmed: events.filter(event => event.kind === 'family_confirmed').length,
    callsClaimed: events.filter(event => event.kind === 'claimed').length,
    quotedReplies,
    tasksCompleted: events.filter(event => event.kind === 'task_completed').length,
    refillEvents,
    medicineChanges,
    upcomingAppointments,
    noReplyDays,
    questions,
  }
}

export function joinNames(names: string[]) {
  if (names.length < 2) return names[0] ?? ''
  if (names.length === 2) return `${names[0]} and ${names[1]}`
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`
}
