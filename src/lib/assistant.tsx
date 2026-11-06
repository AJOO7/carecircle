// Assistant client helpers. They only PROPOSE: rules decide anything that affects a dose, and a person
// always reviews and decides. Every call goes through the server (the API key never reaches the browser),
// and every helper has a plain fallback, so a failure never blocks the page.
import { api } from './supabase'
import type { ParentReplyCategory } from '../types'

export interface ReplyReading { category: ParentReplyCategory; summary: string; confidence: number; source: 'assistant' }
export interface ParsedMedicine { name: string; dose: string; scheduleTime: string; frequency: string; notes: string }
export interface VisitFacts {
  patient: string
  replies: number
  takenReplies: number
  noReplyDays: string[]
  quotedReplies: string[]
  familyConfirmed: number
  tasksCompleted: number
  refills: string[]
  medicineChanges: string[]
  appointments: string[]
}

const CATEGORIES: ParentReplyCategory[] = ['taken', 'not_taken', 'later', 'supply', 'felt_unwell', 'other']

export async function interpretReply(circleId: string, text: string, medicationName: string): Promise<ReplyReading | null> {
  try {
    const result = await api<Partial<ReplyReading>>(`/circles/${circleId}/interpret-reply`, { method: 'POST', body: JSON.stringify({ text, medicationName }) })
    if (!result.category || !CATEGORIES.includes(result.category) || typeof result.summary !== 'string') return null
    return { category: result.category, summary: result.summary.slice(0, 240), confidence: Math.min(1, Math.max(0, Number(result.confidence) || 0)), source: 'assistant' }
  } catch {
    return null
  }
}

function plural(count: number, word: string) {
  return `${count} ${word}${count === 1 ? '' : 's'}`
}

// Plain wording built only from counts and the parent's own quoted words.
export function templateSummary(facts: VisitFacts) {
  const lines = [facts.replies
    ? `${facts.patient} replied ${plural(facts.replies, 'time')} this week; ${facts.takenReplies} recorded as "taken".`
    : 'No replies recorded this week.']
  if (facts.noReplyDays.length) lines.push(`No replies recorded on ${facts.noReplyDays.join(', ')}.`)
  if (facts.quotedReplies.length) lines.push(`In ${facts.patient}'s own words: ${facts.quotedReplies.map(reply => `"${reply}"`).join('; ')}.`)
  if (facts.familyConfirmed) lines.push(`Family confirmed ${plural(facts.familyConfirmed, 'dose')}.`)
  if (facts.tasksCompleted) lines.push(`${plural(facts.tasksCompleted, 'care task')} completed.`)
  if (facts.refills.length) lines.push(`Refills: ${facts.refills.join(' ')}`)
  if (facts.medicineChanges.length) lines.push(`Medicine changes: ${facts.medicineChanges.join(' ')}`)
  if (facts.appointments.length) lines.push(`Coming up: ${facts.appointments.join('; ')}.`)
  lines.push(`This summary is based on replies recorded in Care Circle. It does not tell you how ${facts.patient} is.`)
  return lines.join('\n')
}

export async function summarizeForVisit(circleId: string, facts: VisitFacts): Promise<{ text: string; source: 'assistant' | 'template' }> {
  try {
    const result = await api<{ text?: string }>(`/circles/${circleId}/summarize-week`, { method: 'POST', body: JSON.stringify({ facts }) })
    if (typeof result.text === 'string' && result.text.trim()) return { text: result.text.trim(), source: 'assistant' }
  } catch {
    // fall back to the plain template below
  }
  return { text: templateSummary(facts), source: 'template' }
}

const TIMES: Record<string, string> = { morning: '08:00', afternoon: '14:00', evening: '18:00', night: '21:00', bedtime: '21:00' }
const FREQUENCIES = ['Once daily', 'Twice daily', 'Three times daily']

// Simple pattern matching used when the assistant is unavailable and on the Sample day.
export function parsePrescriptionLocally(text: string): ParsedMedicine[] {
  const rows: ParsedMedicine[] = []
  for (const line of text.split(/\n|;/)) {
    const clean = line.trim()
    const name = clean.match(/^[A-Za-z][A-Za-z-]*/)?.[0]
    if (!name) continue
    const dose = clean.match(/\d+(?:\.\d+)?\s?(?:mg|mcg|g|ml|iu)\b/i)?.[0] ?? ''
    const slots = Object.keys(TIMES).filter(word => new RegExp(`\\b${word}\\b`, 'i').test(clean))
    const times = slots.length ? slots.map(slot => TIMES[slot]) : ['08:00']
    const frequency = FREQUENCIES[Math.min(times.length, FREQUENCIES.length) - 1]
    for (const scheduleTime of times) rows.push({ name, dose, scheduleTime, frequency, notes: clean })
  }
  return rows
}

export async function parsePrescription(circleId: string, text: string): Promise<ParsedMedicine[]> {
  try {
    const result = await api<{ medicines?: Partial<ParsedMedicine>[] }>(`/circles/${circleId}/parse-prescription`, { method: 'POST', body: JSON.stringify({ text }) })
    const rows = (result.medicines ?? [])
      .filter(item => typeof item.name === 'string' && item.name.trim())
      .map(item => ({ name: String(item.name).trim(), dose: String(item.dose ?? '').trim(), scheduleTime: /^\d{2}:\d{2}$/.test(String(item.scheduleTime)) ? String(item.scheduleTime) : '08:00', frequency: String(item.frequency ?? 'Once daily').trim() || 'Once daily', notes: String(item.notes ?? '').trim() }))
    if (rows.length) return rows
  } catch {
    // fall back to pattern matching below
  }
  return parsePrescriptionLocally(text)
}
