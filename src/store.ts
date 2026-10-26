import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { startRun, syncRun } from './workflow'
import { blocksToText, field, heading, para } from './docBlocks'
import type { AppUser, Project, Task, ChecklistTemplate, BmsDocument, Workflow, ProjectDocument, ProjectOrgEntry, TimesheetEntry, TimesheetSubmission } from './types'

interface AppState {
  currentUser: AppUser | null
  currentProjectId: string | null
  members: AppUser[]
  projects: Project[]
  tasks: Task[]
  templates: ChecklistTemplate[]
  bmsDocuments: BmsDocument[]
  workflows: Workflow[]
  projectDocuments: ProjectDocument[]
  projectOrg: ProjectOrgEntry[]
  timesheetEntries: TimesheetEntry[]
  timesheetSubmissions: TimesheetSubmission[]

  setCurrentUser: (user: AppUser | null) => void
  setCurrentProjectId: (id: string | null) => void

  // Members
  addMember: (member: AppUser) => void
  updateMember: (member: AppUser) => void
  deleteMember: (id: string) => void

  // Projects
  addProject: (project: Project) => void
  updateProject: (project: Project) => void
  deleteProject: (id: string) => void

  // Tasks
  addTask: (task: Task) => void
  updateTask: (task: Task) => void
  deleteTask: (id: string) => void

  // Templates
  addTemplate: (template: ChecklistTemplate) => void
  updateTemplate: (template: ChecklistTemplate) => void
  deleteTemplate: (id: string) => void

  // BMS documents
  addBmsDocument: (doc: BmsDocument) => void
  updateBmsDocument: (doc: BmsDocument) => void
  deleteBmsDocument: (id: string) => void

  // Workflows
  addWorkflow: (workflow: Workflow) => void
  updateWorkflow: (workflow: Workflow) => void
  deleteWorkflow: (id: string) => void

  // Project documents: a project takes up (or updates to) a version of a BMS document
  adoptProjectDocument: (projectId: string, bmsDocumentId: string, version: string, by: string) => void
  // Timesheets
  addTimesheetEntry: (entry: TimesheetEntry) => void
  updateTimesheetEntry: (entry: TimesheetEntry) => void
  deleteTimesheetEntry: (id: string) => void
  submitTimesheetWeek: (userId: string, weekStart: string) => void
  reopenTimesheetWeek: (userId: string, weekStart: string) => void

  setProjectOrgEntry: (projectId: string, memberId: string, patch: Partial<Pick<ProjectOrgEntry, 'title' | 'reportsToId'>>) => void
  saveProjectDocumentFields: (projectId: string, bmsDocumentId: string, values: Record<string, string>, by: string) => void
}

// ── Sample projects ───────────────────────────────────────────────
const SAMPLE_PROJECTS: Project[] = [
  { id: 'p1', name: 'Building A Renovation', description: 'Full structural and services renovation of Building A' },
  { id: 'p2', name: 'Substation Upgrade', description: 'Electrical substation upgrade and commissioning' },
]

// ── Sample members ────────────────────────────────────────────────
const SAMPLE_MEMBERS: AppUser[] = [
  { id: 'u1', email: 'admin@itp.com',     name: 'Admin User',      role: 'admin',    team: 'Executive',    projectIds: ['p1', 'p2'] },
  { id: 'u2', email: 'manager@itp.com',   name: 'Project Manager', role: 'manager',  team: 'Manager',  projectIds: ['p1', 'p2'] },
  { id: 'u3', email: 'vedh@itp.com',      name: 'Vedh',            role: 'manager',  team: 'Manager',  projectIds: ['p1'] },
  { id: 'u4', email: 'inspector@itp.com', name: 'Site Inspector',  role: 'engineer', team: 'Quality', projectIds: ['p1'] },
  { id: 'u5', email: 'engineer@itp.com',  name: 'Field Engineer',  role: 'engineer', team: 'Site Engineer', projectIds: ['p2'] },
]

