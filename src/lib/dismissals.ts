const PREFIX = 'carecircle-dismissed:'
const FOURTEEN_DAYS = 14 * 24 * 60 * 60 * 1000

export function isDismissed(id: string, now = new Date()) {
  try {
    const value = localStorage.getItem(PREFIX + id)
    return Boolean(value && now.getTime() < Date.parse(value))
  } catch {
    return false
  }
}

export function dismissFor14Days(id: string, now = new Date()) {
  try {
    localStorage.setItem(PREFIX + id, new Date(now.getTime() + FOURTEEN_DAYS).toISOString())
  } catch {
    // Dismissal remains session-only when storage is unavailable.
  }
}
