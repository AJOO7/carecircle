import { useEffect, useState } from 'react'
import { useApp } from '../context'
import type { CareTask, CircleMember, HealthEntry, Patient } from '../types'
import { sharedLoad } from '../lib/metrics'
import { Button, Card, Dialog, EmptyState, Field, PageHeader, SelectField, TextAreaField } from '../components/ui'
import { PlusIcon, ShieldCheckIcon } from '../components/icons'
import { Link, useSearchParams } from 'react-router'
import { parentConsentMessages } from '../constants/parentConsent'
import { useGate } from '../auth/Gate'

const EMPTY_PATIENT: Patient = {
  id: '', name: '', preferredName: '', age: 0, dob: '', initials: '', relationship: '', conditions: [],
  bloodType: '', primaryDoctor: '', primaryCaregiverId: '', address: '', accentColor: '#4A7FA5',
  medicalHistory: '', allergies: '', doctors: [], emergencyContacts: [], preferredHospital: '',
  emergencyInstructions: '', diet: '', mobility: '', communication: '', routine: '',
  parentChannel: {
    whatsappNumber: '', language: 'English', preferredName: '', quietHours: { start: '21:00', end: '07:00' }, paused: true,
    lastAskedQuestion: undefined,
    reminders: { status: 'Not asked', changedAt: '', via: 'Recorded by family' },
    sharing: { status: 'Not asked', changedAt: '', via: 'Recorded by family', sharedWith: [] },
  },
}

function PermissionNotice() {
  const { state } = useApp()
  if (state.activeCircleRole !== 'view-only') return null
  return <Card className="p-4 bg-amber-50 border-amber-100 text-sm text-amber-800"><b>View-only circle.</b> Creation, editing, confirmation, archive, and settings changes are disabled.</Card>
}

export function PatientProfile() {
  const { state, actions, now } = useApp()
  const patient = state.patients.find(p => p.id === state.activePatientId)!
  const [formPatient, setFormPatient] = useState<Patient | null>(null)
  const [dirty, setDirty] = useState(false)
  const canManage = state.activeCircleRole === 'coordinator'
  const set = <K extends keyof Patient>(key: K, value: Patient[K]) => { setFormPatient(p => p ? { ...p, [key]: value } : p); setDirty(true) }
  const close = () => dirty ? actions.showConfirm({ title: 'Discard unsaved changes?', message: 'Patient edits have not been saved.', confirmLabel: 'Discard', variant: 'danger', onConfirm: () => { setFormPatient(null); setDirty(false) } }) : setFormPatient(null)
  return <div className="space-y-6">
    <PageHeader title="Patient Profile" subtitle="Medical, emergency, routine and linked care information" action={<div className="flex gap-2"><Button variant="secondary" disabled={!canManage} onClick={() => setFormPatient({ ...EMPTY_PATIENT, id: `patient-${now().getTime()}` })}>Add patient</Button><Button disabled={!canManage} onClick={() => setFormPatient(JSON.parse(JSON.stringify(patient)))}>Edit profile</Button></div>} />
    <PermissionNotice />
    {patient.parentChannel.reminders.status === 'Withdrawn' && <Card className="p-4 bg-amber-50 border-amber-100 text-sm text-amber-800"><b>{patient.parentChannel.preferredName} asked to stop reminders on {new Date(patient.parentChannel.reminders.changedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}.</b> Reminder messages remain paused until a new consent message is sent and the parent replies YES.</Card>}
    <Card className="p-6 flex items-center gap-5"><div className="w-16 h-16 rounded-2xl text-white flex items-center justify-center font-semibold" style={{ backgroundColor: patient.accentColor }}>{patient.initials}</div><div className="flex-1"><h2 className="text-xl font-semibold text-slate-800">{patient.name} <span className="text-sm font-normal text-slate-400">“{patient.preferredName}”</span></h2><p className="text-sm text-slate-500">Born {new Date(patient.dob).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })} · Age {patient.age} · {patient.relationship}</p><p className="text-sm text-slate-500 mt-1">{patient.address}</p></div><Button variant="secondary" disabled={!canManage} onClick={() => actions.showConfirm({ title: `Archive ${patient.name}?`, message: 'The patient will be removed from the active picker. All records remain recoverable.', confirmLabel: 'Archive profile', variant: 'danger', onConfirm: () => actions.archivePatient(patient.id) })}>Archive</Button></Card>
    <div className="grid lg:grid-cols-2 gap-4">
      <ParentConsentCard patient={patient} />
      <SharingSummary patient={patient} />
    </div>
    <div className="grid lg:grid-cols-2 gap-4">
      <Info title="Medical overview" lead={`${patient.conditions.join(' · ')} · ${patient.bloodType}`} detail={`${patient.medicalHistory} Allergies: ${patient.allergies}.`} />
      <Info title="Doctors" lead={patient.doctors.map(d => `${d.name} · ${d.specialty}`).join(' | ')} detail={patient.doctors.map(d => `${d.clinic} · ${d.contact}`).join(' | ')} />
      <Info title="Emergency" lead={patient.emergencyContacts.map(c => `${c.name} (${c.relationship}) · ${c.phone}`).join(' | ')} detail={`${patient.preferredHospital}. ${patient.emergencyInstructions}`} />
      <Info title="Daily care preferences" lead={`${patient.diet} ${patient.mobility}`} detail={`${patient.communication} ${patient.routine}`} />
      <Card className="p-5 lg:col-span-2"><h3 className="font-semibold text-slate-800">Linked records</h3><div className="flex flex-wrap gap-3 mt-4"><Button variant="secondary" onClick={() => actions.setView('medicines')}>{state.medications.length} medicines</Button><Button variant="secondary" onClick={() => actions.setView('appointments')}>{state.appointments.length} appointments</Button><Button variant="secondary" onClick={() => actions.setView('documents')}>{state.documents.length} documents</Button><Button variant="secondary" onClick={() => actions.setView('timeline')}>{state.timeline.length} timeline events</Button></div></Card>
    </div>
    {formPatient && <Dialog title={patient.id === formPatient.id ? `Edit ${patient.name}` : 'Add patient'} onClose={close} wide><PatientForm patient={formPatient} set={set} /><div className="flex justify-end gap-2 mt-6"><Button variant="secondary" onClick={close}>Cancel</Button><Button disabled={!formPatient.name || !formPatient.dob || !formPatient.address} onClick={() => { const age = now().getFullYear() - Number(formPatient.dob.slice(0, 4)); actions.savePatient({ ...formPatient, age, initials: formPatient.name.split(' ').map(p => p[0]).join('').slice(0, 2), primaryDoctor: formPatient.doctors[0]?.name ?? formPatient.primaryDoctor }); setFormPatient(null); setDirty(false) }}>Save patient</Button></div></Dialog>}
  </div>
}

