import { useState } from 'react'
import type { Task, TaskChecklist } from '../types'
import { useAppStore } from '../store'

const USER_NAMES: Record<string, string> = {
  'admin@itp.com': 'Admin User',
  'vedh@itp.com': 'Vedh',
  'inspector@itp.com': 'Site Inspector',
}

interface Props {
  task: Task
  checklist: TaskChecklist
  onClose: () => void
}

export default function ChecklistDetail({ task, checklist, onClose }: Props) {
  const updateTask = useAppStore((s) => s.updateTask)
  const [signerName, setSignerName] = useState('')
  const [showSignInput, setShowSignInput] = useState(false)

  const liveChecklist = task.checklists.find((cl) => cl.id === checklist.id) ?? checklist

  const itemsDone = liveChecklist.items.filter((i) => i.completed).length
  const total = liveChecklist.items.length
  const allItemsDone = itemsDone === total && total > 0
  const isSigned = !!liveChecklist.signature
  const isFullyComplete = allItemsDone && (!liveChecklist.requiresSignature || isSigned)

  const pct = !liveChecklist.requiresSignature
    ? (total > 0 ? Math.round((itemsDone / total) * 100) : 0)
    : Math.round(((itemsDone + (isSigned ? 1 : 0)) / (total + 1)) * 100)

  const updateChecklist = (updated: Partial<TaskChecklist>) => {
    const updatedTask: Task = {
      ...task,
      checklists: task.checklists.map((cl) =>
        cl.id === liveChecklist.id ? { ...cl, ...updated } : cl
      ),
    }
    updateTask(updatedTask)
  }

  const toggleItem = (itemId: string) => {
    updateChecklist({
      items: liveChecklist.items.map((it) =>
        it.id === itemId ? { ...it, completed: !it.completed } : it
      ),
    })
  }

  const submitSignature = () => {
    if (!signerName.trim()) return
    updateChecklist({ signature: { name: signerName.trim(), date: new Date().toISOString() } })
    setShowSignInput(false)
    setSignerName('')
  }

  const clearSignature = () => {
    updateChecklist({ signature: undefined })
  }

  return (
    <div className="absolute inset-0 z-10 bg-slate-950 flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-4 px-8 py-5 border-b border-slate-800">
        <button
          onClick={onClose}
          className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors text-sm font-medium"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to mind map
        </button>

        <div className="h-5 w-px bg-slate-700" />

        <div className="flex-1 min-w-0">
          <p className="text-xs text-slate-500 uppercase tracking-wide font-semibold">{task.name}</p>
          <h1 className="text-lg font-bold text-white truncate">{liveChecklist.templateName}</h1>
        </div>

        {/* Assigned user */}
        {liveChecklist.assignedTo && (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-800 border border-slate-700">
            <div className="w-5 h-5 rounded-full bg-blue-600/40 text-blue-300 flex items-center justify-center text-xs font-bold flex-shrink-0">
              {(USER_NAMES[liveChecklist.assignedTo] ?? liveChecklist.assignedTo).charAt(0)}
            </div>
            <span className="text-xs text-slate-300 font-medium">
              {USER_NAMES[liveChecklist.assignedTo] ?? liveChecklist.assignedTo}
            </span>
          </div>
        )}

        <div className={`px-3 py-1.5 rounded-full text-sm font-semibold ${
          isFullyComplete
            ? 'bg-green-900/40 text-green-400 border border-green-800'
            : 'bg-blue-900/40 text-blue-400 border border-blue-800'
        }`}>
          {isFullyComplete ? 'Complete' : `${itemsDone} / ${total}`}
        </div>
      </div>

      {/* Progress bar */}
      <div className="px-8 py-4 border-b border-slate-800/50">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-slate-400">Progress</span>
          <span className="text-sm font-semibold text-slate-300">{pct}%</span>
        </div>
        <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${isFullyComplete ? 'bg-green-500' : 'bg-blue-500'}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {/* Checklist items */}
      <div className="flex-1 overflow-y-auto px-8 py-6">
        <div className="max-w-2xl mx-auto space-y-3">
          {liveChecklist.items.map((item, idx) => (
            <div
              key={item.id}
              onClick={() => toggleItem(item.id)}
              className={`flex items-start gap-4 p-4 rounded-xl border cursor-pointer transition-all ${
                item.completed
                  ? 'bg-green-950/20 border-green-900/40'
                  : 'bg-slate-900 border-slate-800 hover:border-slate-600'
              }`}
            >
              <div className={`flex-shrink-0 mt-0.5 w-5 h-5 rounded-md border-2 flex items-center justify-center transition-colors ${
                item.completed ? 'bg-green-500 border-green-500' : 'border-slate-600'
              }`}>
                {item.completed && (
                  <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </div>
              <div className="flex items-baseline gap-3 flex-1">
                <span className="text-xs text-slate-600 flex-shrink-0 font-mono">{String(idx + 1).padStart(2, '0')}</span>
                <span className={`text-sm font-medium leading-relaxed ${
                  item.completed ? 'line-through text-slate-600' : 'text-slate-200'
                }`}>
                  {item.text}
                </span>
              </div>
            </div>
          ))}

          {/* ── Signature section ── */}
          {liveChecklist.requiresSignature && (
            <div className={`rounded-xl border p-5 mt-2 transition-all ${
              isSigned
                ? 'bg-green-950/20 border-green-900/40'
                : 'bg-amber-950/10 border-amber-900/30'
            }`}>
              <div className="flex items-center gap-3 mb-3">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                  isSigned ? 'bg-green-900/40 text-green-400' : 'bg-amber-900/30 text-amber-400'
                }`}>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                  </svg>
                </div>
                <div>
                  <p className={`text-sm font-semibold ${isSigned ? 'text-green-400' : 'text-amber-300'}`}>
                    {isSigned ? 'Signed off' : 'Signature required'}
                  </p>
                  <p className="text-xs text-slate-500">This checklist requires an authorised sign-off</p>
                </div>
              </div>

              {isSigned && liveChecklist.signature ? (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 bg-green-950/30 border border-green-900/40 rounded-lg px-4 py-2.5 flex-1">
                    <svg className="w-4 h-4 text-green-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                    </svg>
                    <div>
                      <p className="text-sm font-semibold text-green-300">{liveChecklist.signature.name}</p>
                      <p className="text-xs text-green-700">
                        {new Date(liveChecklist.signature.date).toLocaleString(undefined, {
                          dateStyle: 'medium', timeStyle: 'short',
                        })}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={clearSignature}
                    className="ml-3 text-xs text-slate-600 hover:text-red-400 transition-colors"
                  >
                    Clear
                  </button>
                </div>
              ) : showSignInput ? (
                <div className="space-y-2">
                  <input
                    autoFocus
                    type="text"
                    value={signerName}
                    onChange={(e) => setSignerName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') submitSignature()
                      if (e.key === 'Escape') setShowSignInput(false)
                    }}
                    placeholder="Enter your full name…"
                    className="w-full bg-slate-900 text-slate-100 placeholder-slate-500 rounded-lg px-3 py-2.5 border border-amber-800/50 focus:outline-none focus:border-amber-500 text-sm transition-colors"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={submitSignature}
                      disabled={!signerName.trim()}
                      className="flex-1 py-2 rounded-lg bg-amber-600 hover:bg-amber-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold transition-colors"
                    >
                      Confirm signature
                    </button>
                    <button
                      onClick={() => setShowSignInput(false)}
                      className="px-4 py-2 rounded-lg border border-slate-700 text-slate-400 hover:text-white text-sm transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setShowSignInput(true)}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-sm font-semibold transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                  </svg>
                  Sign off checklist
                </button>
              )}
            </div>
          )}

          {/* All done banner */}
          {isFullyComplete && (
            <div className="mt-4">
              <div className="bg-green-950/30 border border-green-800/40 rounded-xl px-6 py-4 flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center flex-shrink-0">
                  <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <div>
                  <p className="text-green-400 font-semibold text-sm">Checklist fully complete</p>
                  <p className="text-green-700 text-xs">All items checked{liveChecklist.requiresSignature ? ' and signed off' : ''}.</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
