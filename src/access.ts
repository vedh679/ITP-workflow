import type { AppUser, Permission, Project, ProjectRole, UserRole } from './types'

// Access roles
//   it       — IT access: projects and their admins, workflows and the BMS core library
//   manager  — project manager: manages tasks and checklists on their projects
//   engineer — project team member
export const ROLE_LABEL: Record<UserRole, string> = { it: 'IT', manager: 'Manager', engineer: 'Engineer' }
export const ROLE_ORDER: Record<UserRole, number> = { it: 0, manager: 1, engineer: 2 }

export const ROLE_DESCRIPTION: Record<UserRole, string> = {
  it: 'IT access — creates projects, appoints each project admin, and maintains workflows and the BMS core library.',
  manager: 'Starts with ITP, checklist, inspection, workflow and organisation permissions.',
  engineer: 'Starts with filling in ITPs, completing checklists and raising snags.',
}

/** Classes for a role's avatar / chip */
export const roleChip = (role: UserRole) =>
  role === 'it' ? 'bg-ink text-white'
  : role === 'manager' ? 'bg-coral-tint text-coral-dark'
  : 'bg-green-100 text-green-700'

/** Classes for a selected role option */
export const roleChipSelected = (role: UserRole) =>
  role === 'it' ? 'bg-ink border-ink text-white'
  : role === 'manager' ? 'bg-coral-tint border-coral text-coral-dark'
  : 'bg-green-100 border-green-500 text-green-700'

type U = Pick<AppUser, 'role'> | null | undefined

/** IT works across all projects rather than inside one */
export const isCentral = (u: U) => u?.role === 'it'
/** Projects, project admins and workflows */
export const canAdministerSystem = (u: U) => u?.role === 'it'
/** Create, edit, review and publish BMS core library documents */
export const canManageBms = (u: U) => u?.role === 'it'
/** The project organisation chart belongs to the project teams; IT works across projects and doesn't use it */
export const canViewOrganisation = (u: U) => u?.role !== 'it'

/** Tasks (with their checklists and inspections) and the document register are project work; IT doesn't use them */
export const canAccessTasks = (u: U) => u?.role !== 'it'
/** Timesheets are for the project teams; IT doesn't keep one */
export const canAccessTimesheet = (u: U) => u?.role !== 'it'
export const canAccessRegister = (u: U) => u?.role !== 'it'

/** The member IT appointed for a project controls who has access to it */
export const isProjectAdmin = (u: { id: string } | null | undefined, project: { adminId?: string } | null | undefined) => !!u && project?.adminId === u.id

// ── Project permissions ──
// Everyone on a project can view everything; these control who can change it.
export const PERMISSION_GROUPS: { area: string; items: { key: Permission; label: string; covers: string }[] }[] = [
  { area: 'ITPs', items: [
    { key: 'itp.edit', label: 'Create & edit ITPs', covers: 'New ITP, details, document content, export' },
    { key: 'itp.fill', label: 'Fill in ITPs', covers: 'Entries in the ITP document' },
  ] },
  { area: 'Checklists', items: [
    { key: 'checklist.manage', label: 'Manage', covers: 'Add, assign, delete, export' },
    { key: 'checklist.complete', label: 'Complete', covers: 'Tick items and add attachments' },
    { key: 'checklist.sign', label: 'Sign off', covers: 'Sign any checklist' },
  ] },
  { area: 'Inspections', items: [
    { key: 'inspection.manage', label: 'Manage', covers: 'Add, edit, delete, delete snags' },
    { key: 'inspection.raise', label: 'Raise snags', covers: 'Record new snags' },
  ] },
  { area: 'Workflow', items: [{ key: 'workflow.run', label: 'Run', covers: 'Start, next stage, client decision' }] },
  { area: 'Document Register', items: [
    { key: 'register.add', label: 'Add & archive', covers: 'Add from library, archive, restore' },
    { key: 'register.edit', label: 'Edit & update', covers: 'Fill in, drafts, library updates, submit' },
    { key: 'register.review', label: 'Review', covers: 'Record a no-change review' },
    { key: 'register.approve', label: 'Approve & issue', covers: 'Approve, return and issue' },
  ] },
  { area: 'Project', items: [{ key: 'org.edit', label: 'Organisation', covers: 'Reporting lines and titles' }] },
]
export const ALL_PERMISSIONS: Permission[] = PERMISSION_GROUPS.flatMap((g) => g.items.map((i) => i.key))
export const permissionLabel = (key: Permission) => {
  const group = PERMISSION_GROUPS.find((g) => g.items.some((i) => i.key === key))!
  return `${group.area}: ${group.items.find((i) => i.key === key)!.label}`
}

// The document register is tightly controlled: no preset includes it, the admin grants it by name
export const PRESETS: Record<ProjectRole, Permission[]> = {
  manager: ['itp.edit', 'itp.fill', 'checklist.manage', 'checklist.complete', 'checklist.sign', 'inspection.manage', 'inspection.raise', 'workflow.run', 'org.edit'],
  engineer: ['itp.fill', 'checklist.complete', 'inspection.raise'],
}

type ProjectAccess = Pick<Project, 'adminId' | 'roles' | 'permissions'> | null | undefined
type Member = Pick<AppUser, 'id' | 'role' | 'projectIds'>

/** A member's role on this project (their account role only applies until one is set here) */
export const roleIn = (project: ProjectAccess, m: Pick<AppUser, 'id' | 'role'>): UserRole =>
  m.role === 'it' ? 'it' : project?.adminId === m.id ? 'manager' : project?.roles?.[m.id] ?? m.role

export function permissionsOf(project: ProjectAccess, m: Member): Permission[] {
  if (!project) return []
  if (project.adminId === m.id) return ALL_PERMISSIONS
  const role = roleIn(project, m)
  return role === 'it' ? [] : project.permissions?.[m.id] ?? PRESETS[role]
}

export const can = (u: Member | null | undefined, project: (ProjectAccess & { id: string }) | null | undefined, permission: Permission) =>
  !!u && !!project && u.projectIds.includes(project.id) && permissionsOf(project, u).includes(permission)
