export type UserRole = 'admin' | 'user'

export interface User {
  email: string
  name: string
  role: UserRole
}

export interface Signature {
  name: string
  date: string // ISO string
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
  assignedTo?: string  // email of assigned user
}

export interface Task {
  id: string
  name: string
  description: string
  assignedTo: string
  status: 'pending' | 'in-progress' | 'completed'
  checklists: TaskChecklist[]
  createdAt: string
}
