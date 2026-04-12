import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppStore } from '../store'
import type { ChecklistTemplate, ChecklistItem } from '../types'

function newItem(text = ''): ChecklistItem {
  return { id: `item-${Date.now()}-${Math.random()}`, text, completed: false }
}

function newTemplate(): ChecklistTemplate {
  return {
    id: `tmpl-${Date.now()}`,
    name: '',
    description: '',
    requiresSignature: false,
    items: [newItem()],
    createdAt: new Date().toISOString(),
  }
}

export default function AdminPage() {
  const navigate = useNavigate()
  const { currentUser, templates, addTemplate, updateTemplate, deleteTemplate } = useAppStore()

  const [selectedId, setSelectedId] = useState<string | null>(templates[0]?.id ?? null)
  const [editing, setEditing] = useState<ChecklistTemplate | null>(null)
  const [isNew, setIsNew] = useState(false)

  if (!currentUser || currentUser.role !== 'admin') {
    navigate('/home')
    return null
  }

  const selected = templates.find((t) => t.id === selectedId) ?? null

  const startEdit = (t: ChecklistTemplate) => {
    setEditing(JSON.parse(JSON.stringify(t)))
    setIsNew(false)
  }

  const startNew = () => {
    const t = newTemplate()
    setEditing(t)
    setIsNew(true)
  }

  const saveEditing = () => {
    if (!editing) return
    if (!editing.name.trim()) return
    if (isNew) {
      addTemplate(editing)
      setSelectedId(editing.id)
    } else {
      updateTemplate(editing)
      setSelectedId(editing.id)
    }
    setEditing(null)
    setIsNew(false)
  }

  const cancelEditing = () => {
    setEditing(null)
    setIsNew(false)
  }

  const handleDelete = (id: string) => {
    if (!confirm('Delete this template?')) return
    deleteTemplate(id)
    setSelectedId(templates.find((t) => t.id !== id)?.id ?? null)
  }

  // editing helpers
  const setField = (field: keyof ChecklistTemplate, value: string) => {
    if (!editing) return
    setEditing({ ...editing, [field]: value })
  }

  const setItemText = (idx: number, text: string) => {
    if (!editing) return
    const items = editing.items.map((it, i) => (i === idx ? { ...it, text } : it))
    setEditing({ ...editing, items })
  }

  const toggleSignature = () => {
    if (!editing) return
    setEditing({ ...editing, requiresSignature: !editing.requiresSignature })
  }

  const addItem = () => {
    if (!editing) return
    setEditing({ ...editing, items: [...editing.items, newItem()] })
  }

  const removeItem = (idx: number) => {
    if (!editing) return
    setEditing({ ...editing, items: editing.items.filter((_, i) => i !== idx) })
  }

  return (
    <div className="flex h-screen bg-slate-950 overflow-hidden">
      {/* Sidebar */}
      <aside className="w-72 flex flex-col border-r border-slate-800 bg-slate-900">
        <div className="px-4 py-4 border-b border-slate-800">
          <div className="flex items-center gap-2 mb-1">
            <button onClick={() => navigate('/home')} className="text-slate-400 hover:text-white transition-colors">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <h1 className="text-white font-bold text-base">Admin</h1>
            <span className="ml-auto text-xs bg-purple-900/60 text-purple-300 px-2 py-0.5 rounded-full">Templates</span>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-3 py-3 space-y-1">
          {templates.map((t) => (
            <button
              key={t.id}
              onClick={() => { setSelectedId(t.id); setEditing(null) }}
              className={`w-full text-left px-3 py-3 rounded-xl transition-all ${
                selectedId === t.id && !editing
                  ? 'bg-purple-600/20 border border-purple-600/40'
                  : 'hover:bg-slate-800 border border-transparent'
              }`}
            >
              <div className="text-sm font-medium text-slate-200 truncate">{t.name || 'Untitled'}</div>
              <div className="text-xs text-slate-500 mt-0.5">{t.items.length} items</div>
            </button>
          ))}

          {templates.length === 0 && (
            <p className="text-slate-500 text-xs text-center py-6">No templates yet</p>
          )}
        </div>

        <div className="p-3 border-t border-slate-800">
          <button
            onClick={startNew}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-sm font-semibold transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            New Template
          </button>
        </div>
      </aside>

      {/* Main panel */}
      <main className="flex-1 overflow-y-auto p-8 bg-slate-950">
        {editing ? (
          /* ── Edit / Create form ── */
          <div className="max-w-2xl mx-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-white">
                {isNew ? 'New Template' : 'Edit Template'}
              </h2>
              <div className="flex gap-2">
                <button
                  onClick={cancelEditing}
                  className="px-4 py-2 rounded-xl border border-slate-700 text-slate-300 hover:bg-slate-800 text-sm font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={saveEditing}
                  className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-sm font-semibold transition-colors"
                >
                  Save Template
                </button>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Template Name *</label>
                <input
                  autoFocus
                  type="text"
                  value={editing.name}
                  onChange={(e) => setField('name', e.target.value)}
                  placeholder="e.g. Fire Safety Inspection"
                  className="w-full bg-slate-800 text-slate-100 placeholder-slate-500 rounded-xl px-4 py-3 border border-slate-700 focus:outline-none focus:border-purple-500 transition-colors"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Description</label>
                <input
                  type="text"
                  value={editing.description}
                  onChange={(e) => setField('description', e.target.value)}
                  placeholder="Short description of this template"
                  className="w-full bg-slate-800 text-slate-100 placeholder-slate-500 rounded-xl px-4 py-3 border border-slate-700 focus:outline-none focus:border-purple-500 transition-colors"
                />
              </div>

              {/* Signature requirement toggle */}
              <div
                onClick={toggleSignature}
                className={`flex items-center justify-between px-4 py-3.5 rounded-xl border cursor-pointer transition-all ${
                  editing.requiresSignature
                    ? 'bg-amber-950/20 border-amber-700/60'
                    : 'bg-slate-800/50 border-slate-700 hover:border-slate-500'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                    editing.requiresSignature ? 'bg-amber-900/40 text-amber-400' : 'bg-slate-700 text-slate-400'
                  }`}>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                    </svg>
                  </div>
                  <div>
                    <p className={`text-sm font-semibold ${editing.requiresSignature ? 'text-amber-300' : 'text-slate-300'}`}>
                      Requires signature
                    </p>
                    <p className="text-xs text-slate-500">Inspector must sign off on this checklist</p>
                  </div>
                </div>
                {/* Toggle pill */}
                <div className={`w-10 h-6 rounded-full transition-colors flex-shrink-0 ${
                  editing.requiresSignature ? 'bg-amber-500' : 'bg-slate-600'
                }`}>
                  <div className={`w-4 h-4 rounded-full bg-white mt-1 transition-transform ${
                    editing.requiresSignature ? 'translate-x-5' : 'translate-x-1'
                  }`} />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-slate-300">Checklist Items</label>
                  <span className="text-xs text-slate-500">{editing.items.length} items</span>
                </div>

                <div className="space-y-2">
                  {editing.items.map((item, idx) => (
                    <div key={item.id} className="flex items-center gap-2">
                      <span className="text-slate-600 text-xs w-5 text-right flex-shrink-0">{idx + 1}.</span>
                      <input
                        type="text"
                        value={item.text}
                        onChange={(e) => setItemText(idx, e.target.value)}
                        placeholder={`Item ${idx + 1}`}
                        className="flex-1 bg-slate-800 text-slate-100 placeholder-slate-500 rounded-lg px-3 py-2.5 border border-slate-700 focus:outline-none focus:border-purple-500 text-sm transition-colors"
                      />
                      <button
                        onClick={() => removeItem(idx)}
                        disabled={editing.items.length === 1}
                        className="p-2 text-slate-600 hover:text-red-400 disabled:opacity-20 transition-colors rounded-lg hover:bg-red-950/30"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>

                <button
                  onClick={addItem}
                  className="mt-3 flex items-center gap-2 text-sm text-slate-400 hover:text-purple-400 transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Add item
                </button>
              </div>
            </div>
          </div>
        ) : selected ? (
          /* ── View template ── */
          <div className="max-w-2xl mx-auto">
            <div className="flex items-start justify-between mb-6">
              <div>
                <h2 className="text-2xl font-bold text-white">{selected.name}</h2>
                {selected.description && (
                  <p className="text-slate-400 mt-1">{selected.description}</p>
                )}
                <p className="text-slate-600 text-xs mt-2">
                  Created {new Date(selected.createdAt).toLocaleDateString()}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => startEdit(selected)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-medium border border-slate-700 transition-colors flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                  Edit
                </button>
                <button
                  onClick={() => handleDelete(selected.id)}
                  className="px-4 py-2 rounded-xl bg-red-900/30 hover:bg-red-900/60 text-red-400 text-sm font-medium border border-red-900/40 transition-colors flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  Delete
                </button>
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
                <span className="text-sm font-semibold text-slate-300">Checklist Items</span>
                <span className="text-xs text-slate-500">{selected.items.length} items</span>
              </div>
              <ul className="divide-y divide-slate-800">
                {selected.items.map((item, idx) => (
                  <li key={item.id} className="flex items-center gap-4 px-5 py-3.5">
                    <span className="text-slate-600 text-xs w-5 text-right flex-shrink-0">{idx + 1}</span>
                    <span className="text-slate-200 text-sm flex-1">{item.text}</span>
                  </li>
                ))}
              </ul>
              {selected.requiresSignature && (
                <div className="flex items-center gap-3 px-5 py-3.5 border-t border-slate-700 bg-amber-950/10">
                  <svg className="w-4 h-4 text-amber-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                  </svg>
                  <span className="text-sm text-amber-400 font-medium">Signature required to complete this checklist</span>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <div className="w-16 h-16 rounded-2xl bg-slate-800 flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                </svg>
              </div>
              <p className="text-slate-500 text-sm">Select a template or create a new one</p>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
