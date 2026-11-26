import { useAppStore } from '../store'
import { ALL_PERMISSIONS, PERMISSION_GROUPS, PRESETS, permissionsOf, roleChip, roleIn, ROLE_LABEL } from '../access'
import type { AppUser, Permission, Project, ProjectRole } from '../types'

// Members down the side, permissions across. Choosing a role applies its preset; any box can then be changed.
export default function PermissionsGrid({ project, team }: { project: Project; team: AppUser[] }) {
  const { currentUser, setMemberRole, setMemberPermissions } = useAppStore()
  const by = currentUser?.name ?? 'Unknown'

  const toggle = (m: AppUser, key: Permission, on: boolean) => {
    const now = permissionsOf(project, m).filter((k) => k !== key)
    setMemberPermissions(project.id, m.id, ALL_PERMISSIONS.filter((k) => now.includes(k) || (on && k === key)), by)
  }

  const th = 'px-1 py-2 text-[11px] font-semibold text-slate-400 border-l border-slate-800'
  return (
    <div className="space-y-4">
      <p className="text-xs text-slate-500">Everyone on the project can view everything. These boxes control who can change it. Document Register access is not part of any preset: grant it by name.</p>
      <div className="border border-slate-800 rounded-3xl overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead className="bg-slate-900">
            <tr>
              <th rowSpan={2} className="sticky left-0 bg-slate-900 text-left px-4 py-2 text-[11px] font-bold uppercase tracking-wide text-slate-400 min-w-[200px]">Member</th>
              {PERMISSION_GROUPS.map((g) => <th key={g.area} colSpan={g.items.length} className={`${th} text-center uppercase tracking-wide ${g.area === 'Document Register' ? 'bg-amber-50 text-amber-700' : ''}`}>{g.area}</th>)}
            </tr>
            <tr>
              {PERMISSION_GROUPS.flatMap((g) => g.items.map((i) => (
                <th key={i.key} title={i.covers} className={`${th} text-center align-bottom w-16 ${g.area === 'Document Register' ? 'bg-amber-50' : ''}`}>{i.label}</th>
              )))}
            </tr>
          </thead>
          <tbody>
            {team.map((m) => {
              const admin = m.id === project.adminId
              const role = roleIn(project, m) as ProjectRole
              const held = permissionsOf(project, m)
              const custom = !admin && (held.length !== PRESETS[role].length || PRESETS[role].some((k) => !held.includes(k)))
              return (
                <tr key={m.id} className="border-t border-slate-800">
                  <td className="sticky left-0 bg-white px-4 py-2.5">
                    <p className="font-semibold text-ink whitespace-nowrap">{m.name}</p>
                    {admin ? <p className="text-[11px] text-slate-500">Project admin · every permission</p> : (
                      <div className="flex items-center gap-2 mt-1">
                        <select aria-label={`Role of ${m.name}`} value={role} onChange={(e) => setMemberRole(project.id, m.id, e.target.value as ProjectRole, by)}
                          className={`text-[11px] font-semibold rounded-full px-2 py-0.5 border-0 ${roleChip(role)}`}>
                          <option value="manager">{ROLE_LABEL.manager}</option>
                          <option value="engineer">{ROLE_LABEL.engineer}</option>
                        </select>
                        {custom && <button onClick={() => setMemberRole(project.id, m.id, role, by)} className="text-[11px] font-semibold text-coral-dark hover:underline whitespace-nowrap">Reset to preset</button>}
                      </div>
                    )}
                  </td>
                  {ALL_PERMISSIONS.map((key) => (
                    <td key={key} className="border-l border-slate-800 text-center">
                      <input type="checkbox" aria-label={`${key} for ${m.name}`} checked={held.includes(key)} disabled={admin} onChange={(e) => toggle(m, key, e.target.checked)} className="w-4 h-4" />
                    </td>
                  ))}
                </tr>
              )
            })}
            {team.length === 0 && <tr><td colSpan={ALL_PERMISSIONS.length + 1} className="px-4 py-6 text-center text-slate-500">No members match.</td></tr>}
          </tbody>
        </table>
      </div>

      <div>
        <h3 className="text-sm font-bold text-ink mb-2">Access history</h3>
        <div className="border border-slate-800 rounded-3xl divide-y divide-slate-800 max-h-64 overflow-y-auto">
          {(project.permissionLog ?? []).length === 0 && <p className="px-4 py-3 text-xs text-slate-500">No changes to access yet.</p>}
          {(project.permissionLog ?? []).map((l) => (
            <p key={l.id} className="px-4 py-2 text-xs text-slate-300"><span className="font-semibold text-ink">{l.member}</span> — {l.change} <span className="text-slate-500">· {l.by}, {new Date(l.at).toLocaleString()}</span></p>
          ))}
        </div>
      </div>
    </div>
  )
}