// ── Sample templates ──────────────────────────────────────────────
const SAMPLE_TEMPLATES: ChecklistTemplate[] = [
  {
    id: 't1', name: 'Site Safety Inspection',
    description: 'Standard safety checklist for site inspections',
    requiresSignature: true,
    items: [
      { id: 'i1', text: 'PPE available and worn correctly', completed: false },
      { id: 'i2', text: 'Emergency exits clear and marked', completed: false },
      { id: 'i3', text: 'Fire extinguishers in place and in date', completed: false },
      { id: 'i4', text: 'Hazardous materials properly stored', completed: false },
    ],
    createdAt: new Date().toISOString(),
  },
  {
    id: 't2', name: 'Electrical Systems Check',
    description: 'Electrical installation test checklist',
    requiresSignature: false,
    items: [
      { id: 'i5', text: 'Visual inspection of all wiring', completed: false },
      { id: 'i6', text: 'Earth continuity test completed', completed: false },
      { id: 'i7', text: 'Insulation resistance measured', completed: false },
      { id: 'i8', text: 'RCD trip times verified', completed: false },
      { id: 'i9', text: 'Labelling accurate and legible', completed: false },
    ],
    createdAt: new Date().toISOString(),
  },
  {
    id: 't3', name: 'Structural Integrity Review',
    description: 'Structural elements inspection checklist',
    requiresSignature: false,
    items: [
      { id: 'i10', text: 'Foundation inspection complete', completed: false },
      { id: 'i11', text: 'Load-bearing walls checked', completed: false },
      { id: 'i12', text: 'Roof structure assessed', completed: false },
      { id: 'i13', text: 'No visible cracks or deformation', completed: false },
    ],
    createdAt: new Date().toISOString(),
  },
]

// ── Sample tasks ──────────────────────────────────────────────────
const SAMPLE_TASKS: Task[] = [
  {
    id: 'task1', name: 'Building A — Level 3 ITP',
    description: 'Inspection and test plan for Building A, Level 3',
    location: 'Building A, Level 3', dueDate: '2026-05-01',
    assignedTo: 'vedh@itp.com', projectId: 'p1',
    status: 'in-progress',
    checklists: [
      {
        id: 'tc1', templateId: 't1', templateName: 'Site Safety Inspection',
        requiresSignature: true, assignedTo: 'inspector@itp.com',
        items: [
          { id: 'i1', text: 'PPE available and worn correctly', completed: true },
          { id: 'i2', text: 'Emergency exits clear and marked', completed: false },
          { id: 'i3', text: 'Fire extinguishers in place and in date', completed: false },
          { id: 'i4', text: 'Hazardous materials properly stored', completed: false },
        ],
      },
    ],
    createdAt: new Date().toISOString(),
  },
  {
    id: 'task2', name: 'Substation Electrical ITP',
    description: 'Electrical systems test for substation installation',
    location: 'Site B — Substation', dueDate: '2026-06-15',
    assignedTo: 'manager@itp.com', projectId: 'p2',
    status: 'pending', checklists: [],
    createdAt: new Date().toISOString(),
  },
]

