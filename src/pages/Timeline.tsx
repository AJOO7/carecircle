import { useState } from 'react'
import { useApp } from '../context'
import { ClockIcon, CheckCircleIcon, PillIcon, ShieldCheckIcon } from '../components/icons'
import { Field, PageHeader } from '../components/ui'
import type { CareEvent, CareEventKind } from '../types'
import { eventTextForMember } from '../lib/careEvents'

type EventFilter = CareEventKind | 'all' | 'tasks'

const FILTERS: { value: EventFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'reminder_sent', label: 'Reminders' },
  { value: 'followup_sent', label: 'Follow-ups' },
  { value: 'parent_replied', label: 'Parent replies' },
  { value: 'family_confirmed', label: 'Family confirmations' },
  { value: 'not_taken_recorded', label: 'Not taken' },
  { value: 'record_corrected', label: 'Record corrected' },
  { value: 'escalated', label: 'Escalations' },
  { value: 'claimed', label: 'Claims' },
  { value: 'tasks', label: 'Tasks' },
  { value: 'consent_changed', label: 'Consent' },
]

function eventIcon(kind: CareEventKind) {
  const className = 'w-3.5 h-3.5'
  if (kind === 'reminder_sent') return <PillIcon className={className} />
  if (kind === 'parent_replied' || kind === 'family_confirmed') return <CheckCircleIcon className={className} />
  if (kind === 'consent_changed') return <ShieldCheckIcon className={className} />
  return <ClockIcon className={className} />
}

function eventColors(kind: CareEventKind) {
  if (kind === 'parent_replied') return 'bg-emerald-50 text-emerald-700'
  if (kind === 'family_confirmed') return 'bg-blue-50 text-blue-700'
  if (kind === 'consent_changed') return 'bg-violet-50 text-violet-700'
  if (kind === 'not_taken_recorded') return 'bg-slate-100 text-slate-600'
  return 'bg-amber-50 text-amber-700'
}

function fmtDatetime(iso: string) {
  return new Date(iso).toLocaleString('en-IN', {
    weekday: 'short', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: true,
  })
}

function groupByDate(events: CareEvent[]): [string, CareEvent[]][] {
  const groups = new Map<string, CareEvent[]>()
  for (const event of events) {
    const date = new Date(event.at).toLocaleDateString('en-IN', {
      weekday: 'long', day: 'numeric', month: 'long',
    })
    if (!groups.has(date)) groups.set(date, [])
    groups.get(date)!.push(event)
  }
  return [...groups.entries()]
}

export function Timeline() {
  const { state } = useApp()
  const [filter, setFilter] = useState<EventFilter>('all')
  const [search, setSearch] = useState('')
  const activePatient = state.patients.find(patient => patient.id === state.activePatientId)
  const events = state.careEvents
    .filter(event => event.patientId === state.activePatientId)
    .filter(event => (filter === 'all' || event.kind === filter || (filter === 'tasks' && event.kind.startsWith('task_'))) && event.text.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => Date.parse(b.at) - Date.parse(a.at))
  const groups = groupByDate(events)

  return <div className="space-y-6">
    <PageHeader title="Timeline" subtitle={`Append-only reminder, reply, confirmation and consent events for ${activePatient?.name}.`} />
    <Field label="Search timeline" value={search} onChange={event => setSearch(event.target.value)} placeholder="Search event text…" />
    <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1" role="tablist" aria-label="Filter timeline">
      {FILTERS.map(item => <button key={item.value} onClick={() => setFilter(item.value)} role="tab" aria-selected={filter === item.value} className={`px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap flex-shrink-0 ${filter === item.value ? 'bg-[#4A7FA5] text-white shadow-sm' : 'bg-white text-slate-600 border border-slate-200'}`}>{item.label}</button>)}
    </div>
    {!groups.length ? <div className="text-center py-16 text-slate-400 bg-white rounded-2xl border border-dashed border-slate-200"><ClockIcon className="w-8 h-8 mx-auto mb-3 text-slate-300" /><p className="text-sm font-medium">No events for this filter</p></div> : <div className="grid xl:grid-cols-2 gap-x-8 gap-y-6 items-start">
      {groups.map(([date, dateEvents]) => <section key={date}><h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">{date}</h2><div className="space-y-2">{dateEvents.map(event => {
        const member = state.members.find(item => (item.userId ?? item.id) === event.actorId)
        const target = state.members.find(item => (item.userId ?? item.id) === event.targetId)
        const actor = target ? `For ${target.name}` : event.actorType === 'parent' ? activePatient?.parentChannel.preferredName : event.actorType === 'system' ? 'Care Circle schedule' : member?.name ?? 'Family member'
        return <article key={event.id} className="bg-white rounded-2xl p-4 shadow-sm flex items-start gap-3"><div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${eventColors(event.kind)}`}>{eventIcon(event.kind)}</div><div className="min-w-0"><p className="text-sm font-semibold text-slate-800">{eventTextForMember(event, activePatient, state.currentUser?.id)}</p><p className="text-xs text-slate-500 mt-1">{actor} · {fmtDatetime(event.at)}</p></div></article>
      })}</div></section>)}
    </div>}
  </div>
}
