import { useNavigate } from 'react-router-dom'
import { useAppStore } from '../store'
import Logo from './Logo'
import ProjectSwitcher from './ProjectSwitcher'
import { pendingDocs } from '../projectDocs'
import { canAccessTasks, isCentral, isIT } from '../access'

type Active = 'overview' | 'tasks' | 'documents' | 'organisation' | 'timesheet' | 'admin'

// Shared top bar: logo + project switcher (left), pill navigation (centre), user (right)
export default function AppHeader({ active }: { active: Active }) {
  const navigate = useNavigate()
  const currentUser = useAppStore((s) => s.currentUser)
  const { currentProjectId, projects, bmsDocuments, projectDocuments } = useAppStore()
  if (!currentUser) return null

  // Documents behind the latest BMS version: the manager's project, or every project for an admin
  const docsBehind = isCentral(currentUser)
    ? projects.reduce((n, p) => n + pendingDocs(p.id, bmsDocuments, projectDocuments).length, 0)
    : currentUser.role === 'manager' && currentProjectId ? pendingDocs(currentProjectId, bmsDocuments, projectDocuments).length : 0

  const signOut = () => {
    useAppStore.getState().setCurrentUser(null)
    useAppStore.getState().setCurrentProjectId(null)
    navigate('/')
  }

  const tabs: { key: Active; label: string; path: string; badge?: number }[] = [
    { key: 'overview', label: 'Overview', path: '/home' },
    ...(canAccessTasks(currentUser) ? [{ key: 'tasks' as const, label: 'Tasks', path: '/tasks' }] : []),
    { key: 'documents', label: 'Documents', path: '/documents', badge: docsBehind },
    { key: 'organisation', label: 'Organisation', path: '/organisation' },
    { key: 'timesheet', label: 'Timesheet', path: '/timesheet' },
    ...(isCentral(currentUser) ? [{ key: 'admin' as const, label: isIT(currentUser) ? 'IT' : 'BMS', path: '/admin' }] : []),
  ]
  // Project pages need a chosen project; the timesheet is personal and doesn't
  const go = (key: Active, path: string) => {
    if (key !== 'timesheet' && !isCentral(currentUser) && !currentProjectId && currentUser.projectIds.length > 1) navigate('/select-project')
    else navigate(path)
  }
  const pill = 'px-3 py-2 xl:px-4 xl:py-2.5 rounded-full text-sm font-medium transition-colors whitespace-nowrap'

  return (
    <header className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 xl:gap-4 px-4 lg:px-10 pt-8 pb-2 flex-shrink-0">
      <div className="flex items-center gap-3 justify-self-start">
        <Logo size={44} />
        <ProjectSwitcher variant="header" />
      </div>

      <nav className="flex items-center gap-1 bg-slate-800 rounded-full p-1">
        {tabs.map((t) => {
          const dot = t.badge ? <span className="ml-2 inline-flex min-w-[18px] h-[18px] px-1 items-center justify-center rounded-full bg-coral text-white text-[11px] font-bold">{t.badge}</span> : null
          return t.key === active
            ? <span key={t.key} className={`${pill} bg-ink text-white inline-flex items-center`}>{t.label}{dot}</span>
            : <button key={t.key} onClick={() => go(t.key, t.path)} className={`${pill} text-slate-300 hover:text-ink hover:bg-white inline-flex items-center`}>{t.label}{dot}</button>
        })}
      </nav>

      <div className="flex items-center gap-3 justify-self-end">
        <div className="text-right hidden xl:block whitespace-nowrap">
          <p className="text-sm font-semibold text-ink leading-tight">{currentUser.name}</p>
          <p className="text-xs text-slate-500">{currentUser.role}</p>
        </div>
        <div className="w-11 h-11 rounded-full bg-ink text-white flex items-center justify-center text-sm font-bold">
          {currentUser.name.charAt(0).toUpperCase()}
        </div>
        <button onClick={signOut} className="px-3 xl:px-4 py-2 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-medium transition-colors whitespace-nowrap">
          Sign out
        </button>
      </div>
    </header>
  )
}
