import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppStore } from '../store'
import type { Task, ChecklistTemplate } from '../types'
import TaskMindMap from '../components/TaskMindMap'
import AddChecklistModal from '../components/AddChecklistModal'
import ChecklistDetail from '../components/ChecklistDetail'
import NewTaskModal from '../components/NewTaskModal'

const USER_NAMES: Record<string, string> = {
  'admin@itp.com': 'Admin User',
  'vedh@itp.com': 'Vedh',
  'inspector@itp.com': 'Site Inspector',
}

function statusBadge(status: Task['status']) {
  const map = {
    'pending': 'bg-slate-700 text-slate-300',
    'in-progress': 'bg-blue-900/60 text-blue-300',
    'completed': 'bg-green-900/60 text-green-300',
  }
  return map[status]
}

function formatDate(iso: string) {
  if (!iso) return null
  const d = new Date(iso + 'T00:00:00')
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function TasksPage() {
  const navigate = useNavigate()
  const { currentUser, tasks, templates, addTask, updateTask } = useAppStore()
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(tasks[0]?.id ?? null)
  const [search, setSearch] = useState('')
  const [filterMine, setFilterMine] = useState(false)
  const [showAddChecklist, setShowAddChecklist] = useState(false)
  const [openChecklistId, setOpenChecklistId] = useState<string | null>(null)
  const [showNewTask, setShowNewTask] = useState(false)
  const [editingTask, setEditingTask] = useState<Task | null>(null)

  if (!currentUser) { navigate('/'); return null }

  const filteredTasks = tasks.filter((t) => {
    const matchSearch = t.name.toLowerCase().includes(search.toLowerCase())
    const matchMine = !filterMine || t.assignedTo === currentUser.email
    return matchSearch && matchMine
  })

  const selectedTask = tasks.find((t) => t.id === selectedTaskId) ?? null

  const handleAddChecklist = (taskId: string) => {
    setSelectedTaskId(taskId)
    setShowAddChecklist(true)
  }

  const handleOpenChecklist = (checklistId: string) => {
    setOpenChecklistId(checklistId)
  }

  const handleChecklistSelected = (template: ChecklistTemplate, assignedTo: string) => {
    if (!selectedTask) return
    const newChecklist = {
      id: `cl-${Date.now()}`,
      templateId: template.id,
      templateName: template.name,
      requiresSignature: template.requiresSignature,
      assignedTo: assignedTo || undefined,
      items: template.items.map((i) => ({ ...i, completed: false })),
    }
    updateTask({ ...selectedTask, checklists: [...selectedTask.checklists, newChecklist] })
    setShowAddChecklist(false)
  }

  const handleCreateTask = (fields: Omit<Task, 'id' | 'createdAt' | 'checklists' | 'status'>) => {
    const task: Task = {
      id: `task-${Date.now()}`,
      status: 'pending',
      checklists: [],
      createdAt: new Date().toISOString(),
      ...fields,
    }
    addTask(task)
    setSelectedTaskId(task.id)
    setShowNewTask(false)
  }

  const handleSaveEdit = (fields: Omit<Task, 'id' | 'createdAt' | 'checklists' | 'status'>) => {
    if (!editingTask) return
    updateTask({ ...editingTask, ...fields })
    setEditingTask(null)
  }

  return (
    <div className="flex h-screen bg-slate-950 overflow-hidden">
      {/* ── Sidebar 25% ── */}
      <aside className="w-1/4 min-w-[220px] flex flex-col border-r border-slate-800 bg-slate-900">
        {/* Sidebar header */}
        <div className="px-4 py-4 border-b border-slate-800">
          <div className="flex items-center gap-2 mb-4">
            <button
              onClick={() => navigate('/home')}
              className="text-slate-400 hover:text-white transition-colors"
              title="Back to home"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <h1 className="text-white font-bold text-base">Tasks</h1>
          </div>

          {/* Search */}
          <div className="relative mb-3">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search tasks…"
              className="w-full bg-slate-800 text-slate-200 placeholder-slate-500 text-sm rounded-lg pl-9 pr-3 py-2 border border-slate-700 focus:outline-none focus:border-blue-500 transition-colors"
            />
          </div>

          {/* Filter toggle */}
          <button
            onClick={() => setFilterMine((v) => !v)}
            className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              filterMine
                ? 'bg-blue-600/20 text-blue-300 border border-blue-600/40'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            {filterMine ? 'My tasks only' : 'All tasks'}
          </button>
        </div>

        {/* Task list */}
        <div className="flex-1 overflow-y-auto px-3 py-3 space-y-1">
          {filteredTasks.length === 0 ? (
            <p className="text-slate-500 text-xs text-center py-8">No tasks found</p>
          ) : (
            filteredTasks.map((task) => (
              <button
                key={task.id}
                onClick={() => setSelectedTaskId(task.id)}
                className={`w-full text-left px-3 py-3 rounded-xl transition-all ${
                  selectedTaskId === task.id
                    ? 'bg-blue-600/20 border border-blue-600/40'
                    : 'hover:bg-slate-800 border border-transparent'
                }`}
              >
                <div className="text-sm font-medium text-slate-200 truncate">{task.name}</div>

                <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusBadge(task.status)}`}>
                    {task.status}
                  </span>
                  <span className="text-xs text-slate-500">
                    {task.checklists.length} checklist{task.checklists.length !== 1 ? 's' : ''}
                  </span>
                </div>

                {/* Location */}
                {task.location && (
                  <div className="flex items-center gap-1 mt-1.5">
                    <svg className="w-3 h-3 text-slate-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    <span className="text-xs text-slate-500 truncate">{task.location}</span>
                  </div>
                )}

                {/* Due date + assigned user */}
                <div className="flex items-center justify-between mt-1">
                  {task.dueDate ? (
                    <div className="flex items-center gap-1">
                      <svg className="w-3 h-3 text-slate-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      <span className="text-xs text-slate-500">{formatDate(task.dueDate)}</span>
                    </div>
                  ) : <span />}
                  {task.assignedTo && (
                    <div className="w-5 h-5 rounded-full bg-blue-800/50 text-blue-300 flex items-center justify-center text-xs font-bold flex-shrink-0"
                      title={USER_NAMES[task.assignedTo] ?? task.assignedTo}>
                      {(USER_NAMES[task.assignedTo] ?? task.assignedTo).charAt(0)}
                    </div>
                  )}
                </div>
              </button>
            ))
          )}
        </div>

        {/* Add new task */}
        <div className="p-3 border-t border-slate-800">
          <button
            onClick={() => setShowNewTask(true)}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-dashed border-slate-700 text-slate-500 hover:text-slate-300 hover:border-slate-500 text-sm font-medium transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            New Task
          </button>
        </div>
      </aside>

      {/* ── Mind map 75% ── */}
      <main className="flex-1 overflow-hidden relative flex flex-col">
        {selectedTask ? (
          <>
            {/* Task info bar */}
            <div className="flex items-center gap-4 px-5 py-3 border-b border-slate-800 bg-slate-900/80 backdrop-blur flex-shrink-0">
              <div className="flex-1 min-w-0">
                <h2 className="text-sm font-bold text-white truncate">{selectedTask.name}</h2>
                <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                  {selectedTask.location && (
                    <span className="flex items-center gap-1 text-xs text-slate-400">
                      <svg className="w-3 h-3 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0zM15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      {selectedTask.location}
                    </span>
                  )}
                  {selectedTask.dueDate && (
                    <span className="flex items-center gap-1 text-xs text-slate-400">
                      <svg className="w-3 h-3 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      Due {formatDate(selectedTask.dueDate)}
                    </span>
                  )}
                  {selectedTask.assignedTo && (
                    <span className="flex items-center gap-1 text-xs text-slate-400">
                      <svg className="w-3 h-3 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                      {USER_NAMES[selectedTask.assignedTo] ?? selectedTask.assignedTo}
                    </span>
                  )}
                </div>
              </div>
              <button
                onClick={() => setEditingTask(selectedTask)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-700 text-slate-400 hover:text-white hover:border-slate-500 text-xs font-medium transition-colors flex-shrink-0"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                Edit task
              </button>
            </div>

            <div className="flex-1 overflow-hidden relative">
            <TaskMindMap
              task={selectedTask}
              onAddChecklist={handleAddChecklist}
              onOpenChecklist={handleOpenChecklist}
            />
            {openChecklistId && (() => {
              const cl = selectedTask.checklists.find((c) => c.id === openChecklistId)
              return cl ? (
                <ChecklistDetail
                  task={selectedTask}
                  checklist={cl}
                  onClose={() => setOpenChecklistId(null)}
                />
              ) : null
            })()}
            </div>
          </>
        ) : (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <div className="w-16 h-16 rounded-2xl bg-slate-800 flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              </div>
              <p className="text-slate-500 text-sm">Select a task to view its mind map</p>
            </div>
          </div>
        )}
      </main>

      {/* Add checklist modal */}
      {showAddChecklist && selectedTask && (
        <AddChecklistModal
          templates={templates}
          onAdd={(tmpl, assignedTo) => handleChecklistSelected(tmpl, assignedTo)}
          onClose={() => setShowAddChecklist(false)}
        />
      )}

      {/* New task modal */}
      {showNewTask && (
        <NewTaskModal
          onAdd={handleCreateTask}
          onClose={() => setShowNewTask(false)}
        />
      )}

      {/* Edit task modal */}
      {editingTask && (
        <NewTaskModal
          initialValues={{
            name: editingTask.name,
            description: editingTask.description,
            location: editingTask.location,
            dueDate: editingTask.dueDate,
            assignedTo: editingTask.assignedTo,
          }}
          onAdd={handleSaveEdit}
          onClose={() => setEditingTask(null)}
        />
      )}
    </div>
  )
}
