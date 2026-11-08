import type { AppState, View } from '../types'
import { isDismissed } from './dismissals'

export type DashboardNudge = {
  id: string
  title: string
  detail: string
  primaryLabel?: string
  secondaryLabel: string
  view?: View
  action?: 'resend-consent'
}

export function prioritizedDashboardNudge(state: AppState, now = new Date(), sessionDismissed: string[] = []): DashboardNudge | undefined {
  const hidden = (id: string) => sessionDismissed.includes(`nudge:${id}`) || isDismissed(`nudge:${id}`, now)
  const memberId = state.currentUser?.id ?? ''
  const awayUntil = state.preferences.awayUntil[memberId]
  if (awayUntil && Date.parse(`${awayUntil}T23:59:59`) < now.getTime() && !hidden(`away-summary:${awayUntil}`)) {
    const since = Date.parse(`${awayUntil}T00:00:00`)
    const count = state.careEvents.filter(event => event.patientId === state.activePatientId && Date.parse(event.at) >= since).length
    if (count) return { id: `away-summary:${awayUntil}`, title: 'While you were away', detail: `${count} care updates were recorded. Review them when convenient.`, primaryLabel: 'Review updates', secondaryLabel: 'Not now', view: 'timeline' }
  }
  const firstMissed = state.alerts.find(alert => alert.patientId === state.activePatientId && alert.status === 'Missed')
  if (firstMissed && !hidden(`first-missed:${state.activePatientId}`)) {
    return { id: `first-missed:${state.activePatientId}`, title: 'Agree who follows up', detail: 'Choose a first-call and backup person for future unanswered reminders. This is about roles, not blame.', primaryLabel: 'Review roles', secondaryLabel: 'Not now', view: 'settings' }
  }
  const patient = state.patients.find(item => item.id === state.activePatientId)
  const reminders = patient?.parentChannel.reminders
  if (reminders?.status === 'Asked' && Date.parse(reminders.changedAt) <= now.getTime() - 2 * 24 * 60 * 60 * 1000 && !hidden(`consent:${state.activePatientId}`)) {
    return { id: `consent:${state.activePatientId}`, title: 'Reminder consent is still pending', detail: `${patient?.parentChannel.preferredName ?? 'The parent'} has not replied. You can resend the same request without changing anything.`, primaryLabel: 'Review request', secondaryLabel: 'Not now', view: 'profile' }
  }
  return undefined
}
