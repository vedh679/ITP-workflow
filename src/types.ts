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

export interface ChecklistAttachment {
  id: string
  name: string
  mimeType: string
  dataUrl: string   // base64 data URL stored client-side
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
  // version control (same as BMS documents)
  docNumber?: string
  version?: string
  changeNote?: string
  revisions?: BmsRevision[]
  file?: ChecklistAttachment
  updatedAt?: string
}

export interface TaskChecklist {
  id: string
  templateId: string
  templateName: string
  items: ChecklistItem[]
  requiresSignature: boolean
  signature?: Signature
  assignedTo?: string
  attachments?: ChecklistAttachment[]
}

export interface CustomTable {
  columns: string[]   // column header labels
  rows: string[][]    // rows[r][c] = cell value
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
  customTable?: CustomTable
}

export type BmsCategory = 'Policy' | 'Procedure' | 'Form' | 'Template' | 'Register' | 'Manual' | 'Checklist Template'

export interface BmsDocument {
  id: string
  title: string
  docNumber: string       // e.g. BMS-QP-001
  category: BmsCategory
  description: string
  version: string
  content: string         // template body text
  file?: ChecklistAttachment   // optional uploaded template file
  requiresSignature?: boolean   // checklist templates only
  changeNote?: string     // what changed from the previous version
  revisions?: BmsRevision[]    // archived older versions, oldest first
  updatedAt: string       // when the current version was created
}

export interface BmsRevision {
  version: string
  title: string
  docNumber: string
  category: BmsCategory
  description: string
  content: string
  file?: ChecklistAttachment
  requiresSignature?: boolean
  changeNote: string
  createdAt: string       // when this version was created
  archivedAt: string      // when it was superseded
}