// ── Sample BMS documents ──────────────────────────────────────────
const qmBlocks = [
  heading('1. Purpose', 2), para('This manual describes how the business plans, controls and improves the quality of its work.'),
  heading('2. Scope', 2), para('It applies to all projects, sites and personnel working under the business management system.'),
  heading('3. Project details', 2), field('Project name'), field('Project manager'),
  heading('4. Responsibilities', 2), para('Project managers are responsible for applying this manual on their projects and keeping project records up to date.'),
  heading('5. Project quality objectives', 2), field('Quality objectives for this project', 'long', 'List the measurable objectives the project team will work to.'),
]
const itpBlocks = [
  heading('Inspection & Test Plan', 1),
  para('Complete this plan before work starts. Each inspection point must be signed off before the next activity begins.'),
  field('Project'), field('Activity'), field('Location / area'),
  heading('Inspection points', 2), field('Inspection points and acceptance criteria', 'long', 'One per line: inspection point, acceptance criteria, hold or witness.'),
  field('Date prepared', 'date'),
]
const ncrBlocks = [
  heading('Non-Conformance Report', 1),
  para('Record every non-conformance and close it out with corrective action.'),
  field('NCR number'), field('Date raised', 'date'), field('Description of non-conformance', 'long'),
  field('Root cause', 'long'), field('Corrective action', 'long'), field('Closed out by'),
]
const SAMPLE_BMS: BmsDocument[] = [
  { id: 'bms1', title: 'Quality Manual', docNumber: 'BMS-QM-001', category: 'Manual', version: '1.0',
    description: 'Top-level description of the quality management system.',
    blocks: qmBlocks, content: blocksToText(qmBlocks),
    changeNote: 'Initial release', revisions: [], updatedAt: new Date().toISOString() },
  { id: 'bms2', title: 'Inspection & Test Plan Template', docNumber: 'BMS-TP-010', category: 'Template', version: '1.0',
    description: 'Standard ITP layout used on all projects.',
    blocks: itpBlocks, content: blocksToText(itpBlocks),
    changeNote: 'Initial release', revisions: [], updatedAt: new Date().toISOString() },
  { id: 'bms3', title: 'Non-Conformance Report', docNumber: 'BMS-FM-020', category: 'Form', version: '1.0',
    description: 'Form for recording and closing out non-conformances.',
    blocks: ncrBlocks, content: blocksToText(ncrBlocks),
    changeNote: 'Initial release', revisions: [], updatedAt: new Date().toISOString() },
]

// ── Sample workflow ───────────────────────────────────────────────
const SAMPLE_WORKFLOWS: Workflow[] = [
  {
    id: 'wf1', name: 'Standard ITP Process', description: 'Inspect, approve internally, complete the works, then send to the client for approval.',
    nodes: [
      { id: 'n1', position: { x: 300, y: 0 },   data: { kind: 'start',     label: 'Start', description: '' } },
      { id: 'n2', position: { x: 250, y: 100 }, data: { kind: 'procedure', label: 'Prepare work area', description: 'Isolate and prepare the area; confirm drawings are the latest revision.' } },
      { id: 'n3', position: { x: 250, y: 230 }, data: { kind: 'checklist', label: 'Safety inspection', description: '', checklistTemplateId: 't1' } },
      { id: 'n4', position: { x: 245, y: 360 }, data: { kind: 'approval',  label: 'Inspector approves?', description: 'Hold point — work cannot proceed without sign-off.', approverType: 'member', approverId: 'u2', managerInitiates: false } },
      { id: 'n5', position: { x: 250, y: 560 }, data: { kind: 'task',      label: 'Complete the works', description: 'Carry out the works and confirm they are done.' } },
      { id: 'n6', position: { x: 560, y: 380 }, data: { kind: 'task',      label: 'Raise NCR and rework', description: 'Record the non-conformance and correct before re-inspection.' } },
      { id: 'n8', position: { x: 245, y: 700 }, data: { kind: 'approval',  label: 'Client approves?', description: 'Send the completed ITP to the client for sign-off.', approverType: 'client' } },
      { id: 'n9', position: { x: 560, y: 720 }, data: { kind: 'task',      label: 'Address client comments', description: '' } },
      { id: 'n7', position: { x: 300, y: 900 }, data: { kind: 'end',       label: 'End', description: '' } },
    ],
    edges: [
      { id: 'e1', source: 'n1', target: 'n2' },
      { id: 'e2', source: 'n2', target: 'n3' },
      { id: 'e3', source: 'n3', target: 'n4' },
      { id: 'e4', source: 'n4', target: 'n5', sourceHandle: 'yes' },
      { id: 'e5', source: 'n4', target: 'n6', sourceHandle: 'no' },
      { id: 'e6', source: 'n6', target: 'n3' },
      { id: 'e7', source: 'n5', target: 'n8' },
      { id: 'e8', source: 'n8', target: 'n7', sourceHandle: 'yes' },
      { id: 'e9', source: 'n8', target: 'n9', sourceHandle: 'no' },
      { id: 'e10', source: 'n9', target: 'n5' },
    ],
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  },
]

