import type { CareEvent, CircleMember, MedicationAlert, Patient } from '../types'

export function shortTime(value: string | Date) {
  const date = value instanceof Date ? value : new Date(value)
  const hours = date.getHours()
  return `${hours % 12 || 12}:${String(date.getMinutes()).padStart(2, '0')}`
}

export function latestAlertEvent(alertId: string, events: CareEvent[]) {
  return [...events].reverse().find(event => event.alertId === alertId)
}

export function latestParentReply(alertId: string, events: CareEvent[]) {
  return [...events].reverse().find(event => event.alertId === alertId && event.kind === 'parent_replied')
}

export function parentReplyCategoryLabel(event: CareEvent) {
  if (event.replyCategory === 'not_taken') return 'Not confirmed · needs a check'
  if (event.replyCategory === 'later') return 'Later · not confirmed'
  if (event.replyCategory === 'other') return 'Other reply · needs a check'
  if (event.replyCategory === 'supply') return 'Supply issue · needs a check'
  if (event.replyCategory === 'felt_unwell') return 'Felt unwell · needs a check'
  if (event.replyCategory === 'taken') return 'Taken'
  return event.replyCategory?.replace('_', ' ') ?? 'Parent reply'
}

export function activeClaim(alertId: string, events: CareEvent[], currentTime: Date) {
  let claimIndex = -1
  for (let index = events.length - 1; index >= 0; index -= 1) {
    if (events[index].alertId === alertId && events[index].kind === 'claimed') {
      claimIndex = index
      break
    }
  }
  if (claimIndex < 0) return undefined
  const claim = events[claimIndex]
  const resolved = events.slice(claimIndex + 1).some(event =>
    event.alertId === alertId &&
    ['claim_lapsed', 'call_unanswered', 'parent_replied', 'family_confirmed', 'not_taken_recorded'].includes(event.kind)
  )
  if (resolved || currentTime.getTime() - Date.parse(claim.at) >= 20 * 60 * 1000) return undefined
  return claim
}

export function alertSourceLabel(
  alert: MedicationAlert,
  events: CareEvent[],
  patient?: Patient,
  members: CircleMember[] = [],
  memberId?: string,
) {
  const parentReply = latestParentReply(alert.id, events)
  if (parentReply) {
    if (!canMemberSeeParentReplies(patient, memberId)) return `Waiting for ${patient?.parentChannel.preferredName ?? 'the parent'} to agree to share with you`
    return `${patient?.parentChannel.preferredName ?? 'Parent'} wrote: "${parentReply.rawText ?? parentReply.text}" (${shortTime(parentReply.at)})`
  }
  const event = latestAlertEvent(alert.id, events)
  if (event?.kind === 'family_confirmed') {
    const member = members.find(item => (item.userId ?? item.id) === event.actorId)
    return `${member?.name ?? event.text.replace(/\s+confirmed\.?$/, '')} confirmed ${shortTime(event.at)}`
  }
  if (event?.kind === 'not_taken_recorded') {
    const member = members.find(item => (item.userId ?? item.id) === event.actorId)
    return `${member?.name ?? 'Family member'} recorded not taken ${shortTime(event.at)}`
  }
  if (event?.kind === 'reminder_sent') {
    return `Reminder sent ${shortTime(event.at)} · No reply yet`
  }
  if (event?.kind === 'followup_sent') return `Follow-up sent ${shortTime(event.at)} · No reply yet`
  if (event?.kind === 'claimed') return event.text
  if (event?.kind === 'claim_lapsed') return 'Claim lapsed'
  if (event?.kind === 'call_unanswered') return `${event.text} · No reply yet`
  if (event?.kind === 'escalated') return event.text
  if (alert.status === 'Confirmed' && alert.confirmedAt) {
    if (alert.confirmedBy?.startsWith('parent-')) return `${patient?.parentChannel.preferredName ?? 'Parent'} replied ${shortTime(alert.confirmedAt)}`
    const member = members.find(item => (item.userId ?? item.id) === alert.confirmedBy)
    return `${member?.name ?? 'Family member'} confirmed ${shortTime(alert.confirmedAt)}`
  }
  return 'No reply yet'
}

