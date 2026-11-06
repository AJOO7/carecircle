import type { AppNotification, CareTask, HealthEntry } from './types'

export const INITIAL_TASKS: CareTask[] = [
  {
    id: 'task-1', title: 'Arrange transport for cardiology visit', patientId: 'meera',
    assigneeId: 'rohan', due: '2026-10-14T08:30:00', priority: 'High', status: 'In progress',
    response: 'Accepted', respondedAt: '2026-10-11T09:15:00',
    description: 'Book a cab with step-free access and confirm pickup by Tuesday evening.',
    comments: [{ id: 'c-1', author: 'Rohan Singh', text: 'Driver shortlist ready. I will confirm tonight.', timestamp: '2026-10-11T09:15:00' }],
  },
  {
    id: 'task-2', title: 'Refill Atorvastatin', patientId: 'pradeep',
    assigneeId: 'anaya', due: '2026-10-13T18:00:00', priority: 'High', status: 'To do',
    response: 'Waiting',
    description: 'Stock is below the seven-day threshold. Collect refill from the neighbourhood pharmacy.',
    comments: [],
  },
  {
    id: 'task-3', title: 'Upload orthopedic visit notes', patientId: 'pradeep',
    assigneeId: 'rohan', due: '2026-10-23T17:00:00', priority: 'Medium', status: 'To do',
    response: 'Waiting',
    description: 'Add the consultation summary and any exercise handout after the visit.',
    comments: [],
  },
]

export const INITIAL_HEALTH_ENTRIES: HealthEntry[] = [
  { id: 'health-1', patientId: 'meera', type: 'Blood pressure', value: '128/78', unit: 'mmHg', timestamp: '2026-10-11T08:10:00', notes: 'Before breakfast, seated.' },
  { id: 'health-2', patientId: 'meera', type: 'Glucose', value: '112', unit: 'mg/dL', timestamp: '2026-10-11T07:45:00', notes: 'Fasting reading.' },
  { id: 'health-3', patientId: 'meera', type: 'Glucose', value: '118', unit: 'mg/dL', timestamp: '2026-10-10T07:40:00', notes: '' },
  { id: 'health-4', patientId: 'pradeep', type: 'Weight', value: '71.4', unit: 'kg', timestamp: '2026-10-10T08:00:00', notes: 'Weekly check.' },
  { id: 'health-5', patientId: 'pradeep', type: 'Wellbeing', value: 'Good', unit: '', timestamp: '2026-10-11T09:00:00', notes: 'Slept well; mild knee stiffness.' },
]

export const INITIAL_NOTIFICATIONS: AppNotification[] = [
  { id: 'n-1', type: 'task', title: 'Transport task due soon', detail: 'Cardiology transport is due 14 October.', timestamp: '2026-10-11T09:30:00', read: false, target: 'tasks' },
  { id: 'n-2', type: 'medicine', title: 'Amlodipine needs confirmation', detail: 'Today at 8:00 PM for Lakshmi.', timestamp: '2026-10-11T08:00:00', read: false, target: 'medicines' },
  { id: 'n-3', type: 'appointment', title: 'Preparation checklist available', detail: 'Review notes for the cardiology follow-up.', timestamp: '2026-10-10T18:00:00', read: true, target: 'appointments' },
]