// ── Sample project documents: both projects start on v1.0 of the sample BMS documents ──
const SAMPLE_PROJECT_DOCUMENTS: ProjectDocument[] = ['p1', 'p2'].flatMap((projectId) =>
  ['bms1', 'bms2', 'bms3'].map((bmsDocumentId) => ({
    id: `pd-${projectId}-${bmsDocumentId}`, projectId, bmsDocumentId, adoptedVersion: '1.0',
    adoptedAt: new Date().toISOString(), adoptedBy: 'System',
    history: [{ version: '1.0', at: new Date().toISOString(), by: 'System' }],
  })))

// ── Sample project organisation ──
const SAMPLE_PROJECT_ORG: ProjectOrgEntry[] = [
  { projectId: 'p1', memberId: 'u1', title: 'Operations Director',   reportsToId: null },
  { projectId: 'p1', memberId: 'u2', title: 'Project Manager',       reportsToId: 'u1' },
  { projectId: 'p1', memberId: 'u3', title: 'Site Manager',          reportsToId: 'u2' },
  { projectId: 'p1', memberId: 'u4', title: 'Site Inspector (QA)',   reportsToId: 'u3' },
  { projectId: 'p2', memberId: 'u1', title: 'Operations Director',   reportsToId: null },
  { projectId: 'p2', memberId: 'u2', title: 'Project Manager',       reportsToId: 'u1' },
  { projectId: 'p2', memberId: 'u5', title: 'Commissioning Engineer', reportsToId: 'u2' },
]

