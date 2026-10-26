import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppStore } from '../store'
import Logo from '../components/Logo'

const ROLE_BADGE: Record<string, string> = {
  admin:    'bg-ink text-white',
  manager:  'bg-coral-tint text-coral-dark',
  engineer: 'bg-green-100 text-green-700',
}

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const { members, projects, setCurrentUser, setCurrentProjectId } = useAppStore()
  const navigate = useNavigate()

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault()
    const user = members.find((u) => u.email.toLowerCase() === email.trim().toLowerCase())
    if (user) {
      setCurrentUser(user)
      if (user.role === 'admin') {
        // Admins see everything — no project context needed
        navigate('/home')
      } else if (user.projectIds.length === 1) {
        // Only one project — auto-select it
        setCurrentProjectId(user.projectIds[0])
        navigate('/home')
      } else if (user.projectIds.length > 1) {
        // Multiple projects — let user choose
        navigate('/select-project')
      } else {
        // No projects assigned — still go home (will see empty tasks)
        navigate('/home')
      }
    } else {
      setError('Email not found. Select a test account below or contact your admin.')
    }
  }

  return (
    <div className="h-full overflow-y-auto flex p-6">
      <div className="w-full max-w-md py-6 m-auto">
        {/* Branding */}
        <div className="flex flex-col items-center text-center mb-8">
          <Logo size={56} />
          <h1 className="text-4xl font-normal text-ink tracking-tight mt-5">ITP Workflow</h1>
          <p className="text-slate-400 mt-1.5 text-base">Inspection & Test Plan Management</p>
        </div>

        {/* Card */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-7">
          <h2 className="text-xl font-semibold text-ink mb-1">Sign in</h2>
          <p className="text-slate-400 text-sm mb-6">Enter your email address to continue</p>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Email address</label>
              <input
                type="email"
                value={email}
                onChange={(e) => { setEmail(e.target.value); setError('') }}
                placeholder="you@itp.com"
                className="w-full px-4 py-3 rounded-2xl bg-white border border-slate-700 focus:outline-none focus:border-ink text-ink placeholder-slate-500 transition"
                autoFocus
              />
            </div>

            {error && (
              <div className="bg-red-50 text-red-600 text-sm rounded-2xl px-4 py-3 border border-red-100">
                {error}
              </div>
            )}

            <button
              type="submit"
              className="w-full bg-ink hover:bg-ink-soft text-white font-semibold py-3 rounded-full transition-colors shadow-float"
            >
              Continue
            </button>
          </form>

          {/* Test accounts */}
          <div className="mt-6 pt-6 border-t border-slate-800">
            <p className="text-xs text-slate-500 font-semibold uppercase tracking-wide mb-3">Test accounts</p>
            <div className="space-y-1">
              {members.map((u) => (
                <button
                  key={u.email}
                  onClick={() => setEmail(u.email)}
                  className="w-full flex items-center justify-between px-3 py-2 rounded-2xl hover:bg-white transition-colors group"
                >
                  <div className="text-left">
                    <span className="text-sm font-medium text-slate-200 group-hover:text-ink">{u.name}</span>
                    <span className="text-xs text-slate-500 block">{u.email}</span>
                  </div>
                  <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${ROLE_BADGE[u.role] ?? 'bg-slate-800 text-slate-400'}`}>
                    {u.role}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