function Info({ title, lead, detail }: { title: string; lead: string; detail: string }) {
  return <Card className="p-5"><h3 className="font-semibold text-slate-800">{title}</h3><p className="text-sm font-medium text-slate-600 mt-3">{lead || 'Not recorded'}</p><p className="text-sm text-slate-500 mt-2 leading-relaxed">{detail || 'Not recorded'}</p></Card>
}

function consentDetail(name: string, status: Patient['parentChannel']['reminders']['status'], changedAt: string, via: string) {
  if (status === 'Not asked') return 'No consent message sent'
  const date = changedAt ? ` · ${new Date(changedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}` : ''
  if (status === 'Asked') return `Consent message sent by family${date} · No reply yet`
  if (status === 'Agreed') return `${name} agreed · ${via}${date}`
  if (status === 'Declined') return `${name} declined · ${via}${date}`
  return `${name} asked to stop · ${via}${date}`
}

function ParentConsentCard({ patient }: { patient: Patient }) {
  const { state, actions } = useApp()
  const gate = useGate()
  const channel = patient.parentChannel
  const canManage = state.activeCircleRole === 'coordinator'
  const [familyNote, setFamilyNote] = useState(channel.familyNote ?? '')
  useEffect(() => setFamilyNote(channel.familyNote ?? ''), [channel.familyNote, patient.id])
  const messages = parentConsentMessages(channel.language, patient.preferredName || patient.name, state.members.filter(member => member.status === 'Active').map(member => member.name), Boolean(channel.aiReading))
  return <Card className="p-5">
    <div className="flex items-start justify-between gap-3"><div><h3 className="font-semibold text-slate-800">Parent consent</h3><p className="text-xs text-slate-500 mt-1">WhatsApp · {channel.language} · quiet hours {channel.quietHours.start}–{channel.quietHours.end}</p></div><span className={`text-xs font-semibold rounded-full px-2 py-1 ${channel.paused ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700'}`}>{channel.paused ? 'Reminders off' : `${channel.preferredName} agreed`}</span></div>
    <div className="space-y-3 mt-4"><div className="rounded-xl bg-slate-50 p-3"><p className="text-xs font-semibold text-slate-700">Medicine reminders</p><p className="text-xs text-slate-500 mt-1">{consentDetail(channel.preferredName, channel.reminders.status, channel.reminders.changedAt, channel.reminders.via)}</p></div><div className="rounded-xl bg-slate-50 p-3"><p className="text-xs font-semibold text-slate-700">Share parent replies</p><p className="text-xs text-slate-500 mt-1">{consentDetail(channel.preferredName, channel.sharing.status, channel.sharing.changedAt, channel.sharing.via)}</p></div></div>
    <p className="text-sm font-semibold text-slate-700 mt-4">They decide. Nothing starts until they reply.</p>
    <div className="rounded-xl bg-slate-50 p-3 mt-4"><Field label="Optional family line in reminders" value={familyNote} disabled={!canManage} onChange={event => setFamilyNote(event.target.value)} placeholder="Vikram says hello" /><p className="text-xs text-slate-500 mt-2">Keep this short and pressure-free. It appears after the medicine reminder.</p><Button variant="secondary" className="mt-3" disabled={!canManage || familyNote.trim() === (channel.familyNote ?? '')} onClick={() => actions.savePatient({ ...patient, parentChannel: { ...channel, familyNote: familyNote.trim() || undefined } })}>Save family line</Button></div>
    <div className="rounded-xl bg-slate-50 p-3 mt-4"><label className="flex items-start justify-between gap-3 text-sm font-semibold text-slate-700">Let an assistant read replies in their own words<input type="checkbox" className="mt-1" checked={Boolean(channel.aiReading)} disabled={!canManage} onChange={event => actions.savePatient({ ...patient, parentChannel: { ...channel, aiReading: event.target.checked, aiDisclosed: event.target.checked ? channel.aiDisclosed : false } })} /></label><p className="text-xs text-slate-500 mt-2">Only for replies the rules cannot read. It suggests what a reply may mean; it never confirms, misses or changes a dose, and their exact words always stay visible. {channel.aiReading ? (channel.aiDisclosed ? 'They have been told.' : 'Send the consent message so they are told before an assistant reads anything.') : ''}</p></div>
    {channel.reminders.status !== 'Agreed' && <div className="rounded-xl bg-slate-50 p-3 mt-4"><p className="text-xs font-semibold text-slate-700">Exact WhatsApp message</p><p className="text-xs text-slate-500 mt-1">“{messages.reminders}”</p><Button variant="secondary" className="mt-3" disabled={!canManage} onClick={() => gate.requireAccount(() => actions.sendParentConsent(patient.id), 'send-consent')}>Send consent message</Button></div>}
    {channel.reminders.status === 'Agreed' && channel.sharing.status === 'Not asked' && <div className="rounded-xl bg-slate-50 p-3 mt-3"><p className="text-xs font-semibold text-slate-700">Exact WhatsApp message</p><p className="text-xs text-slate-500 mt-1">“{messages.sharing}”</p><Button variant="secondary" className="mt-3" disabled={!canManage} onClick={() => gate.requireAccount(() => actions.sendSharingConsent(patient.id), 'send-consent')}>Ask to share replies</Button></div>}
    {(state.isSample || import.meta.env.VITE_DEMO_CONTROLS === 'true') && <div className="flex flex-wrap gap-2 mt-4"><Button variant="secondary" disabled={!canManage || !channel.lastAskedQuestion} onClick={() => actions.simulateParentConsent(patient.id, 'agrees')}>Simulate: {channel.preferredName} agrees</Button><Button variant="secondary" disabled={!canManage || !channel.lastAskedQuestion} onClick={() => actions.simulateParentConsent(patient.id, 'declines')}>Simulate: {channel.preferredName} declines</Button><Button variant="secondary" disabled={!canManage} onClick={() => actions.simulateParentConsent(patient.id, 'stop')}>Simulate: {channel.preferredName} sends STOP</Button></div>}
  </Card>
}

