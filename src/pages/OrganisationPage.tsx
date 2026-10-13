import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppStore } from '../store'
import AppHeader from '../components/AppHeader'
import { isManager } from '../workflow'
import type { AppUser, ProjectOrgEntry } from '../types'

// The people on a project laid out as an organisation chart. Everyone sees the chart;
// managers and admins can set each person's title and who they report to.
const ROLE_LABEL: Record<AppUser['role'], string> = { admin: 'Administrator', manager: 'Manager', engineer: 'Engineer' }
const ROLE_CHIP: Record<AppUser['role'], string> = {
  admin: 'bg-ink text-white', manager: 'bg-coral-tint text-coral-dark', engineer: 'bg-green-100 text-green-700',
}
const ROLE_ORDER: Record<AppUser['role'], number> = { admin: 0, manager: 1, engineer: 2 }

interface OrgNode { member: AppUser; title: string; reportsToId: string | null; children: OrgNode[] }

/** Where a member sits when nobody has set it: admins on top, managers under an admin, engineers under a manager */
function defaultParent(m: AppUser, team: AppUser[]): string | null {
  if (m.role === 'admin') return null
  if (m.role === 'manager') return team.find((t) => t.role === 'admin')?.id ?? null
  return (team.find((t) => t.role === 'manager' && t.id !== m.id) ?? team.find((t) => t.role === 'admin'))?.id ?? null
}

function buildTree(team: AppUser[], entries: ProjectOrgEntry[]): { roots: OrgNode[]; parentOf: Record<string, string | null> } {
  const ids = new Set(team.map((m) => m.id))
  const raw: Record<string, string | null> = {}
  for (const m of team) {
    const e = entries.find((x) => x.memberId === m.id)
    const parent = e ? e.reportsToId : defaultParent(m, team)
    raw[m.id] = parent && ids.has(parent) && parent !== m.id ? parent : null
  }
  // break any reporting loop by lifting the member to the top
  const parentOf: Record<string, string | null> = { ...raw }
  for (const m of team) {
    const seen = new Set<string>([m.id]); let cur = parentOf[m.id]
    while (cur) { if (seen.has(cur)) { parentOf[m.id] = null; break } seen.add(cur); cur = parentOf[cur] ?? null }
  }
  const nodes: Record<string, OrgNode> = {}
  for (const m of team) {
    const e = entries.find((x) => x.memberId === m.id)
    nodes[m.id] = { member: m, title: e?.title || ROLE_LABEL[m.role], reportsToId: parentOf[m.id], children: [] }
  }
  const sort = (a: OrgNode, b: OrgNode) => ROLE_ORDER[a.member.role] - ROLE_ORDER[b.member.role] || a.member.name.localeCompare(b.member.name)
  const roots: OrgNode[] = []
  for (const m of team) {
    const n = nodes[m.id]
    if (n.reportsToId) nodes[n.reportsToId].children.push(n); else roots.push(n)
  }
  Object.values(nodes).forEach((n) => n.children.sort(sort))
  return { roots: roots.sort(sort), parentOf }
}

function descendantsOf(id: string, parentOf: Record<string, string | null>): Set<string> {
  const out = new Set<string>()
  let grew = true
  while (grew) {
    grew = false
    for (const [child, parent] of Object.entries(parentOf)) {
      if (!out.has(child) && parent && (parent === id || out.has(parent))) { out.add(child); grew = true }
    }
  }
  return out
}

