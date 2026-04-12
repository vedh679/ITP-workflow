import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppStore } from '../store'
import type { Task, ChecklistTemplate } from '../types'
import TaskMindMap from '../components/TaskMindMap'
import AddChecklistModal from '../components/AddChecklistModal'
import ChecklistDetail from '../components/ChecklistDetail'

function statusBadge(status: Task['status']) {
  const map = {
    'pending': 'bg-slate-700 text-slate-300',
    'in-progress': 'bg-blue-900/60 text-blue-300',
    'completed': 'bg-green-900/60 text-green-300',
  }
  return map[status]
}

export default function TasksPage() {
  const navigate = useNavigate()
  const { currentUser, tasks, templates, addTask, updateTask } = useAppStore()
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(
    tasks[0]?.id ?? null
  )
  const [search, setSearch] = useState('')
  const [filterMine, setFilterMine] = useState(false)
  const [showAddChecklist, setShowAddChecklist] = useState(false)
  const [openChecklistId, setOpenChecklistId] = useState<string | null>(null)
  const [showNewTask, setShowNewTask] = useState(false)
  const [newTaskName, setNewTaskName] = useState('')

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

  const handleCreateTask = () => {
    if (!newTaskName.trim()) return
    const task: Task = {
      id: `task-${Date.now()}`,
      name: newTaskName.trim(),
      description: '',
      assignedTo: currentUser.email,
      status: 'pending',
      checklists: [],
      createdAt: new Date().toISOString(),
    }
    addTask(task)
    setSelectedTaskId(task.id)
    setNewTaskName('')
    setShowNewTask(false)
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
                <div className="flex items-center gap-2 mt-1.5">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusBadge(task.status)}`}>
                    {task.status}
                  </span>
                  <span className="text-xs text-slate-500">{task.checklists.length} checklist{task.checklists.length !== 1 ? 's' : ''}</span>
                </div>
                <div className="text-xs text-slate-600 mt-1 truncate">{task.assignedTo}</div>
              </button>
            ))
          )}
        </div>

        {/* Add new task */}
        <div className="p-3 border-t border-slate-800">
          {showNewTask ? (
            <div className="space-y-2">
              <input
                autoFocus
                type="text"
                value={newTaskName}
                onChange={(e) => setNewTaskName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleCreateTask(); if (e.key === 'Escape') setShowNewTask(false) }}
                placeholder="Task name…"
                className="w-full bg-slate-800 text-slate-200 placeholder-slate-500 text-sm rounded-lg px-3 py-2 border border-slate-700 focus:outline-none focus:border-blue-500"
              />
              <div className="flex gap-2">
                <button onClick={handleCreateTask} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold py-1.5 rounded-lg transition-colors">Create</button>
                <button onClick={() => setShowNewTask(false)} className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold py-1.5 rounded-lg transition-colors">Cancel</button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShowNewTask(true)}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-dashed border-slate-700 text-slate-500 hover:text-slate-300 hover:border-slate-500 text-sm font-medium transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              New Task
            </button>
          )}
        </div>
      </aside>

      {/* ── Mind map 75% ── */}
      <main className="flex-1 overflow-hidden relative">
        {selectedTask ? (
          <>
            <TaskMindMap
              task={selectedTask}
              onAddChecklist={handleAddChecklist}
              onOpenChecklist={handleOpenChecklist}
            />
            {/* Full-page checklist detail overlay */}
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
    </div>
  )
}
