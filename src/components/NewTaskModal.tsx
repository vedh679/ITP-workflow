import { useState } from 'react'
import { useAppStore } from '../store'
import type { Task } from '../types'
import MemberPicker from './MemberPicker'

type TaskFields = Omit<Task, 'id' | 'createdAt' | 'checklists' | 'status' | 'projectId'>

interface Props {
  initialValues?: Partial<TaskFields>
  onAdd: (task: TaskFields) => void
  onClose: () => void
}

export default function NewTaskModal({ initialValues, onAdd, onClose }: Props) {
  const { members, currentProjectId } = useAppStore()
  const [name, setName] = useState(initialValues?.name ?? '')
  const [description, setDescription] = useState(initialValues?.description ?? '')
  const [location, setLocation] = useState(initialValues?.location ?? '')
  const [dueDate, setDueDate] = useState(initialValues?.dueDate ?? '')
  const [assignedTo, setAssignedTo] = useState(initialValues?.assignedTo ?? '')

  const isEdit = !!initialValues

  // Only show members belonging to the active project
  const visibleMembers = currentProjectId
    ? members.filter((m) => m.projectIds.includes(currentProjectId))
    : members

  const canSubmit = name.trim() && assignedTo

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!canSubmit) return
    onAdd({ name: name.trim(), description, location, dueDate, assignedTo })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-lg">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-800">
          <h2 className="text-lg font-bold text-white">{isEdit ? 'Edit Task' : 'New Task'}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="px-6 py-5 space-y-4">

            {/* Task name */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">
                Task name <span className="text-red-400">*</span>
              </label>
              <input
                autoFocus
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Building A — Level 3 ITP"
                className="w-full bg-slate-800 text-slate-100 placeholder-slate-500 rounded-xl px-4 py-3 border border-slate-700 focus:outline-none focus:border-blue-500 text-sm transition-colors"
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Brief description of this ITP…"
                rows={2}
                className="w-full bg-slate-800 text-slate-100 placeholder-slate-500 rounded-xl px-4 py-3 border border-slate-700 focus:outline-none focus:border-blue-500 text-sm transition-colors resize-none"
              />
            </div>

            {/* Location + Due date side by side */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">
                  <span className="flex items-center gap-1.5">
                    <svg className="w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    Location
                  </span>
                </label>
                <input
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="e.g. Site B, Level 2"
                  className="w-full bg-slate-800 text-slate-100 placeholder-slate-500 rounded-xl px-3 py-2.5 border border-slate-700 focus:outline-none focus:border-blue-500 text-sm transition-colors"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">
                  <span className="flex items-center gap-1.5">
                    <svg className="w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    Due date
                  </span>
                </label>
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="w-full bg-slate-800 text-slate-100 rounded-xl px-3 py-2.5 border border-slate-700 focus:outline-none focus:border-blue-500 text-sm transition-colors [color-scheme:dark]"
                />
              </div>
            </div>

            {/* Assign to */}
            <MemberPicker
              members={visibleMembers}
              value={assignedTo}
              onChange={setAssignedTo}
              label="Assign to"
              required
              placeholder={visibleMembers.length === 0 ? 'No members on this project' : 'Search by name…'}
            />

          </div>

          {/* Actions */}
          <div className="flex gap-3 px-6 py-5 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-slate-700 text-slate-300 hover:bg-slate-800 transition-colors text-sm font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!canSubmit}
              className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold transition-colors"
            >
              {isEdit ? 'Save Changes' : 'Create Task'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
