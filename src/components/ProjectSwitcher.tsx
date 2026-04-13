import { useState, useRef, useEffect } from 'react'
import { useAppStore } from '../store'

interface Props {
  /** Dark variant = for the TasksPage dark sidebar; light = for the dark-gradient HomePage header */
  variant?: 'dark' | 'header'
}

export default function ProjectSwitcher({ variant = 'header' }: Props) {
  const { currentUser, projects, currentProjectId, setCurrentProjectId } = useAppStore()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  if (!currentUser || currentUser.role === 'admin') return null
  if (currentUser.projectIds.length <= 1) return null   // only show when multiple

  const assignedProjects = projects.filter((p) => currentUser.projectIds.includes(p.id))
  const current = projects.find((p) => p.id === currentProjectId)

  const isDark = variant === 'dark'

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
          isDark
            ? 'bg-slate-800 border border-slate-700 text-slate-200 hover:border-slate-500'
            : 'bg-white/10 border border-white/20 text-white hover:bg-white/20'
        }`}
      >
        {/* Project icon */}
        <svg className={`w-3.5 h-3.5 flex-shrink-0 ${isDark ? 'text-blue-400' : 'text-blue-300'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
        </svg>
        <span className="max-w-[140px] truncate">{current?.name ?? 'Select project'}</span>
        <svg
          className={`w-3.5 h-3.5 flex-shrink-0 transition-transform ${open ? 'rotate-180' : ''} ${isDark ? 'text-slate-400' : 'text-blue-200'}`}
          fill="none" stroke="currentColor" viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className={`absolute top-full mt-2 left-0 z-50 min-w-[220px] rounded-xl border shadow-2xl overflow-hidden ${
          isDark
            ? 'bg-slate-900 border-slate-700'
            : 'bg-slate-900 border-slate-700'
        }`}>
          <div className="px-3 py-2 border-b border-slate-800">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Switch project</p>
          </div>
          {assignedProjects.map((p) => (
            <button
              key={p.id}
              onClick={() => { setCurrentProjectId(p.id); setOpen(false) }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors ${
                p.id === currentProjectId
                  ? 'bg-blue-600/20 text-white'
                  : 'text-slate-300 hover:bg-slate-800'
              }`}
            >
              <div className={`w-2 h-2 rounded-full flex-shrink-0 ${p.id === currentProjectId ? 'bg-blue-400' : 'bg-slate-600'}`} />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{p.name}</div>
                {p.description && <div className="text-xs text-slate-500 truncate">{p.description}</div>}
              </div>
              {p.id === currentProjectId && (
                <svg className="w-4 h-4 text-blue-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
