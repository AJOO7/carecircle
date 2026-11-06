import type { CircleData, MedicationAlert, Patient } from '../types'

function localDate(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function atTime(date: Date, hours: number, minutes = 0) {
  const value = new Date(date)
  value.setHours(hours, minutes, 0, 0)
  return value
}

function minutesBefore(date: Date, minutes: number) {
  return new Date(date.getTime() - minutes * 60 * 1000)
}

export function buildSampleCircle(now: Date): CircleData {
  const today = localDate(now)
  const yesterdayDate = new Date(now)
  yesterdayDate.setDate(now.getDate() - 1)
  const yesterday = localDate(yesterdayDate)
  const patientId = 'sample-patient-lakshmi'
  const members = [
    { id: 'sample-anita', userId: 'sample-anita', name: 'Anita Iyer', email: 'anita@example.com', relationship: 'Daughter', role: 'coordinator' as const, status: 'Active' as const, caregiverType: 'Primary' as const, initials: 'AI', color: '#477E78' },
    { id: 'sample-vikram', userId: 'sample-vikram', name: 'Vikram Iyer', email: 'vikram@example.com', relationship: 'Son', role: 'caregiver' as const, status: 'Active' as const, caregiverType: 'Backup' as const, initials: 'VI', color: '#7A68A8' },
    { id: 'sample-priya', userId: 'sample-priya', name: 'Priya Nair', email: 'priya@example.com', relationship: 'Niece', role: 'caregiver' as const, status: 'Active' as const, initials: 'PN', color: '#B77958' },
    { id: 'sample-ravi', userId: 'sample-ravi', name: 'Ravi Iyer', email: 'ravi@example.com', relationship: 'Brother', role: 'view-only' as const, status: 'Active' as const, initials: 'RI', color: '#4A7FA5' },
  ]
  const patient: Patient = {
    id: patientId,
    name: 'Lakshmi Iyer',
    preferredName: 'Lakshmi',
    age: 72,
    dob: `${now.getFullYear() - 72}-04-18`,
    initials: 'LI',
    relationship: 'Mother',
    conditions: ['Type 2 Diabetes', 'Hypertension'],
    bloodType: 'B+',
    primaryDoctor: 'Dr. Kavita Rao',
    primaryCaregiverId: 'sample-anita',
    address: 'Mylapore, Chennai',
    accentColor: '#477E78',
    medicalHistory: 'Managing diabetes and blood pressure with regular reviews.',
    allergies: 'No known medicine allergies recorded.',
    doctors: [{ id: 'sample-doctor', name: 'Dr. Kavita Rao', specialty: 'Internal medicine', clinic: 'Mylapore Family Clinic', contact: '+91 44 5550 0180' }],
    emergencyContacts: [{ id: 'sample-emergency', name: 'Anita Iyer', relationship: 'Daughter', phone: '+91 90000 00001' }],
    preferredHospital: 'City General Hospital',
    emergencyInstructions: 'Call Anita first and use local emergency services when needed.',
    diet: 'Vegetarian; regular meal timing.',
    mobility: 'Walks independently; prefers support on stairs.',
    communication: 'Tamil and English.',
    routine: 'Morning walk, breakfast at 8:30, rest after lunch.',
    parentChannel: {
      whatsappNumber: '+91 90000 00000',
      language: 'English',
      preferredName: 'Lakshmi',
      quietHours: { start: '21:00', end: '07:00' },
      paused: false,
      reminders: { status: 'Agreed', changedAt: atTime(yesterdayDate, 18).toISOString(), via: 'WhatsApp reply' },
      sharing: { status: 'Agreed', changedAt: atTime(yesterdayDate, 18, 5).toISOString(), via: 'WhatsApp reply', sharedWith: members.map(member => member.id) },
    },
  }
  const medications = [
    { id: 'sample-metformin', patientId, name: 'Metformin', dose: '500 mg', frequency: 'Twice daily', prescribingDoctor: 'Dr. Kavita Rao', condition: 'Type 2 Diabetes', startDate: `${now.getFullYear() - 2}-05-10`, notes: 'Take with food as prescribed.', accentColor: '#C5DCEE', scheduleTime: '08:30', stock: 18, refillThreshold: 7, status: 'Active' as const, appearance: 'Small white round tablet in a blister strip', photos: [] },
    { id: 'sample-amlodipine', patientId, name: 'Amlodipine', dose: '5 mg', frequency: 'Once daily', prescribingDoctor: 'Dr. Kavita Rao', condition: 'Hypertension', startDate: `${now.getFullYear() - 1}-02-12`, notes: 'Morning schedule recorded by the family.', accentColor: '#E8D7B8', scheduleTime: '09:00', stock: 6, refillThreshold: 7, status: 'Active' as const, appearance: 'Pale yellow round tablet', photos: [] },
    { id: 'sample-atorvastatin', patientId, name: 'Atorvastatin', dose: '10 mg', frequency: 'Once daily', prescribingDoctor: 'Dr. Kavita Rao', condition: 'Cholesterol', startDate: `${now.getFullYear() - 1}-06-20`, notes: 'Evening schedule recorded by the family.', accentColor: '#D9D0E8', scheduleTime: '20:00', stock: 24, refillThreshold: 7, status: 'Active' as const, appearance: 'White oval tablet', photos: [] },
  ]
  const alert = (id: string, medicationId: string, medicationName: string, dose: string, scheduledTime: string, status: MedicationAlert['status'], scheduledDate = today): MedicationAlert => ({
    id, patientId, medicationId, medicationName, dose, scheduledTime, scheduledDate, status,
    source: scheduledDate === today ? 'Sample reminder schedule' : 'Schedule history',
    createdAt: atTime(scheduledDate === today ? now : yesterdayDate, Number(scheduledTime.slice(0, 2)), Number(scheduledTime.slice(3))).toISOString(),
  })
  // Only doses whose time has passed get a reminder, so nothing says 'Reminder sent' before it is due.
  const dueAt = (time: string) => atTime(now, Number(time.slice(0, 2)), Number(time.slice(3)))
  const sentAt = (time: string, fallbackMinutes: number) => dueAt(time) <= now ? dueAt(time) : minutesBefore(now, fallbackMinutes)
  const eveningDue = dueAt('20:00') <= now
  const alerts = [
    alert('sample-alert-metformin', 'sample-metformin', 'Metformin', '500 mg', '08:30', 'Confirmed'),
    { ...alert('sample-alert-amlodipine', 'sample-amlodipine', 'Amlodipine', '5 mg', '09:00', 'Assigned'), assignedTo: 'sample-vikram' },
    ...(eveningDue ? [alert('sample-alert-atorvastatin', 'sample-atorvastatin', 'Atorvastatin', '10 mg', '20:00', 'Unconfirmed')] : []),
    alert('sample-alert-earlier', 'sample-metformin', 'Metformin', '500 mg', '20:30', 'Not recorded', yesterday),
  ]
  const tasks = [
    { id: 'sample-task-refill', patientId, medicationId: 'sample-amlodipine', title: 'Refill Amlodipine', assigneeId: 'sample-vikram', due: atTime(now, 17).toISOString(), priority: 'High' as const, status: 'To do' as const, response: 'Accepted' as const, description: 'Six tablets left; collect the refill this week.', comments: [], history: [] },
    { id: 'sample-task-appointment', patientId, title: 'Confirm transport for clinic', assigneeId: '', due: atTime(now, 18).toISOString(), priority: 'Medium' as const, status: 'To do' as const, response: 'Waiting' as const, description: 'Arrange a ride for Friday’s appointment.', comments: [], history: [] },
  ]
  const careEvents = [
    { id: 'sample-event-reminder', at: atTime(now, 8, 30).toISOString(), kind: 'reminder_sent' as const, patientId, alertId: 'sample-alert-metformin', actorType: 'system' as const, actorId: 'care-circle', text: 'Reminder sent for Metformin 500 mg at 08:30.' },
    { id: 'sample-event-reply', at: atTime(now, 8, 42).toISOString(), kind: 'parent_replied' as const, patientId, alertId: 'sample-alert-metformin', actorType: 'parent' as const, actorId: `parent-${patientId}`, rawText: 'Le li, thank you', replyCategory: 'taken' as const, text: 'Lakshmi wrote: "Le li, thank you"' },
    { id: 'sample-event-task', at: atTime(now, 9, 5).toISOString(), kind: 'task_assigned' as const, patientId, taskId: 'sample-task-refill', actorType: 'member' as const, actorId: 'sample-anita', targetId: 'sample-vikram', text: 'Vikram was assigned Refill Amlodipine.' },
    ...(eveningDue ? [{ id: 'sample-event-reminder-atorvastatin', at: dueAt('20:00').toISOString(), kind: 'reminder_sent' as const, patientId, alertId: 'sample-alert-atorvastatin', actorType: 'system' as const, actorId: 'care-circle', text: 'Atorvastatin 10 mg.' }] : []),
    { id: 'sample-event-reminder-amlodipine', at: sentAt('09:00', 5).toISOString(), kind: 'reminder_sent' as const, patientId, alertId: 'sample-alert-amlodipine', actorType: 'system' as const, actorId: 'care-circle', text: 'Amlodipine 5 mg.' },
  ]
  const appointmentDate = new Date(now)
  appointmentDate.setDate(now.getDate() + 3)
  appointmentDate.setHours(10, 30, 0, 0)
  return {
    id: 'sample-circle',
    name: 'Iyer Family Circle',
    role: 'coordinator',
    patients: [patient],
    activePatientId: patientId,
    patientDataStore: {
      [patientId]: {
        alerts,
        medications,
        appointments: [{ id: 'sample-appointment', patientId, type: 'Diabetes review', doctor: 'Dr. Kavita Rao', specialty: 'Internal medicine', location: 'Mylapore Family Clinic', datetime: appointmentDate.toISOString(), status: 'Upcoming', notes: 'Bring glucose log and current medicine list.' }],
        documents: [],
        timeline: [],
      },
    },
    tasks,
    healthEntries: [],
    notifications: [],
    members,
    activity: [{ id: 'sample-activity', actor: 'Anita Iyer', action: 'updated today’s care plan', timestamp: atTime(now, 9, 5).toISOString() }],
    careEvents,
  }
}
