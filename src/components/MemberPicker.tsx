import { useState, useRef, useEffect } from 'react'
import type { AppUser } from '../types'

const ROLE_COLORS: Record<string, string> = {
  admin:   'bg-purple-900/50 text-purple-300',
  manager: 'bg-blue-900/50   text-blue-300',
  engineer:'bg-green-900/50  text-green-300',
}

interface Props {
  members: AppUser[]
  value: string            // currently selected email
  onChange: (email: string) => void
  label?: string
  required?: boolean
  placeholder?: string
}

export default function MemberPicker({
  members,
  value,
  onChange,
  label,
  required,
  placeholder = 'Search by name…',
}: Props) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const selected = members.find((m) => m.email === value) ?? null

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
        setQuery('')
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setOpen(false); setQuery('') }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [])

  const filtered = members.filter((m) =>
    m.name.toLowerCase().includes(query.toLowerCase()) ||
    m.email.toLowerCase().includes(query.toLowerCase())
  )

  const handleSelect = (email: string) => {
    onChange(email)
    setOpen(false)
    setQuery('')
  }

  const handleClear = () => {
    onChange('')
    setQuery('')
    setOpen(true)
    setTimeout(() => inputRef.current?.focus(), 0)
  }

  return (
    <div ref={containerRef} className="relative">
      {label && (
        <label className="block text-sm font-medium text-slate-300 mb-1.5">
          {label}{required && <span className="text-red-400 ml-0.5">*</span>}
        </label>
      )}

      {/* Trigger / input area */}
      {selected && !open ? (
        /* ── Selected state chip ── */
        <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl border border-blue-500 bg-blue-500/10">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${
            selected.role === 'admin'    ? 'bg-purple-600/40 text-purple-200' :
            selected.role === 'manager' ? 'bg-blue-600/40   text-blue-200'   :
                                          'bg-green-600/40  text-green-200'
          }`}>
            {selected.name.charAt(0)}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-slate-200 truncate">{selected.name}</span>
              <span className={`text-xs px-1.5 py-0.5 rounded font-semibold flex-shrink-0 ${ROLE_COLORS[selected.role]}`}>
                {selected.role}
              </span>
            </div>
            <div className="text-xs text-slate-500 truncate">{selected.email}</div>
          </div>
          {/* Change / clear button */}
          <button
            type="button"
            onClick={handleClear}
            className="flex-shrink-0 text-slate-500 hover:text-white transition-colors"
            title="Change"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      ) : (
        /* ── Search input ── */
        <div className="relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setOpen(true) }}
            onFocus={() => setOpen(true)}
            placeholder={placeholder}
            className="w-full bg-slate-800 text-slate-100 placeholder-slate-500 rounded-xl pl-9 pr-3 py-2.5 border border-slate-700 focus:outline-none focus:border-blue-500 text-sm transition-colors"
          />
        </div>
      )}

      {/* ── Dropdown ── */}
      {open && (
        <div className="absolute top-full mt-1.5 left-0 right-0 z-50 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl overflow-hidden">
          {filtered.length === 0 ? (
            <div className="px-4 py-3 text-sm text-slate-500 text-center">No members match "{query}"</div>
          ) : (
            <ul className="max-h-52 overflow-y-auto py-1">
              {filtered.map((m) => (
                <li key={m.email}>
                  <button
                    type="button"
                    onClick={() => handleSelect(m.email)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors ${
                      m.email === value
                        ? 'bg-blue-600/20 text-white'
                        : 'text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${
                      m.role === 'admin'    ? 'bg-purple-600/40 text-purple-200' :
                      m.role === 'manager' ? 'bg-blue-600/40   text-blue-200'   :
                                             'bg-green-600/40  text-green-200'
                    }`}>
                      {m.name.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        {/* Highlight matching text */}
                        <HighlightMatch text={m.name} query={query} />
                        <span className={`text-xs px-1.5 py-0.5 rounded font-semibold flex-shrink-0 ${ROLE_COLORS[m.role]}`}>
                          {m.role}
                        </span>
                      </div>
                      <div className="text-xs text-slate-500 truncate">{m.email}</div>
                    </div>
                    {m.email === value && (
                      <svg className="w-4 h-4 text-blue-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}

// Bolds the matching portion of the text
function HighlightMatch({ text, query }: { text: string; query: string }) {
  if (!query.trim()) return <span className="text-sm font-medium truncate">{text}</span>
  const idx = text.toLowerCase().indexOf(query.toLowerCase())
  if (idx === -1) return <span className="text-sm font-medium truncate">{text}</span>
  return (
    <span className="text-sm font-medium truncate">
      {text.slice(0, idx)}
      <mark className="bg-blue-500/30 text-white rounded px-0.5">{text.slice(idx, idx + query.length)}</mark>
      {text.slice(idx + query.length)}
    </span>
  )
}
