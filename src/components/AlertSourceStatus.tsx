import { useApp } from '../context'
import { alertSourceLabel, canMemberSeeParentReplies, latestParentReply, parentReplyCategoryLabel } from '../lib/careEvents'
import type { MedicationAlert } from '../types'

export function AlertSourceStatus({ alert }: { alert: MedicationAlert }) {
  const { state } = useApp()
  const patient = state.patients.find(item => item.id === (alert.patientId ?? state.activePatientId))
  const reply = latestParentReply(alert.id, state.careEvents)
  const canSeeReply = Boolean(reply && canMemberSeeParentReplies(patient, state.currentUser?.id))
  return <div><p className="text-xs font-medium text-slate-500">{alertSourceLabel(alert, state.careEvents, patient, state.members, state.currentUser?.id)}</p>{canSeeReply && reply && reply.replyCategory !== 'taken' && <span className="inline-flex mt-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">{parentReplyCategoryLabel(reply)}</span>}</div>
}
