import { useNavigate } from 'react-router-dom'
import { useAppStore } from '../store'
import Logo from './Logo'
import ProjectSwitcher from './ProjectSwitcher'

type Active = 'overview' | 'tasks' | 'admin'

// Shared top bar: logo + project switcher (left), pill navigation (centre), user (right)
export default function AppHeader({ active }: { active: Active }) {
  const navigate = useNavigate()
  const currentUser = useAppStore((s) => s.currentUser)
  if (!currentUser) return null

  const signOut = () => {
    useAppStore.getState().setCurrentUser(null)
    useAppStore.getState().setCurrentProjectId(null)
    navigate('/')
  }

  const tabs: { key: Active; label: string; path: string }[] = [
    { key: 'overview', label: 'Overview', path: '/home' },
    { key: 'tasks', label: 'Tasks', path: '/tasks' },
    ...(currentUser.role === 'admin' ? [{ key: 'admin' as const, label: 'Admin', path: '/admin' }] : []),
  ]
  const pill = 'px-5 py-2.5 rounded-full text-sm font-medium transition-colors'

  return (
    <header className="grid grid-cols-[1fr_auto_1fr] items-center gap-4 px-10 pt-8 pb-2 flex-shrink-0">
      <div className="flex items-center gap-3 justify-self-start">
        <Logo size={44} />
        <ProjectSwitcher variant="header" />
      </div>

      <nav className="flex items-center gap-1 bg-slate-800 rounded-full p-1">
        {tabs.map((t) => t.key === active
          ? <span key={t.key} className={`${pill} bg-ink text-white`}>{t.label}</span>
          : <button key={t.key} onClick={() => navigate(t.path)} className={`${pill} text-slate-300 hover:text-ink hover:bg-white`}>{t.label}</button>)}
      </nav>

      <div className="flex items-center gap-3 justify-self-end">
        <div className="text-right hidden sm:block">
          <p className="text-sm font-semibold text-ink leading-tight">{currentUser.name}</p>
          <p className="text-xs text-slate-500">{currentUser.role}</p>
        </div>
        <div className="w-11 h-11 rounded-full bg-ink text-white flex items-center justify-center text-sm font-bold">
          {currentUser.name.charAt(0).toUpperCase()}
        </div>
        <button onClick={signOut} className="px-4 py-2 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-medium transition-colors">
          Sign out
        </button>
      </div>
    </header>
  )
}
