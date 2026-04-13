import { useNavigate } from 'react-router-dom'
import { useAppStore } from '../store'

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
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-blue-800 to-blue-600 flex flex-col items-center justify-center p-4">
      {/* Sign out top-right */}
      <div className="absolute top-5 right-6">
        <button
          onClick={handleSignOut}
          className="text-blue-200 hover:text-white text-sm transition-colors flex items-center gap-1.5"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
          Sign out
        </button>
      </div>

      <div className="w-full max-w-xl">
        {/* Greeting */}
        <div className="text-center mb-10">
          {/* Avatar */}
          <div className={`inline-flex w-16 h-16 rounded-2xl items-center justify-center text-2xl font-bold text-white mb-4 ${
            currentUser.role === 'manager' ? 'bg-blue-500/40' : 'bg-green-600/40'
          } backdrop-blur border border-white/20`}>
            {currentUser.name.charAt(0).toUpperCase()}
          </div>
          <h1 className="text-3xl font-bold text-white">Welcome, {currentUser.name.split(' ')[0]}</h1>
          <p className="text-blue-200 mt-2 text-base">
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
              className="w-full group bg-white/10 hover:bg-white/20 backdrop-blur border border-white/20 hover:border-white/40 rounded-2xl p-6 text-left transition-all duration-200 flex items-center gap-5"
            >
              {/* Project index badge */}
              <div className="w-12 h-12 rounded-xl bg-white/15 group-hover:bg-white/25 flex items-center justify-center flex-shrink-0 transition-colors">
                <span className="text-white font-bold text-lg">{idx + 1}</span>
              </div>

              <div className="flex-1 min-w-0">
                <div className="text-white font-bold text-lg leading-tight">{project.name}</div>
                {project.description && (
                  <div className="text-blue-200 text-sm mt-0.5 truncate">{project.description}</div>
                )}
              </div>

              <svg
                className="w-5 h-5 text-blue-200 group-hover:text-white group-hover:translate-x-1 transition-all flex-shrink-0"
                fill="none" stroke="currentColor" viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          ))}

          {assignedProjects.length === 0 && (
            <div className="bg-white/10 border border-white/20 rounded-2xl p-8 text-center">
              <p className="text-blue-200">You have no projects assigned. Contact your admin.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
