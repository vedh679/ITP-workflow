export type UserRole = 'it' | 'manager' | 'engineer'

export type TeamType = 'Quality' | 'Site Engineer' | 'Engineer' | 'Manager' | 'Commercial' | 'Planning' | 'Executive' | 'Finance'

export interface AppUser {
  id: string
  email: string
  name: string
  role: UserRole
  team?: TeamType        // which team the member belongs to (separate from their access role)
  projectIds: string[]   // projects this member is assigned to
  signature?: { image: string; at: string }   // their stored signature; only they can set it
}

export type ProjectRole = 'manager' | 'engineer'

export type Permission =
  | 'itp.edit' | 'itp.fill'
  | 'checklist.manage' | 'checklist.complete' | 'checklist.sign'
  | 'inspection.manage' | 'inspection.raise'
  | 'workflow.run'
  | 'register.add' | 'register.edit' | 'register.review' | 'register.approve'
  | 'org.edit'

export interface PermissionLogEntry {
  id: string
  at: string
  by: string
  member: string
  change: string
}

export interface Project {
  id: string
  name: string
  description: string
  code?: string          // short project code used on timesheets, e.g. BLD-A
  adminId?: string       // the team member IT appointed to control who has access to this project
  // Access is per project. A member's role here picks the starting preset; the admin can then change any permission.
  roles?: Record<string, ProjectRole>             // by member id
  permissions?: Record<string, Permission[]>      // by member id; absent = the role's preset
  permissionLog?: PermissionLogEntry[]
}