export default function OrganisationPage() {
  const navigate = useNavigate()
  const { currentUser, currentProjectId, projects, members, tasks, projectOrg, setProjectOrgEntry } = useAppStore()
  const [adminProjectId, setAdminProjectId] = useState(projects[0]?.id ?? '')
  const [editing, setEditing] = useState(false)

  const isAdmin = currentUser?.role === 'admin'
  const projectId = isAdmin ? adminProjectId : (currentProjectId ?? '')
  const project = projects.find((p) => p.id === projectId)
  const team = useMemo(() => members.filter((m) => m.projectIds.includes(projectId)), [members, projectId])
  const entries = useMemo(() => projectOrg.filter((e) => e.projectId === projectId), [projectOrg, projectId])
  const { roots, parentOf } = useMemo(() => buildTree(team, entries), [team, entries])

  if (!currentUser) { navigate('/'); return null }
  const canEdit = isManager(currentUser)

  const taskCount = (m: AppUser) => tasks.filter((t) => t.projectId === projectId && t.assignedTo === m.email && t.status !== 'completed').length
  const count = (role: AppUser['role']) => team.filter((m) => m.role === role).length

  const renderCard = (n: OrgNode) => {
    const m = n.member
    const blocked = descendantsOf(m.id, parentOf)
    const open = taskCount(m)
    return (
      <div className={`w-[230px] bg-white border rounded-3xl p-4 text-left shadow-sm ${m.id === currentUser.id ? 'border-ink' : 'border-slate-700'}`}>
        <div className="flex items-center gap-3">
          <div className={`w-11 h-11 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${ROLE_CHIP[m.role]}`}>{m.name.charAt(0).toUpperCase()}</div>
          <div className="min-w-0">
            <p className="text-sm font-bold text-ink truncate">{m.name}</p>
            <p className="text-xs text-slate-400 truncate">{n.title}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 mt-3 flex-wrap">
          <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${ROLE_CHIP[m.role]}`}>{ROLE_LABEL[m.role]}</span>
          {m.id === currentUser.id && <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-slate-800 text-slate-300">You</span>}
          <span className="text-[11px] text-slate-500">{open} open task{open === 1 ? '' : 's'}</span>
          {n.children.length > 0 && <span className="text-[11px] text-slate-500">· {n.children.length} report{n.children.length === 1 ? '' : 's'}</span>}
        </div>
        <p className="text-[11px] text-slate-500 mt-1.5 truncate">{m.email}</p>

        {editing && canEdit && (
          <div className="mt-3 pt-3 border-t border-slate-800 space-y-2">
            <input value={entries.find((e) => e.memberId === m.id)?.title ?? n.title} placeholder="Title"
              onChange={(e) => setProjectOrgEntry(projectId, m.id, { title: e.target.value, reportsToId: n.reportsToId })}
              className="w-full bg-slate-900 border border-slate-700 rounded-full px-3 py-1.5 text-xs text-ink focus:outline-none focus:border-ink" />
            <select value={n.reportsToId ?? ''} onChange={(e) => setProjectOrgEntry(projectId, m.id, { title: n.title, reportsToId: e.target.value || null })}
              className="w-full bg-slate-900 border border-slate-700 rounded-full px-3 py-1.5 text-xs text-slate-300 focus:outline-none">
              <option value="">Top of the chart</option>
              {team.filter((t) => t.id !== m.id && !blocked.has(t.id)).map((t) => <option key={t.id} value={t.id}>Reports to {t.name}</option>)}
            </select>
          </div>
        )}
      </div>
    )
  }

  const renderBranch = (n: OrgNode): JSX.Element => (
    <li key={n.member.id}>
      {renderCard(n)}
      {n.children.length > 0 && <ul>{n.children.map(renderBranch)}</ul>}
    </li>
  )

  return (
    <div className="flex flex-col h-full bg-white overflow-hidden">
      <AppHeader active="organisation" />

      <div className="px-10 pt-6 pb-4 flex items-end justify-between gap-4 flex-wrap flex-shrink-0">
        <div>
          <h1 className="text-4xl font-normal tracking-tight text-ink">Project Organisation</h1>
          <p className="text-slate-400 mt-1">The team {project ? <>on <span className="text-slate-200 font-medium">{project.name}</span></> : ''} and how it fits together</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {isAdmin && (
            <select value={projectId} onChange={(e) => setAdminProjectId(e.target.value)}
              className="px-4 py-2.5 rounded-full bg-slate-800 text-sm font-medium text-slate-200 focus:outline-none">
              {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          )}
          {canEdit && (
            <button onClick={() => setEditing((v) => !v)}
              className={`px-5 py-2.5 rounded-full text-sm font-semibold transition-colors ${editing ? 'bg-ink text-white' : 'bg-slate-800 hover:bg-slate-700 text-slate-200'}`}>
              {editing ? 'Done editing' : 'Edit structure'}
            </button>
          )}
        </div>
      </div>

      {/* Team summary */}
      <div className="px-10 pb-4 grid grid-cols-2 lg:grid-cols-4 gap-4 flex-shrink-0">
        {[['Team size', team.length], ['Administrators', count('admin')], ['Managers', count('manager')], ['Engineers', count('engineer')]].map(([label, value]) => (
          <div key={label as string} className="bg-slate-900 border border-slate-800 rounded-3xl px-5 py-4">
            <p className="text-sm text-slate-400">{label}</p>
            <p className="text-3xl font-bold tracking-tight text-ink mt-1">{value}</p>
          </div>
        ))}
      </div>

      {editing && canEdit && (
        <p className="px-10 pb-2 text-xs text-slate-500 flex-shrink-0">Set each person's title and who they report to. Changes save straight away.</p>
      )}

      {/* Chart */}
      <div className="flex-1 overflow-auto border-t border-slate-800 bg-slate-900/50">
        {team.length === 0 ? (
          <p className="p-10 text-sm text-slate-500">{project ? 'No members are assigned to this project yet. Add them from Admin → Members.' : 'Select a project to see its organisation.'}</p>
        ) : (
          <div className="org-tree min-w-max px-10 py-10 flex justify-center">
            <ul>{roots.map(renderBranch)}</ul>
          </div>
        )}
      </div>
    </div>
  )
}