function SharingSummary({ patient }: { patient: Patient }) {
  const { state } = useApp()
  const sharing = patient.parentChannel.sharing
  return <Card className="p-5"><h3 className="font-semibold text-slate-800">What’s shared</h3><p className="text-xs text-slate-500 mt-1">Parent replies follow {patient.parentChannel.preferredName}’s current sharing choice.</p><div className="divide-y divide-slate-100 mt-3">{state.members.map(member => {
    const memberId = member.userId ?? member.id
    const repliesShared = sharing.status === 'Agreed' && sharing.sharedWith.includes(memberId)
    return <div key={member.id} className="py-3"><div className="flex items-center justify-between gap-3"><p className="text-sm font-semibold text-slate-700">{member.name}</p><span className="text-xs capitalize text-slate-500">{member.role}</span></div><p className="text-xs text-slate-500 mt-1">{member.role === 'view-only' ? 'View shared logistics and permitted records.' : 'Coordinate logistics and update permitted records.'} {repliesShared ? `${patient.parentChannel.preferredName} agreed to share replies with this member.` : 'Parent replies are not shared with this member.'}</p></div>
  })}</div></Card>
}

function PatientForm({ patient, set }: { patient: Patient; set: <K extends keyof Patient>(key: K, value: Patient[K]) => void }) {
  const { state, now } = useApp()
  const doctor = patient.doctors[0] ?? { id: `doctor-${now().getTime()}`, name: '', specialty: '', clinic: '', contact: '' }
  const emergency = patient.emergencyContacts[0] ?? { id: `contact-${now().getTime()}`, name: '', relationship: '', phone: '' }
  return <div className="space-y-6">
    <FormSection title="Identity"><div className="grid sm:grid-cols-2 gap-4"><Field label="Full name" value={patient.name} onChange={e => set('name', e.target.value)} /><Field label="Preferred name" value={patient.preferredName} onChange={e => set('preferredName', e.target.value)} /><Field label="Date of birth" type="date" value={patient.dob} onChange={e => set('dob', e.target.value)} /><Field label="Relationship" value={patient.relationship} onChange={e => set('relationship', e.target.value)} /><Field label="Address" value={patient.address} onChange={e => set('address', e.target.value)} /><SelectField label="Primary caregiver" value={patient.primaryCaregiverId} onChange={e => set('primaryCaregiverId', e.target.value)}>{state.members.filter(member => member.status === 'Active').map(member => <option key={member.id} value={member.userId ?? member.id}>{member.name}</option>)}</SelectField></div></FormSection>
    <FormSection title="Medical"><div className="grid sm:grid-cols-2 gap-4"><Field label="Conditions (comma separated)" value={patient.conditions.join(', ')} onChange={e => set('conditions', e.target.value.split(',').map(v => v.trim()).filter(Boolean))} /><Field label="Blood group" value={patient.bloodType} onChange={e => set('bloodType', e.target.value)} /><TextAreaField label="Medical history" value={patient.medicalHistory} onChange={e => set('medicalHistory', e.target.value)} /><TextAreaField label="Allergies" value={patient.allergies} onChange={e => set('allergies', e.target.value)} /></div></FormSection>
    <FormSection title="Primary doctor"><div className="grid sm:grid-cols-2 gap-4"><Field label="Doctor name" value={doctor.name} onChange={e => set('doctors', [{ ...doctor, name: e.target.value }, ...patient.doctors.slice(1)])} /><Field label="Specialty" value={doctor.specialty} onChange={e => set('doctors', [{ ...doctor, specialty: e.target.value }, ...patient.doctors.slice(1)])} /><Field label="Clinic" value={doctor.clinic} onChange={e => set('doctors', [{ ...doctor, clinic: e.target.value }, ...patient.doctors.slice(1)])} /><Field label="Contact" value={doctor.contact} onChange={e => set('doctors', [{ ...doctor, contact: e.target.value }, ...patient.doctors.slice(1)])} /></div></FormSection>
    <FormSection title="Emergency"><div className="grid sm:grid-cols-2 gap-4"><Field label="Emergency contact" value={emergency.name} onChange={e => set('emergencyContacts', [{ ...emergency, name: e.target.value }, ...patient.emergencyContacts.slice(1)])} /><Field label="Relationship" value={emergency.relationship} onChange={e => set('emergencyContacts', [{ ...emergency, relationship: e.target.value }, ...patient.emergencyContacts.slice(1)])} /><Field label="Phone" value={emergency.phone} onChange={e => set('emergencyContacts', [{ ...emergency, phone: e.target.value }, ...patient.emergencyContacts.slice(1)])} /><Field label="Preferred hospital" value={patient.preferredHospital} onChange={e => set('preferredHospital', e.target.value)} /><div className="sm:col-span-2"><TextAreaField label="Emergency instructions" value={patient.emergencyInstructions} onChange={e => set('emergencyInstructions', e.target.value)} /></div></div></FormSection>
    <FormSection title="Daily care"><div className="grid sm:grid-cols-2 gap-4"><TextAreaField label="Diet" value={patient.diet} onChange={e => set('diet', e.target.value)} /><TextAreaField label="Mobility & accessibility" value={patient.mobility} onChange={e => set('mobility', e.target.value)} /><TextAreaField label="Communication" value={patient.communication} onChange={e => set('communication', e.target.value)} /><TextAreaField label="Routine" value={patient.routine} onChange={e => set('routine', e.target.value)} /></div></FormSection>
    <FormSection title="Parent communication"><div className="grid sm:grid-cols-2 gap-4"><Field label="WhatsApp number" value={patient.parentChannel.whatsappNumber} onChange={e => set('parentChannel', { ...patient.parentChannel, whatsappNumber: e.target.value })} /><SelectField label="Language" value={patient.parentChannel.language} onChange={e => set('parentChannel', { ...patient.parentChannel, language: e.target.value as Patient['parentChannel']['language'] })}><option>English</option><option>Hindi</option></SelectField><Field label="Preferred name" value={patient.parentChannel.preferredName} onChange={e => set('parentChannel', { ...patient.parentChannel, preferredName: e.target.value })} /><div className="grid grid-cols-2 gap-2"><Field label="Quiet from" type="time" value={patient.parentChannel.quietHours.start} onChange={e => set('parentChannel', { ...patient.parentChannel, quietHours: { ...patient.parentChannel.quietHours, start: e.target.value } })} /><Field label="Quiet until" type="time" value={patient.parentChannel.quietHours.end} onChange={e => set('parentChannel', { ...patient.parentChannel, quietHours: { ...patient.parentChannel.quietHours, end: e.target.value } })} /></div></div></FormSection>
  </div>
}