export function canMemberSeeParentReplies(patient: Patient | undefined, memberId: string | undefined) {
  return Boolean(patient && memberId && patient.parentChannel.sharing.sharedWith.includes(memberId))
}

export function eventTextForMember(event: CareEvent, patient: Patient | undefined, memberId: string | undefined) {
  if (event.kind !== 'parent_replied' || canMemberSeeParentReplies(patient, memberId)) return event.text
  return `Waiting for ${patient?.parentChannel.preferredName ?? 'the parent'} to agree to share with you`
}

const BASE_POINTS: Partial<Record<CareEvent['kind'], number>> = {
  claimed: 5, family_confirmed: 10, task_accepted: 3, task_taken: 3, task_completed: 12, refill_done: 15,
}
const DAILY_POINT_CAP = 40

export interface AwardedEvent { event: CareEvent; points: number }

function localDay(value: string) {
  const date = new Date(value)
  return date.getFullYear() + '-' + date.getMonth() + '-' + date.getDate()
}

// Care points reward family actions that are hard to fake. Each action counts once, and a daily cap applies.
export function awardCarePoints(patientEvents: CareEvent[]): AwardedEvent[] {
  const ordered = [...patientEvents].sort((a, b) => Date.parse(a.at) - Date.parse(b.at))
  const claimedBy = new Map<string, Set<string>>()
  const paidClaim = new Set<string>()
  const paidConfirm = new Set<string>()
  const paidAccept = new Set<string>()
  const paidComplete = new Set<string>()
  const acceptedTasks = new Set<string>()
  const openRefills = new Set<string>()
  const usedPerDay = new Map<string, number>()
  const awards: AwardedEvent[] = []
  for (const event of ordered) {
    let points = 0
    const alertId = event.alertId ?? ''
    const taskId = event.taskId ?? ''
    if (event.kind === 'refill_needed' && event.medicationId) openRefills.add(event.medicationId)
    if (event.actorType === 'member') {
      if (event.kind === 'claimed' && alertId) {
        if (!claimedBy.has(alertId)) claimedBy.set(alertId, new Set())
        claimedBy.get(alertId)!.add(event.actorId)
        if (!paidClaim.has(alertId)) { paidClaim.add(alertId); points = BASE_POINTS.claimed ?? 0 }
      } else if (event.kind === 'family_confirmed' && alertId) {
        if (claimedBy.get(alertId)?.has(event.actorId) && !paidConfirm.has(alertId)) { paidConfirm.add(alertId); points = BASE_POINTS.family_confirmed ?? 0 }
      } else if ((event.kind === 'task_accepted' || event.kind === 'task_taken') && taskId) {
        acceptedTasks.add(taskId)
        if (!paidAccept.has(taskId)) { paidAccept.add(taskId); points = BASE_POINTS[event.kind] ?? 0 }
      } else if (event.kind === 'task_completed' && taskId) {
        if (acceptedTasks.has(taskId) && !paidComplete.has(taskId)) { paidComplete.add(taskId); points = BASE_POINTS.task_completed ?? 0 }
      } else if (event.kind === 'refill_done' && event.medicationId) {
        if (openRefills.has(event.medicationId)) { openRefills.delete(event.medicationId); points = BASE_POINTS.refill_done ?? 0 }
      }
    }
    if (points > 0) {
      const day = localDay(event.at)
      const used = usedPerDay.get(day) ?? 0
      points = Math.max(0, Math.min(points, DAILY_POINT_CAP - used))
      usedPerDay.set(day, used + points)
    }
    awards.push({ event, points })
  }
  return awards
}

export function totalCarePoints(patientEvents: CareEvent[]) {
  return awardCarePoints(patientEvents).reduce((sum, award) => sum + award.points, 0)
}

// Text for a toast: only mentions points the new event really earns.
export function pointsNote(existing: CareEvent[], next: CareEvent) {
  const same = existing.filter(event => event.patientId === next.patientId)
  const gained = totalCarePoints([...same, next]) - totalCarePoints(same)
  return gained > 0 ? ' · +' + gained + ' care points' : ''
}
