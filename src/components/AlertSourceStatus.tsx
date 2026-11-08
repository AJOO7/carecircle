import { useApp } from '../context'
import { alertSourceLabel, canMemberSeeParentReplies, latestParentReply, parentReplyCategoryLabel } from '../lib/careEvents'
import { durationLabel, lateBy } from '../lib/time'
import { ClockIcon } from './icons'
import type { MedicationAlert } from '../types'

const SETTLED: MedicationAlert['status'][] = ['Confirmed', 'Missed', 'Not recorded']

export function AlertSourceStatus({ alert }: { alert: MedicationAlert }) {
  const { state, now } = useApp()
  const patient = state.patients.find(item => item.id === (alert.patientId ?? state.activePatientId))
  const reply = latestParentReply(alert.id, state.careEvents)
  const canSeeReply = Boolean(reply && canMemberSeeParentReplies(patient, state.currentUser?.id))
  const late = SETTLED.includes(alert.status) || reply?.replyCategory === 'taken' ? 0 : lateBy(alert.scheduledDate, alert.scheduledTime, now())
  return <div>
    {late > 0 && <span className="cc-late"><ClockIcon className="w-3.5 h-3.5" aria-hidden="true" />Late · {durationLabel(late)} past its time</span>}
    <p className="text-xs font-medium text-slate-500">{state.isSample ? alertSourceLabel(alert, state.careEvents, patient, state.members, state.currentUser?.id).replace(/Reminder sent/g, 'Simulated reminder') : alertSourceLabel(alert, state.careEvents, patient, state.members, state.currentUser?.id)}</p>
    {canSeeReply && reply && reply.replyCategory !== 'taken' && <span className="inline-flex mt-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">{parentReplyCategoryLabel(reply)}</span>}
  </div>
}
