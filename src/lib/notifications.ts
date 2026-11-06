import type { AppState, CareEvent, View } from '../types'

const ALL_MEMBER_KINDS = new Set([
  'parent_replied', 'consent_changed', 'refill_needed', 'refill_done',
  'member_added', 'medicine_changed', 'appointment_reminder',
  'parent_medicine_photo', 'medicine_photo_judgement',
])

export function relevantCareEvents(state: AppState) {
  const userId = state.currentUser?.id
  if (!userId) return []
  return state.careEvents.filter(event => {
    if (event.kind === 'weekly_digest') return Boolean(
      event.recipientIds?.includes(userId) &&
      state.patients.find(patient => patient.id === event.patientId)?.parentChannel.sharing.status === 'Agreed'
    )
    if (ALL_MEMBER_KINDS.has(event.kind)) return true
    if (event.targetId === userId || event.actorId === userId) return true
    if (event.alertId && state.alerts.find(alert => alert.id === event.alertId)?.assignedTo === userId) return true
    if (event.taskId && state.tasks.find(task => task.id === event.taskId)?.assigneeId === userId) return true
    return false
  }).sort((a, b) => Date.parse(b.at) - Date.parse(a.at))
}

export function unreadCareEvents(state: AppState) {
  const userId = state.currentUser?.id
  const read = new Set(state.notifications.filter(receipt => receipt.userId === userId).map(receipt => receipt.eventId))
  return relevantCareEvents(state).filter(event => !read.has(event.id))
}

export function eventTargetView(event: CareEvent): View {
  if (event.taskId || event.kind.startsWith('task_')) return 'tasks'
  if (event.kind === 'weekly_digest') return 'digest'
  if (event.appointmentId || event.kind === 'appointment_reminder') return 'appointments'
  if (event.medicationId || event.alertId || event.kind.startsWith('refill_') || event.kind === 'medicine_changed') return 'medicines'
  if (event.kind === 'consent_changed' || event.kind === 'member_added') return 'circle'
  return 'timeline'
}