export interface Signature {
  name: string
  date: string
  by?: string       // the member who signed
  image?: string    // a copy of their stored signature as it was when they signed
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

// ── Inspections (a second branch on the task, alongside checklists) ──
export type InspectionType = 'QICC' | 'NOWRI' | 'Joint Inspection' | 'Quality Inspection'
export type IssueSeverity = 'minor' | 'major' | 'critical'
export type IssueStatus = 'open' | 'in-progress' | 'closed'

export interface IssueChange {
  field: string
  from: string
  to: string
}

// Audit trail entry for one issue: who did what, when, and exactly what changed
export interface IssueHistoryEntry {
  id: string
  at: string
  by: string
  action: 'created' | 'started' | 'closed' | 'reopened' | 'edited'
  summary: string
  changes?: IssueChange[]
  note?: string
  photos?: ChecklistAttachment[]   // photos added in this step (before photos on creation, after photos on closing)
}

export interface InspectionLogEntry {
  id: string
  at: string
  by: string
  summary: string
}

export interface InspectionIssue {
  id: string
  title: string
  description: string
  severity: IssueSeverity
  status: IssueStatus
  location?: string
  assignedTo?: string        // member email responsible for fixing it
  dueDate?: string
  raisedBy: string           // member name
  raisedAt: string
  closedBy?: string
  closedAt?: string
  closeNote?: string
  beforePhotos?: ChecklistAttachment[]   // required when the issue is raised
  afterPhotos?: ChecklistAttachment[]    // required when the issue is closed
  photos?: ChecklistAttachment[]         // legacy: treated as before photos
  history?: IssueHistoryEntry[]
}

export interface Inspection {
  id: string
  type: InspectionType
  title: string
  date: string               // YYYY-MM-DD
  inspectedBy: string        // member email
  location: string
  notes: string
  status: 'open' | 'completed'
  completedAt?: string
  issues: InspectionIssue[]
  log?: InspectionLogEntry[]   // inspection-level activity (created, edited, completed, issue deleted …)
  createdAt: string
}

// An ITP's own document: it starts as a copy of the BMS ITP template, then belongs to this ITP alone
export interface TaskItp {
  templateId: string
  templateRef: string        // the template's document number, e.g. BMS-TP-010
  templateTitle: string
  templateVersion: string    // the template version it started from
  blocks: DocBlock[]         // its content — normally the template's, adjusted where this ITP needs it
  fieldValues: Record<string, string>
  updatedAt?: string
  updatedBy?: string
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
  inspections?: Inspection[]
  createdAt: string
  itp?: TaskItp              // this ITP's own inspection and test plan document (starts from the BMS ITP template)
  workflowId?: string        // workflow applied to this task
  workflowRun?: WorkflowRun  // progress through that workflow
}

// A block in a structured (Word-style) BMS document.
// heading / paragraph text is fixed — project teams cannot change it.
// field blocks are spaces the project team fills in with project-specific information.
export type DocBlockType = 'heading' | 'paragraph' | 'field' | 'table'

export interface DocBlock {
  id: string
  type: DocBlockType
  text?: string                       // heading / paragraph text
  level?: 1 | 2 | 3                   // heading level
  label?: string                      // field: what the project team should enter
  hint?: string                       // field: guidance shown to the project team
  fieldType?: 'text' | 'long' | 'date'   // field: single line, multi-line or date
  // table blocks: `label` is the caption
  columns?: string[]               // column headers
  rows?: string[][]                // the rows the admin set up (a fill-in table's starting rows)
  tableMode?: 'fixed' | 'fill'     // fixed = locked like the text; fill = the project team completes cells
  colLocked?: boolean[]            // fill-in tables: columns the project team can't change
  allowAddRows?: boolean           // fill-in tables: the project team can add rows (default true)
}

export type BmsCategory = 'Policy' | 'Procedure' | 'Form' | 'Template' | 'Register' | 'Manual' | 'Checklist Template'

// A new version being prepared for a published document. It is only visible to IT
// until it is published, which rolls it out to the projects.
export interface BmsPending {
  title: string
  docNumber: string
  category: BmsCategory
  description: string
  version: string
  content: string
  blocks?: DocBlock[]
  file?: ChecklistAttachment
  author?: string
  approvedBy?: string
  reviewIntervalMonths?: number
  changeNote: string
  savedAt: string
  savedBy: string
}

// One periodic review of a published document
export interface BmsReview {
  id: string
  at: string
  by: string
  version: string
  outcome: 'no-changes' | 'changes-needed'
  comment: string
}

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
  status?: 'draft' | 'published'   // drafts are invisible to projects; undefined counts as published
  pending?: BmsPending             // next version being prepared (published documents only)
  publishedAt?: string
  publishedBy?: string
  reviewIntervalMonths?: number    // how often the document must be reviewed (default 12)
  lastReviewedAt?: string
  lastReviewedBy?: string
  reviews?: BmsReview[]            // review history, newest first
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

// ── Project documents: documents a project creates from BMS library templates ──
export interface ProjectDocumentHistory {
  version: string   // template version
  at: string
  by: string
  note?: string
}

// A document in a project's register, created by pulling a template in from the BMS library.
// Its name and number are always the template's (never edited by the project). It remembers which
// template version it is on, so the project is told when the template moves on.
export interface ProjectDocument {
  id: string
  projectId: string
  bmsDocumentId: string          // the BMS library template this document was created from
  adoptedVersion: string         // the template version this document is on
  adoptedAt: string
  adoptedBy: string
  sequence: number               // which copy of the template this is in the project (1, 2 …), set automatically
  status?: 'active' | 'archived' // undefined counts as active
  createdAt?: string
  history: ProjectDocumentHistory[]
  fieldValues?: Record<string, string>   // what the project team entered, by field block id
  fieldsUpdatedAt?: string
  fieldsUpdatedBy?: string
  // Revisions and review. The first version is revision 1; each update to a newer template version
  // is the next revision, and the earlier ones are kept in `versions`.
  revision?: number
  revisionStartedAt?: string             // when the current revision began
  lastEditedAt?: string                  // last edit (creation, saved project details, or an update); the 12-month review period runs from here
  lastReviewedAt?: string                // a review that confirmed nothing needed changing also restarts the period
  lastReviewedBy?: string
  reviews?: ProjectDocReview[]           // newest first
  versions?: ProjectDocVersion[]         // earlier revisions, oldest first
  editDraft?: { values: Record<string, string>; savedAt: string; savedBy: string }  // project details saved as a draft, not yet a new revision
  submission?: ProjectDocSubmission
  returned?: { by: string; at: string; comment: string }   // sent back by the approver; the work is kept as a draft
  issue?: ProjectDocIssue                // approval of the current revision
  updateDraft?: ProjectDocUpdateDraft    // an update to a newer template version that has been started but not applied
}

export interface ProjectDocReview {
  id: string
  at: string
  by: string
  revision: number
  comment: string
}

// A completed change waiting for someone with "Approve & issue". The current revision stays in use until then.
export interface ProjectDocSubmission {
  kind: 'edit' | 'update'                // project details edited, or a newer library version adopted
  toVersion: string
  values: Record<string, string>
  note?: string
  by: string
  at: string
}

// Who prepared and who approved a revision
export interface ProjectDocIssue {
  preparedBy: string
  approvedBy: string
  approvedAt: string
  signature?: string   // the approver's signature
}

// An earlier revision of a project document, kept exactly as it was
export interface ProjectDocVersion {
  revision: number
  templateVersion: string
  fieldValues: Record<string, string>
  startedAt: string                      // when this revision was created
  endedAt: string                        // when it was replaced
  endedBy: string
  note?: string
  issue?: ProjectDocIssue
}

export interface ProjectDocUpdateDraft {
  toVersion: string
  values: Record<string, string>
  savedAt: string
  savedBy: string
}

// ── Project organisation (who is on a project and where they sit in the team) ──
export interface ProjectOrgEntry {
  projectId: string
  memberId: string
  title: string                    // e.g. "Site Manager"
  reportsToId: string | null       // another member of the same project, or null for the top of the chart
}

// ── Timesheets ────────────────────────────────────────────────────
// A day has two sessions (the two halves of the day): IN, OUT and the project code worked on.
export interface TimesheetSession {
  in: string      // HH:MM
  out: string     // HH:MM
  code: string    // project code
}

export interface TimesheetDay {
  userId: string
  date: string    // YYYY-MM-DD
  sessions: [TimesheetSession, TimesheetSession]
}

export interface TimesheetSubmission {
  userId: string
  weekStart: string     // the Monday, YYYY-MM-DD
  submittedAt: string
}
