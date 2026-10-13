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
  author?: string
  approvedBy?: string
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
  workflowId?: string        // workflow applied to this task
  workflowRun?: WorkflowRun  // progress through that workflow
}

// A block in a structured (Word-style) BMS document.
// heading / paragraph text is fixed — project teams cannot change it.
// field blocks are spaces the project team fills in with project-specific information.
export type DocBlockType = 'heading' | 'paragraph' | 'field'

export interface DocBlock {
  id: string
  type: DocBlockType
  text?: string                       // heading / paragraph text
  level?: 1 | 2 | 3                   // heading level
  label?: string                      // field: what the project team should enter
  hint?: string                       // field: guidance shown to the project team
  fieldType?: 'text' | 'long' | 'date'   // field: single line, multi-line or date
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
  author?: string
  approvedBy?: string
  blocks?: DocBlock[]           // structured document body (core documents); `content` is derived from it
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
  author?: string
  approvedBy?: string
  blocks?: DocBlock[]
  requiresSignature?: boolean
  changeNote: string
  createdAt: string       // when this version was created
  archivedAt: string      // when it was superseded
}

// ── Workflows (ITP process flow diagrams) ─────────────────────────
export type WorkflowNodeKind = 'start' | 'procedure' | 'task' | 'checklist' | 'approval' | 'end'

export interface WorkflowNodeData extends Record<string, unknown> {
  kind: WorkflowNodeKind
  label: string
  description: string
  checklistTemplateId?: string   // checklist nodes
  approverId?: string            // approval nodes (member id) when approverType is 'member'
  approverType?: 'member' | 'client'   // approval nodes: who decides (default member)
  managerInitiates?: boolean     // project manager must start this step (approvals: default true)
  status?: 'done' | 'current' | 'awaiting'   // runtime only, set when drawing a task's run
}

export interface WorkflowNode {
  id: string
  position: { x: number; y: number }
  data: WorkflowNodeData
}

export interface WorkflowEdge {
  id: string
  source: string
  target: string
  sourceHandle?: string | null   // 'yes' | 'no' for approval nodes
}

export interface Workflow {
  id: string
  name: string
  description: string
  nodes: WorkflowNode[]
  edges: WorkflowEdge[]
  createdAt: string
  updatedAt: string
}

// ── Workflow runs (a workflow applied to a task) ──────────────────
export type WorkflowLogOutcome = 'done' | 'auto' | 'yes' | 'no' | 'initiated'

export interface WorkflowLogEntry {
  nodeId: string
  label: string
  kind: WorkflowNodeKind
  outcome: WorkflowLogOutcome
  at: string
  by: string
  note?: string
}

export interface WorkflowRun {
  workflowId: string
  workflowName: string
  status: 'running' | 'awaiting-initiation' | 'completed'
  currentNodeId: string | null     // step in focus (running, or waiting for the manager to initiate)
  currentChecklistId?: string      // checklist being waited on, for checklist steps
  usedChecklistIds: string[]       // checklists already consumed by completed steps
  clientSentAt?: string            // client approval steps: when it was sent
  log: WorkflowLogEntry[]
}

// ── Project documents (which BMS version each project holds) ──────
export interface ProjectDocumentHistory {
  version: string
  at: string
  by: string
}

export interface ProjectDocument {
  id: string
  projectId: string
  bmsDocumentId: string
  adoptedVersion: string         // the BMS version this project is currently working to
  adoptedAt: string
  adoptedBy: string
  history: ProjectDocumentHistory[]
  fieldValues?: Record<string, string>   // what the project team entered, by field block id
  fieldsUpdatedAt?: string
  fieldsUpdatedBy?: string
}

// ── Project organisation (who is on a project and where they sit in the team) ──
export interface ProjectOrgEntry {
  projectId: string
  memberId: string
  title: string                    // e.g. "Site Manager"
  reportsToId: string | null       // another member of the same project, or null for the top of the chart
}