function FormSection({ title, children }: { title: string; children: React.ReactNode }) {
  return <section><h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">{title}</h3>{children}</section>
}

export function Tasks() {
  const { state, actions, now } = useApp()
  const [search, setSearch] = useState('')
  const [coordination, setCoordination] = useState('All')
  const [assignee, setAssignee] = useState('All')
  const [editing, setEditing] = useState<CareTask | null>(null)
  const canCreate = state.activeCircleRole === 'coordinator'
  const taskState = (task: CareTask) => task.status === 'Completed' ? 'Completed' : !task.assigneeId ? 'Open' : task.response === 'Waiting' ? 'Waiting for a reply' : 'Accepted'
  const tasks = state.tasks.filter(task => task.patientId === state.activePatientId && (coordination === 'All' || taskState(task) === coordination) && (assignee === 'All' || (assignee === 'Open' ? !task.assigneeId : task.assigneeId === assignee)) && task.title.toLowerCase().includes(search.toLowerCase()))
  const blank = (): CareTask => { const createdAt = now(); const due = new Date(createdAt.getTime() + 24 * 60 * 60 * 1000); due.setHours(12, 0, 0, 0); return { id: `task-${createdAt.getTime()}`, title: '', patientId: state.activePatientId, assigneeId: '', due: new Date(due.getTime() - due.getTimezoneOffset() * 60000).toISOString().slice(0, 16), priority: 'Medium', status: 'To do', response: 'Waiting', description: '', comments: [], history: [] } }
  return <div className="space-y-6"><PageHeader title="Tasks" subtitle="Assignments, responses and completion history" action={<Button disabled={!canCreate} onClick={() => setEditing(blank())}><PlusIcon className="w-4 h-4 inline mr-2" />Create task</Button>} /><PermissionNotice /><Card className="p-4 grid lg:grid-cols-3 gap-3"><Field label="Search" value={search} onChange={e => setSearch(e.target.value)} /><SelectField label="Coordination" value={coordination} onChange={e => setCoordination(e.target.value)}><option>All</option><option>Waiting for a reply</option><option>Accepted</option><option>Open</option><option>Completed</option></SelectField><SelectField label="Assignee" value={assignee} onChange={e => setAssignee(e.target.value)}><option>All</option><option>Open</option>{state.members.filter(m => m.status === 'Active').map(m => <option key={m.id} value={m.userId ?? m.id}>{m.name}</option>)}</SelectField></Card>
    {tasks.length ? <div className="grid lg:grid-cols-2 gap-3">{tasks.map(task => <TaskCard key={task.id} task={task} onEdit={() => setEditing(task)} />)}</div> : <EmptyState title="No matching tasks" detail="Change filters or create a task." />}
    {editing && <TaskEditor task={editing} onClose={() => setEditing(null)} onSave={task => { actions.saveTask(task); setEditing(null) }} members={state.members} />}
  </div>
}

