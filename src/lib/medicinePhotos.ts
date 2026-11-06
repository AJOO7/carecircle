import type { MedicationPhoto } from '../types'

function sampleSvg(background: string, pill: string, shape: 'round' | 'oval' | 'strip') {
  const medicine = shape === 'round'
    ? `<circle cx="160" cy="105" r="48" fill="${pill}"/><path d="M125 105h70" stroke="#cbd5e1" stroke-width="3"/>`
    : shape === 'oval'
      ? `<rect x="93" y="64" width="134" height="82" rx="41" fill="${pill}" transform="rotate(-12 160 105)"/><path d="M121 119l78-28" stroke="#d6d3d1" stroke-width="3"/>`
      : `<rect x="62" y="38" width="196" height="134" rx="18" fill="#d7dce2"/><g fill="${pill}"><circle cx="105" cy="78" r="24"/><circle cx="170" cy="78" r="24"/><circle cx="235" cy="78" r="24"/><circle cx="105" cy="135" r="24"/><circle cx="170" cy="135" r="24"/><circle cx="235" cy="135" r="24"/></g>`
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 210"><defs><linearGradient id="b" x1="0" y1="0" x2="1" y2="1"><stop stop-color="${background}"/><stop offset="1" stop-color="#ffffff"/></linearGradient><filter id="s"><feDropShadow dx="0" dy="8" stdDeviation="8" flood-opacity=".18"/></filter></defs><rect width="320" height="210" fill="url(#b)"/><g filter="url(#s)">${medicine}</g></svg>`
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`
}

export const BUILT_IN_MEDICINE_PHOTOS = [
  { id: 'sample-white-round', label: 'White round tablet', appearance: 'small white round tablet', dataUrl: sampleSvg('#dbeafe', '#ffffff', 'round') },
  { id: 'sample-pink-oval', label: 'Pink oval tablet', appearance: 'small pale pink oval tablet', dataUrl: sampleSvg('#fce7f3', '#f9a8d4', 'oval') },
  { id: 'sample-blister-strip', label: 'Blister strip', appearance: 'silver blister strip with white round tablets', dataUrl: sampleSvg('#e2e8f0', '#ffffff', 'strip') },
] as const

export function builtInPhoto(sampleId: string, savedBy: string, savedAt: string): MedicationPhoto | undefined {
  const sample = BUILT_IN_MEDICINE_PHOTOS.find(item => item.id === sampleId)
  return sample ? { id: `${sample.id}-${crypto.randomUUID()}`, dataUrl: sample.dataUrl, savedBy, savedAt } : undefined
}
