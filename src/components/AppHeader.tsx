import { useNavigate } from 'react-router-dom'
import { useAppStore } from '../store'
import Logo from './Logo'
import { useState } from 'react'
import { SignatureModal, SignaturePrompt } from './Signature'
import ProjectSwitcher from './ProjectSwitcher'
import { pendingDocs, projectDocsOf, reviewsDueIn } from '../projectDocs'
import { canAccessRegister, canAccessTasks, canAccessTimesheet, canViewOrganisation, isCentral, isProjectAdmin, can, roleIn } from '../access'

type Active = 'none' | 'overview' | 'tasks' | 'documents' | 'organisation' | 'timesheet' | 'admin' | 'team'

// Shared top bar: logo + project switcher (left), pill navigation (centre), user (right)
export default function AppHeader({ active }: { active: Active }) {
  const navigate = useNavigate()
  const currentUser = useAppStore((s) => s.currentUser)
  const [signing, setSigning] = useState(false)
  const { currentProjectId, bmsDocuments, projectDocuments, projects } = useAppStore()
  if (!currentUser) return null

  // Documents in this project needing attention, shown to the whole project team: a newer template to update to, or a 12-month review due
  const docsBehind = canAccessRegister(currentUser) && currentProjectId
    ? pendingDocs(currentProjectId, bmsDocuments, projectDocuments).length + reviewsDueIn(currentProjectId, projectDocuments, bmsDocuments).length
      + (can(currentUser, projects.find((p) => p.id === currentProjectId), 'register.approve') ? projectDocsOf(projectDocuments, currentProjectId).filter((d) => d.submission).length : 0) : 0

  const signOut = () => {
    useAppStore.getState().setCurrentUser(null)
    useAppStore.getState().setCurrentProjectId(null)
    navigate('/')
  }

  const tabs: { key: Active; label: string; path: string; badge?: number }[] = [
    { key: 'overview', label: 'Overview', path: '/home' },
    ...(canAccessTasks(currentUser) ? [{ key: 'tasks' as const, label: 'ITP', path: '/tasks' }] : []),
    ...(canAccessRegister(currentUser) ? [{ key: 'documents' as const, label: 'Document Register', path: '/documents', badge: docsBehind }] : []),
    ...(canViewOrganisation(currentUser) ? [{ key: 'organisation' as const, label: 'Organisation', path: '/organisation' }] : []),
    ...(canAccessTimesheet(currentUser) ? [{ key: 'timesheet' as const, label: 'Timesheet', path: '/timesheet' }] : []),
    ...(isProjectAdmin(currentUser, projects.find((p) => p.id === currentProjectId)) ? [{ key: 'team' as const, label: 'Admin', path: '/project-admin' }] : []),
    ...(isCentral(currentUser) ? [{ key: 'admin' as const, label: 'IT', path: '/admin' }] : []),
  ]
  // Project pages need a chosen project; the timesheet is personal and doesn't
  const go = (key: Active, path: string) => {
    if (key !== 'timesheet' && !isCentral(currentUser) && !currentProjectId && currentUser.projectIds.length > 1) navigate('/select-project')
    else navigate(path)
  }
  const pill = 'px-3 py-1.5 xl:px-4 rounded-full text-sm font-medium transition-colors whitespace-nowrap'

  return (
    <header className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 xl:gap-4 px-4 lg:px-10 py-3 flex-shrink-0">
      <div className="flex items-center gap-3 justify-self-start">
        <Logo size={32} />
        {active !== 'none' && <ProjectSwitcher variant="header" />}
      </div>

      {active === 'none' ? <div /> : (
      <nav className="flex items-center gap-1 bg-slate-800 rounded-full p-0.5">
        {tabs.map((t) => {
          const dot = t.badge ? <span className="ml-2 inline-flex min-w-[18px] h-[18px] px-1 items-center justify-center rounded-full bg-coral text-white text-[11px] font-bold">{t.badge}</span> : null
          return t.key === active
            ? <span key={t.key} className={`${pill} bg-ink text-white inline-flex items-center`}>{t.label}{dot}</span>
            : <button key={t.key} onClick={() => go(t.key, t.path)} className={`${pill} text-slate-300 hover:text-ink hover:bg-white inline-flex items-center`}>{t.label}{dot}</button>
        })}
      </nav>
      )}

      <div className="flex items-center gap-3 justify-self-end">
        <div className="text-right hidden xl:block whitespace-nowrap">
          <p className="text-sm font-semibold text-ink leading-tight">{currentUser.name}</p>
          <p className="text-xs text-slate-500">{roleIn(projects.find((p) => p.id === currentProjectId), currentUser)}</p>
        </div>
        <button onClick={() => currentUser.role !== 'it' && setSigning(true)} title={currentUser.role === 'it' ? undefined : 'Your signature'}
          className="w-8 h-8 rounded-full bg-ink text-white flex items-center justify-center text-xs font-bold">
          {currentUser.name.charAt(0).toUpperCase()}
        </button>
        <button onClick={signOut} className="px-3 xl:px-4 py-1.5 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-medium transition-colors whitespace-nowrap">
          Sign out
        </button>
      </div>
      {signing ? <SignatureModal onClose={() => setSigning(false)} /> : <SignaturePrompt />}
    </header>
  )
}
