import { useState } from 'react'
import type { ChecklistTemplate } from '../types'

const USERS = [
  { email: 'admin@itp.com', name: 'Admin User' },
  { email: 'vedh@itp.com', name: 'Vedh' },
  { email: 'inspector@itp.com', name: 'Site Inspector' },
]

interface Props {
  templates: ChecklistTemplate[]
  onAdd: (template: ChecklistTemplate, assignedTo: string) => void
  onClose: () => void
}

export default function AddChecklistModal({ templates, onAdd, onClose }: Props) {
  const [selected, setSelected] = useState<string | null>(null)
  const [assignedTo, setAssignedTo] = useState('')

  const chosen = templates.find((t) => t.id === selected)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-lg">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-800">
          <h2 className="text-lg font-bold text-white">Add Checklist from Template</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Template list */}
        <div className="px-6 py-4 space-y-2 max-h-52 overflow-y-auto">
          {templates.length === 0 ? (
            <p className="text-slate-400 text-sm text-center py-8">No templates yet. Create some in Admin.</p>
          ) : (
            templates.map((t) => (
              <button
                key={t.id}
                onClick={() => setSelected(t.id)}
                className={`w-full text-left px-4 py-3 rounded-xl border transition-all ${
                  selected === t.id
                    ? 'border-blue-500 bg-blue-500/10'
                    : 'border-slate-700 hover:border-slate-500 bg-slate-800/50'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="font-semibold text-white text-sm">{t.name}</div>
                  {t.requiresSignature && (
                    <span className="flex items-center gap-1 text-xs text-amber-400 bg-amber-900/20 border border-amber-800/40 px-2 py-0.5 rounded-full flex-shrink-0">
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                      </svg>
                      Signature
                    </span>
                  )}
                </div>
                <div className="text-slate-400 text-xs mt-0.5">{t.description}</div>
                <div className="text-slate-500 text-xs mt-1">{t.items.length} items</div>
              </button>
            ))
          )}
        </div>

        {/* Assign to user */}
        {chosen && (
          <div className="px-6 pb-4">
            <div className="border-t border-slate-800 pt-4">
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Assign to
              </label>
              <div className="space-y-2">
                {USERS.map((u) => (
                  <button
                    key={u.email}
                    onClick={() => setAssignedTo(u.email)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border text-left transition-all ${
                      assignedTo === u.email
                        ? 'border-blue-500 bg-blue-500/10'
                        : 'border-slate-700 hover:border-slate-500 bg-slate-800/50'
                    }`}
                  >
                    <div className="w-7 h-7 rounded-full bg-blue-600/30 text-blue-300 flex items-center justify-center text-xs font-bold flex-shrink-0">
                      {u.name.charAt(0)}
                    </div>
                    <div>
                      <div className="text-sm font-medium text-slate-200">{u.name}</div>
                      <div className="text-xs text-slate-500">{u.email}</div>
                    </div>
                    {assignedTo === u.email && (
                      <svg className="w-4 h-4 text-blue-400 ml-auto flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3 px-6 py-5 border-t border-slate-800">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-slate-700 text-slate-300 hover:bg-slate-800 transition-colors text-sm font-medium"
          >
            Cancel
          </button>
          <button
            onClick={() => chosen && onAdd(chosen, assignedTo)}
            disabled={!chosen}
            className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold transition-colors"
          >
            Add Checklist
          </button>
        </div>
      </div>
    </div>
  )
}