function TaskCard({ task, onEdit }: { task: CareTask; onEdit: () => void }) {
  const { state, actions } = useApp()
  const [declining, setDeclining] = useState(false)
  const [reason, setReason] = useState('')
  const assignee = state.members.find(member => (member.userId ?? member.id) === task.assigneeId)
  const isAssignee = task.assigneeId === state.currentUser?.id
  const isOpen = !task.assigneeId
  const declinedEvent = [...state.careEvents].reverse().find(event => event.taskId === task.id && event.kind === 'task_declined')
  return <Card className="p-5">
    <div className="flex items-start justify-between gap-3"><div><h3 className="font-semibold text-slate-800">{task.title}</h3><p className="text-sm text-slate-500 mt-1">{task.description}</p></div><span className="text-xs font-semibold rounded-full bg-slate-100 text-slate-600 px-2 py-1">{task.status}</span></div>
    <div className="grid grid-cols-2 gap-3 mt-4 text-xs"><div><p className="text-slate-400">Assignee</p><p className="font-semibold text-slate-700 mt-1">{isOpen ? 'Open' : assignee?.name ?? 'Circle member'}</p></div><div><p className="text-slate-400">Due</p><p className="font-semibold text-slate-700 mt-1">{new Date(task.due).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</p></div></div>
    <div className="rounded-xl bg-slate-50 p-3 mt-4 text-sm text-slate-600">{task.status === 'Completed' ? `${assignee?.name ?? 'A circle member'} completed this task.` : isOpen ? (declinedEvent?.text ?? 'Open to anyone in the circle.') : task.response === 'Accepted' ? `${assignee?.name ?? 'A circle member'} accepted.` : `Waiting for ${assignee?.name ?? 'the assignee'} to reply.`}</div>
    <div className="flex flex-wrap gap-2 mt-4">
      {isOpen && state.activeCircleRole !== 'view-only' && task.status !== 'Completed' && <Button onClick={() => actions.takeTask(task.id)}>I'll take this</Button>}
      {isAssignee && task.response === 'Waiting' && task.status !== 'Completed' && <><Button onClick={() => actions.respondToTask(task.id, 'Accepted')}>Accept</Button><Button variant="secondary" onClick={() => setDeclining(true)}>Can't do this</Button></>}
      {isAssignee && task.response === 'Accepted' && task.status !== 'Completed' && <Button onClick={() => actions.completeTask(task.id)}>Mark completed</Button>}
      {state.activeCircleRole === 'coordinator' && <Button variant="secondary" onClick={onEdit}>Edit task</Button>}
    </div>
    {declining && <div className="mt-3 rounded-xl border border-slate-200 p-3"><Field label="Optional reason" value={reason} onChange={event => setReason(event.target.value)} placeholder="One-line reason" /><div className="flex justify-end gap-2 mt-2"><Button variant="ghost" onClick={() => setDeclining(false)}>Cancel</Button><Button variant="secondary" onClick={() => { actions.respondToTask(task.id, 'Declined', reason); setDeclining(false) }}>Move back to Open</Button></div></div>}
  </Card>
}

function TaskEditor({ task, onClose, onSave, members }: { task: CareTask; onClose: () => void; onSave: (task: CareTask) => void; members: CircleMember[] }) {
  const { state, now } = useApp()
  const [form, setForm] = useState(JSON.parse(JSON.stringify(task)) as CareTask)
  const [comment, setComment] = useState('')
  const set = (key: keyof CareTask, value: string) => setForm(f => ({ ...f, [key]: value }))
  return <Dialog title="Task details" onClose={onClose} wide><div className="grid sm:grid-cols-2 gap-4"><Field label="Title" value={form.title} onChange={e => set('title', e.target.value)} /><SelectField label="Assignee" value={form.assigneeId} onChange={e => set('assigneeId', e.target.value)} disabled={state.activeCircleRole !== 'coordinator'}><option value="">Anyone in the circle</option>{members.filter(m => m.status === 'Active').map(m => <option key={m.id} value={m.userId ?? m.id}>{m.name}</option>)}</SelectField><Field label="Due" type="datetime-local" value={form.due} onChange={e => set('due', e.target.value)} /><SelectField label="Priority" value={form.priority} onChange={e => set('priority', e.target.value)}><option>Low</option><option>Medium</option><option>High</option></SelectField><SelectField label="Status" value={form.status} onChange={e => set('status', e.target.value)}><option>To do</option><option>In progress</option><option>Completed</option></SelectField><div className="sm:col-span-2"><TextAreaField label="Description" value={form.description} onChange={e => set('description', e.target.value)} /></div></div>
    <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mt-5">Comments</h3>{form.comments.map(c => <div key={c.id} className="bg-slate-50 rounded-xl p-3 mt-2 text-sm"><b>{c.author}</b><span className="text-xs text-slate-400 ml-2">{new Date(c.timestamp).toLocaleString('en-IN')}</span><p>{c.text}</p></div>)}<div className="flex gap-2 mt-3"><Field label="Add comment" value={comment} onChange={e => setComment(e.target.value)} /><Button variant="secondary" className="self-end" disabled={!comment} onClick={() => { const timestamp = now(); setForm(f => ({ ...f, comments: [...f.comments, { id: `comment-${timestamp.getTime()}`, author: state.currentUser?.name ?? state.accountProfile.name, text: comment, timestamp: timestamp.toISOString() }] })); setComment('') }}>Add</Button></div>
    <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mt-5">Completion history</h3>{form.history?.length ? form.history.map(h => <p key={h.id} className="text-sm text-slate-600 mt-2">{h.status} · {h.actor} · {new Date(h.timestamp).toLocaleString('en-IN')}</p>) : <p className="text-sm text-slate-400 mt-2">No status changes yet.</p>}<div className="flex justify-end gap-2 mt-6"><Button variant="secondary" onClick={onClose}>Cancel</Button><Button onClick={() => onSave(form)}>Save task</Button></div></Dialog>
}

function parseBloodPressure(value: string) {
  const match = value.match(/^\s*(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)\s*$/)
  return match ? { systolic: Number(match[1]), diastolic: Number(match[2]) } : null
}

function BloodPressureChart({ entries }: { entries: HealthEntry[] }) {
  const points = entries.flatMap(entry => {
    const value = parseBloodPressure(entry.value)
    return value ? [{ entry, ...value }] : []
  }).slice(0, 8).reverse()
  if (!points.length) return <p className="h-44 flex items-center justify-center text-sm text-slate-400">No blood-pressure values to plot.</p>
  const x = (index: number) => points.length === 1 ? 200 : 20 + index * (360 / (points.length - 1))
  const y = (value: number) => 130 - Math.max(0, Math.min(120, ((value - 40) / 140) * 120))
  const systolic = points.map((point, index) => `${x(index)},${y(point.systolic)}`).join(' ')
  const diastolic = points.map((point, index) => `${x(index)},${y(point.diastolic)}`).join(' ')
  return <div className="mt-4">
    <div className="flex gap-4 text-xs text-slate-500"><span><i className="inline-block w-3 h-0.5 bg-[#4A7FA5] mr-1 align-middle" />Systolic</span><span><i className="inline-block w-3 h-0.5 bg-[#7A68A8] mr-1 align-middle" />Diastolic</span></div>
    <svg className="w-full h-44 mt-2" viewBox="0 0 400 150" role="img" aria-label={`Blood pressure trend with ${points.length} readings`}>
      <path d="M20 130H380" stroke="#E2E8F0" />
      <polyline points={systolic} fill="none" stroke="#4A7FA5" strokeWidth="3" strokeLinejoin="round" />
      <polyline points={diastolic} fill="none" stroke="#7A68A8" strokeWidth="3" strokeLinejoin="round" />
      {points.map((point, index) => <g key={point.entry.id}><circle cx={x(index)} cy={y(point.systolic)} r="4" fill="#4A7FA5" /><circle cx={x(index)} cy={y(point.diastolic)} r="4" fill="#7A68A8" /><text x={x(index)} y="146" textAnchor="middle" fontSize="10" fill="#64748B">{point.entry.value}</text></g>)}
    </svg>
  </div>
}

export function HealthLog() {
  const { state, actions, now } = useApp()
  const [metric, setMetric] = useState<HealthEntry['type'] | 'All'>('All')
  const [open, setOpen] = useState(false)
  const [type, setType] = useState<HealthEntry['type']>('Blood pressure')
  const [value, setValue] = useState('')
  const [notes, setNotes] = useState('')
  const all = state.healthEntries.filter(e => e.patientId === state.activePatientId)
  const entries = all.filter(e => metric === 'All' || e.type === metric)
  const chart = entries.filter(e => e.type !== 'Blood pressure' && !Number.isNaN(Number(e.value))).slice(0, 8).reverse()
  const units: Record<HealthEntry['type'], string> = { 'Blood pressure': 'mmHg', Glucose: 'mg/dL', Weight: 'kg', Symptoms: '', Wellbeing: '' }
  const bloodPressureEntries = entries.filter(entry => entry.type === 'Blood pressure')
  const hasBloodPressureData = bloodPressureEntries.some(entry => parseBloodPressure(entry.value))
  const hasChartData = chart.length > 0 || hasBloodPressureData
  return <div className="space-y-6"><PageHeader title="Health Log" subtitle="Metric filters, accessible trends and complete history" action={<Button disabled={state.activeCircleRole === 'view-only'} onClick={() => setOpen(true)}>Add entry</Button>} /><PermissionNotice /><SelectField label="Metric" value={metric} onChange={e => setMetric(e.target.value as typeof metric)}><option>All</option><option>Blood pressure</option><option>Glucose</option><option>Weight</option><option>Symptoms</option><option>Wellbeing</option></SelectField><Card className="p-6"><h2 className="font-semibold">Trend: {metric}</h2><p className="text-xs text-slate-400 mt-1">{hasChartData ? 'Oldest to newest.' : 'No numeric data for this metric.'}</p>{metric === 'Blood pressure' ? <BloodPressureChart entries={bloodPressureEntries} /> : <>{chart.length > 0 && <div className="h-44 flex items-end gap-4 border-b border-slate-200 mt-4">{chart.map(e => <div key={e.id} className="flex-1 flex flex-col items-center gap-2"><span className="text-xs">{e.value}</span><div className="w-full bg-[#C5DCEE] rounded-t" style={{ height: `${Math.max(24, Math.min(130, Number(e.value)))}px` }} role="img" aria-label={`${e.type}: ${e.value} ${e.unit} on ${new Date(e.timestamp).toLocaleDateString()}`} /></div>)}</div>}{metric === 'All' && hasBloodPressureData && <BloodPressureChart entries={bloodPressureEntries} />}</>}</Card><Card className="overflow-hidden">{entries.map(e => <div key={e.id} className="grid grid-cols-4 p-4 border-b text-sm"><b>{e.type}</b><span>{e.value} {e.unit}</span><span>{new Date(e.timestamp).toLocaleString('en-IN')}</span><span>{e.notes || '—'}</span></div>)}</Card>{open && <Dialog title="Add health entry" onClose={() => setOpen(false)}><div className="space-y-4"><SelectField label="Metric" value={type} onChange={e => setType(e.target.value as HealthEntry['type'])}><option>Blood pressure</option><option>Glucose</option><option>Weight</option><option>Symptoms</option><option>Wellbeing</option></SelectField><Field label={`Value ${units[type]}`} value={value} onChange={e => setValue(e.target.value)} /><TextAreaField label="Notes" value={notes} onChange={e => setNotes(e.target.value)} /><Button disabled={!value} onClick={() => { const timestamp = now(); actions.addHealthEntry({ id: `health-${timestamp.getTime()}`, patientId: state.activePatientId, type, value, unit: units[type], timestamp: timestamp.toISOString(), notes }); setOpen(false) }}>Save entry</Button></div></Dialog>}</div>
}

export function CareCircle() {
  const { state, actions, now } = useApp()
  const gate = useGate()
  const [searchParams] = useSearchParams()
  const [editing, setEditing] = useState<CircleMember | null>(null)
  const canManage = state.activeCircleRole === 'coordinator'
  const load = sharedLoad(state, now())
  const newMember = (): CircleMember => ({ id: `member-${now().getTime()}`, name: '', email: '', relationship: '', role: 'caregiver', status: 'Invited', initials: '', color: '#7A68A8' })
  useEffect(() => {
    if (searchParams.get('action') === 'invite-member') setEditing(newMember())
  }, [searchParams])
  return <div className="space-y-6"><PageHeader title="Care Circle" subtitle="Membership, roles, invitations and audited activity" action={<Button disabled={!canManage} onClick={() => gate.requireAccount(() => setEditing(newMember()), 'invite-member')}>Invite member</Button>} /><PermissionNotice /><Card className="p-4 bg-blue-50/50"><ShieldCheckIcon className="w-5 h-5 inline mr-2 text-[#4A7FA5]" /><span className="text-sm">Coordinator manages membership. Caregivers update their own tasks. View-only members cannot mutate care data.</span></Card><div className="grid lg:grid-cols-3 gap-4">{state.members.map(member => <Card key={member.id} className="p-5"><h3 className="font-semibold">{member.name}</h3><p className="text-sm text-slate-500">{member.relationship} · {member.role} · {member.status}</p><p className="text-xs text-slate-400 mt-2">{member.caregiverType ? `${member.caregiverType} caregiver` : 'Not designated'} · {state.tasks.filter(t => t.assigneeId === (member.userId ?? member.id)).length} tasks</p><div className="flex flex-wrap gap-2 mt-4">{member.status === 'Active' ? <><Button variant="secondary" disabled={!canManage} onClick={() => setEditing({ ...member })}>Edit role</Button>{member.userId !== state.currentUser?.id && <Button variant="ghost" disabled={!canManage} onClick={() => actions.showConfirm({ title: `Remove ${member.name}?`, message: 'Their assigned tasks remain in history.', confirmLabel: 'Remove member', variant: 'danger', onConfirm: () => actions.removeMember(member.id) })}>Remove</Button>}</> : <><Button variant="secondary" disabled={!canManage} onClick={() => actions.updateInvitation(member.id, 'Invited')}>Resend</Button><Button variant="ghost" disabled={!canManage} onClick={() => actions.updateInvitation(member.id, 'Cancelled')}>Cancel</Button>{(member as any).inviteToken && <a className="text-xs font-semibold text-[#477E78] underline" target="_blank" rel="noreferrer" href={'https://wa.me/?text=' + encodeURIComponent(member.name + ', I added you to our family care circle on CareCircle. Join here: ' + window.location.origin + '/invite/' + (member as any).inviteToken)}>Share on WhatsApp</a>}<p className="text-xs text-slate-500">Waiting for the recipient to sign in and accept their invitation.</p></>}</div></Card>)}</div><Card className="p-5"><h2 className="font-semibold">Who has helped, last 30 days</h2><p className="text-sm text-slate-500 mt-1">This is not a ranking. It is a simple view of shared care actions.</p><div className="divide-y divide-slate-100 mt-3">{load.map(({ member, count }) => <div key={member.id} className="flex justify-between py-3 text-sm"><span>{member.name}</span><span className="font-semibold text-slate-700">{count} care {count === 1 ? 'action' : 'actions'}</span></div>)}</div></Card><Card className="p-5"><h2 className="font-semibold">Activity log</h2>{state.activity.map(item => <p key={item.id} className="text-sm text-slate-600 mt-3"><b>{item.actor}</b> {item.action} · {new Date(item.timestamp).toLocaleString('en-IN')}</p>)}</Card>{editing && <MemberDialog member={editing} onClose={() => setEditing(null)} onSave={member => { actions.saveMember(member); setEditing(null) }} />}</div>
}

function MemberDialog({ member, onClose, onSave }: { member: CircleMember; onClose: () => void; onSave: (member: CircleMember) => void }) {
  const [form, setForm] = useState(member)
  return <Dialog title={member.name ? 'Edit member' : 'Invite member'} onClose={onClose}><div className="space-y-4"><Field label="Name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /><Field label="Email" type="email" disabled={!!member.userId} value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /><Field label="Relationship" value={form.relationship} onChange={e => setForm({ ...form, relationship: e.target.value })} /><SelectField label="Role" value={form.role} onChange={e => setForm({ ...form, role: e.target.value as CircleMember['role'] })}>{member.userId && <option>coordinator</option>}<option>caregiver</option><option>view-only</option></SelectField><SelectField label="Caregiver designation" value={form.caregiverType ?? ''} onChange={e => setForm({ ...form, caregiverType: (e.target.value || undefined) as CircleMember['caregiverType'] })}><option value="">None</option><option>Primary</option><option>Backup</option></SelectField><p className="text-xs text-slate-400">{member.userId ? 'Account email is managed by the member.' : 'Creates a shareable invitation link. No email is sent. The recipient must sign in to accept.'}</p><Button disabled={!form.name || !form.email.includes('@')} onClick={() => onSave({ ...form, initials: form.name.split(' ').map(p => p[0]).join('').slice(0, 2) })}>Save membership</Button></div></Dialog>
}

export function Account() {
  const { state, actions } = useApp()
  const [name, setName] = useState(state.accountProfile.name)
  const [phone, setPhone] = useState(state.accountProfile.phone)
  return <div className="space-y-6"><PageHeader title="Account" subtitle="Supabase account profile" /><PermissionNotice /><Card className="p-6 max-w-2xl"><div className="grid sm:grid-cols-2 gap-4"><Field label="Display name" disabled={state.activeCircleRole === 'view-only'} value={name} onChange={e => setName(e.target.value)} /><Field label="Contact number" disabled={state.activeCircleRole === 'view-only'} value={phone} onChange={e => setPhone(e.target.value)} /></div><Button className="mt-5" disabled={state.activeCircleRole === 'view-only'} onClick={() => actions.saveAccountProfile({ name, phone })}>Save account</Button><Button variant="danger" className="mt-5 ml-2" onClick={actions.signOut}>Sign out</Button></Card></div>
}

export function Settings() {
  const { state, actions } = useApp()
  const [prefs, setPrefs] = useState(state.preferences)
  const [name, setName] = useState(state.circleName)
  const archived = state.patients.filter(p => p.archived)
  const coordinatorTargets = state.members.filter(m => m.status === 'Active' && m.id !== state.members.find(x => x.userId === state.currentUser?.id)?.id)
  const activeMembers = state.members.filter(member => member.status === 'Active')
  const memberId = state.currentUser?.id ?? ''
  const [away, setAway] = useState(state.preferences.awayUntil?.[memberId] ?? '')
  const [large, setLarge] = useState(() => { try { return localStorage.getItem('carecircle-large-text') === '1' } catch { return false } })
  useEffect(() => { try { localStorage.setItem('carecircle-large-text', large ? '1' : '0') } catch {} document.documentElement.classList.toggle('large-text', large) }, [large])
  return <div className="space-y-6">
    <PageHeader title="Settings" subtitle="Persisted reminders, circle ownership and recoverable profiles" />
    <PermissionNotice />
    <div className="grid lg:grid-cols-2 gap-4">
      <Card className="p-5">
        <h2 className="font-semibold">Reminder preferences</h2>
        {([['medicineReminders', 'Medicine reminders'], ['taskUpdates', 'Task updates'], ['quietHours', 'Quiet hours']] as const).map(([key, label]) => <label key={key} className="flex justify-between mt-4 text-sm">{label}<input type="checkbox" checked={prefs[key]} disabled={state.activeCircleRole === 'view-only'} onChange={event => setPrefs({ ...prefs, [key]: event.target.checked })} /></label>)}
        <div className="grid grid-cols-2 gap-3 mt-4"><Field label="Quiet start" type="time" disabled={state.activeCircleRole === 'view-only'} value={prefs.quietStart} onChange={event => setPrefs({ ...prefs, quietStart: event.target.value })} /><Field label="Quiet end" type="time" disabled={state.activeCircleRole === 'view-only'} value={prefs.quietEnd} onChange={event => setPrefs({ ...prefs, quietEnd: event.target.value })} /></div>
        <div className="grid sm:grid-cols-3 gap-3 mt-4"><Field label="Follow-up after (min)" type="number" min={1} disabled={state.activeCircleRole === 'view-only'} value={prefs.followUpAfter} onChange={event => setPrefs({ ...prefs, followUpAfter: Number(event.target.value) })} /><Field label="First-call after (min)" type="number" min={1} disabled={state.activeCircleRole === 'view-only'} value={prefs.firstCallAfter} onChange={event => setPrefs({ ...prefs, firstCallAfter: Number(event.target.value) })} /><Field label="Backup after (min)" type="number" min={1} disabled={state.activeCircleRole === 'view-only'} value={prefs.backupAfter} onChange={event => setPrefs({ ...prefs, backupAfter: Number(event.target.value) })} /></div>
        <div className="grid sm:grid-cols-2 gap-3 mt-4"><SelectField label="First-call member" disabled={state.activeCircleRole === 'view-only'} value={prefs.firstCallMemberId} onChange={event => setPrefs({ ...prefs, firstCallMemberId: event.target.value })}><option value="">Select member</option>{activeMembers.map(member => <option key={member.id} value={member.userId ?? member.id}>{member.name}</option>)}</SelectField><SelectField label="Backup member" disabled={state.activeCircleRole === 'view-only'} value={prefs.backupMemberId} onChange={event => setPrefs({ ...prefs, backupMemberId: event.target.value })}><option value="">Select member</option>{activeMembers.map(member => <option key={member.id} value={member.userId ?? member.id}>{member.name}</option>)}</SelectField></div>
        <Button className="mt-4" disabled={state.activeCircleRole === 'view-only'} onClick={() => actions.savePreferences(prefs)}>Save preferences</Button>
      </Card>
      <Card className="p-5">
        <h2 className="font-semibold">Weekly digest</h2>
        <label className="flex justify-between mt-4 text-sm">Send weekly digest<input type="checkbox" checked={prefs.weeklyDigestEnabled} disabled={state.activeCircleRole === 'view-only'} onChange={event => setPrefs({ ...prefs, weeklyDigestEnabled: event.target.checked })} /></label>
        <p className="text-xs text-slate-500 mt-2">Only members included in the parent’s reply-sharing consent receive it.</p>
        <div className="grid grid-cols-2 gap-3 mt-4"><SelectField label="Delivery day" value={prefs.weeklyDigestDay} disabled={state.activeCircleRole === 'view-only'} onChange={event => setPrefs({ ...prefs, weeklyDigestDay: Number(event.target.value) })}><option value={0}>Sunday</option><option value={1}>Monday</option><option value={2}>Tuesday</option><option value={3}>Wednesday</option><option value={4}>Thursday</option><option value={5}>Friday</option><option value={6}>Saturday</option></SelectField><Field label="Delivery time" type="time" value={prefs.weeklyDigestTime} disabled={state.activeCircleRole === 'view-only'} onChange={event => setPrefs({ ...prefs, weeklyDigestTime: event.target.value })} /></div>
        <Button className="mt-4" disabled={state.activeCircleRole === 'view-only'} onClick={() => actions.savePreferences(prefs)}>Save digest settings</Button>
      </Card>
      <Card className="p-5"><h2 className="font-semibold">Away and display</h2><div className="grid sm:grid-cols-2 gap-3 mt-4"><Field label="I am away until" type="date" disabled={!memberId} value={away} onChange={event => setAway(event.target.value)} /><div className="flex items-end gap-2"><Button disabled={!memberId || !away} onClick={() => actions.savePreferences({ ...prefs, awayUntil: { ...prefs.awayUntil, [memberId]: away } })}>Save</Button><Button variant="secondary" disabled={!memberId} onClick={() => { setAway(''); const next = { ...prefs.awayUntil }; delete next[memberId]; actions.savePreferences({ ...prefs, awayUntil: next }) }}>I am back</Button></div></div><label className="flex justify-between mt-4 text-sm">Larger text on this device<input type="checkbox" checked={large} onChange={event => setLarge(event.target.checked)} /></label><p className="text-xs text-slate-500 mt-2">While you are away, calls go to your backup. Larger text is saved on this device only.</p></Card><Card className="p-5"><h2 className="font-semibold">Circle management</h2><Field label="Circle name" disabled={state.activeCircleRole !== 'coordinator'} value={name} onChange={event => setName(event.target.value)} /><Button className="mt-4" disabled={state.activeCircleRole !== 'coordinator'} onClick={() => actions.renameCircle(name)}>Save circle name</Button><h3 className="text-sm font-semibold mt-6">Transfer ownership</h3>{coordinatorTargets.map(member => <Button key={member.id} variant="secondary" className="mt-2 mr-2" disabled={state.activeCircleRole !== 'coordinator'} onClick={() => actions.showConfirm({ title: `Transfer ownership to ${member.name}?`, message: 'Your role becomes caregiver and the member becomes coordinator.', confirmLabel: 'Transfer ownership', variant: 'danger', onConfirm: () => actions.transferOwnership(member.id) })}>{member.name}</Button>)}</Card>
      <Card className="p-5"><h2 className="font-semibold">Archived patients</h2>{archived.length ? archived.map(patient => <div key={patient.id} className="flex items-center justify-between mt-3"><span>{patient.name} · records retained</span><Button variant="secondary" disabled={state.activeCircleRole !== 'coordinator'} onClick={() => actions.restorePatient(patient.id)}>Restore</Button></div>) : <p className="text-sm text-slate-400 mt-3">No archived profiles.</p>}</Card>
      <Card className="p-5"><h2 className="font-semibold">Reload server data</h2><p className="text-sm text-slate-500 mt-2">Discard unsaved screen state and fetch committed records again. Server records are never deleted.</p><Button variant="danger" className="mt-4" disabled={state.activeCircleRole === 'view-only'} onClick={() => actions.showConfirm({ title: 'Reload committed data?', message: 'This does not delete or reset server records.', confirmLabel: 'Reload', variant: 'danger', onConfirm: actions.resetDemo })}>Reload from server</Button></Card>
    </div>
  </div>
}

export function Help() {
  const { actions } = useApp()
  const [gallery, setGallery] = useState(false)
  const states = [
    ['Empty', 'No matching records. Clear filters or add a record.'],
    ['Loading', 'Loading care information…'],
    ['Error', 'The sample could not load. Retry restores it.'],
    ['Permission', 'View-only members cannot change this record.'],
    ['Success', 'Changes saved and reflected in linked history.'],
    ['Expired invitation', 'This invitation expired. Request a replacement.'],
    ['Unsaved changes', 'Continue editing or discard changes.'],
  ]
  const helpCards = [
    { title: 'Getting started', detail: 'Choose a care circle and patient, review Today, then add or assign the next concrete care action.' },
    { title: 'Permissions', detail: 'Check the role beside the circle name. Coordinators manage access; caregivers update assigned care; view-only members cannot edit.' },
    { title: 'Privacy', detail: 'Use care data only with consent. Documents use private signed access, and invitation links should be shared only with the intended recipient.' },
  ]
  return <div className="space-y-6"><PageHeader title="Help & prototype review" subtitle="Account recovery, permissions, privacy, and UI state reference" action={<Button onClick={() => setGallery(true)}>Open states gallery</Button>} /><Card className="p-5"><h2 className="font-semibold">Review account flows</h2><div className="flex flex-wrap gap-3 mt-4"><Link className="text-sm font-semibold text-[#4A7FA5]" to="/forgot-password">Forgot password</Link><Link className="text-sm font-semibold text-[#4A7FA5]" to="/verify-email">Check email</Link><Link className="text-sm font-semibold text-[#4A7FA5]" to="/set-password">Set password</Link><Link className="text-sm font-semibold text-[#4A7FA5]" to="/password-success">Reset success</Link><Link className="text-sm font-semibold text-[#4A7FA5]" to="/invite/active">Active invitation</Link><Link className="text-sm font-semibold text-[#4A7FA5]" to="/invite/expired">Expired invitation</Link></div></Card><div className="grid lg:grid-cols-3 gap-4">{helpCards.map(card => <Card key={card.title} className="p-5"><h2 className="font-semibold">{card.title}</h2><p className="text-sm text-slate-500 mt-2">{card.detail}</p></Card>)}</div>{gallery && <Dialog title="Prototype states gallery" onClose={() => setGallery(false)} wide><div className="grid sm:grid-cols-2 gap-4">{states.map(([title, detail]) => <Card key={title} className="p-4"><h3 className="font-semibold">{title}</h3><p className="text-sm text-slate-500 mt-1">{detail}</p><Button variant="secondary" className="mt-3" onClick={() => actions.addToast(title === 'Error' ? 'warning' : 'info', `${title} state action completed`)}>{title === 'Error' ? 'Retry' : 'Review action'}</Button></Card>)}</div></Dialog>}</div>
}