// ── Store ─────────────────────────────────────────────────────────
export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      currentUser: null,
      currentProjectId: null,
      members: SAMPLE_MEMBERS,
      projects: SAMPLE_PROJECTS,
      tasks: SAMPLE_TASKS,
      templates: SAMPLE_TEMPLATES,
      bmsDocuments: SAMPLE_BMS,
      workflows: SAMPLE_WORKFLOWS,
      projectDocuments: SAMPLE_PROJECT_DOCUMENTS,
      projectOrg: SAMPLE_PROJECT_ORG,
      timesheetEntries: [],
      timesheetSubmissions: [],

      setCurrentUser: (user) => set({ currentUser: user, currentProjectId: null }),
      setCurrentProjectId: (id) => set({ currentProjectId: id }),

      addMember: (m) => set((s) => ({ members: [...s.members, m] })),
      updateMember: (m) => set((s) => ({ members: s.members.map((x) => x.id === m.id ? m : x) })),
      deleteMember: (id) => set((s) => ({ members: s.members.filter((x) => x.id !== id) })),

      addProject: (p) => set((s) => ({ projects: [...s.projects, p] })),
      updateProject: (p) => set((s) => ({ projects: s.projects.map((x) => x.id === p.id ? p : x) })),
      deleteProject: (id) => set((s) => ({ projects: s.projects.filter((x) => x.id !== id) })),

      // A task with a workflow starts running it straight away; later changes (e.g. a completed
      // checklist) move the workflow on automatically.
      addTask: (task) => set((s) => {
        const wf = !task.workflowRun && task.workflowId ? s.workflows.find((w) => w.id === task.workflowId) : undefined
        return { tasks: [...s.tasks, wf ? startRun(task, wf, s.templates) : task] }
      }),
      updateTask: (task) => set((s) => ({
        tasks: s.tasks.map((t) => t.id === task.id ? syncRun(task, s.workflows, s.templates) : t),
      })),
      deleteTask: (id) => set((s) => ({ tasks: s.tasks.filter((t) => t.id !== id) })),

      addTemplate: (t) => set((s) => ({ templates: [...s.templates, t] })),
      updateTemplate: (t) => set((s) => ({ templates: s.templates.map((x) => x.id === t.id ? t : x) })),
      deleteTemplate: (id) => set((s) => ({ templates: s.templates.filter((t) => t.id !== id) })),

      addBmsDocument: (d) => set((s) => ({ bmsDocuments: [...s.bmsDocuments, d] })),
      updateBmsDocument: (d) => set((s) => ({ bmsDocuments: s.bmsDocuments.map((x) => x.id === d.id ? d : x) })),
      deleteBmsDocument: (id) => set((s) => ({ bmsDocuments: s.bmsDocuments.filter((x) => x.id !== id) })),

      addWorkflow: (w) => set((s) => ({ workflows: [...s.workflows, w] })),
      updateWorkflow: (w) => set((s) => ({ workflows: s.workflows.map((x) => x.id === w.id ? w : x) })),
      deleteWorkflow: (id) => set((s) => ({ workflows: s.workflows.filter((x) => x.id !== id) })),

      addTimesheetEntry: (e) => set((s) => ({ timesheetEntries: [...s.timesheetEntries, e] })),
      updateTimesheetEntry: (e) => set((s) => ({ timesheetEntries: s.timesheetEntries.map((x) => x.id === e.id ? e : x) })),
      deleteTimesheetEntry: (id) => set((s) => ({ timesheetEntries: s.timesheetEntries.filter((x) => x.id !== id) })),
      submitTimesheetWeek: (userId, weekStart) => set((s) => ({
        timesheetSubmissions: [...s.timesheetSubmissions.filter((x) => !(x.userId === userId && x.weekStart === weekStart)),
          { userId, weekStart, submittedAt: new Date().toISOString() }],
      })),
      reopenTimesheetWeek: (userId, weekStart) => set((s) => ({
        timesheetSubmissions: s.timesheetSubmissions.filter((x) => !(x.userId === userId && x.weekStart === weekStart)),
      })),

      setProjectOrgEntry: (projectId, memberId, patch) => set((s) => {
        const existing = s.projectOrg.find((e) => e.projectId === projectId && e.memberId === memberId)
        if (existing) return { projectOrg: s.projectOrg.map((e) => e === existing ? { ...e, ...patch } : e) }
        return { projectOrg: [...s.projectOrg, { projectId, memberId, title: '', reportsToId: null, ...patch }] }
      }),

      saveProjectDocumentFields: (projectId, bmsDocumentId, values, by) => set((s) => ({
        projectDocuments: s.projectDocuments.map((d) => d.projectId === projectId && d.bmsDocumentId === bmsDocumentId
          ? { ...d, fieldValues: values, fieldsUpdatedAt: new Date().toISOString(), fieldsUpdatedBy: by } : d),
      })),

      adoptProjectDocument: (projectId, bmsDocumentId, version, by) => set((s) => {
        const now = new Date().toISOString()
        const existing = s.projectDocuments.find((d) => d.projectId === projectId && d.bmsDocumentId === bmsDocumentId)
        if (existing) {
          return { projectDocuments: s.projectDocuments.map((d) => d === existing
            ? { ...d, adoptedVersion: version, adoptedAt: now, adoptedBy: by, history: [...d.history, { version, at: now, by }] } : d) }
        }
        return { projectDocuments: [...s.projectDocuments, {
          id: `pd-${projectId}-${bmsDocumentId}`, projectId, bmsDocumentId, adoptedVersion: version,
          adoptedAt: now, adoptedBy: by, history: [{ version, at: now, by }],
        }] }
      }),
    }),
    { name: 'itp-store' }
  )
)
