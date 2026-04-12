import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { User, Task, ChecklistTemplate } from './types'

interface AppState {
  currentUser: User | null
  tasks: Task[]
  templates: ChecklistTemplate[]

  setCurrentUser: (user: User | null) => void
  addTask: (task: Task) => void
  updateTask: (task: Task) => void
  deleteTask: (id: string) => void
  addTemplate: (template: ChecklistTemplate) => void
  updateTemplate: (template: ChecklistTemplate) => void
  deleteTemplate: (id: string) => void
}

const SAMPLE_TEMPLATES: ChecklistTemplate[] = [
  {
    id: 't1',
    name: 'Site Safety Inspection',
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
    id: 't2',
    name: 'Electrical Systems Check',
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
    id: 't3',
    name: 'Structural Integrity Review',
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

const SAMPLE_TASKS: Task[] = [
  {
    id: 'task1',
    name: 'Building A — Level 3 ITP',
    description: 'Inspection and test plan for Building A, Level 3',
    location: 'Building A, Level 3',
    dueDate: '2026-05-01',
    assignedTo: 'vedh@itp.com',
    status: 'in-progress',
    checklists: [
      {
        id: 'tc1',
        templateId: 't1',
        templateName: 'Site Safety Inspection',
        requiresSignature: true,
        assignedTo: 'vedh@itp.com',
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
    id: 'task2',
    name: 'Substation Electrical ITP',
    description: 'Electrical systems test for substation installation',
    location: 'Site B — Substation',
    dueDate: '2026-06-15',
    assignedTo: 'admin@itp.com',
    status: 'pending',
    checklists: [],
    createdAt: new Date().toISOString(),
  },
]

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      currentUser: null,
      tasks: SAMPLE_TASKS,
      templates: SAMPLE_TEMPLATES,

      setCurrentUser: (user) => set({ currentUser: user }),

      addTask: (task) => set((s) => ({ tasks: [...s.tasks, task] })),
      updateTask: (task) =>
        set((s) => ({ tasks: s.tasks.map((t) => (t.id === task.id ? task : t)) })),
      deleteTask: (id) => set((s) => ({ tasks: s.tasks.filter((t) => t.id !== id) })),

      addTemplate: (template) =>
        set((s) => ({ templates: [...s.templates, template] })),
      updateTemplate: (template) =>
        set((s) => ({
          templates: s.templates.map((t) => (t.id === template.id ? template : t)),
        })),
      deleteTemplate: (id) =>
        set((s) => ({ templates: s.templates.filter((t) => t.id !== id) })),
    }),
    { name: 'itp-store' }
  )
)
