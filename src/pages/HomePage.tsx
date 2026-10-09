import { useNavigate } from 'react-router-dom'
import { useAppStore } from '../store'
import AppHeader from '../components/AppHeader'
import { isChecklistComplete, isManager } from '../workflow'

function greeting() {
  const h = new Date().getHours()
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'
}

function Kpi({ icon, label, value, caption, tone }: { icon: React.ReactNode; label: string; value: string | number; caption: string; tone?: 'warn' }) {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-ink text-white flex items-center justify-center flex-shrink-0">{icon}</div>
        <span className="text-base font-medium text-slate-200">{label}</span>
      </div>
      <div className="mt-5 flex items-baseline gap-2.5 flex-wrap">
        <span className="text-4xl font-bold tracking-tight text-ink">{value}</span>
        <span className={`text-sm ${tone === 'warn' ? 'text-amber-600 font-medium' : 'text-slate-500'}`}>{caption}</span>
      </div>
    </div>
  )
}

const icon = (d: string) => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d={d} /></svg>
)

export default function HomePage() {
  const navigate = useNavigate()
  const { currentUser, currentProjectId, projects, tasks } = useAppStore()

  if (!currentUser) {
    navigate('/')
    return null
  }

  const activeProject = projects.find((p) => p.id === currentProjectId)
  const isAdmin = currentUser.role === 'admin'

  // Headline numbers for the tasks this person can see
  const scoped = isAdmin ? tasks : tasks.filter((t) => t.projectId === currentProjectId)
  const today = new Date().toISOString().slice(0, 10)
  const active = scoped.filter((t) => t.status !== 'completed')
  const awaiting = scoped.filter((t) => t.workflowRun?.status === 'awaiting-initiation')
  const allChecklists = scoped.flatMap((t) => t.checklists)
  const doneChecklists = allChecklists.filter(isChecklistComplete)
  const overdue = active.filter((t) => t.dueDate && t.dueDate < today)

  return (
    <div className="h-full overflow-y-auto">
      <AppHeader active="overview" />

      <main className="px-10 pb-10 pt-8 max-w-6xl mx-auto">
        <h1 className="text-4xl font-normal tracking-tight text-ink">Overview</h1>
        <p className="text-xl text-slate-400 mt-1.5">
          {greeting()}, {currentUser.name.split(' ')[0]} 👋
          {activeProject && !isAdmin && <span className="text-slate-500"> · {activeProject.name}</span>}
        </p>

        {/* KPI row */}
        <div className="grid gap-5 mt-8 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
          <Kpi icon={icon('M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2')}
            label="Active tasks" value={active.length} caption={`of ${scoped.length} total`} />
          <Kpi icon={icon('M12 9v4m0 4h.01M10.3 3.9L1.8 18a2 2 0 001.7 3h17a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z')}
            label={isManager(currentUser) ? 'Awaiting your action' : 'Awaiting PM'} value={awaiting.length}
            caption={awaiting.length > 0 ? 'ready for next stage' : 'all clear'} tone={awaiting.length > 0 ? 'warn' : undefined} />
          <Kpi icon={icon('M5 13l4 4L19 7')} label="Checklists done" value={`${doneChecklists.length}/${allChecklists.length}`}
            caption={allChecklists.length ? `${Math.round((doneChecklists.length / allChecklists.length) * 100)}% complete` : 'none yet'} />
          <Kpi icon={icon('M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z')} label="Overdue" value={overdue.length}
            caption={overdue.length > 0 ? 'past due date' : 'on schedule'} tone={overdue.length > 0 ? 'warn' : undefined} />
        </div>

        {/* Where to next */}
        <h2 className="text-xl font-bold text-ink mt-10 mb-4">Jump in</h2>
        <div className="grid gap-5 grid-cols-1 md:grid-cols-2">
          <button onClick={() => navigate('/tasks')}
            className="group text-left bg-slate-900 hover:bg-white border border-slate-800 hover:border-slate-600 hover:shadow-float rounded-3xl p-7 flex items-center gap-5 transition-all">
            <div className="w-14 h-14 rounded-full bg-ink text-white flex items-center justify-center flex-shrink-0">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.7} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" /></svg>
            </div>
            <div className="flex-1">
              <h3 className="text-xl font-bold text-ink">Tasks</h3>
              <p className="text-slate-400 text-sm mt-0.5">{currentUser.role === 'engineer' ? 'View tasks & complete checklists' : 'View & manage inspection tasks'}</p>
            </div>
            <span className="text-slate-500 group-hover:text-ink group-hover:translate-x-1 transition-all text-xl">→</span>
          </button>

          {isAdmin && (
            <button onClick={() => navigate('/admin')}
              className="group text-left bg-slate-900 hover:bg-white border border-slate-800 hover:border-slate-600 hover:shadow-float rounded-3xl p-7 flex items-center gap-5 transition-all">
              <div className="w-14 h-14 rounded-full bg-coral text-white flex items-center justify-center flex-shrink-0">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.7} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.7} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <div className="flex-1">
                <h3 className="text-xl font-bold text-ink">Admin</h3>
                <p className="text-slate-400 text-sm mt-0.5">Members, projects, BMS documents & workflows</p>
              </div>
              <span className="text-slate-500 group-hover:text-ink group-hover:translate-x-1 transition-all text-xl">→</span>
            </button>
          )}
        </div>
      </main>
    </div>
  )
}
