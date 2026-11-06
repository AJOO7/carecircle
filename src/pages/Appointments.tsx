import { useState } from 'react'
import { useApp } from '../context'
import { XMarkIcon, CalendarIcon, ClockIcon, PlusIcon } from '../components/icons'
import type { Appointment } from '../types'
import { Button, Dialog, Field, PageHeader, SelectField, TextAreaField } from '../components/ui'

function fmtFull(iso: string) {
  return new Date(iso).toLocaleString('en-IN', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: true,
  })
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })
}

function daysUntil(iso: string, currentTime: Date) {
  const diff = new Date(iso).getTime() - currentTime.getTime()
  const days = Math.ceil(diff / (1000 * 60 * 60 * 24))
  if (days === 0) return 'Today'
  if (days === 1) return 'Tomorrow'
  return `In ${days} days`
}

const STATUS_STYLE: Record<Appointment['status'], { bg: string; text: string; label: string }> = {
  Upcoming: { bg: '#EEF5FB', text: '#2E6B9E', label: 'Upcoming' },
  Confirmed: { bg: '#D1FAE5', text: '#065F46', label: 'Confirmed' },
  Completed: { bg: '#F1F5F9', text: '#475569', label: 'Completed' },
  Cancelled: { bg: '#FEE2E2', text: '#991B1B', label: 'Cancelled' },
}

