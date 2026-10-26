import { useState } from 'react'
import { useAppStore } from '../store'
import { KIND_META, WorkflowDiagram } from './WorkflowFlow'
import { canActOnStep, completeStep, initiateLabel, initiateStep, isClientApproval, isManager, startRun } from '../workflow'
import type { Task, WorkflowLogOutcome } from '../types'

const OUTCOME_TEXT: Record<WorkflowLogOutcome, string> = {
  done: 'Completed', auto: 'Completed automatically', yes: 'Approved', no: 'Rejected', initiated: 'Initiated',
}

interface Props {
  task: Task
  onOpenChecklist: (checklistId: string) => void
}

// Shows a task's workflow progress to every member, and prompts the project
// manager when the next stage is waiting for them to initiate it.
export default function TaskWorkflowBanner({ task, onOpenChecklist }: Props) {
  const { workflows, templates, members, currentUser, updateTask } = useAppStore()
  const [expanded, setExpanded] = useState(false)
  const [note, setNote] = useState('')
  const [pickedWorkflow, setPickedWorkflow] = useState('')

  const manager = isManager(currentUser)
  const run = task.workflowRun

  // ── No workflow yet ──
  if (!run) {
    if (!manager || workflows.length === 0) return null
    const chosen = workflows.find((w) => w.id === (pickedWorkflow || workflows[0].id))!
    return (
      <div className="flex-shrink-0 flex items-center gap-3 px-4 py-2 border-b border-slate-800 bg-slate-900/60">
        <span className="text-xs text-slate-400">No workflow applied to this task</span>
        <select value={chosen.id} onChange={(e) => setPickedWorkflow(e.target.value)}
          className="bg-slate-800 border border-slate-700 rounded-lg px-2 py-1 text-xs text-slate-200 focus:outline-none">
          {workflows.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
        </select>
        <button onClick={() => updateTask(startRun(task, chosen, templates))}
          className="px-3 py-1 rounded-full bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold">Start workflow</button>
      </div>
    )
  }

  const wf = workflows.find((w) => w.id === run.workflowId)
  if (!wf) {
    return <div className="flex-shrink-0 px-4 py-2 border-b border-slate-800 bg-slate-900/60 text-xs text-red-300">The workflow "{run.workflowName}" for this task no longer exists.</div>
  }

  const node = wf.nodes.find((n) => n.id === run.currentNodeId)
  const doneCount = new Set(run.log.filter((l) => l.kind !== 'start' && l.kind !== 'end' && l.outcome !== 'initiated').map((l) => l.nodeId)).size
  const by = currentUser?.name ?? 'Unknown'
  const apply = (next: Task) => { updateTask(next); setNote('') }

  const approverName = node?.data.kind === 'approval' && !isClientApproval(node)
    ? members.find((m) => m.id === node.data.approverId)?.name : undefined
  const checklist = run.currentChecklistId ? task.checklists.find((c) => c.id === run.currentChecklistId) : undefined
  const meta = node ? KIND_META[node.data.kind] : null
  const awaiting = run.status === 'awaiting-initiation'
  const canAct = !!node && !!currentUser && canActOnStep(currentUser, task, node, members)

  const btn = 'px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors'

  return (
    <div className="flex-shrink-0 border-b border-slate-800 bg-slate-900/60">
      {/* Manager prompt */}
      {awaiting && node && (
        <div className="px-4 py-3 bg-amber-50 border-b border-amber-100 flex items-center gap-4 flex-wrap">
          <div className="w-8 h-8 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center font-bold">!</div>
          <div className="flex-1 min-w-[220px]">
            {manager ? (
              <>
                <p className="text-sm font-semibold text-amber-700">Ready for the next stage</p>
                <p className="text-xs text-amber-700/80">The previous steps are complete. Next: <span className="font-semibold">{node.data.label || meta?.label}</span>{node.data.description ? ` — ${node.data.description}` : ''}</p>
              </>
            ) : (
              <>
                <p className="text-sm font-semibold text-amber-700">Waiting for the project manager</p>
                <p className="text-xs text-amber-700/80">The project manager needs to initiate: {node.data.label || meta?.label}</p>
              </>
            )}
          </div>
          {manager && (
            <button onClick={() => apply(initiateStep(task, wf, templates, by))}
              className={`${btn} !px-4 !py-2 !text-sm bg-ink hover:bg-ink-soft text-white`}>{initiateLabel(node)}</button>
          )}
        </div>
      )}

      {/* Progress row */}
      <div className="flex items-center gap-3 px-4 py-2 flex-wrap">
        <span className="text-xs font-semibold text-slate-300">{run.workflowName}</span>
        <span className="text-xs text-slate-500">{doneCount} step{doneCount === 1 ? '' : 's'} done</span>
        {run.status === 'completed' && <span className="text-xs px-2 py-0.5 rounded-full bg-green-900/50 text-green-300 border border-green-800/50">Workflow complete</span>}
        {run.status === 'running' && node && meta && (
          <span className="text-xs px-2 py-0.5 rounded-full border" style={{ color: meta.color, borderColor: meta.color }}>
            Now: {node.data.label || meta.label}
          </span>
        )}
        <button onClick={() => setExpanded((v) => !v)} className="ml-auto text-xs text-slate-400 hover:text-ink">{expanded ? 'Hide flow ▴' : 'View flow ▾'}</button>
      </div>

      {/* Current step actions */}
      {run.status === 'running' && node && meta && (
        <div className="px-4 pb-3 flex items-start gap-4 flex-wrap">
          <div className="flex-1 min-w-[220px]">
            <p className="text-[10px] font-bold tracking-wider" style={{ color: meta.color }}>{meta.label.toUpperCase()}</p>
            {node.data.description && <p className="text-xs text-slate-400 mt-0.5 whitespace-pre-wrap">{node.data.description}</p>}
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {node.data.kind === 'checklist' && checklist && (
              <>
                <span className="text-xs text-slate-400">
                  {checklist.items.filter((i) => i.completed).length}/{checklist.items.length} items
                  {checklist.requiresSignature && !checklist.signature ? ' · needs signature' : ''} · moves on when complete
                </span>
                <button onClick={() => onOpenChecklist(checklist.id)} className={`${btn} bg-purple-600 hover:bg-purple-500 text-white`}>Open checklist</button>
              </>
            )}

            {(node.data.kind === 'procedure' || node.data.kind === 'task') && (
              canAct
                ? <button onClick={() => apply(completeStep(task, wf, templates, by))} className={`${btn} bg-blue-600 hover:bg-blue-500 text-white`}>Mark step done</button>
                : <span className="text-xs text-slate-500">Waiting for the assignee or project manager</span>
            )}

            {node.data.kind === 'approval' && isClientApproval(node) && (
              <>
                <span className="text-xs text-slate-400">Sent to client{run.clientSentAt ? ` on ${new Date(run.clientSentAt).toLocaleDateString()}` : ''}</span>
                {canAct ? (
                  <>
                    <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Client comment (optional)"
                      className="bg-slate-800 border border-slate-700 rounded-lg px-2 py-1 text-xs text-slate-200 w-48 focus:outline-none" />
                    <button onClick={() => apply(completeStep(task, wf, templates, by, 'yes', note))} className={`${btn} bg-green-600 hover:bg-green-500 text-white`}>Client approved</button>
                    <button onClick={() => apply(completeStep(task, wf, templates, by, 'no', note))} className={`${btn} bg-red-600 hover:bg-red-500 text-white`}>Client rejected</button>
                  </>
                ) : <span className="text-xs text-slate-500">Waiting for the project manager to record the client's decision</span>}
              </>
            )}

            {node.data.kind === 'approval' && !isClientApproval(node) && (
              canAct ? (
                <>
                  <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Comment (optional)"
                    className="bg-slate-800 border border-slate-700 rounded-lg px-2 py-1 text-xs text-slate-200 w-44 focus:outline-none" />
                  <button onClick={() => apply(completeStep(task, wf, templates, by, 'yes', note))} className={`${btn} bg-green-600 hover:bg-green-500 text-white`}>Approve</button>
                  <button onClick={() => apply(completeStep(task, wf, templates, by, 'no', note))} className={`${btn} bg-red-600 hover:bg-red-500 text-white`}>Reject</button>
                </>
              ) : <span className="text-xs text-slate-500">Waiting for {approverName ?? 'the approver'} to approve</span>
            )}
          </div>
        </div>
      )}

      {/* Flow + history */}
      {expanded && (
        <div className="px-4 pb-4 space-y-3">
          <WorkflowDiagram workflow={wf} run={run} height={320} />
          {run.log.length > 0 && (
            <div className="rounded-xl border border-slate-800 bg-slate-950 divide-y divide-slate-800 max-h-48 overflow-y-auto">
              {[...run.log].reverse().map((l, i) => (
                <div key={i} className="px-3 py-2 text-xs flex items-baseline gap-2 flex-wrap">
                  <span className="font-semibold text-slate-200">{l.label}</span>
                  <span className={l.outcome === 'no' ? 'text-red-400' : l.outcome === 'yes' || l.outcome === 'done' || l.outcome === 'auto' ? 'text-green-400' : 'text-amber-300'}>
                    {l.kind === 'approval' && l.outcome === 'initiated' ? (isClientApproval(wf.nodes.find((n) => n.id === l.nodeId) ?? wf.nodes[0]) ? 'Sent to client' : 'Initiated') : OUTCOME_TEXT[l.outcome]}
                  </span>
                  <span className="text-slate-500">{l.by} · {new Date(l.at).toLocaleString()}</span>
                  {l.note && <span className="text-slate-400 italic">"{l.note}"</span>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
