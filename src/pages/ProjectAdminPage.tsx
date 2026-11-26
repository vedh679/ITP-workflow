import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useAppStore } from '../store'
import AppHeader from '../components/AppHeader'
import { canApproveIssue, isProjectAdmin, roleChip, roleChipSelected, ROLE_DESCRIPTION, ROLE_LABEL } from '../access'
import { TEAM_OPTIONS } from '../teams'
import type { AppUser, TeamType, UserRole } from '../types'

// The project admin (appointed by IT) controls who has access to their project.
// They add people, set what each one can do, and take access away.
const PROJECT_ROLES: UserRole[] = ['manager', 'engineer']

interface Draft { id: string | null; email: string; name: string; role: UserRole; team?: TeamType }
const blank: Draft = { id: null, email: '', name: '', role: 'engineer' }

const input = 'w-full bg-white border border-slate-700 rounded-2xl px-3 py-2.5 text-sm text-ink placeholder-slate-500 focus:outline-none focus:border-ink disabled:bg-slate-900 disabled:text-slate-500'

export default function ProjectAdminPage() {
  const { currentUser, currentProjectId, projects, members, tasks, addMember, updateMember, updateProject } = useAppStore()
  const [draft, setDraft] = useState<Draft | null>(null)
  const [search, setSearch] = useState('')
  const [notice, setNotice] = useState('')

  if (!currentUser) return <Navigate to="/" replace />
  const project = projects.find((p) => p.id === currentProjectId)
  if (!project || !isProjectAdmin(currentUser, project)) return <Navigate to="/home" replace />

  const team = members.filter((m) => m.role !== 'it' && m.projectIds.includes(project.id))
  const shown = team.filter((m) => `${m.name} ${m.email} ${m.team ?? ''} ${ROLE_LABEL[m.role]}`.toLowerCase().includes(search.trim().toLowerCase()))

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
  const canSave = !!draft && !problem && (existing ? true : !!email && !!draft.name.trim() && !!draft.team && !shared)

  const save = () => {
    if (!draft || !canSave) return
    if (existing) {
      updateMember({ ...existing, projectIds: [...existing.projectIds, project.id] })
      setNotice(`${existing.name} now has access to ${project.name}.`)
    } else if (editingPerson) {
      updateMember({ ...editingPerson, name: draft.name.trim(), role: isSelfAdmin ? editingPerson.role : draft.role, team: draft.team })
      setNotice(`${draft.name.trim()} updated.`)
    } else {
      addMember({ id: `u-${Date.now()}`, email, name: draft.name.trim(), role: draft.role, team: draft.team, projectIds: [project.id] })
      setNotice(`${draft.name.trim()} added to ${project.name}.`)
    }
    setDraft(null)
  }

  const remove = (m: AppUser) => {
    const w = openWork(m)
    const left = [w.itps && `${w.itps} open ITP(s)`, w.checklists && `${w.checklists} unfinished checklist(s)`, w.snags && `${w.snags} open snag(s)`].filter(Boolean).join(', ')
    if (!window.confirm(`Remove ${m.name}'s access to ${project.name}?${left ? `\n\nStill assigned to them: ${left}. These stay assigned until you reassign them.` : ''}`)) return
    updateMember({ ...m, projectIds: m.projectIds.filter((id) => id !== project.id) })
    updateProject({ ...project, approverIds: (project.approverIds ?? []).filter((id) => id !== m.id) })
    setNotice(`${m.name} no longer has access to ${project.name}. Their name stays on past records.`)
  }

  const setApprover = (m: AppUser, on: boolean) => {
    const others = (project.approverIds ?? []).filter((id) => id !== m.id)
    updateProject({ ...project, approverIds: on ? [...others, m.id] : others })
    setNotice(on ? `${m.name} can now approve and issue documents.` : `${m.name} can no longer approve and issue documents.`)
  }

  return (
    <div className="flex flex-col h-full bg-white overflow-hidden">
      <AppHeader active="team" />
      <div className="flex-1 overflow-y-auto px-10 pb-10">
        <div className="max-w-5xl mx-auto pt-1">
          <div className="flex items-center gap-3 flex-wrap pb-3">
            <h1 className="text-2xl font-medium tracking-tight text-ink">Admin</h1>
            <p className="text-sm text-slate-400 flex-1 min-w-0 truncate">Who has access to <span className="text-slate-200 font-medium">{project.name}</span></p>
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search members…"
              className="w-64 px-4 py-1.5 rounded-full bg-slate-800 text-sm text-ink placeholder-slate-500 focus:outline-none focus:bg-white focus:ring-1 focus:ring-ink" />
            <button onClick={() => { setDraft({ ...blank }); setNotice('') }} className="px-4 py-1.5 rounded-full bg-ink hover:bg-ink-soft text-white text-sm font-semibold">+ Add member</button>
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
              {existing ? (
                !problem && <p className="text-sm text-slate-300">{existing.name} is already in the system as {ROLE_LABEL[existing.role]}. Adding gives them access to this project.</p>
              ) : shared ? (
                <p className="text-sm text-slate-400">This person is also on other projects, so their name, role and team are shared and can't be changed from here.</p>
              ) : (
                <>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-semibold text-slate-500 w-12">Role</span>
                    {PROJECT_ROLES.map((r) => (
                      <button key={r} onClick={() => setDraft({ ...draft, role: r })} disabled={isSelfAdmin}
                        className={`px-4 py-1.5 rounded-full border text-sm font-semibold disabled:opacity-50 ${draft.role === r ? roleChipSelected(r) : 'border-slate-700 text-slate-400'}`}>{ROLE_LABEL[r]}</button>
                    ))}
                    <span className="text-xs text-slate-500">{isSelfAdmin ? 'As project admin you stay a Manager.' : ROLE_DESCRIPTION[draft.role]}</span>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-semibold text-slate-500 w-12">Team</span>
                    {TEAM_OPTIONS.map((t) => (
                      <button key={t} onClick={() => setDraft({ ...draft, team: t })}
                        className={`px-3 py-1.5 rounded-full border text-sm ${draft.team === t ? 'bg-ink border-ink text-white' : 'border-slate-700 text-slate-400'}`}>{t}</button>
                    ))}
                  </div>
                </>
              )}
              {problem && <p className="text-sm text-red-600">{problem}</p>}
              <div className="flex gap-2">
                <button onClick={save} disabled={!canSave} className="px-5 py-2 rounded-full bg-ink hover:bg-ink-soft disabled:opacity-40 text-white text-sm font-semibold">{existing ? 'Give access' : draft.id ? 'Save changes' : 'Add member'}</button>
                <button onClick={() => setDraft(null)} className="px-4 py-2 rounded-full bg-slate-800 text-slate-200 text-sm font-semibold">Cancel</button>
              </div>
            </div>
          )}

          <div className="border border-slate-800 rounded-3xl overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-900">
                <tr>{['Member', 'Role', 'Team', 'Open ITPs', 'Approve & issue', ''].map((h) => <th key={h} className="text-left px-4 py-2.5 text-[11px] font-bold uppercase tracking-wide text-slate-400">{h}</th>)}</tr>
              </thead>
              <tbody>
                {shown.map((m) => (
                  <tr key={m.id} className="border-t border-slate-800">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${roleChip(m.role)}`}>{m.name.charAt(0).toUpperCase()}</div>
                        <div className="min-w-0">
                          <p className="font-semibold text-ink">{m.name}{m.id === project.adminId && <span className="ml-2 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-ink text-white">Project admin</span>}</p>
                          <p className="text-xs text-slate-500">{m.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3"><span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${roleChip(m.role)}`}>{ROLE_LABEL[m.role]}</span></td>
                    <td className="px-4 py-3 text-slate-300">{m.team ?? '—'}</td>
                    <td className="px-4 py-3 text-slate-300">{openWork(m).itps}</td>
                    <td className="px-4 py-3">
                      <label className="inline-flex items-center gap-2 text-xs text-slate-400 cursor-pointer">
                        <input type="checkbox" aria-label={`Approve & issue for ${m.name}`} checked={canApproveIssue(m, project)} disabled={m.id === project.adminId}
                          onChange={(e) => setApprover(m, e.target.checked)} />
                        {m.id === project.adminId ? 'Always' : canApproveIssue(m, project) ? 'Allowed' : ''}
                      </label>
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <button onClick={() => { setDraft({ id: m.id, email: m.email, name: m.name, role: m.role, team: m.team }); setNotice('') }} className="text-xs font-semibold text-coral-dark hover:underline">Edit</button>
                      {m.id !== project.adminId && <button onClick={() => remove(m)} className="ml-4 text-xs font-semibold text-red-600 hover:underline">Remove</button>}
                    </td>
                  </tr>
                ))}
                {shown.length === 0 && <tr><td colSpan={6} className="px-4 py-6 text-center text-slate-500">No members match.</td></tr>}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs text-slate-500">{team.length} member{team.length === 1 ? '' : 's'}. Removing someone takes away access to this project only.</p>
        </div>
      </div>
    </div>
  )
}
