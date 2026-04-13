export type UserRole = 'admin' | 'manager' | 'engineer'

export interface AppUser {
  id: string
  email: string
  name: string
  role: UserRole
  projectIds: string[]   // projects this member is assigned to
}

export interface Project {
  id: string
  name: string
  description: string
}

export interface Signature {
  name: string
  date: string
}

export interface ChecklistItem {
  id: string
  text: string
  completed: boolean
}

export interface ChecklistTemplate {
  id: string
  name: string
  description: string
  items: ChecklistItem[]
  requiresSignature: boolean
  createdAt: string
}

export interface TaskChecklist {
  id: string
  templateId: string
  templateName: string
  items: ChecklistItem[]
  requiresSignature: boolean
  signature?: Signature
  assignedTo?: string
}

export interface Task {
  id: string
  name: string
  description: string
  location: string
  dueDate: string
  assignedTo: string
  projectId: string      // which project this task belongs to
  status: 'pending' | 'in-progress' | 'completed'
  checklists: TaskChecklist[]
  createdAt: string
}
