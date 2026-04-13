import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { AppUser, Project, Task, ChecklistTemplate } from './types'

interface AppState {
  currentUser: AppUser | null
  members: AppUser[]
  projects: Project[]
  tasks: Task[]
  templates: ChecklistTemplate[]

  setCurrentUser: (user: AppUser | null) => void

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
}

// ── Sample projects ───────────────────────────────────────────────
const SAMPLE_PROJECTS: Project[] = [
  { id: 'p1', name: 'Building A Renovation', description: 'Full structural and services renovation of Building A' },
  { id: 'p2', name: 'Substation Upgrade', description: 'Electrical substation upgrade and commissioning' },
]

// ── Sample members ────────────────────────────────────────────────
const SAMPLE_MEMBERS: AppUser[] = [
  { id: 'u1', email: 'admin@itp.com',     name: 'Admin User',      role: 'admin',    projectIds: ['p1', 'p2'] },
  { id: 'u2', email: 'manager@itp.com',   name: 'Project Manager', role: 'manager',  projectIds: ['p1', 'p2'] },
  { id: 'u3', email: 'vedh@itp.com',      name: 'Vedh',            role: 'manager',  projectIds: ['p1'] },
  { id: 'u4', email: 'inspector@itp.com', name: 'Site Inspector',  role: 'engineer', projectIds: ['p1'] },
  { id: 'u5', email: 'engineer@itp.com',  name: 'Field Engineer',  role: 'engineer', projectIds: ['p2'] },
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

// ── Store ─────────────────────────────────────────────────────────
export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      currentUser: null,
      members: SAMPLE_MEMBERS,
      projects: SAMPLE_PROJECTS,
      tasks: SAMPLE_TASKS,
      templates: SAMPLE_TEMPLATES,

      setCurrentUser: (user) => set({ currentUser: user }),

      addMember: (m) => set((s) => ({ members: [...s.members, m] })),
      updateMember: (m) => set((s) => ({ members: s.members.map((x) => x.id === m.id ? m : x) })),
      deleteMember: (id) => set((s) => ({ members: s.members.filter((x) => x.id !== id) })),

      addProject: (p) => set((s) => ({ projects: [...s.projects, p] })),
      updateProject: (p) => set((s) => ({ projects: s.projects.map((x) => x.id === p.id ? p : x) })),
      deleteProject: (id) => set((s) => ({ projects: s.projects.filter((x) => x.id !== id) })),

      addTask: (task) => set((s) => ({ tasks: [...s.tasks, task] })),
      updateTask: (task) => set((s) => ({ tasks: s.tasks.map((t) => t.id === task.id ? task : t) })),
      deleteTask: (id) => set((s) => ({ tasks: s.tasks.filter((t) => t.id !== id) })),

      addTemplate: (t) => set((s) => ({ templates: [...s.templates, t] })),
      updateTemplate: (t) => set((s) => ({ templates: s.templates.map((x) => x.id === t.id ? t : x) })),
      deleteTemplate: (id) => set((s) => ({ templates: s.templates.filter((t) => t.id !== id) })),
    }),
    { name: 'itp-store' }
  )
)
