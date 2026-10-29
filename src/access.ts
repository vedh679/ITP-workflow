import type { AppUser, UserRole } from './types'

// Access roles
//   it       — IT access: full control of members, projects, workflows and the BMS core library
//   manager  — project manager: manages tasks and checklists on their projects
//   engineer — project team member
export const ROLE_LABEL: Record<UserRole, string> = { it: 'IT', manager: 'Manager', engineer: 'Engineer' }
export const ROLE_ORDER: Record<UserRole, number> = { it: 0, manager: 1, engineer: 2 }

export const ROLE_DESCRIPTION: Record<UserRole, string> = {
  it: 'IT access — full control of members, projects, workflows and the BMS core library.',
  manager: 'Can create and manage tasks and checklists on their projects. No system settings.',
  engineer: 'Can view tasks and complete checklists only.',
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

export const isIT = (u: U) => u?.role === 'it'
/** IT works across all projects rather than inside one */
export const isCentral = (u: U) => u?.role === 'it'
/** Members, projects, workflows */
export const canAdministerSystem = (u: U) => u?.role === 'it'
/** Create, edit, review and publish BMS core library documents */
export const canManageBms = (u: U) => u?.role === 'it'
/** Manage tasks, checklists and project structure */
export const canManageProject = (u: U) => u?.role === 'it' || u?.role === 'manager'
