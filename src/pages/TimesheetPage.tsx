import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useAppStore } from '../store'
import AppHeader from '../components/AppHeader'
import { isCentral } from '../access'
import { addDays, fmtHours, fromISO, projectCodeOf, rangeLabel, sessionHours, sessionProblem, toISO, weekDays, weekStartOf } from '../timesheet'
import type { TimesheetSession } from '../types'

// A weekly timesheet laid out as a table: one row per day, two halves per day, and in each half
// the IN time, OUT time and project code. Cells are filled in directly and save as you type.
const BLANK: TimesheetSession = { in: '', out: '', code: '' }

export default function TimesheetPage() {
  const { currentUser, projects, timesheetDays, timesheetSubmissions, setTimesheetSession, submitTimesheetWeek, reopenTimesheetWeek } = useAppStore()
  const today = toISO(new Date())
  const [weekStart, setWeekStart] = useState(weekStartOf(today))

  if (!currentUser) return <Navigate to="/" replace />   // signed out

  // Projects this person can log time against, and the codes that go with them
  const myProjects = isCentral(currentUser) ? projects : projects.filter((p) => currentUser.projectIds.includes(p.id))
  const myCodes = myProjects.map(projectCodeOf)

  const days = weekDays(weekStart)
  const dayOf = (date: string) => timesheetDays.find((d) => d.userId === currentUser.id && d.date === date)
  const sessionsOf = (date: string): [TimesheetSession, TimesheetSession] => dayOf(date)?.sessions ?? [BLANK, BLANK]
  const dayHours = (date: string) => sessionsOf(date).reduce((n, s) => n + sessionHours(s), 0)
  const problemsOf = (date: string) => sessionsOf(date).map((s) => sessionProblem(s, myCodes))

  const weekHours = days.reduce((n, d) => n + dayHours(d), 0)
  const daysWorked = days.filter((d) => dayHours(d) > 0).length
  const anyProblem = days.some((d) => problemsOf(d).some(Boolean))

  // hours per project code this week
  const byCode = new Map<string, number>()
  for (const d of days) for (const s of sessionsOf(d)) {
    const h = sessionHours(s)
    const code = s.code.trim().toUpperCase()
    if (h > 0 && code) byCode.set(code, (byCode.get(code) ?? 0) + h)
  }

  const submission = timesheetSubmissions.find((s) => s.userId === currentUser.id && s.weekStart === weekStart)
  const locked = !!submission
  const isThisWeek = weekStart === weekStartOf(today)

  const set = (date: string, index: 0 | 1, patch: Partial<TimesheetSession>) => setTimesheetSession(currentUser.id, date, index, patch)
  const clearDay = (date: string) => { set(date, 0, { ...BLANK }); set(date, 1, { ...BLANK }) }
  const copyFromAbove = (date: string) => {
    const above = sessionsOf(addDays(date, -1))
    set(date, 0, { ...above[0] }); set(date, 1, { ...above[1] })
  }

  const cell = 'w-full bg-transparent px-2 py-2.5 text-sm text-ink text-center focus:outline-none focus:bg-white focus:ring-2 focus:ring-inset focus:ring-ink disabled:opacity-60 disabled:cursor-not-allowed'
  const iconBtn = 'w-9 h-9 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-ink flex items-center justify-center transition-colors'
  const th = 'px-2 py-2 text-[11px] font-bold uppercase tracking-wide text-slate-400 border-b border-slate-800'

  // the three cells of one half of a day: IN, OUT, project code
  const sessionCells = (date: string, index: 0 | 1, problem: string) => {
    const s = sessionsOf(date)[index]
    const flagTimes = ['Enter both IN and OUT', 'OUT must be after IN'].includes(problem)
    const bad = (field: 'in' | 'out' | 'code') => {
      if (!problem) return ''
      if (field === 'code') return ['Enter a project code', 'Unknown project code'].includes(problem) ? 'bg-red-50' : ''
      if (!flagTimes) return ''
      if (problem === 'OUT must be after IN') return 'bg-red-50'
      return (field === 'in' ? !s.in : !s.out) ? 'bg-red-50' : ''
    }
    return (
      <>
        <td className={`${index === 1 ? 'border-l-2' : 'border-l'} border-slate-800 p-0 ${bad('in')}`}>
          <input type="time" aria-label={`${date} half ${index + 1} IN`} className={cell} value={s.in} disabled={locked} onChange={(e) => set(date, index, { in: e.target.value })} />
        </td>
        <td className={`border-l border-slate-800 p-0 ${bad('out')}`}>
          <input type="time" aria-label={`${date} half ${index + 1} OUT`} className={cell} value={s.out} disabled={locked} onChange={(e) => set(date, index, { out: e.target.value })} />
        </td>
        <td className={`border-l border-slate-800 p-0 ${bad('code')}`}>
          <input type="text" list="project-codes" aria-label={`${date} half ${index + 1} project code`} className={`${cell} font-mono uppercase`} placeholder="Code"
            value={s.code} disabled={locked} onChange={(e) => set(date, index, { code: e.target.value.toUpperCase() })} />
        </td>
      </>
    )
  }

  return (
    <div className="flex flex-col h-full bg-white overflow-hidden">
      <AppHeader active="timesheet" />

      <div className="flex-1 overflow-y-auto">
        <div className="px-4 lg:px-10 pt-6 pb-10 max-w-6xl mx-auto">
          <div className="flex items-end justify-between gap-4 flex-wrap">
            <div>
              <h1 className="text-4xl font-normal tracking-tight text-ink">My Timesheet</h1>
              <p className="text-slate-400 mt-1">Fill in your IN and OUT times and project code for each half of the day, {currentUser.name.split(' ')[0]}</p>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => setWeekStart(addDays(weekStart, -7))} className={iconBtn} title="Previous week">‹</button>
              <div className="px-4 py-2 rounded-full bg-slate-800 text-sm font-medium text-slate-200 min-w-[190px] text-center">{rangeLabel(weekStart)}</div>
              <button onClick={() => setWeekStart(addDays(weekStart, 7))} className={iconBtn} title="Next week">›</button>
              {!isThisWeek && <button onClick={() => setWeekStart(weekStartOf(today))} className="px-4 py-2 rounded-full bg-slate-800 hover:bg-slate-700 text-sm font-medium text-slate-200">This week</button>}
            </div>
          </div>

          {/* Week summary */}
          <div className="grid gap-4 mt-6 grid-cols-2 lg:grid-cols-4">
            {[
              ['Hours this week', fmtHours(weekHours)],
              ['Days worked', String(daysWorked)],
              ['Project codes', String(byCode.size)],
              ['Status', locked ? 'Submitted' : weekHours > 0 ? 'Draft' : 'Not started'],
            ].map(([k, v]) => (
              <div key={k} className="bg-slate-900 border border-slate-800 rounded-3xl px-5 py-4">
                <p className="text-sm text-slate-400">{k}</p>
                <p className={`text-3xl font-bold tracking-tight mt-1 ${k === 'Status' && locked ? 'text-green-700' : 'text-ink'}`}>{v}</p>
              </div>
            ))}
          </div>

          {/* The timesheet */}
          <div className="mt-6 border border-slate-800 rounded-3xl overflow-hidden overflow-x-auto bg-white">
            <table className="w-full min-w-[820px] border-collapse">
              <thead className="bg-slate-900">
                <tr>
                  <th rowSpan={2} className={`${th} text-left pl-5 w-40`}>Day</th>
                  <th colSpan={3} className={`${th} border-l border-slate-800`}>First half</th>
                  <th colSpan={3} className={`${th} border-l-2 border-slate-800`}>Second half</th>
                  <th rowSpan={2} className={`${th} border-l-2 border-slate-800 w-28`}>Hours</th>
                  <th rowSpan={2} className={`${th} w-20`} />
                </tr>
                <tr>
                  {['IN', 'OUT', 'Project code', 'IN', 'OUT', 'Project code'].map((h, i) => (
                    <th key={i} className={`${th} ${i === 3 ? 'border-l-2' : 'border-l'} border-slate-800`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {days.map((d) => {
                  const weekend = [0, 6].includes(fromISO(d).getDay())
                  const problems = problemsOf(d)
                  const total = dayHours(d)
                  const hasData = sessionsOf(d).some((s) => s.in || s.out || s.code)
                  return (
                    <tr key={d} className={`border-t border-slate-800 ${d === today ? 'bg-slate-900' : weekend ? 'bg-slate-900/50' : ''}`}>
                      <td className="pl-5 pr-2 py-2.5 whitespace-nowrap">
                        <p className="text-sm font-semibold text-ink">{fromISO(d).toLocaleDateString(undefined, { weekday: 'short' })}</p>
                        <p className="text-xs text-slate-500">{fromISO(d).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}{d === today && <span className="ml-1.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-ink text-white">Today</span>}</p>
                      </td>
                      {sessionCells(d, 0, problems[0])}
                      {sessionCells(d, 1, problems[1])}
                      <td className="border-l-2 border-slate-800 px-2 text-center whitespace-nowrap">
                        {problems.some(Boolean)
                          ? <span className="text-xs font-semibold text-red-600" title={problems.filter(Boolean).join(' · ')}>⚠ {problems.find(Boolean)}</span>
                          : <span className={`text-sm font-bold ${total > 0 ? 'text-ink' : 'text-slate-500 font-normal'}`}>{total > 0 ? fmtHours(total) : '—'}</span>}
                      </td>
                      <td className="px-1 text-center whitespace-nowrap">
                        {!locked && (
                          <span className="inline-flex gap-0.5">
                            <button onClick={() => copyFromAbove(d)} title="Copy the day above" className="w-7 h-7 rounded-full text-slate-500 hover:text-ink hover:bg-slate-800 text-sm">↑</button>
                            {hasData && <button onClick={() => clearDay(d)} title="Clear this day" className="w-7 h-7 rounded-full text-slate-500 hover:text-red-600 hover:bg-red-50 text-sm">✕</button>}
                          </span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot className="bg-slate-900 border-t-2 border-slate-700">
                <tr>
                  <td colSpan={7} className="py-3 text-sm font-bold text-ink text-right pr-4">Total for the week</td>
                  <td className="border-l-2 border-slate-800 px-2 text-center text-sm font-bold text-ink">{fmtHours(weekHours)}</td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>

          <datalist id="project-codes">
            {myProjects.map((p) => <option key={p.id} value={projectCodeOf(p)}>{p.name}</option>)}
          </datalist>

          {/* Hours by project code */}
          <div className="mt-4 flex items-center gap-2 flex-wrap">
            <span className="text-xs font-semibold text-slate-500 mr-1">Project codes</span>
            {myProjects.map((p) => (
              <span key={p.id} className="text-xs px-3 py-1 rounded-full bg-slate-800 text-slate-300">
                <span className="font-mono font-bold text-ink">{projectCodeOf(p)}</span> {p.name}
                {byCode.get(projectCodeOf(p)) ? <span className="font-bold text-ink"> · {fmtHours(byCode.get(projectCodeOf(p))!)}</span> : null}
              </span>
            ))}
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
                  <p className={`text-xs ${anyProblem ? 'text-red-600' : 'text-slate-500'}`}>
                    {anyProblem ? 'Fix the highlighted cells before submitting.' : `Submit when you've filled in everything for ${rangeLabel(weekStart)}.`}
                  </p>
                </>
              )}
            </div>
            {locked ? (
              <button onClick={() => reopenTimesheetWeek(currentUser.id, weekStart)} className="px-5 py-2.5 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-semibold transition-colors">Reopen week</button>
            ) : (
              <button onClick={() => submitTimesheetWeek(currentUser.id, weekStart)} disabled={weekHours === 0 || anyProblem}
                className="px-5 py-2.5 rounded-full bg-ink hover:bg-ink-soft disabled:opacity-40 text-white text-sm font-semibold transition-colors">Submit week</button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
