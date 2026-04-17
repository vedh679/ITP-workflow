import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppStore } from '../store'
import type { Task, ChecklistTemplate } from '../types'
import TaskMindMap from '../components/TaskMindMap'
import TaskTableView from '../components/TaskTableView'
import AddChecklistModal from '../components/AddChecklistModal'
import ChecklistDetail from '../components/ChecklistDetail'
import NewTaskModal from '../components/NewTaskModal'
import ProjectSwitcher from '../components/ProjectSwitcher'

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
  const { currentUser, currentProjectId, members, tasks, templates, addTask, updateTask } = useAppStore()

  // Build name lookup from live members list
  const memberNameMap: Record<string, string> = Object.fromEntries(members.map((m) => [m.email, m.name]))

  // Non-admins only see tasks for the active project
  const projectFilteredTasks = currentUser?.role === 'admin'
    ? tasks
    : tasks.filter((t) => t.projectId === currentProjectId)

  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(projectFilteredTasks[0]?.id ?? null)
  const [search, setSearch] = useState('')
  const [filterMine, setFilterMine] = useState(false)
  const [showAddChecklist, setShowAddChecklist] = useState(false)
  const [openChecklistId, setOpenChecklistId] = useState<string | null>(null)
  const [showNewTask, setShowNewTask] = useState(false)
  const [editingTask, setEditingTask] = useState<Task | null>(null)
  const [viewMode, setViewMode] = useState<'mindmap' | 'table'>('mindmap')
  const [sidebarOpen, setSidebarOpen] = useState(true)

  // Reset selected task when the active project changes
  useEffect(() => {
    setSelectedTaskId(projectFilteredTasks[0]?.id ?? null)
    setOpenChecklistId(null)
  }, [currentProjectId])  // eslint-disable-line react-hooks/exhaustive-deps

  if (!currentUser) { navigate('/'); return null }

  const canEdit = currentUser.role === 'admin' || currentUser.role === 'manager'

  const filteredTasks = projectFilteredTasks.filter((t) => {
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

  const handleCreateTask = (fields: Omit<Task, 'id' | 'createdAt' | 'checklists' | 'status' | 'projectId'>) => {
    const task: Task = {
      id: `task-${Date.now()}`,
      status: 'pending',
      checklists: [],
      createdAt: new Date().toISOString(),
      projectId: currentProjectId ?? '',
      ...fields,
    }
    addTask(task)
    setSelectedTaskId(task.id)
    setShowNewTask(false)
  }

  const handleSaveEdit = (fields: Omit<Task, 'id' | 'createdAt' | 'checklists' | 'status' | 'projectId'>) => {
    if (!editingTask) return
    // projectId is preserved from the original task — never changed on edit
    updateTask({ ...editingTask, ...fields })
    setEditingTask(null)
  }

  return (
    <div className="flex h-screen bg-slate-950 overflow-hidden">
      {/* ── Sidebar ── */}
      <aside
        className="relative flex flex-col border-r border-slate-800 bg-slate-900 transition-all duration-300 ease-in-out flex-shrink-0"
        style={{ width: sidebarOpen ? '25%' : '48px', minWidth: sidebarOpen ? '220px' : '48px' }}
      >
        {/* Collapse toggle — sits on the right edge */}
        <button
          onClick={() => setSidebarOpen((v) => !v)}
          title={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
          className="absolute -right-3 top-6 z-20 w-6 h-6 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-700 transition-colors shadow-md"
        >
          <svg className={`w-3 h-3 transition-transform duration-300 ${sidebarOpen ? '' : 'rotate-180'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        {/* ── Collapsed state: icon strip ── */}
        {!sidebarOpen && (
          <div className="flex flex-col items-center pt-4 gap-3 flex-1 overflow-y-auto">
            {/* Back home */}
            <button
              onClick={() => navigate('/home')}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-500 hover:text-white hover:bg-slate-800 transition-colors"
              title="Back to home"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
              </svg>
            </button>

            <div className="w-5 h-px bg-slate-800" />

            {/* Task dots */}
            {filteredTasks.map((task) => (
              <button
                key={task.id}
                onClick={() => setSelectedTaskId(task.id)}
                title={task.name}
                className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold transition-all ${
                  selectedTaskId === task.id
                    ? 'bg-blue-600/30 text-blue-300 border border-blue-600/50'
                    : 'text-slate-500 hover:bg-slate-800 hover:text-slate-300'
                }`}
              >
                {task.name.charAt(0).toUpperCase()}
              </button>
            ))}

            {/* Add task */}
            {canEdit && (
              <>
                <div className="w-5 h-px bg-slate-800" />
                <button
                  onClick={() => setShowNewTask(true)}
                  title="New task"
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-600 hover:text-blue-400 hover:bg-slate-800 border border-dashed border-slate-700 hover:border-blue-600/50 transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                </button>
              </>
            )}
          </div>
        )}

        {/* ── Expanded state: full sidebar ── */}
        {sidebarOpen && (
          <>
            {/* Sidebar header */}
            <div className="px-4 py-4 border-b border-slate-800">
              <div className="flex items-center gap-2 mb-3">
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
                          title={memberNameMap[task.assignedTo] ?? task.assignedTo}>
                          {(memberNameMap[task.assignedTo] ?? task.assignedTo).charAt(0)}
                        </div>
                      )}
                    </div>
                  </button>
                ))
              )}
            </div>

            {/* Add new task — managers and admins only */}
            {canEdit && (
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
            )}
          </>
        )}
      </aside>

      {/* ── Main area 75% ── */}
      <main className="flex-1 overflow-hidden flex flex-col">

        {/* Toolbar: view toggle (managers/admins) + project switcher */}
        <div className="flex-shrink-0 flex items-center justify-between px-4 py-2 border-b border-slate-800 bg-slate-900/60">
          {/* View toggle — managers & admins only */}
          {canEdit ? (
            <div className="flex items-center gap-1 p-1 bg-slate-800 rounded-lg">
              <button
                onClick={() => setViewMode('mindmap')}
                title="Mind map"
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                  viewMode === 'mindmap'
                    ? 'bg-slate-700 text-white shadow'
                    : 'text-slate-500 hover:text-slate-300'
                }`}
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <circle cx="12" cy="12" r="3" strokeWidth={2}/>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M12 9V5m0 14v-4M9 12H5m14 0h-4M7.05 7.05l-1.42-1.42M18.36 18.36l-1.41-1.41M16.95 7.05l1.41-1.41M5.64 18.36l1.41-1.42" />
                </svg>
                Mind Map
              </button>
              <button
                onClick={() => setViewMode('table')}
                title="Table view"
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                  viewMode === 'table'
                    ? 'bg-slate-700 text-white shadow'
                    : 'text-slate-500 hover:text-slate-300'
                }`}
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M3 10h18M3 14h18M10 3v18M3 6a3 3 0 013-3h12a3 3 0 013 3v12a3 3 0 01-3 3H6a3 3 0 01-3-3V6z" />
                </svg>
                Table
              </button>
            </div>
          ) : <div />}

          <ProjectSwitcher variant="dark" />
        </div>

        {/* Content */}
        {selectedTask ? (
          <div className="flex-1 overflow-hidden relative">
            {viewMode === 'mindmap' ? (
              <>
                <TaskMindMap
                  task={selectedTask}
                  onAddChecklist={handleAddChecklist}
                  onOpenChecklist={handleOpenChecklist}
                  onEditTask={(t) => canEdit && setEditingTask(t)}
                  canEdit={canEdit}
                />
                {openChecklistId && (() => {
                  const cl = selectedTask.checklists.find((c) => c.id === openChecklistId)
                  return cl ? (
                    <ChecklistDetail
                      task={selectedTask}
                      checklist={cl}
                      onClose={() => setOpenChecklistId(null)}
                      onDelete={() => {
                        updateTask({
                          ...selectedTask,
                          checklists: selectedTask.checklists.filter((c) => c.id !== openChecklistId),
                        })
                        setOpenChecklistId(null)
                      }}
                    />
                  ) : null
                })()}
              </>
            ) : (
              <TaskTableView task={selectedTask} members={members} />
            )}
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <div className="w-16 h-16 rounded-2xl bg-slate-800 flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              </div>
              <p className="text-slate-500 text-sm">Select a task to view</p>
            </div>
          </div>
        )}
      </main>

      {/* Add checklist modal */}
      {showAddChecklist && selectedTask && (
        <AddChecklistModal
          templates={templates}
          projectId={selectedTask.projectId}
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
