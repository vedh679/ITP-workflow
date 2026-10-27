import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppStore } from '../store'
import AppHeader from '../components/AppHeader'
import { canAccessTasks, isCentral } from '../access'
import { addDays, dayLabel, entryHours, fmtHours, rangeLabel, toISO, weekDays, weekStartOf } from '../timesheet'
import type { TimesheetEntry } from '../types'

// A personal timesheet: log work times by day, see the week's totals, then submit the week.
const input = 'w-full bg-white border border-slate-700 rounded-2xl px-3 py-2.5 text-sm text-ink placeholder-slate-500 focus:outline-none focus:border-ink'
const label = 'block text-xs font-semibold text-slate-400 mb-1'

function EntryModal({ initial, onSave, onClose }: { initial: TimesheetEntry; onSave: (e: TimesheetEntry) => void; onClose: () => void }) {
  const { currentUser, projects, tasks } = useAppStore()
  const myProjects = isCentral(currentUser) ? projects : projects.filter((p) => currentUser?.projectIds.includes(p.id))
  const [e, setE] = useState<TimesheetEntry>(initial)
  const projectTasks = canAccessTasks(currentUser) ? tasks.filter((t) => t.projectId === e.projectId) : []   // the BMS team can't see tasks
  const hours = entryHours(e)
  const error = !e.projectId ? 'Choose a project.' : !e.start || !e.end ? 'Enter a start and end time.'
    : hours <= 0 ? 'End time must be after the start time (and longer than the break).' : ''

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onMouseDown={(ev) => { if (ev.target === ev.currentTarget) onClose() }}>
      <div className="bg-white border border-slate-700 rounded-3xl shadow-float w-full max-w-lg">
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-800">
          <h2 className="text-lg font-bold text-ink">{initial.description || initial.start ? 'Edit time entry' : 'Log time'}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-ink text-xl leading-none">✕</button>
        </div>
        <div className="px-6 py-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div><label className={label}>Date</label><input type="date" className={input} value={e.date} onChange={(ev) => setE({ ...e, date: ev.target.value })} /></div>
            <div><label className={label}>Project</label>
              <select className={input} value={e.projectId} onChange={(ev) => setE({ ...e, projectId: ev.target.value, taskId: undefined })}>
                <option value="">Select…</option>
                {myProjects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select></div>
          </div>
          {canAccessTasks(currentUser) && (
          <div><label className={label}>Task (optional)</label>
            <select className={input} value={e.taskId ?? ''} disabled={!e.projectId} onChange={(ev) => setE({ ...e, taskId: ev.target.value || undefined })}>
              <option value="">General project work</option>
              {projectTasks.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select></div>
          )}
          <div className="grid grid-cols-3 gap-3">
            <div><label className={label}>Start</label><input type="time" className={input} value={e.start} onChange={(ev) => setE({ ...e, start: ev.target.value })} /></div>
            <div><label className={label}>End</label><input type="time" className={input} value={e.end} onChange={(ev) => setE({ ...e, end: ev.target.value })} /></div>
            <div><label className={label}>Break (min)</label><input type="number" min={0} step={5} className={input} value={e.breakMins}
              onChange={(ev) => setE({ ...e, breakMins: Math.max(0, Number(ev.target.value) || 0) })} /></div>
          </div>
          <div><label className={label}>What did you work on?</label>
            <textarea rows={2} className={`${input} resize-none`} value={e.description} placeholder="e.g. Level 3 slab inspection and sign-off"
              onChange={(ev) => setE({ ...e, description: ev.target.value })} /></div>
          <p className="text-sm text-slate-400">Total: <span className="font-semibold text-ink">{fmtHours(hours)}</span></p>
          {error && e.start && e.end && <p className="text-xs text-red-600">{error}</p>}
        </div>
        <div className="flex gap-3 px-6 py-5 border-t border-slate-800">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-semibold transition-colors">Cancel</button>
          <button onClick={() => onSave(e)} disabled={!!error}
            className="flex-1 py-2.5 rounded-full bg-ink hover:bg-ink-soft disabled:opacity-40 text-white text-sm font-semibold transition-colors">Save entry</button>
        </div>
      </div>
    </div>
  )
}

export default function TimesheetPage() {
  const navigate = useNavigate()
  const { currentUser, currentProjectId, projects, tasks, timesheetEntries, timesheetSubmissions,
    addTimesheetEntry, updateTimesheetEntry, deleteTimesheetEntry, submitTimesheetWeek, reopenTimesheetWeek } = useAppStore()
  const today = toISO(new Date())
  const [weekStart, setWeekStart] = useState(weekStartOf(today))
  const [editing, setEditing] = useState<TimesheetEntry | null>(null)

  if (!currentUser) { navigate('/'); return null }

  const days = weekDays(weekStart)
  const mine = timesheetEntries.filter((e) => e.userId === currentUser.id && e.date >= days[0] && e.date <= days[6])
  const byDay = (d: string) => mine.filter((e) => e.date === d).sort((a, b) => a.start.localeCompare(b.start))
  const dayHours = (d: string) => byDay(d).reduce((n, e) => n + entryHours(e), 0)
  const weekHours = days.reduce((n, d) => n + dayHours(d), 0)
  const daysWorked = days.filter((d) => dayHours(d) > 0).length
  const projectIds = [...new Set(mine.map((e) => e.projectId))]
  const submission = timesheetSubmissions.find((s) => s.userId === currentUser.id && s.weekStart === weekStart)
  const locked = !!submission
  const isThisWeek = weekStart === weekStartOf(today)

  const projectName = (id: string) => projects.find((p) => p.id === id)?.name ?? 'Unknown project'
  const taskName = (id?: string) => tasks.find((t) => t.id === id)?.name

  const blank = (date: string): TimesheetEntry => ({
    id: `ts-${Date.now()}`, userId: currentUser.id, date, projectId: currentProjectId ?? (currentUser.projectIds.length === 1 ? currentUser.projectIds[0] : ''),
    start: '08:00', end: '16:30', breakMins: 30, description: '',
  })
  const save = (e: TimesheetEntry) => {
    if (timesheetEntries.some((x) => x.id === e.id)) updateTimesheetEntry(e); else addTimesheetEntry(e)
    setEditing(null)
  }
  const remove = (e: TimesheetEntry) => { if (window.confirm('Delete this time entry?')) deleteTimesheetEntry(e.id) }

  const icon = 'w-9 h-9 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-ink flex items-center justify-center transition-colors'

  return (
    <div className="flex flex-col h-full bg-white overflow-hidden">
      <AppHeader active="timesheet" />

      <div className="flex-1 overflow-y-auto">
        <div className="px-6 lg:px-10 pt-6 pb-10 max-w-5xl mx-auto">
          <div className="flex items-end justify-between gap-4 flex-wrap">
            <div>
              <h1 className="text-4xl font-normal tracking-tight text-ink">My Timesheet</h1>
              <p className="text-slate-400 mt-1">Log your work times, {currentUser.name.split(' ')[0]}</p>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => setWeekStart(addDays(weekStart, -7))} className={icon} title="Previous week">‹</button>
              <div className="px-4 py-2 rounded-full bg-slate-800 text-sm font-medium text-slate-200 min-w-[190px] text-center">{rangeLabel(weekStart)}</div>
              <button onClick={() => setWeekStart(addDays(weekStart, 7))} className={icon} title="Next week">›</button>
              {!isThisWeek && <button onClick={() => setWeekStart(weekStartOf(today))} className="px-4 py-2 rounded-full bg-slate-800 hover:bg-slate-700 text-sm font-medium text-slate-200">This week</button>}
              <button onClick={() => setEditing(blank(isThisWeek ? today : days[0]))} disabled={locked}
                className="ml-2 px-5 py-2.5 rounded-full bg-ink hover:bg-ink-soft disabled:opacity-40 text-white text-sm font-semibold transition-colors">+ Log time</button>
            </div>
          </div>

          {/* Week summary */}
          <div className="grid gap-4 mt-6 grid-cols-2 lg:grid-cols-4">
            {[
              ['Hours this week', fmtHours(weekHours)],
              ['Days worked', String(daysWorked)],
              ['Projects', String(projectIds.length)],
              ['Status', locked ? 'Submitted' : weekHours > 0 ? 'Draft' : 'No time logged'],
            ].map(([k, v]) => (
              <div key={k} className="bg-slate-900 border border-slate-800 rounded-3xl px-5 py-4">
                <p className="text-sm text-slate-400">{k}</p>
                <p className={`text-3xl font-bold tracking-tight mt-1 ${k === 'Status' && locked ? 'text-green-700' : 'text-ink'}`}>{v}</p>
              </div>
            ))}
          </div>

          {/* Days */}
          <div className="mt-6 space-y-3">
            {days.map((d) => {
              const entries = byDay(d)
              const total = dayHours(d)
              const weekend = ['Saturday', 'Sunday'].includes(fromLong(d))
              return (
                <section key={d} className={`border rounded-3xl overflow-hidden ${d === today ? 'border-ink' : 'border-slate-800'} ${weekend && entries.length === 0 ? 'bg-white' : 'bg-slate-900'}`}>
                  <div className="flex items-center gap-3 px-5 py-3">
                    <h2 className="text-sm font-bold text-ink">{dayLabel(d)}</h2>
                    {d === today && <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-ink text-white">Today</span>}
                    <span className="ml-auto text-sm font-semibold text-ink">{total > 0 ? fmtHours(total) : <span className="text-slate-500 font-normal">—</span>}</span>
                    {!locked && (
                      <button onClick={() => setEditing(blank(d))} className="px-3 py-1 rounded-full bg-white hover:bg-slate-800 border border-slate-700 text-xs font-semibold text-slate-300">+ Add</button>
                    )}
                  </div>
                  {entries.map((e) => (
                    <div key={e.id} className="flex items-center gap-4 px-5 py-3 border-t border-slate-800 bg-white">
                      <div className="w-32 flex-shrink-0">
                        <p className="text-sm font-semibold text-ink">{e.start} – {e.end}</p>
                        <p className="text-xs text-slate-500">{e.breakMins ? `${e.breakMins} min break` : 'No break'}</p>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-ink truncate">{projectName(e.projectId)}{canAccessTasks(currentUser) && taskName(e.taskId) && <span className="text-slate-400"> · {taskName(e.taskId)}</span>}</p>
                        {e.description && <p className="text-xs text-slate-400 truncate">{e.description}</p>}
                      </div>
                      <span className="text-sm font-bold text-ink w-16 text-right">{fmtHours(entryHours(e))}</span>
                      {!locked && (
                        <div className="flex gap-1">
                          <button onClick={() => setEditing(e)} className="px-3 py-1 rounded-full bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200">Edit</button>
                          <button onClick={() => remove(e)} className="px-3 py-1 rounded-full bg-red-50 hover:bg-red-100 text-xs font-medium text-red-600">Delete</button>
                        </div>
                      )}
                    </div>
                  ))}
                </section>
              )
            })}
          </div>

          {/* Submit */}
          <div className="mt-6 flex items-center gap-4 flex-wrap bg-slate-900 border border-slate-800 rounded-3xl px-6 py-5">
            <div className="flex-1 min-w-[220px]">
              {locked ? (
                <>
                  <p className="text-sm font-semibold text-green-700">Week submitted</p>
                  <p className="text-xs text-slate-500">Submitted on {new Date(submission!.submittedAt).toLocaleString()}. Reopen it if you need to make changes.</p>
                </>
              ) : (
                <>
                  <p className="text-sm font-semibold text-ink">Total for the week: {fmtHours(weekHours)}</p>
                  <p className="text-xs text-slate-500">Submit when you've logged everything for {rangeLabel(weekStart)}.</p>
                </>
              )}
            </div>
            {locked ? (
              <button onClick={() => reopenTimesheetWeek(currentUser.id, weekStart)} className="px-5 py-2.5 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-semibold transition-colors">Reopen week</button>
            ) : (
              <button onClick={() => submitTimesheetWeek(currentUser.id, weekStart)} disabled={weekHours === 0}
                className="px-5 py-2.5 rounded-full bg-ink hover:bg-ink-soft disabled:opacity-40 text-white text-sm font-semibold transition-colors">Submit week</button>
            )}
          </div>
        </div>
      </div>

      {editing && <EntryModal initial={editing} onSave={save} onClose={() => setEditing(null)} />}
    </div>
  )
}

function fromLong(iso: string) {
  return new Date(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10))).toLocaleDateString('en-US', { weekday: 'long' })
}
