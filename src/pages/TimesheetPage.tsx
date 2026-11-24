import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useAppStore } from '../store'
import AppHeader from '../components/AppHeader'
import { canAccessTimesheet, isCentral } from '../access'
import { addDays, fmtHours, fromISO, projectCodeOf, rangeLabel, sessionHours, sessionProblem, shiftMonth, toISO, weekDays, weekStartOf } from '../timesheet'
import type { TimesheetSession } from '../types'

// A weekly timesheet laid out as a table: one row per day, two halves per day, and in each half
// the IN time, OUT time and project code. Cells are filled in directly and save as you type.
const BLANK: TimesheetSession = { in: '', out: '', code: '' }

export default function TimesheetPage() {
  const { currentUser, projects, timesheetDays, timesheetSubmissions, setTimesheetSession, submitTimesheetWeek, reopenTimesheetWeek } = useAppStore()
  const today = toISO(new Date())
  const [weekStart, setWeekStart] = useState(weekStartOf(today))
  const [view, setView] = useState<'week' | 'month'>('week')
  const [monthStart, setMonthStart] = useState(() => today.slice(0, 8) + '01')

  if (!currentUser) return <Navigate to="/" replace />   // signed out

  if (!canAccessTimesheet(currentUser)) return <Navigate to="/home" replace />   // IT doesn't keep a timesheet

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
  const isThisWeek = weekStart === weekStartOf(today)
  // Only last week, this week and next week can be filled in (for when someone forgot); anything older or further ahead is view-only
  const thisWeek = weekStartOf(today)
  const canEditWeek = (w: string) => w >= addDays(thisWeek, -7) && w <= addDays(thisWeek, 7)
  const outside = !canEditWeek(weekStart)
  const submitted = !!submission
  const locked = submitted || outside

  const set = (date: string, index: 0 | 1, patch: Partial<TimesheetSession>) => setTimesheetSession(currentUser.id, date, index, patch)
  const clearDay = (date: string) => { set(date, 0, { ...BLANK }); set(date, 1, { ...BLANK }) }
  const copyFromAbove = (date: string) => {
    const above = sessionsOf(addDays(date, -1))
    set(date, 0, { ...above[0] }); set(date, 1, { ...above[1] })
  }

  // Fill this week with last week's table: every IN, OUT and project code, day for day
  const prevDays = weekDays(addDays(weekStart, -7))
  const prevHasData = prevDays.some((d) => sessionsOf(d).some((x) => x.in || x.out || x.code))
  const [copied, setCopied] = useState('')
  const copyPreviousWeek = () => {
    const thisHasData = days.some((d) => sessionsOf(d).some((x) => x.in || x.out || x.code))
    if (thisHasData && !window.confirm('This week already has entries. Replace them with last week\'s?')) return
    days.forEach((d, i) => {
      const src = sessionsOf(prevDays[i])
      set(d, 0, { ...src[0] }); set(d, 1, { ...src[1] })
    })
    setCopied(`Filled in from ${rangeLabel(addDays(weekStart, -7))}.`)
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

  // Month view: every filled-in day and each week's status, read-only. Click a day to open its week.
  const monthFirst = monthStart
  const monthLast = addDays(shiftMonth(monthStart, 1), -1)
  const gridStart = weekStartOf(monthFirst)
  const gridWeeks: string[] = []
  for (let w = gridStart; w <= monthLast; w = addDays(w, 7)) gridWeeks.push(w)
  const dayStats = (date: string) => {
    const ss = sessionsOf(date)
    const hours = ss.reduce((n, x) => n + sessionHours(x), 0)
    const codes = [...new Set(ss.filter((x) => sessionHours(x) > 0 && x.code.trim()).map((x) => x.code.trim().toUpperCase()))]
    return { hours, codes, filled: ss.some((x) => x.in || x.out || x.code) }
  }
  const monthDates = gridWeeks.flatMap((w) => weekDays(w)).filter((d) => d >= monthFirst && d <= monthLast)
  const monthHours = monthDates.reduce((n, d) => n + dayStats(d).hours, 0)
  const monthDaysWorked = monthDates.filter((d) => dayStats(d).hours > 0).length
  const monthWeeksSubmitted = gridWeeks.filter((w) => timesheetSubmissions.some((x) => x.userId === currentUser.id && x.weekStart === w)).length
  const monthView = (
    <>
      <div className="grid gap-4 mt-4 grid-cols-2 lg:grid-cols-4">
        {[['Hours this month', fmtHours(monthHours)], ['Days worked', String(monthDaysWorked)], ['Weeks submitted', `${monthWeeksSubmitted}/${gridWeeks.length}`], ['Mode', 'View only']].map(([k, v]) => (
          <div key={k} className="bg-slate-900 border border-slate-800 rounded-3xl px-5 py-4">
            <p className="text-sm text-slate-400">{k}</p>
            <p className="text-3xl font-bold tracking-tight mt-1 text-ink">{v}</p>
          </div>
        ))}
      </div>
      <div className="mt-6 border border-slate-800 rounded-3xl overflow-hidden overflow-x-auto bg-white">
        <div className="min-w-[820px]">
          <div className="grid grid-cols-[repeat(7,minmax(0,1fr))_120px] bg-slate-900 border-b border-slate-800">
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun', 'Week'].map((h) => <div key={h} className={`${th} text-center`}>{h}</div>)}
          </div>
          {gridWeeks.map((w) => {
            const sub = timesheetSubmissions.some((x) => x.userId === currentUser.id && x.weekStart === w)
            const wh = weekDays(w).reduce((n, d) => n + dayStats(d).hours, 0)
            return (
              <div key={w} className="grid grid-cols-[repeat(7,minmax(0,1fr))_120px] border-t border-slate-800">
                {weekDays(w).map((d) => {
                  const inMonth = d >= monthFirst && d <= monthLast
                  const st = dayStats(d)
                  return (
                    <button key={d} onClick={() => { setWeekStart(w); setCopied(''); setView('week') }} title="Open this week"
                      className={`text-left min-h-[92px] p-2 border-l first:border-l-0 border-slate-800 hover:bg-slate-900 transition-colors ${d === today ? 'bg-slate-900' : ''} ${inMonth ? '' : 'opacity-40'}`}>
                      <span className={`text-xs font-semibold ${d === today ? 'text-white bg-ink rounded-full px-1.5 py-0.5' : 'text-slate-400'}`}>{fromISO(d).getDate()}</span>
                      {st.filled && (
                        <div className="mt-1.5">
                          <p className="text-sm font-bold text-ink">{st.hours > 0 ? fmtHours(st.hours) : '—'}</p>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {st.codes.map((c) => <span key={c} className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-full bg-coral-tint text-coral-dark">{c}</span>)}
                          </div>
                        </div>
                      )}
                    </button>
                  )
                })}
                <div className="border-l-2 border-slate-800 p-2 bg-slate-900/50 flex flex-col justify-center text-center">
                  <p className="text-sm font-bold text-ink">{wh > 0 ? fmtHours(wh) : '—'}</p>
                  <span className={`mt-1 mx-auto text-[10px] font-bold px-2 py-0.5 rounded-full ${sub ? 'bg-green-100 text-green-700' : wh > 0 ? 'bg-amber-100 text-amber-700' : 'bg-slate-800 text-slate-500'}`}>{sub ? 'Submitted' : wh > 0 ? 'Draft' : 'Empty'}</span>
                </div>
              </div>
            )
          })}
        </div>
      </div>
      <p className="mt-3 text-xs text-slate-500">The month view is for looking back only. Click a day to open its week — it can be changed there only if it is last week, this week or next week.</p>
    </>
  )

  return (
    <div className="flex flex-col h-full bg-white overflow-hidden">
      <AppHeader active="timesheet" />

      <div className="flex-1 overflow-y-auto">
        <div className="px-4 lg:px-10 pt-1 pb-10 max-w-6xl mx-auto">
          <div className="flex items-end justify-between gap-4 flex-wrap">
            <div>
              <h1 className="text-2xl font-medium tracking-tight text-ink">My Timesheet</h1>
              <p className="text-sm text-slate-400 mt-0.5">Fill in your IN and OUT times and project code for each half of the day, {currentUser.name.split(' ')[0]}</p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex items-center gap-0.5 bg-slate-800 rounded-full p-0.5 mr-1">
                {(['week', 'month'] as const).map((v) => (
                  <button key={v} onClick={() => { setView(v); if (v === 'month') setMonthStart(weekStart.slice(0, 8) + '01') }}
                    className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${view === v ? 'bg-ink text-white' : 'text-slate-300 hover:text-ink hover:bg-white'}`}>{v === 'week' ? 'Week' : 'Month'}</button>
                ))}
              </div>
              {view === 'week' ? (
                <>
                  <button onClick={() => { setWeekStart(addDays(weekStart, -7)); setCopied('') }} className={iconBtn} title="Previous week">‹</button>
                  <div className="px-4 py-2 rounded-full bg-slate-800 text-sm font-medium text-slate-200 w-[200px] text-center whitespace-nowrap">{rangeLabel(weekStart)}</div>
                  <button onClick={() => { setWeekStart(addDays(weekStart, 7)); setCopied('') }} className={iconBtn} title="Next week">›</button>
                  <button onClick={() => setWeekStart(thisWeek)} tabIndex={isThisWeek ? -1 : 0} aria-hidden={isThisWeek} className={`w-[104px] py-2 rounded-full bg-slate-800 hover:bg-slate-700 text-sm font-medium text-slate-200 ${isThisWeek ? 'invisible' : ''}`}>This week</button>
                </>
              ) : (
                <>
                  <button onClick={() => setMonthStart(shiftMonth(monthStart, -1))} className={iconBtn} title="Previous month">‹</button>
                  <div className="px-4 py-2 rounded-full bg-slate-800 text-sm font-medium text-slate-200 w-[200px] text-center whitespace-nowrap">{fromISO(monthStart).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</div>
                  <button onClick={() => setMonthStart(shiftMonth(monthStart, 1))} className={iconBtn} title="Next month">›</button>
                  <button onClick={() => setMonthStart(today.slice(0, 8) + '01')} tabIndex={monthStart === today.slice(0, 8) + '01' ? -1 : 0} className={`w-[104px] py-2 rounded-full bg-slate-800 hover:bg-slate-700 text-sm font-medium text-slate-200 ${monthStart === today.slice(0, 8) + '01' ? 'invisible' : ''}`}>This month</button>
                </>
              )}
            </div>
          </div>

          <p className="mt-3 text-xs text-slate-500">You can fill in last week, this week and next week, in case you forgot to. Anything older, or further ahead, is view-only.</p>

          {view === 'month' ? monthView : (
          <>
          {outside && (
            <p className="mt-4 rounded-2xl bg-slate-900 border border-slate-800 px-4 py-3 text-sm text-slate-300">
              This week is {weekStart < thisWeek ? 'older than last week' : 'more than a week ahead'}, so it is view-only. You can fill in last week, this week and next week.
            </p>
          )}

          {/* Week summary */}
          <div className="grid gap-4 mt-6 grid-cols-2 lg:grid-cols-4">
            {[
              ['Hours this week', fmtHours(weekHours)],
              ['Days worked', String(daysWorked)],
              ['Project codes', String(byCode.size)],
              ['Status', submitted ? 'Submitted' : outside ? 'View only' : weekHours > 0 ? 'Draft' : 'Not started'],
            ].map(([k, v]) => (
              <div key={k} className="bg-slate-900 border border-slate-800 rounded-3xl px-5 py-4">
                <p className="text-sm text-slate-400">{k}</p>
                <p className={`text-3xl font-bold tracking-tight mt-1 ${k === 'Status' && submitted ? 'text-green-700' : 'text-ink'}`}>{v}</p>
              </div>
            ))}
          </div>

          {!locked && (
            <div className="mt-6 flex items-center gap-3 flex-wrap">
              <button onClick={copyPreviousWeek} disabled={!prevHasData}
                title={prevHasData ? 'Copy every time and project code from last week' : 'Nothing was entered last week'}
                className="px-4 py-2 rounded-full bg-ink hover:bg-ink-soft disabled:opacity-40 text-white text-sm font-semibold transition-colors">Same as previous week</button>
              <span className="text-xs text-slate-500">{copied || (prevHasData ? `Copies all times and codes from ${rangeLabel(addDays(weekStart, -7))}. You can still edit any cell.` : 'Nothing was entered last week to copy.')}</span>
            </div>
          )}

          {/* The timesheet */}
          <div className="mt-3 border border-slate-800 rounded-3xl overflow-hidden overflow-x-auto bg-white">
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
              {outside && !submitted ? (
                <p className="text-sm text-slate-500">This week can't be changed any more.</p>
              ) : submitted ? (
                <>
                  <p className="text-sm font-semibold text-green-700">Week submitted</p>
                  <p className="text-xs text-slate-500">Submitted on {new Date(submission!.submittedAt).toLocaleString()}.{outside ? '' : ' Reopen it if you need to make changes.'}</p>
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
            {outside ? null : submitted ? (
              <button onClick={() => reopenTimesheetWeek(currentUser.id, weekStart)} className="px-5 py-2.5 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-semibold transition-colors">Reopen week</button>
            ) : (
              <button onClick={() => submitTimesheetWeek(currentUser.id, weekStart)} disabled={weekHours === 0 || anyProblem}
                className="px-5 py-2.5 rounded-full bg-ink hover:bg-ink-soft disabled:opacity-40 text-white text-sm font-semibold transition-colors">Submit week</button>
            )}
          </div>
          </>
          )}
        </div>
      </div>
    </div>
  )
}
