import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppStore } from '../store'
import type { User } from '../types'

const TEST_USERS: User[] = [
  { email: 'admin@itp.com', name: 'Admin User', role: 'admin' },
  { email: 'vedh@itp.com', name: 'Vedh', role: 'user' },
  { email: 'inspector@itp.com', name: 'Site Inspector', role: 'user' },
]

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const setCurrentUser = useAppStore((s) => s.setCurrentUser)
  const navigate = useNavigate()

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault()
    const user = TEST_USERS.find((u) => u.email.toLowerCase() === email.trim().toLowerCase())
    if (user) {
      setCurrentUser(user)
      navigate('/home')
    } else {
      setError('Email not found. Try: admin@itp.com, vedh@itp.com, or inspector@itp.com')
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-blue-800 to-blue-600 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo / Branding */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-white/20 backdrop-blur mb-4">
            <svg className="w-9 h-9 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-white tracking-tight">ITP Workflow</h1>
          <p className="text-blue-200 mt-1 text-sm">Inspection & Test Plan Management</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <h2 className="text-xl font-semibold text-gray-800 mb-1">Sign in</h2>
          <p className="text-gray-500 text-sm mb-6">Enter your email to continue</p>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Email address
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => { setEmail(e.target.value); setError('') }}
                placeholder="you@itp.com"
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 placeholder-gray-400 transition"
                autoFocus
              />
            </div>

            {error && (
              <div className="bg-red-50 text-red-600 text-sm rounded-lg px-4 py-3 border border-red-100">
                {error}
              </div>
            )}

            <button
              type="submit"
              className="w-full bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-semibold py-3 rounded-xl transition-colors shadow-sm"
            >
              Continue
            </button>
          </form>

          {/* Test accounts hint */}
          <div className="mt-6 pt-6 border-t border-gray-100">
            <p className="text-xs text-gray-400 font-medium uppercase tracking-wide mb-3">Test accounts</p>
            <div className="space-y-2">
              {TEST_USERS.map((u) => (
                <button
                  key={u.email}
                  onClick={() => setEmail(u.email)}
                  className="w-full flex items-center justify-between px-3 py-2 rounded-lg hover:bg-gray-50 transition-colors group"
                >
                  <div className="text-left">
                    <span className="text-sm font-medium text-gray-700 group-hover:text-blue-600">{u.name}</span>
                    <span className="text-xs text-gray-400 block">{u.email}</span>
                  </div>
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                    u.role === 'admin'
                      ? 'bg-purple-100 text-purple-700'
                      : 'bg-blue-100 text-blue-700'
                  }`}>
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
