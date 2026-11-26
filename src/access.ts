import type { AppUser, UserRole } from './types'

// Access roles
//   it       — IT access: projects and their admins, workflows and the BMS core library
//   manager  — project manager: manages tasks and checklists on their projects
//   engineer — project team member
export const ROLE_LABEL: Record<UserRole, string> = { it: 'IT', manager: 'Manager', engineer: 'Engineer' }
export const ROLE_ORDER: Record<UserRole, number> = { it: 0, manager: 1, engineer: 2 }

export const ROLE_DESCRIPTION: Record<UserRole, string> = {
  it: 'IT access — creates projects, appoints each project admin, and maintains workflows and the BMS core library.',
  manager: 'Can create and manage ITPs and checklists on their projects. No system settings.',
  engineer: 'Can view ITPs and complete checklists only.',
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

/** "Approve & issue" makes a change the current revision of a register document */
export const canApproveIssue = (u: { id: string } | null | undefined, project: { adminId?: string; approverIds?: string[] } | null | undefined) =>
  !!u && !!project && (project.adminId === u.id || !!project.approverIds?.includes(u.id))

/** Manage tasks, checklists and project structure */
export const canManageProject = (u: U) => u?.role === 'it' || u?.role === 'manager'
