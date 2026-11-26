import AppHeader from '../components/AppHeader'
import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useAppStore } from '../store'
import BmsPanel from './BmsPanel'
import WorkflowPanel from './WorkflowPanel'
import type { AppUser, Project, UserRole } from '../types'
import { canAdministerSystem, roleChip, ROLE_LABEL } from '../access'

// ─────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────
type Tab = 'members' | 'projects' | 'bms' | 'workflow'

const ROLE_BADGE: Record<UserRole, string> = {
  it:       'bg-ink text-white border-ink',
  manager:  'bg-coral-tint text-coral-dark border-coral/30',
  engineer: 'bg-green-100 text-green-700 border-green-500/30',
}

function newProject(): Project {
  return { id: `p-${Date.now()}`, name: '', code: '', description: '' }
}

// ─────────────────────────────────────────────────────────────────
// Sub-panel: Members — IT's overview. Project admins add and remove their own members.
// ─────────────────────────────────────────────────────────────────
function MembersPanel() {
  const { members, projects } = useAppStore()
  const [search, setSearch] = useState('')
  const projectNames = (m: AppUser) => projects.filter((p) => m.projectIds.includes(p.id))
  const shown = members.filter((m) => `${m.name} ${m.email} ${m.team ?? ''} ${ROLE_LABEL[m.role]} ${projectNames(m).map((p) => p.name).join(' ')}`.toLowerCase().includes(search.trim().toLowerCase()))

  return (
    <div className="flex-1 overflow-y-auto px-10 pb-10">
      <div className="max-w-5xl mx-auto space-y-3">
        <div className="flex items-center gap-3 flex-wrap">
          <p className="text-sm text-slate-400 flex-1">Overview only. Each project's admin adds and removes its members.</p>
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search people or projects…"
            className="w-72 px-4 py-1.5 rounded-full bg-slate-800 text-sm text-ink placeholder-slate-500 focus:outline-none focus:bg-white focus:ring-1 focus:ring-ink" />
        </div>
        <div className="border border-slate-800 rounded-3xl overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-900">
              <tr>{['Member', 'Role', 'Team', 'Projects'].map((h) => <th key={h} className="text-left px-4 py-2.5 text-[11px] font-bold uppercase tracking-wide text-slate-400">{h}</th>)}</tr>
            </thead>
            <tbody>
              {shown.map((m) => (
                <tr key={m.id} className="border-t border-slate-800">
                  <td className="px-4 py-3"><p className="font-semibold text-ink">{m.name}</p><p className="text-xs text-slate-500">{m.email}</p></td>
                  <td className="px-4 py-3"><span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${roleChip(m.role)}`}>{ROLE_LABEL[m.role]}</span></td>
                  <td className="px-4 py-3 text-slate-300">{m.team ?? '—'}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1.5">
                      {m.role === 'it' ? <span className="text-slate-500">All projects</span> : projectNames(m).map((p) => (
                        <span key={p.id} className={`text-xs px-2 py-0.5 rounded-full ${p.adminId === m.id ? 'bg-ink text-white font-semibold' : 'bg-slate-800 text-slate-300'}`}>{p.name}{p.adminId === m.id ? ' · admin' : ''}</span>
                      ))}
                      {m.role !== 'it' && projectNames(m).length === 0 && <span className="text-slate-500">None</span>}
                    </div>
                  </td>
                </tr>
              ))}
              {shown.length === 0 && <tr><td colSpan={4} className="px-4 py-6 text-center text-slate-500">No one matches.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────
// Sub-panel: Projects
// ─────────────────────────────────────────────────────────────────
function ProjectsPanel() {
  const { projects, members, addMember, updateMember, addProject, updateProject, deleteProject } = useAppStore()
  const [selectedId, setSelectedId] = useState<string | null>(projects[0]?.id ?? null)
  const [editing, setEditing] = useState<Project | null>(null)
  const [isNew, setIsNew] = useState(false)
  // the project admin: someone already in the system, or a new person IT sets up
  const [admin, setAdmin] = useState({ id: '', name: '', email: '' })

  const selected = projects.find((p) => p.id === selectedId) ?? null

  const startEdit = (p: Project) => { setEditing({ ...p }); setIsNew(false); setAdmin({ id: p.adminId ?? '', name: '', email: '' }) }
  const startNew  = () => { const p = newProject(); setEditing(p); setIsNew(true); setAdmin({ id: '', name: '', email: '' }) }
  const cancel    = () => { setEditing(null); setIsNew(false) }

  const NEW_PERSON = 'new'
  const adminEmail = admin.email.trim().toLowerCase()
  const emailTaken = admin.id === NEW_PERSON && members.some((m) => m.email.toLowerCase() === adminEmail)
  const adminReady = admin.id === NEW_PERSON ? !!admin.name.trim() && /^\S+@\S+\.\S+$/.test(adminEmail) && !emailTaken : !!admin.id

  const save = () => {
    if (!editing || !editing.name.trim() || !adminReady) return
    let adminId = admin.id
    if (admin.id === NEW_PERSON) {
      adminId = `u-${Date.now()}`
      addMember({ id: adminId, email: adminEmail, name: admin.name.trim(), role: 'manager', team: 'Manager', projectIds: [editing.id] })
    } else {
      const person = members.find((m) => m.id === adminId)
      // a project admin manages the project, so they hold at least the Manager role and have access to it
      if (person) updateMember({ ...person, role: 'manager', projectIds: person.projectIds.includes(editing.id) ? person.projectIds : [...person.projectIds, editing.id] })
    }
    const project = { ...editing, adminId }
    if (isNew) addProject(project)
    else updateProject(project)
    setSelectedId(editing.id)
    setEditing(null); setIsNew(false)
  }

  const handleDelete = (id: string) => {
    if (!confirm('Delete this project? ITPs assigned to it will still exist.')) return
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
              className={`w-full text-left px-3 py-2.5 rounded-xl border transition-all ${selectedId === p.id && !editing ? 'bg-slate-800 border-slate-700' : 'hover:bg-slate-800 border-transparent'}`}>
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
              <h3 className="text-lg font-bold text-ink">{isNew ? 'New Project' : 'Edit Project'}</h3>
              <div className="flex gap-2">
                <button onClick={cancel} className="px-4 py-2 rounded-xl border border-slate-700 text-slate-300 hover:bg-slate-800 text-sm transition-colors">Cancel</button>
                <button onClick={save} disabled={!editing.name.trim() || !adminReady} className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white text-sm font-semibold transition-colors">Save</button>
              </div>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Project Name *</label>
                <input autoFocus type="text" value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} placeholder="e.g. Building A Renovation"
                  className="w-full bg-slate-800 text-slate-100 placeholder-slate-500 rounded-xl px-4 py-2.5 border border-slate-700 focus:outline-none focus:border-emerald-500 text-sm transition-colors" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Project code</label>
                <input type="text" value={editing.code ?? ''} onChange={(e) => setEditing({ ...editing, code: e.target.value.toUpperCase() })} placeholder="e.g. BLD-A"
                  className="w-full bg-slate-800 text-slate-100 placeholder-slate-500 rounded-xl px-4 py-2.5 border border-slate-700 focus:outline-none focus:border-emerald-500 text-sm transition-colors font-mono" />
                <p className="text-xs text-slate-500 mt-1">Short code people type on their timesheet to log time against this project.</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Description</label>
                <textarea value={editing.description} onChange={(e) => setEditing({ ...editing, description: e.target.value })} placeholder="Brief description of the project" rows={3}
                  className="w-full bg-slate-800 text-slate-100 placeholder-slate-500 rounded-xl px-4 py-2.5 border border-slate-700 focus:outline-none focus:border-emerald-500 text-sm transition-colors resize-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Project admin *</label>
                <select value={admin.id} onChange={(e) => setAdmin({ ...admin, id: e.target.value })}
                  className="w-full bg-slate-800 text-slate-100 rounded-xl px-4 py-2.5 border border-slate-700 focus:outline-none text-sm">
                  <option value="">Choose who controls access to this project…</option>
                  {members.filter((m) => m.role !== 'it').map((m) => <option key={m.id} value={m.id}>{m.name} — {m.email}</option>)}
                  <option value={NEW_PERSON}>+ Someone new</option>
                </select>
                {admin.id === NEW_PERSON && (
                  <div className="grid grid-cols-2 gap-3 mt-2">
                    <input value={admin.name} onChange={(e) => setAdmin({ ...admin, name: e.target.value })} placeholder="Full name"
                      className="w-full bg-slate-800 text-slate-100 placeholder-slate-500 rounded-xl px-4 py-2.5 border border-slate-700 focus:outline-none text-sm" />
                    <input type="email" value={admin.email} onChange={(e) => setAdmin({ ...admin, email: e.target.value })} placeholder="Email"
                      className="w-full bg-slate-800 text-slate-100 placeholder-slate-500 rounded-xl px-4 py-2.5 border border-slate-700 focus:outline-none text-sm" />
                  </div>
                )}
                {emailTaken && <p className="text-xs text-red-600 mt-1">That email is already in the system. Choose the person from the list.</p>}
                <p className="text-xs text-slate-500 mt-1">The project admin is given the Manager role, and adds and removes the project's members.</p>
              </div>
            </div>
          </div>
        ) : selected ? (
          <div className="max-w-xl">
            <div className="flex items-start justify-between mb-5">
              <div>
                <h3 className="text-xl font-bold text-ink flex items-center gap-2">{selected.name}{selected.code && <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded-full bg-slate-800 text-slate-300">{selected.code}</span>}</h3>
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
              {!members.some((m) => m.id === selected.adminId) && <p className="px-4 py-3 text-sm text-amber-700 bg-amber-50">No project admin yet. Edit the project to appoint one.</p>}
              {projectMembers(selected.id).length === 0 ? (
                <div className="px-4 py-6 text-center text-slate-500 text-sm">No members assigned yet</div>
              ) : (
                <ul className="divide-y divide-slate-800">
                  {projectMembers(selected.id).map((m) => (
                    <li key={m.id} className="flex items-center gap-3 px-4 py-3">
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${roleChip(m.role)}`}>
                        {m.name.charAt(0)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-slate-200">{m.name}{m.id === selected.adminId && <span className="ml-2 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-ink text-white">Project admin</span>}</div>
                        <div className="text-xs text-slate-500">{m.email}</div>
                      </div>
                      <span className={`text-xs px-2 py-0.5 rounded-full border font-semibold ${ROLE_BADGE[m.role]}`}>{ROLE_LABEL[m.role]}</span>
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
  const currentUser = useAppStore((s) => s.currentUser)
  const [tab, setTab] = useState<Tab>('bms')

  // IT only; anyone else is sent home
  if (!currentUser || !canAdministerSystem(currentUser)) return <Navigate to={currentUser ? '/home' : '/'} replace />

  const TABS: { key: Tab; label: string }[] = [
    { key: 'projects', label: 'Projects' },
    { key: 'members',  label: 'Members' },
    { key: 'bms',      label: 'BMS Core Library' },
    { key: 'workflow', label: 'Workflow' },
  ]

  return (
    <div className="flex h-full bg-white overflow-hidden flex-col">
      <AppHeader active="admin" />

      {/* IT sections */}
      <div className="px-10 pt-1 pb-3 grid grid-cols-[1fr_auto_1fr] items-center gap-3 flex-shrink-0">
        <h1 className="text-2xl font-medium tracking-tight text-ink justify-self-start">IT</h1>
        <div className="flex items-center gap-1 bg-slate-800 rounded-full p-0.5">
          {TABS.map((t) => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${tab === t.key ? 'bg-ink text-white' : 'text-slate-300 hover:text-ink hover:bg-white'}`}>
              {t.label}
            </button>
          ))}
        </div>
        <div />
      </div>

      {/* Tab content */}
      <div className="flex flex-1 overflow-hidden">
        {tab === 'members'   && <MembersPanel />}
        {tab === 'projects'  && <ProjectsPanel />}
        {tab === 'bms'       && <BmsPanel />}
        {tab === 'workflow'  && <WorkflowPanel />}
      </div>
    </div>
  )
}
