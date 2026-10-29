import type { Project, TimesheetSession } from './types'

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

/** Hours worked in one session (OUT − IN); 0 until both times are filled and OUT is after IN */
export function sessionHours(s: Pick<TimesheetSession, 'in' | 'out'>): number {
  if (!s.in || !s.out) return 0
  return Math.max(0, (toMins(s.out) - toMins(s.in)) / 60)
}

/** What is wrong with a session, if anything */
export function sessionProblem(s: TimesheetSession, knownCodes: string[]): string {
  const any = s.in || s.out || s.code
  if (!any) return ''
  if (!s.in || !s.out) return 'Enter both IN and OUT'
  if (toMins(s.out) <= toMins(s.in)) return 'OUT must be after IN'
  if (!s.code.trim()) return 'Enter a project code'
  if (!knownCodes.includes(s.code.trim().toUpperCase())) return 'Unknown project code'
  return ''
}

/** The code shown for a project: its own code, or initials of its name */
export const projectCodeOf = (p: Pick<Project, 'name' | 'code'>) =>
  (p.code?.trim() || p.name.split(/\s+/).map((w) => w[0]).join('')).toUpperCase()

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
