import type { TimesheetEntry } from './types'

// Dates are handled as local YYYY-MM-DD strings so weeks never shift with the time zone.
export const toISO = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
export const fromISO = (iso: string) => { const [y, m, d] = iso.split('-').map(Number); return new Date(y, m - 1, d) }
export const addDays = (iso: string, n: number) => { const d = fromISO(iso); d.setDate(d.getDate() + n); return toISO(d) }

/** The Monday of the week containing the given date */
export function weekStartOf(iso: string): string {
  const d = fromISO(iso)
  const dow = (d.getDay() + 6) % 7   // Monday = 0
  d.setDate(d.getDate() - dow)
  return toISO(d)
}

export const weekDays = (weekStart: string) => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))

const toMins = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + m }

/** Worked hours for an entry (end − start − break), never negative */
export function entryHours(e: Pick<TimesheetEntry, 'start' | 'end' | 'breakMins'>): number {
  if (!e.start || !e.end) return 0
  return Math.max(0, (toMins(e.end) - toMins(e.start) - (e.breakMins || 0)) / 60)
}

export function fmtHours(h: number): string {
  const mins = Math.round(h * 60)
  const hh = Math.floor(mins / 60), mm = mins % 60
  return mm === 0 ? `${hh}h` : hh === 0 ? `${mm}m` : `${hh}h ${mm}m`
}

export const dayLabel = (iso: string) => fromISO(iso).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'short' })
export const rangeLabel = (weekStart: string) => {
  const a = fromISO(weekStart), b = fromISO(addDays(weekStart, 6))
  const f = (d: Date) => d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
  return `${f(a)} – ${f(b)} ${b.getFullYear()}`
}
