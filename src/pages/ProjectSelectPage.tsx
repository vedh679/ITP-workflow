import { useNavigate } from 'react-router-dom'
import { useAppStore } from '../store'
import Logo from '../components/Logo'

export default function ProjectSelectPage() {
  const navigate = useNavigate()
  const { currentUser, projects, setCurrentProjectId, setCurrentUser } = useAppStore()

  if (!currentUser) { navigate('/'); return null }

  // Only non-admin users with multiple projects should land here
  const assignedProjects = projects.filter((p) => currentUser.projectIds.includes(p.id))

  const handleSelect = (projectId: string) => {
    setCurrentProjectId(projectId)
    navigate('/home')
  }

  const handleSignOut = () => {
    setCurrentUser(null)
    navigate('/')
  }

  return (
    <div className="h-full overflow-y-auto flex flex-col">
      {/* Top bar */}
      <header className="flex items-center justify-between px-10 pt-8">
        <Logo size={44} />
        <button
          onClick={handleSignOut}
          className="flex items-center gap-2 px-4 py-2 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-medium transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
              d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
          Sign out
        </button>
      </header>

      <div className="flex-1 flex p-6">
        <div className="w-full max-w-xl m-auto">
          {/* Greeting */}
          <div className="text-center mb-10">
            <div className="inline-flex w-16 h-16 rounded-full items-center justify-center text-2xl font-bold text-white bg-ink mb-5">
              {currentUser.name.charAt(0).toUpperCase()}
            </div>
            <h1 className="text-4xl font-normal text-ink tracking-tight">Welcome, {currentUser.name.split(' ')[0]} 👋</h1>
            <p className="text-slate-400 mt-2 text-base">
              You're assigned to multiple projects.<br />
              Select the one you'd like to work in today.
            </p>
          </div>

          {/* Project cards */}
          <div className="space-y-3">
            {assignedProjects.map((project, idx) => (
              <button
                key={project.id}
                onClick={() => handleSelect(project.id)}
                className="w-full group bg-slate-900 hover:bg-white border border-slate-800 hover:border-slate-600 hover:shadow-float rounded-3xl p-5 text-left transition-all duration-200 flex items-center gap-5"
              >
                <div className="w-12 h-12 rounded-full bg-ink flex items-center justify-center flex-shrink-0">
                  <span className="text-white font-bold text-lg">{idx + 1}</span>
                </div>

                <div className="flex-1 min-w-0">
                  <div className="text-ink font-semibold text-lg leading-tight">{project.name}</div>
                  {project.description && (
                    <div className="text-slate-400 text-sm mt-0.5 truncate">{project.description}</div>
                  )}
                </div>

                <svg
                  className="w-5 h-5 text-slate-500 group-hover:text-ink group-hover:translate-x-1 transition-all flex-shrink-0"
                  fill="none" stroke="currentColor" viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            ))}

            {assignedProjects.length === 0 && (
              <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 text-center">
                <p className="text-slate-400">You have no projects assigned. Contact your admin.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