function ApptDetail({ appt, onClose, onEdit }: { appt: Appointment; onClose: () => void; onEdit: () => void }) {
  const { state, actions, now } = useApp()
  const [visitNote, setVisitNote] = useState('')
  const style = STATUS_STYLE[appt.status]
  return (
    <div
      className="fixed inset-0 z-40 flex items-end sm:items-center justify-center p-4 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="appt-title"
    >
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-md z-10 overflow-hidden max-h-[90vh] flex flex-col">
        {/* Header */}
        <div
          className="px-5 pt-5 pb-4 flex-shrink-0"
          style={{ background: 'linear-gradient(135deg, #F3F0FB 0%, #EEF5FB 100%)', borderBottom: '1px solid #F1F5F9' }}
        >
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <span
                className="inline-block text-xs font-semibold px-2 py-0.5 rounded-full mb-3"
                style={{ backgroundColor: style.bg, color: style.text }}
              >
                {style.label}
              </span>
              <h2 id="appt-title" className="text-lg font-semibold text-slate-800">{appt.type}</h2>
              <p className="text-slate-600 text-sm">{appt.doctor} · {appt.specialty}</p>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:bg-white/60 hover:text-slate-600 transition-colors"
              aria-label="Close"
            >
              <XMarkIcon className="w-4.5 h-4.5" />
            </button>
          </div>
        </div>

        {/* Details */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-1">
          {[
            { label: 'Date & Time', value: fmtFull(appt.datetime) },
            { label: 'Location', value: appt.location },
            { label: 'Specialty', value: appt.specialty },
            { label: 'Doctor', value: appt.doctor },
          ].map(({ label, value }) => (
            <div key={label} className="flex items-start justify-between gap-4 py-2.5" style={{ borderBottom: '1px solid #F8FAFC' }}>
              <span className="text-sm text-slate-500 flex-shrink-0 w-32">{label}</span>
              <span className="text-sm font-medium text-slate-800 text-right">{value}</span>
            </div>
          ))}

          {appt.notes && (
            <div className="pt-3">
              <p className="text-xs text-slate-400 uppercase tracking-wider font-semibold mb-2">Notes</p>
              <p className="text-sm text-slate-600 leading-relaxed bg-slate-50 rounded-xl px-3 py-3">{appt.notes}</p>
            </div>
          )}

          {appt.preparationNotes && (
            <div className="pt-3">
              <p className="text-xs text-slate-400 uppercase tracking-wider font-semibold mb-2">Preparation</p>
              <div className="rounded-xl px-3 py-3" style={{ backgroundColor: '#FFFBEB', border: '1px solid #FDE68A' }}>
                <p className="text-sm text-amber-800 leading-relaxed">{appt.preparationNotes}</p>
              </div>
            </div>
          )}
          <div className="pt-3">
            <TextAreaField label="Completed visit note" value={visitNote} onChange={e => setVisitNote(e.target.value)} placeholder="Add outcome, follow-up and linked sample record…" />
            <Button className="mt-3" disabled={!visitNote || state.activeCircleRole === 'view-only'} onClick={() => { const timestamp = now(); const documentId = `doc-${timestamp.getTime()}`; actions.addDocument({ id: documentId, name: `${appt.type} visit note`, category: 'Other', uploadedAt: timestamp.toISOString(), uploadedBy: state.accountProfile.name, fileType: 'Demo summary', size: 'Sample', description: `Linked visit note for ${appt.type}.`, access: 'Caregivers and coordinators', linkedType: 'appointment', linkedId: appt.id, sampleContent: `SAMPLE VISIT NOTE\n${visitNote}` }); actions.saveAppointment({ ...appt, status: 'Completed', visitNotes: [...(appt.visitNotes ?? []), { id: `note-${timestamp.getTime()}`, text: visitNote, author: state.accountProfile.name, timestamp: timestamp.toISOString(), documentId }] }); setVisitNote('') }}>Save completed visit & linked document</Button>
          </div>
          {appt.visitNotes?.map(note => <div key={note.id} className="rounded-xl bg-slate-50 p-3 text-sm"><b>Visit note · {note.author}</b><p className="text-slate-600 mt-1">{note.text}</p>{note.documentId && <button onClick={() => { actions.setView('documents'); actions.openDocumentDetail(note.documentId!) }} className="text-xs font-semibold text-[#4A7FA5] mt-2">Open linked document</button>}</div>)}
          <div className="flex gap-2 pt-4">
            <Button variant="secondary" disabled={state.activeCircleRole === 'view-only'} onClick={() => actions.saveAppointment({ ...appt, preparationComplete: !appt.preparationComplete })}>{appt.preparationComplete ? 'Preparation complete' : 'Mark preparation complete'}</Button>
            <Button variant="secondary" disabled={state.activeCircleRole === 'view-only'} onClick={onEdit}>Edit</Button>
            <Button variant="ghost" onClick={() => actions.showConfirm({ title: 'Cancel appointment?', message: 'The appointment remains in history as Cancelled.', confirmLabel: 'Cancel appointment', variant: 'danger', onConfirm: () => actions.saveAppointment({ ...appt, status: 'Cancelled' }) })}>Cancel appointment</Button>
          </div>
        </div>
      </div>
    </div>
  )
}

export function Appointments() {
  const { state, actions, now } = useApp()
  const { appointments, appointmentDetailId } = state
  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState<Appointment | null>(null)
  const selectedAppt = appointments.find(a => a.id === appointmentDetailId)

  const upcoming = appointments.filter(a => a.status === 'Upcoming')
  const past = appointments.filter(a => a.status === 'Completed' || a.status === 'Cancelled')

  function ApptCard({ appt }: { appt: Appointment }) {
    const style = STATUS_STYLE[appt.status]
    const until = daysUntil(appt.datetime, now())
    const isUrgent = until === 'Today' || until === 'Tomorrow'

    return (
      <button
        onClick={() => actions.openAppointmentDetail(appt.id)}
        className="w-full flex items-start gap-4 px-5 py-4 rounded-2xl bg-white shadow-sm hover:shadow-md transition-all text-left border border-transparent hover:border-slate-100 group"
        aria-label={`${appt.type} with ${appt.doctor} on ${fmtDate(appt.datetime)}`}
      >
        {/* Date block */}
        <div
          className="w-12 h-14 rounded-xl flex flex-col items-center justify-center flex-shrink-0"
          style={{ backgroundColor: '#EEF5FB' }}
        >
          <p className="text-[10px] font-bold text-[#4A7FA5] uppercase tracking-wider leading-none">
            {new Date(appt.datetime).toLocaleDateString('en-IN', { month: 'short' })}
          </p>
          <p className="text-2xl font-bold text-[#2E6B9E] leading-none mt-0.5">
            {new Date(appt.datetime).getDate()}
          </p>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-semibold text-slate-800 text-sm">{appt.type}</p>
            {isUrgent && (
              <span className="text-[10px] font-semibold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded-full">
                {until}
              </span>
            )}
          </div>
          <p className="text-sm text-slate-500 mt-0.5">{appt.doctor}</p>
          <div className="flex items-center gap-2 mt-2">
            <span
              className="text-xs font-semibold px-2 py-0.5 rounded-full"
              style={{ backgroundColor: style.bg, color: style.text }}
            >
              {style.label}
            </span>
            <span className="flex items-center gap-1 text-xs text-slate-400">
              <ClockIcon className="w-3 h-3" />
              {fmtTime(appt.datetime)}
            </span>
          </div>
        </div>

        <svg className="w-4 h-4 text-slate-300 group-hover:text-slate-400 transition-colors flex-shrink-0 mt-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
          <path d="m8.25 4.5 7.5 7.5-7.5 7.5" />
        </svg>
      </button>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Appointments" subtitle="Scheduled medical visits and consultations" action={<Button disabled={state.activeCircleRole === 'view-only'} onClick={() => setAdding(true)}><PlusIcon className="w-4 h-4 inline mr-2" />Add appointment</Button>} />

      {upcoming.length > 0 && (
        <section aria-labelledby="upcoming-heading">
          <h2 id="upcoming-heading" className="text-sm font-semibold text-slate-700 mb-3">Upcoming</h2>
          <div className="grid lg:grid-cols-2 gap-3">
            {upcoming.map(a => <ApptCard key={a.id} appt={a} />)}
          </div>
        </section>
      )}

      {past.length > 0 && (
        <section aria-labelledby="past-heading">
          <h2 id="past-heading" className="text-sm font-semibold text-slate-700 mb-3">Past</h2>
          <div className="grid lg:grid-cols-2 gap-3">
            {past.map(a => <ApptCard key={a.id} appt={a} />)}
          </div>
        </section>
      )}

      {appointments.length === 0 && (
        <div className="text-center py-16 bg-white rounded-2xl border border-dashed border-slate-200 text-slate-400">
          <CalendarIcon className="w-8 h-8 mx-auto mb-3 text-slate-300" />
          <p className="text-sm font-medium">No appointments scheduled</p>
        </div>
      )}

      {selectedAppt && (
        <ApptDetail
          appt={selectedAppt}
          onClose={() => actions.openAppointmentDetail(null)}
          onEdit={() => { setEditing(selectedAppt); actions.openAppointmentDetail(null) }}
        />
      )}
      {adding && <AppointmentForm onClose={() => setAdding(false)} onSave={appt => { actions.saveAppointment(appt); setAdding(false) }} />}
      {editing && <AppointmentForm initial={editing} onClose={() => setEditing(null)} onSave={appt => { actions.saveAppointment(appt); setEditing(null) }} />}
    </div>
  )
}

function AppointmentForm({ initial, onClose, onSave }: { initial?: Appointment; onClose: () => void; onSave: (appt: Appointment) => void }) {
  const { now } = useApp()
  const [form, setForm] = useState<Appointment>(() => {
    if (initial) return initial
    const createdAt = now()
    const appointmentTime = new Date(createdAt.getTime() + 7 * 24 * 60 * 60 * 1000)
    appointmentTime.setHours(10, 30, 0, 0)
    return { id: `appt-${createdAt.getTime()}`, type: '', doctor: '', specialty: '', location: '', datetime: new Date(appointmentTime.getTime() - appointmentTime.getTimezoneOffset() * 60000).toISOString().slice(0, 16), status: 'Upcoming', preparationNotes: '', reminder: '1 day before', preparationComplete: false, visitNotes: [] }
  })
  const set = <K extends keyof Appointment>(key: K, value: Appointment[K]) => setForm(current => ({ ...current, [key]: value }))
  return <Dialog title={initial ? 'Edit appointment' : 'Add appointment'} onClose={onClose} wide><div className="grid sm:grid-cols-2 gap-4"><Field label="Visit type" value={form.type} onChange={e => set('type', e.target.value)} /><Field label="Doctor" value={form.doctor} onChange={e => set('doctor', e.target.value)} /><Field label="Specialty" value={form.specialty} onChange={e => set('specialty', e.target.value)} /><Field label="Location or virtual link" value={form.location} onChange={e => set('location', e.target.value)} /><Field label="Date and time" type="datetime-local" value={form.datetime.slice(0, 16)} onChange={e => set('datetime', e.target.value)} /><SelectField label="Reminder" value={form.reminder} onChange={e => set('reminder', e.target.value)}><option>1 day before</option><option>2 days before</option><option>1 week before</option></SelectField><div className="sm:col-span-2"><TextAreaField label="Preparation notes" value={form.preparationNotes ?? ''} onChange={e => set('preparationNotes', e.target.value)} /></div></div><div className="flex justify-end gap-2 mt-6"><Button variant="secondary" onClick={onClose}>Cancel</Button><Button disabled={!form.type || !form.doctor || !form.location} onClick={() => onSave(form)}>Save appointment</Button></div></Dialog>
}
