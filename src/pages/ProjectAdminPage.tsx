import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useAppStore } from '../store'
import AppHeader from '../components/AppHeader'
import { isProjectAdmin, roleChip, roleChipSelected, roleIn, ROLE_DESCRIPTION, ROLE_LABEL } from '../access'
import PermissionsGrid from '../components/PermissionsGrid'
import { TEAM_OPTIONS } from '../teams'
import type { AppUser, ProjectRole, TeamType } from '../types'

// The project admin (appointed by IT) controls who has access to their project.
// They add people, set what each one can do, and take access away.
const PROJECT_ROLES: ProjectRole[] = ['manager', 'engineer']

interface Draft { id: string | null; email: string; name: string; role: ProjectRole; team?: TeamType }
const blank: Draft = { id: null, email: '', name: '', role: 'engineer' }

const input = 'w-full bg-white border border-slate-700 rounded-2xl px-3 py-2.5 text-sm text-ink placeholder-slate-500 focus:outline-none focus:border-ink disabled:bg-slate-900 disabled:text-slate-500'

export default function ProjectAdminPage() {
  const { currentUser, currentProjectId, projects, members, tasks, addMember, updateMember, updateProject, setMemberRole } = useAppStore()
  const [draft, setDraft] = useState<Draft | null>(null)
  const [search, setSearch] = useState('')
  const [notice, setNotice] = useState('')
  const [view, setView] = useState<'members' | 'permissions'>('members')

  if (!currentUser) return <Navigate to="/" replace />
  const project = projects.find((p) => p.id === currentProjectId)
  if (!project || !isProjectAdmin(currentUser, project)) return <Navigate to="/home" replace />

  const team = members.filter((m) => m.role !== 'it' && m.projectIds.includes(project.id))
  const shown = team.filter((m) => `${m.name} ${m.email} ${m.team ?? ''} ${ROLE_LABEL[roleIn(project, m)]}`.toLowerCase().includes(search.trim().toLowerCase()))

  // work in this project still assigned to someone
  const openWork = (m: AppUser) => {
    const mine = tasks.filter((t) => t.projectId === project.id)
    return {
      itps: mine.filter((t) => t.assignedTo === m.email && t.status !== 'completed').length,
      checklists: mine.flatMap((t) => t.checklists).filter((c) => c.assignedTo === m.email && !c.items.every((i) => i.completed)).length,
      snags: mine.flatMap((t) => t.inspections ?? []).flatMap((i) => i.issues).filter((i) => i.assignedTo === m.email && i.status !== 'closed').length,
    }
  }

  // adding: an email already in the system means that person is given access, not created again
  const email = draft?.email.trim().toLowerCase() ?? ''
  const existing = draft && !draft.id ? members.find((m) => m.email.toLowerCase() === email) : undefined
  const editingPerson = draft?.id ? members.find((m) => m.id === draft.id) : undefined
  // name, role and team belong to the person, so they can only be changed here if this is their only project
  const shared = !!editingPerson && editingPerson.projectIds.some((id) => id !== project.id)
  const isSelfAdmin = draft?.id === project.adminId

  const problem = !draft ? ''
    : existing ? (existing.role === 'it' ? 'That is an IT account. IT accounts are not added to project teams.' : existing.projectIds.includes(project.id) ? `${existing.name} is already on this project.` : '')
    : !draft.id && email && !/^\S+@\S+\.\S+$/.test(email) ? 'Enter a valid email address.' : ''
  const canSave = !!draft && !problem && (existing || shared ? true : !!email && !!draft.name.trim() && !!draft.team)

  const save = () => {
    if (!draft || !canSave) return
    if (existing) {
      updateMember({ ...existing, projectIds: [...existing.projectIds, project.id] })
      setMemberRole(project.id, existing.id, draft.role, currentUser.name)
      setNotice(`${existing.name} now has access to ${project.name}.`)
    } else if (editingPerson) {
      if (!shared) updateMember({ ...editingPerson, name: draft.name.trim(), team: draft.team })
      // changing the role applies that role's preset on this project
      if (!isSelfAdmin && draft.role !== roleIn(project, editingPerson)) setMemberRole(project.id, editingPerson.id, draft.role, currentUser.name)
      setNotice(`${draft.name.trim()} updated.`)
    } else {
      const id = `u-${Date.now()}`
      addMember({ id, email, name: draft.name.trim(), role: draft.role, team: draft.team, projectIds: [project.id] })
      setMemberRole(project.id, id, draft.role, currentUser.name)
      setNotice(`${draft.name.trim()} added to ${project.name}.`)
    }
    setDraft(null)
  }

  const remove = (m: AppUser) => {
    const w = openWork(m)
    const left = [w.itps && `${w.itps} open ITP(s)`, w.checklists && `${w.checklists} unfinished checklist(s)`, w.snags && `${w.snags} open snag(s)`].filter(Boolean).join(', ')
    if (!window.confirm(`Remove ${m.name}'s access to ${project.name}?${left ? `\n\nStill assigned to them: ${left}. These stay assigned until you reassign them.` : ''}`)) return
    updateMember({ ...m, projectIds: m.projectIds.filter((id) => id !== project.id) })
    const { [m.id]: _r, ...roles } = project.roles ?? {}
    const { [m.id]: _p, ...permissions } = project.permissions ?? {}
    updateProject({ ...project, roles, permissions })
    setNotice(`${m.name} no longer has access to ${project.name}. Their name stays on past records.`)
  }

  return (
    <div className="flex flex-col h-full bg-white overflow-hidden">
      <AppHeader active="team" />
      <div className="flex-1 overflow-y-auto px-10 pb-10">
        <div className="max-w-5xl mx-auto pt-1">
          <div className="flex items-center gap-3 flex-wrap pb-3">
            <h1 className="text-2xl font-medium tracking-tight text-ink">Admin</h1>
            <div className="flex items-center gap-0.5 bg-slate-800 rounded-full p-0.5">
              {(['members', 'permissions'] as const).map((v) => (
                <button key={v} onClick={() => { setView(v); setDraft(null) }}
                  className={`px-4 py-1.5 rounded-full text-sm font-medium capitalize ${view === v ? 'bg-ink text-white' : 'text-slate-300 hover:text-ink hover:bg-white'}`}>{v}</button>
              ))}
            </div>
            <p className="text-sm text-slate-400 flex-1 min-w-0 truncate"><span className="text-slate-200 font-medium">{project.name}</span></p>
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search members…"
              className="w-64 px-4 py-1.5 rounded-full bg-slate-800 text-sm text-ink placeholder-slate-500 focus:outline-none focus:bg-white focus:ring-1 focus:ring-ink" />
            {view === 'members' && <button onClick={() => { setDraft({ ...blank }); setNotice('') }} className="px-4 py-1.5 rounded-full bg-ink hover:bg-ink-soft text-white text-sm font-semibold">+ Add member</button>}
          </div>

          {notice && (
            <div className="mb-4 rounded-2xl bg-green-50 border border-green-100 px-4 py-3 text-sm text-green-700 flex items-center gap-3">
              <span className="flex-1">{notice}</span><button onClick={() => setNotice('')}>✕</button>
            </div>
          )}

          {draft && (
            <div className="mb-4 rounded-3xl border border-ink shadow-float px-5 py-4 space-y-3">
              <h2 className="text-sm font-bold text-ink">{draft.id ? `Edit ${editingPerson?.name}` : 'Add a member to this project'}</h2>
              <div className="grid grid-cols-2 gap-3">
                <input autoFocus className={input} type="email" placeholder="Email" value={draft.email} disabled={!!draft.id} onChange={(e) => setDraft({ ...draft, email: e.target.value })} />
                <input className={input} placeholder="Full name" value={existing ? existing.name : draft.name} disabled={!!existing || shared} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
              </div>
              {existing && !problem && <p className="text-sm text-slate-300">{existing.name} is already in the system. Adding gives them access to this project.</p>}
              {shared && <p className="text-sm text-slate-400">This person is also on other projects, so their name and team are shared and can't be changed here. Their role is set per project.</p>}
              {!problem && (
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-semibold text-slate-500 w-12">Role</span>
                  {PROJECT_ROLES.map((r) => (
                    <button key={r} onClick={() => setDraft({ ...draft, role: r })} disabled={isSelfAdmin}
                      className={`px-4 py-1.5 rounded-full border text-sm font-semibold disabled:opacity-50 ${draft.role === r ? roleChipSelected(r) : 'border-slate-700 text-slate-400'}`}>{ROLE_LABEL[r]}</button>
                  ))}
                  <span className="text-xs text-slate-500">{isSelfAdmin ? 'As project admin you have every permission.' : ROLE_DESCRIPTION[draft.role]}</span>
                </div>
              )}
              {!existing && !shared && (
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-semibold text-slate-500 w-12">Team</span>
                  {TEAM_OPTIONS.map((t) => (
                    <button key={t} onClick={() => setDraft({ ...draft, team: t })}
                      className={`px-3 py-1.5 rounded-full border text-sm ${draft.team === t ? 'bg-ink border-ink text-white' : 'border-slate-700 text-slate-400'}`}>{t}</button>
                  ))}
                </div>
              )}
              {problem && <p className="text-sm text-red-600">{problem}</p>}
              <div className="flex gap-2">
                <button onClick={save} disabled={!canSave} className="px-5 py-2 rounded-full bg-ink hover:bg-ink-soft disabled:opacity-40 text-white text-sm font-semibold">{existing ? 'Give access' : draft.id ? 'Save changes' : 'Add member'}</button>
                <button onClick={() => setDraft(null)} className="px-4 py-2 rounded-full bg-slate-800 text-slate-200 text-sm font-semibold">Cancel</button>
              </div>
            </div>
          )}

          {view === 'permissions' ? <PermissionsGrid project={project} team={shown} /> : <>
          <div className="border border-slate-800 rounded-3xl overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-900">
                <tr>{['Member', 'Role', 'Team', 'Open ITPs', 'Signature', ''].map((h) => <th key={h} className="text-left px-4 py-2.5 text-[11px] font-bold uppercase tracking-wide text-slate-400">{h}</th>)}</tr>
              </thead>
              <tbody>
                {shown.map((m) => (
                  <tr key={m.id} className="border-t border-slate-800">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${roleChip(roleIn(project, m))}`}>{m.name.charAt(0).toUpperCase()}</div>
                        <div className="min-w-0">
                          <p className="font-semibold text-ink">{m.name}{m.id === project.adminId && <span className="ml-2 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-ink text-white">Project admin</span>}</p>
                          <p className="text-xs text-slate-500">{m.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3"><span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${roleChip(roleIn(project, m))}`}>{ROLE_LABEL[roleIn(project, m)]}</span></td>
                    <td className="px-4 py-3 text-slate-300">{m.team ?? '—'}</td>
                    <td className="px-4 py-3 text-slate-300">{openWork(m).itps}</td>
                    <td className="px-4 py-3 text-xs font-semibold">{m.signature ? <span className="text-green-700">Stored</span> : <span className="text-amber-700">Pending</span>}</td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <button onClick={() => { setDraft({ id: m.id, email: m.email, name: m.name, role: roleIn(project, m) === 'engineer' ? 'engineer' : 'manager', team: m.team }); setNotice('') }} className="text-xs font-semibold text-coral-dark hover:underline">Edit</button>
                      {m.id !== project.adminId && <button onClick={() => remove(m)} className="ml-4 text-xs font-semibold text-red-600 hover:underline">Remove</button>}
                    </td>
                  </tr>
                ))}
                {shown.length === 0 && <tr><td colSpan={6} className="px-4 py-6 text-center text-slate-500">No members match.</td></tr>}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs text-slate-500">{team.length} member{team.length === 1 ? '' : 's'}. Removing someone takes away access to this project only.</p>
          </>}
        </div>
      </div>
    </div>
  )
}
