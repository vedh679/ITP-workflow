import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppStore } from '../store'
import type { ChecklistTemplate, ChecklistItem, AppUser, Project } from '../types'

// ─────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────
type Tab = 'templates' | 'members' | 'projects'

const ROLE_BADGE: Record<string, string> = {
  admin:    'bg-purple-900/40 text-purple-300 border-purple-800/40',
  manager:  'bg-blue-900/40 text-blue-300 border-blue-800/40',
  engineer: 'bg-green-900/40 text-green-300 border-green-800/40',
}
const ROLE_OPTIONS = ['admin', 'manager', 'engineer'] as const

function newItem(text = ''): ChecklistItem {
  return { id: `item-${Date.now()}-${Math.random()}`, text, completed: false }
}
function newTemplate(): ChecklistTemplate {
  return { id: `tmpl-${Date.now()}`, name: '', description: '', requiresSignature: false, items: [newItem()], createdAt: new Date().toISOString() }
}
function newMember(): AppUser {
  return { id: `u-${Date.now()}`, email: '', name: '', role: 'engineer', projectIds: [] }
}
function newProject(): Project {
  return { id: `p-${Date.now()}`, name: '', description: '' }
}

// ─────────────────────────────────────────────────────────────────
// Sub-panel: Templates
// ─────────────────────────────────────────────────────────────────
function TemplatesPanel() {
  const { templates, addTemplate, updateTemplate, deleteTemplate } = useAppStore()
  const [selectedId, setSelectedId] = useState<string | null>(templates[0]?.id ?? null)
  const [editing, setEditing] = useState<ChecklistTemplate | null>(null)
  const [isNew, setIsNew] = useState(false)

  const selected = templates.find((t) => t.id === selectedId) ?? null

  const startEdit = (t: ChecklistTemplate) => { setEditing(JSON.parse(JSON.stringify(t))); setIsNew(false) }
  const startNew  = () => { const t = newTemplate(); setEditing(t); setIsNew(true) }
  const cancel    = () => { setEditing(null); setIsNew(false) }

  const save = () => {
    if (!editing || !editing.name.trim()) return
    if (isNew) { addTemplate(editing); setSelectedId(editing.id) }
    else        { updateTemplate(editing); setSelectedId(editing.id) }
    setEditing(null); setIsNew(false)
  }

  const handleDelete = (id: string) => {
    if (!confirm('Delete this template?')) return
    deleteTemplate(id)
    setSelectedId(templates.find((t) => t.id !== id)?.id ?? null)
  }

  const setField = (field: keyof ChecklistTemplate, value: string | boolean) => editing && setEditing({ ...editing, [field]: value })
  const setItemText = (idx: number, text: string) => editing && setEditing({ ...editing, items: editing.items.map((it, i) => i === idx ? { ...it, text } : it) })
  const addItem    = () => editing && setEditing({ ...editing, items: [...editing.items, newItem()] })
  const removeItem = (idx: number) => editing && setEditing({ ...editing, items: editing.items.filter((_, i) => i !== idx) })

  return (
    <div className="flex flex-1 overflow-hidden">
      {/* List */}
      <div className="w-56 flex flex-col border-r border-slate-800 bg-slate-900/50">
        <div className="flex-1 overflow-y-auto px-2 py-2 space-y-1">
          {templates.map((t) => (
            <button key={t.id} onClick={() => { setSelectedId(t.id); setEditing(null) }}
              className={`w-full text-left px-3 py-2.5 rounded-xl border transition-all ${selectedId === t.id && !editing ? 'bg-purple-600/20 border-purple-600/40' : 'hover:bg-slate-800 border-transparent'}`}>
              <div className="text-sm font-medium text-slate-200 truncate">{t.name || 'Untitled'}</div>
              <div className="text-xs text-slate-500 mt-0.5">{t.items.length} items</div>
            </button>
          ))}
          {templates.length === 0 && <p className="text-slate-500 text-xs text-center py-6">No templates</p>}
        </div>
        <div className="p-2 border-t border-slate-800">
          <button onClick={startNew} className="w-full flex items-center justify-center gap-2 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-sm font-semibold transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
            New
          </button>
        </div>
      </div>

      {/* Detail */}
      <div className="flex-1 overflow-y-auto p-6">
        {editing ? (
          <div className="max-w-xl">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-bold text-white">{isNew ? 'New Template' : 'Edit Template'}</h3>
              <div className="flex gap-2">
                <button onClick={cancel} className="px-4 py-2 rounded-xl border border-slate-700 text-slate-300 hover:bg-slate-800 text-sm transition-colors">Cancel</button>
                <button onClick={save}   className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-sm font-semibold transition-colors">Save</button>
              </div>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Name *</label>
                <input autoFocus type="text" value={editing.name} onChange={(e) => setField('name', e.target.value)} placeholder="Template name"
                  className="w-full bg-slate-800 text-slate-100 placeholder-slate-500 rounded-xl px-4 py-2.5 border border-slate-700 focus:outline-none focus:border-purple-500 text-sm transition-colors" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Description</label>
                <input type="text" value={editing.description} onChange={(e) => setField('description', e.target.value)} placeholder="Short description"
                  className="w-full bg-slate-800 text-slate-100 placeholder-slate-500 rounded-xl px-4 py-2.5 border border-slate-700 focus:outline-none focus:border-purple-500 text-sm transition-colors" />
              </div>

              {/* Signature toggle */}
              <div onClick={() => setField('requiresSignature', !editing.requiresSignature)}
                className={`flex items-center justify-between px-4 py-3 rounded-xl border cursor-pointer transition-all ${editing.requiresSignature ? 'bg-amber-950/20 border-amber-700/60' : 'bg-slate-800/50 border-slate-700 hover:border-slate-500'}`}>
                <div className="flex items-center gap-3">
                  <svg className={`w-4 h-4 ${editing.requiresSignature ? 'text-amber-400' : 'text-slate-500'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                  </svg>
                  <div>
                    <p className={`text-sm font-semibold ${editing.requiresSignature ? 'text-amber-300' : 'text-slate-300'}`}>Requires signature</p>
                    <p className="text-xs text-slate-500">Inspector must sign off on completion</p>
                  </div>
                </div>
                <div className={`w-10 h-6 rounded-full transition-colors flex-shrink-0 ${editing.requiresSignature ? 'bg-amber-500' : 'bg-slate-600'}`}>
                  <div className={`w-4 h-4 rounded-full bg-white mt-1 transition-transform ${editing.requiresSignature ? 'translate-x-5' : 'translate-x-1'}`} />
                </div>
              </div>

              {/* Items */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium text-slate-300">Checklist Items</label>
                  <span className="text-xs text-slate-500">{editing.items.length} items</span>
                </div>
                <div className="space-y-2">
                  {editing.items.map((item, idx) => (
                    <div key={item.id} className="flex items-center gap-2">
                      <span className="text-slate-600 text-xs w-5 text-right flex-shrink-0">{idx + 1}.</span>
                      <input type="text" value={item.text} onChange={(e) => setItemText(idx, e.target.value)} placeholder={`Item ${idx + 1}`}
                        className="flex-1 bg-slate-800 text-slate-100 placeholder-slate-500 rounded-lg px-3 py-2 border border-slate-700 focus:outline-none focus:border-purple-500 text-sm transition-colors" />
                      <button onClick={() => removeItem(idx)} disabled={editing.items.length === 1} className="p-1.5 text-slate-600 hover:text-red-400 disabled:opacity-20 transition-colors rounded-lg hover:bg-red-950/30">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                      </button>
                    </div>
                  ))}
                </div>
                <button onClick={addItem} className="mt-2 flex items-center gap-2 text-sm text-slate-400 hover:text-purple-400 transition-colors">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                  Add item
                </button>
              </div>
            </div>
          </div>
        ) : selected ? (
          <div className="max-w-xl">
            <div className="flex items-start justify-between mb-5">
              <div>
                <h3 className="text-xl font-bold text-white">{selected.name}</h3>
                {selected.description && <p className="text-slate-400 text-sm mt-1">{selected.description}</p>}
              </div>
              <div className="flex gap-2">
                <button onClick={() => startEdit(selected)} className="px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-slate-300 hover:bg-slate-700 text-xs font-medium transition-colors">Edit</button>
                <button onClick={() => handleDelete(selected.id)} className="px-3 py-1.5 rounded-lg bg-red-900/30 border border-red-900/40 text-red-400 hover:bg-red-900/60 text-xs font-medium transition-colors">Delete</button>
              </div>
            </div>
            <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between">
                <span className="text-sm font-semibold text-slate-300">Checklist Items</span>
                <span className="text-xs text-slate-500">{selected.items.length} items</span>
              </div>
              <ul className="divide-y divide-slate-800">
                {selected.items.map((item, idx) => (
                  <li key={item.id} className="flex items-center gap-3 px-4 py-3">
                    <span className="text-slate-600 text-xs w-4">{idx + 1}</span>
                    <span className="text-slate-200 text-sm">{item.text}</span>
                  </li>
                ))}
              </ul>
              {selected.requiresSignature && (
                <div className="flex items-center gap-2 px-4 py-3 border-t border-slate-700 bg-amber-950/10">
                  <svg className="w-3.5 h-3.5 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                  <span className="text-xs text-amber-400 font-medium">Signature required</span>
                </div>
              )}
            </div>
          </div>
        ) : (
          <EmptyState label="Select a template or create one" />
        )}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────
// Sub-panel: Members
// ─────────────────────────────────────────────────────────────────
function MembersPanel() {
  const { members, projects, addMember, updateMember, deleteMember } = useAppStore()
  const [selectedId, setSelectedId] = useState<string | null>(members[0]?.id ?? null)
  const [editing, setEditing] = useState<AppUser | null>(null)
  const [isNew, setIsNew] = useState(false)

  const selected = members.find((m) => m.id === selectedId) ?? null

  const startEdit = (m: AppUser) => { setEditing({ ...m, projectIds: [...m.projectIds] }); setIsNew(false) }
  const startNew  = () => { const m = newMember(); setEditing(m); setIsNew(true) }
  const cancel    = () => { setEditing(null); setIsNew(false) }

  const save = () => {
    if (!editing || !editing.name.trim() || !editing.email.trim()) return
    if (isNew) { addMember(editing); setSelectedId(editing.id) }
    else        { updateMember(editing); setSelectedId(editing.id) }
    setEditing(null); setIsNew(false)
  }

  const handleDelete = (id: string) => {
    if (!confirm('Remove this member?')) return
    deleteMember(id)
    setSelectedId(members.find((m) => m.id !== id)?.id ?? null)
  }

  const toggleProject = (pid: string) => {
    if (!editing) return
    const has = editing.projectIds.includes(pid)
    setEditing({ ...editing, projectIds: has ? editing.projectIds.filter((x) => x !== pid) : [...editing.projectIds, pid] })
  }

  return (
    <div className="flex flex-1 overflow-hidden">
      {/* List */}
      <div className="w-56 flex flex-col border-r border-slate-800 bg-slate-900/50">
        <div className="flex-1 overflow-y-auto px-2 py-2 space-y-1">
          {members.map((m) => (
            <button key={m.id} onClick={() => { setSelectedId(m.id); setEditing(null) }}
              className={`w-full text-left px-3 py-2.5 rounded-xl border transition-all ${selectedId === m.id && !editing ? 'bg-blue-600/20 border-blue-600/40' : 'hover:bg-slate-800 border-transparent'}`}>
              <div className="flex items-center gap-2">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${m.role === 'admin' ? 'bg-purple-600/40 text-purple-300' : m.role === 'manager' ? 'bg-blue-600/40 text-blue-300' : 'bg-green-600/40 text-green-300'}`}>
                  {m.name.charAt(0)}
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-medium text-slate-200 truncate">{m.name}</div>
                  <div className="text-xs text-slate-500 truncate">{m.role}</div>
                </div>
              </div>
            </button>
          ))}
          {members.length === 0 && <p className="text-slate-500 text-xs text-center py-6">No members</p>}
        </div>
        <div className="p-2 border-t border-slate-800">
          <button onClick={startNew} className="w-full flex items-center justify-center gap-2 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
            Add Member
          </button>
        </div>
      </div>

      {/* Detail */}
      <div className="flex-1 overflow-y-auto p-6">
        {editing ? (
          <div className="max-w-xl">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-bold text-white">{isNew ? 'Add Member' : 'Edit Member'}</h3>
              <div className="flex gap-2">
                <button onClick={cancel} className="px-4 py-2 rounded-xl border border-slate-700 text-slate-300 hover:bg-slate-800 text-sm transition-colors">Cancel</button>
                <button onClick={save}   className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold transition-colors">Save</button>
              </div>
            </div>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1.5">Full Name *</label>
                  <input autoFocus type="text" value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} placeholder="Jane Smith"
                    className="w-full bg-slate-800 text-slate-100 placeholder-slate-500 rounded-xl px-3 py-2.5 border border-slate-700 focus:outline-none focus:border-blue-500 text-sm transition-colors" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1.5">Email *</label>
                  <input type="email" value={editing.email} onChange={(e) => setEditing({ ...editing, email: e.target.value })} placeholder="jane@itp.com"
                    className="w-full bg-slate-800 text-slate-100 placeholder-slate-500 rounded-xl px-3 py-2.5 border border-slate-700 focus:outline-none focus:border-blue-500 text-sm transition-colors" />
                </div>
              </div>

              {/* Role */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Role *</label>
                <div className="grid grid-cols-3 gap-2">
                  {ROLE_OPTIONS.map((role) => (
                    <button key={role} type="button" onClick={() => setEditing({ ...editing, role })}
                      className={`py-2 rounded-xl border text-sm font-semibold capitalize transition-all ${editing.role === role
                        ? role === 'admin' ? 'bg-purple-600/20 border-purple-500 text-purple-300'
                          : role === 'manager' ? 'bg-blue-600/20 border-blue-500 text-blue-300'
                          : 'bg-green-600/20 border-green-500 text-green-300'
                        : 'border-slate-700 text-slate-400 hover:border-slate-500'}`}>
                      {role}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-slate-500 mt-1.5">
                  {editing.role === 'admin' ? 'Full access including template management and member settings.' :
                   editing.role === 'manager' ? 'Can create and manage tasks and checklists. No admin settings.' :
                   'Can view tasks and complete checklists only.'}
                </p>
              </div>

              {/* Project assignment */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Assign to Projects</label>
                {projects.length === 0 ? (
                  <p className="text-slate-500 text-xs">No projects yet. Create projects first.</p>
                ) : (
                  <div className="space-y-2">
                    {projects.map((p) => {
                      const active = editing.projectIds.includes(p.id)
                      return (
                        <button key={p.id} type="button" onClick={() => toggleProject(p.id)}
                          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border text-left transition-all ${active ? 'border-blue-500 bg-blue-500/10' : 'border-slate-700 hover:border-slate-500 bg-slate-800/50'}`}>
                          <div className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${active ? 'border-blue-500 bg-blue-500' : 'border-slate-600'}`}>
                            {active && <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                          </div>
                          <div>
                            <div className="text-sm font-medium text-slate-200">{p.name}</div>
                            {p.description && <div className="text-xs text-slate-500">{p.description}</div>}
                          </div>
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : selected ? (
          <div className="max-w-xl">
            <div className="flex items-start justify-between mb-5">
              <div className="flex items-center gap-4">
                <div className={`w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold ${selected.role === 'admin' ? 'bg-purple-600/30 text-purple-300' : selected.role === 'manager' ? 'bg-blue-600/30 text-blue-300' : 'bg-green-600/30 text-green-300'}`}>
                  {selected.name.charAt(0)}
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white">{selected.name}</h3>
                  <p className="text-slate-400 text-sm">{selected.email}</p>
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => startEdit(selected)} className="px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-slate-300 hover:bg-slate-700 text-xs font-medium transition-colors">Edit</button>
                <button onClick={() => handleDelete(selected.id)} className="px-3 py-1.5 rounded-lg bg-red-900/30 border border-red-900/40 text-red-400 hover:bg-red-900/60 text-xs font-medium transition-colors">Remove</button>
              </div>
            </div>

            {/* Role */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 mb-3">
              <p className="text-xs text-slate-500 uppercase tracking-wide font-semibold mb-2">Role</p>
              <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-semibold border ${ROLE_BADGE[selected.role]}`}>
                {selected.role}
              </span>
              <p className="text-xs text-slate-500 mt-2">
                {selected.role === 'admin' ? 'Full access including template management and member settings.' :
                 selected.role === 'manager' ? 'Can create and manage tasks and checklists. No admin settings.' :
                 'Can view tasks and complete checklists only.'}
              </p>
            </div>

            {/* Assigned projects */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
              <p className="text-xs text-slate-500 uppercase tracking-wide font-semibold mb-3">Assigned Projects</p>
              {selected.projectIds.length === 0 ? (
                <p className="text-slate-500 text-sm">No projects assigned</p>
              ) : (
                <div className="space-y-2">
                  {selected.projectIds.map((pid) => {
                    const proj = projects.find((p) => p.id === pid)
                    return proj ? (
                      <div key={pid} className="flex items-center gap-2 bg-slate-800 rounded-lg px-3 py-2">
                        <div className="w-2 h-2 rounded-full bg-blue-400 flex-shrink-0" />
                        <span className="text-sm text-slate-200">{proj.name}</span>
                      </div>
                    ) : null
                  })}
                </div>
              )}
            </div>
          </div>
        ) : (
          <EmptyState label="Select a member or add one" />
        )}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────
// Sub-panel: Projects
// ─────────────────────────────────────────────────────────────────
function ProjectsPanel() {
  const { projects, members, addProject, updateProject, deleteProject } = useAppStore()
  const [selectedId, setSelectedId] = useState<string | null>(projects[0]?.id ?? null)
  const [editing, setEditing] = useState<Project | null>(null)
  const [isNew, setIsNew] = useState(false)

  const selected = projects.find((p) => p.id === selectedId) ?? null

  const startEdit = (p: Project) => { setEditing({ ...p }); setIsNew(false) }
  const startNew  = () => { const p = newProject(); setEditing(p); setIsNew(true) }
  const cancel    = () => { setEditing(null); setIsNew(false) }

  const save = () => {
    if (!editing || !editing.name.trim()) return
    if (isNew) { addProject(editing); setSelectedId(editing.id) }
    else        { updateProject(editing); setSelectedId(editing.id) }
    setEditing(null); setIsNew(false)
  }

  const handleDelete = (id: string) => {
    if (!confirm('Delete this project? Tasks assigned to it will still exist.')) return
    deleteProject(id)
    setSelectedId(projects.find((p) => p.id !== id)?.id ?? null)
  }

  const projectMembers = (pid: string) => members.filter((m) => m.projectIds.includes(pid))

  return (
    <div className="flex flex-1 overflow-hidden">
      {/* List */}
      <div className="w-56 flex flex-col border-r border-slate-800 bg-slate-900/50">
        <div className="flex-1 overflow-y-auto px-2 py-2 space-y-1">
          {projects.map((p) => (
            <button key={p.id} onClick={() => { setSelectedId(p.id); setEditing(null) }}
              className={`w-full text-left px-3 py-2.5 rounded-xl border transition-all ${selectedId === p.id && !editing ? 'bg-emerald-600/20 border-emerald-600/40' : 'hover:bg-slate-800 border-transparent'}`}>
              <div className="text-sm font-medium text-slate-200 truncate">{p.name}</div>
              <div className="text-xs text-slate-500 mt-0.5">{projectMembers(p.id).length} members</div>
            </button>
          ))}
          {projects.length === 0 && <p className="text-slate-500 text-xs text-center py-6">No projects</p>}
        </div>
        <div className="p-2 border-t border-slate-800">
          <button onClick={startNew} className="w-full flex items-center justify-center gap-2 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
            New Project
          </button>
        </div>
      </div>

      {/* Detail */}
      <div className="flex-1 overflow-y-auto p-6">
        {editing ? (
          <div className="max-w-xl">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-bold text-white">{isNew ? 'New Project' : 'Edit Project'}</h3>
              <div className="flex gap-2">
                <button onClick={cancel} className="px-4 py-2 rounded-xl border border-slate-700 text-slate-300 hover:bg-slate-800 text-sm transition-colors">Cancel</button>
                <button onClick={save}   className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold transition-colors">Save</button>
              </div>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Project Name *</label>
                <input autoFocus type="text" value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} placeholder="e.g. Building A Renovation"
                  className="w-full bg-slate-800 text-slate-100 placeholder-slate-500 rounded-xl px-4 py-2.5 border border-slate-700 focus:outline-none focus:border-emerald-500 text-sm transition-colors" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Description</label>
                <textarea value={editing.description} onChange={(e) => setEditing({ ...editing, description: e.target.value })} placeholder="Brief description of the project" rows={3}
                  className="w-full bg-slate-800 text-slate-100 placeholder-slate-500 rounded-xl px-4 py-2.5 border border-slate-700 focus:outline-none focus:border-emerald-500 text-sm transition-colors resize-none" />
              </div>
              <p className="text-xs text-slate-500">To assign members to this project, go to the Members tab and edit each member.</p>
            </div>
          </div>
        ) : selected ? (
          <div className="max-w-xl">
            <div className="flex items-start justify-between mb-5">
              <div>
                <h3 className="text-xl font-bold text-white">{selected.name}</h3>
                {selected.description && <p className="text-slate-400 text-sm mt-1">{selected.description}</p>}
              </div>
              <div className="flex gap-2">
                <button onClick={() => startEdit(selected)} className="px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-slate-300 hover:bg-slate-700 text-xs font-medium transition-colors">Edit</button>
                <button onClick={() => handleDelete(selected.id)} className="px-3 py-1.5 rounded-lg bg-red-900/30 border border-red-900/40 text-red-400 hover:bg-red-900/60 text-xs font-medium transition-colors">Delete</button>
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between">
                <span className="text-sm font-semibold text-slate-300">Team Members</span>
                <span className="text-xs text-slate-500">{projectMembers(selected.id).length} assigned</span>
              </div>
              {projectMembers(selected.id).length === 0 ? (
                <div className="px-4 py-6 text-center text-slate-500 text-sm">No members assigned yet</div>
              ) : (
                <ul className="divide-y divide-slate-800">
                  {projectMembers(selected.id).map((m) => (
                    <li key={m.id} className="flex items-center gap-3 px-4 py-3">
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${m.role === 'admin' ? 'bg-purple-600/30 text-purple-300' : m.role === 'manager' ? 'bg-blue-600/30 text-blue-300' : 'bg-green-600/30 text-green-300'}`}>
                        {m.name.charAt(0)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-slate-200">{m.name}</div>
                        <div className="text-xs text-slate-500">{m.email}</div>
                      </div>
                      <span className={`text-xs px-2 py-0.5 rounded-full border font-semibold ${ROLE_BADGE[m.role]}`}>{m.role}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        ) : (
          <EmptyState label="Select a project or create one" />
        )}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────
// Shared empty state
// ─────────────────────────────────────────────────────────────────
function EmptyState({ label }: { label: string }) {
  return (
    <div className="flex items-center justify-center h-full">
      <p className="text-slate-500 text-sm">{label}</p>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────
// Main AdminPage
// ─────────────────────────────────────────────────────────────────
export default function AdminPage() {
  const navigate = useNavigate()
  const currentUser = useAppStore((s) => s.currentUser)
  const [tab, setTab] = useState<Tab>('templates')

  if (!currentUser || currentUser.role !== 'admin') {
    navigate('/home')
    return null
  }

  const TABS: { key: Tab; label: string; color: string; activeClass: string }[] = [
    { key: 'templates', label: 'Templates', color: 'text-purple-400', activeClass: 'border-purple-500 text-purple-300 bg-purple-900/20' },
    { key: 'members',   label: 'Members',   color: 'text-blue-400',   activeClass: 'border-blue-500 text-blue-300 bg-blue-900/20' },
    { key: 'projects',  label: 'Projects',  color: 'text-emerald-400',activeClass: 'border-emerald-500 text-emerald-300 bg-emerald-900/20' },
  ]

  return (
    <div className="flex h-screen bg-slate-950 overflow-hidden flex-col">
      {/* Top nav */}
      <header className="flex items-center gap-4 px-6 py-3 border-b border-slate-800 bg-slate-900 flex-shrink-0">
        <button onClick={() => navigate('/home')} className="text-slate-400 hover:text-white transition-colors">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
        </button>
        <h1 className="text-white font-bold">Admin</h1>
        <span className="text-xs bg-purple-900/50 text-purple-300 px-2 py-0.5 rounded-full border border-purple-800/40">Admin only</span>

        <div className="flex items-center gap-1 ml-6 bg-slate-800 rounded-xl p-1">
          {TABS.map((t) => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-all border ${tab === t.key ? t.activeClass : 'border-transparent text-slate-400 hover:text-slate-200'}`}>
              {t.label}
            </button>
          ))}
        </div>
      </header>

      {/* Tab content */}
      <div className="flex flex-1 overflow-hidden">
        {tab === 'templates' && <TemplatesPanel />}
        {tab === 'members'   && <MembersPanel />}
        {tab === 'projects'  && <ProjectsPanel />}
      </div>
    </div>
  )
}
