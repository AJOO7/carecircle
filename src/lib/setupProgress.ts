import type { AppState, View } from '../types'

export interface SetupStep {
  id: 'medicine' | 'consent' | 'member' | 'refill'
  title: string
  detail: string
  view: View
  complete: boolean
}

export interface SetupMilestone {
  id: string
  title: string
  complete: boolean
}

function localDay(value: string) {
  const date = new Date(value)
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`
}

export function setupProgress(state: AppState) {
  const patient = state.patients.find(item => item.id === state.activePatientId)
  const medicines = state.medications.filter(item => item.status !== 'Stopped' && (!item.patientId || item.patientId === state.activePatientId))
  const steps: SetupStep[] = [
    { id: 'medicine', title: 'Add a medicine', detail: 'Record the family’s current medicine instructions.', view: 'medicines', complete: medicines.length > 0 },
    { id: 'consent', title: 'Ask the parent to agree to reminders', detail: 'Preview the exact message in the Patient profile.', view: 'profile', complete: Boolean(patient && patient.parentChannel.reminders.status !== 'Not asked') },
    { id: 'member', title: 'Invite a family member', detail: 'Share care with one more trusted person.', view: 'circle', complete: state.members.some(member => (member.userId ?? member.id) !== state.currentUser?.id) },
    { id: 'refill', title: 'Check a refill level', detail: 'Review stock against the family’s refill level.', view: 'medicines', complete: medicines.some(item => Number.isFinite(item.refillThreshold) && item.refillThreshold >= 0) },
  ]
  const patientEvents = state.careEvents.filter(event => event.patientId === state.activePatientId)
  const closedDoseDays = new Set(patientEvents.filter(event =>
    event.kind === 'family_confirmed' ||
    event.kind === 'not_taken_recorded' ||
    (event.kind === 'parent_replied' && event.replyCategory === 'taken')
  ).map(event => localDay(event.at)))
  const helpers = new Set(patientEvents.filter(event =>
    event.actorType === 'member' &&
    ['family_confirmed', 'not_taken_recorded', 'claimed', 'task_accepted', 'task_taken', 'task_completed', 'refill_done'].includes(event.kind)
  ).map(event => event.actorId))
  const milestones: SetupMilestone[] = [
    { id: 'first-reply', title: 'First parent reply seen', complete: patientEvents.some(event => event.kind === 'parent_replied') },
    { id: 'three-dose-days', title: 'Doses closed on three different days', complete: closedDoseDays.size >= 3 },
    { id: 'two-helpers', title: 'Two people have each helped', complete: helpers.size >= 2 },
    { id: 'first-digest', title: 'First weekly digest', complete: patientEvents.some(event => event.kind === 'weekly_digest') },
    { id: 'visit-ready', title: 'Visit-ready', complete: state.appointments.some(item => item.patientId === state.activePatientId && item.preparationComplete) },
  ]
  const completed = steps.filter(step => step.complete).length
  return { steps, milestones, completed, complete: completed === steps.length }
}
