import type { AppState } from '../types'

export function deriveStage(state: AppState) {
  const patient = state.patients.find(item => item.id === state.activePatientId)
  const medicines = state.medications.filter(item =>
    item.status !== 'Stopped' &&
    (!item.patientId || item.patientId === state.activePatientId)
  )
  if (!medicines.length) return 1
  if (patient?.parentChannel.reminders.status !== 'Agreed') return 2
  const activeMembers = state.members.filter(member => member.status === 'Active')
  const hasParentReply = state.careEvents.some(event =>
    event.patientId === state.activePatientId && event.kind === 'parent_replied'
  )
  if (activeMembers.length >= 2 || hasParentReply) return 4
  return 3
}

export function isNewInvitee(state: AppState) {
  if (!state.currentUser || state.activeCircleRole === 'coordinator') return false
  const joined = [...state.careEvents].reverse().find(event =>
    event.kind === 'member_added' &&
    (event.memberId === state.currentUser?.id || event.targetId === state.currentUser?.id)
  )
  if (!joined) return false
  return !state.careEvents.some(event =>
    Date.parse(event.at) >= Date.parse(joined.at) &&
    event.actorId === state.currentUser?.id &&
    ['task_accepted', 'task_declined', 'task_taken'].includes(event.kind)
  )
}
