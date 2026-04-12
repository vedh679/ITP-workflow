import { useNavigate } from 'react-router-dom'
import { useAppStore } from '../store'

export default function HomePage() {
  const navigate = useNavigate()
  const currentUser = useAppStore((s) => s.currentUser)

  if (!currentUser) {
    navigate('/')
    return null
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 flex flex-col">
      {/* Top bar */}
      <header className="flex items-center justify-between px-8 py-5">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-blue-500/20 flex items-center justify-center">
            <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
            </svg>
          </div>
          <span className="text-white font-semibold tracking-tight">ITP Workflow</span>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="text-sm font-medium text-white">{currentUser.name}</p>
            <p className="text-xs text-blue-300">{currentUser.email}</p>
          </div>
          <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold ${
            currentUser.role === 'admin' ? 'bg-purple-500 text-white' : 'bg-blue-500 text-white'
          }`}>
            {currentUser.name.charAt(0).toUpperCase()}
          </div>
          <button
            onClick={() => { useAppStore.getState().setCurrentUser(null); navigate('/') }}
            className="ml-2 text-blue-300 hover:text-white text-sm transition-colors"
          >
            Sign out
          </button>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 flex flex-col items-center justify-center px-4">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-white mb-3">
            Welcome back, {currentUser.name.split(' ')[0]}
          </h1>
          <p className="text-blue-300 text-lg">What would you like to do today?</p>
        </div>

        <div className="flex gap-6 flex-wrap justify-center">
          {/* Tasks button — always visible */}
          <button
            onClick={() => navigate('/tasks')}
            className="group relative w-64 h-52 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-blue-400/50 rounded-2xl p-8 flex flex-col items-center justify-center gap-4 transition-all duration-200 backdrop-blur cursor-pointer"
          >
            <div className="w-16 h-16 rounded-2xl bg-blue-500/20 group-hover:bg-blue-500/30 flex items-center justify-center transition-colors">
              <svg className="w-8 h-8 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
              </svg>
            </div>
            <div className="text-center">
              <h2 className="text-xl font-bold text-white">Tasks</h2>
              <p className="text-blue-300 text-sm mt-1">View & manage inspection tasks</p>
            </div>
            <div className="absolute inset-x-0 bottom-0 h-1 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-b-2xl opacity-0 group-hover:opacity-100 transition-opacity" />
          </button>

          {/* Admin button — only for admins */}
          {currentUser.role === 'admin' && (
            <button
              onClick={() => navigate('/admin')}
              className="group relative w-64 h-52 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-purple-400/50 rounded-2xl p-8 flex flex-col items-center justify-center gap-4 transition-all duration-200 backdrop-blur cursor-pointer"
            >
              <div className="w-16 h-16 rounded-2xl bg-purple-500/20 group-hover:bg-purple-500/30 flex items-center justify-center transition-colors">
                <svg className="w-8 h-8 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <div className="text-center">
                <h2 className="text-xl font-bold text-white">Admin</h2>
                <p className="text-purple-300 text-sm mt-1">Manage templates & settings</p>
              </div>
              <div className="absolute inset-x-0 bottom-0 h-1 bg-gradient-to-r from-purple-500 to-pink-500 rounded-b-2xl opacity-0 group-hover:opacity-100 transition-opacity" />
            </button>
          )}
        </div>
      </main>
    </div>
  )
}
