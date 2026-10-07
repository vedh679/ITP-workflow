import type {
  Task, Workflow, WorkflowNode, WorkflowRun, WorkflowLogEntry, WorkflowLogOutcome,
  TaskChecklist, ChecklistTemplate, AppUser,
} from './types'

// ─────────────────────────────────────────────────────────────────
// Workflow engine — pure functions that move a task through a workflow.
// A task's progress lives in task.workflowRun.
// ─────────────────────────────────────────────────────────────────

export function requiresInitiation(n: WorkflowNode): boolean {
  return n.data.kind === 'approval' ? n.data.managerInitiates !== false : !!n.data.managerInitiates
}

export function isClientApproval(n: WorkflowNode): boolean {
  return n.data.kind === 'approval' && n.data.approverType === 'client'
}

export function isChecklistComplete(cl: TaskChecklist): boolean {
  return cl.items.length > 0 && cl.items.every((i) => i.completed) && (!cl.requiresSignature || !!cl.signature)
}

export function isManager(user: AppUser | null): boolean {
  return user?.role === 'admin' || user?.role === 'manager'
}

/** Label for the manager's "go to the next stage" button */
export function initiateLabel(n: WorkflowNode): string {
  return isClientApproval(n) ? 'Send to client for approval' : `Initiate: ${n.data.label || 'next step'}`
}

/** Who may act on the step currently in progress */
export function canActOnStep(user: AppUser | null, task: Task, node: WorkflowNode, members: AppUser[]): boolean {
  if (!user) return false
  if (isManager(user)) {
    if (node.data.kind !== 'approval' || isClientApproval(node)) return true
    // member approval: the named approver, or an admin
    const approver = members.find((m) => m.id === node.data.approverId)
    return !approver || approver.id === user.id || user.role === 'admin'
  }
  if (node.data.kind === 'approval') {
    return !isClientApproval(node) && node.data.approverId === user.id
  }
  return task.assignedTo === user.email   // procedure / task steps
}

function entry(node: WorkflowNode, outcome: WorkflowLogOutcome, by: string, note?: string): WorkflowLogEntry {
  return { nodeId: node.id, label: node.data.label || node.data.kind, kind: node.data.kind, outcome, at: new Date().toISOString(), by, note: note?.trim() || undefined }
}

function nextNodeId(wf: Workflow, nodeId: string, handle?: string): string | null {
  const outs = wf.edges.filter((e) => e.source === nodeId)
  const edge = handle ? outs.find((e) => e.sourceHandle === handle) : (outs.find((e) => !e.sourceHandle) ?? outs[0])
  return edge?.target ?? null
}

function withRun(task: Task, run: WorkflowRun, status?: Task['status']): Task {
  return { ...task, status: status ?? task.status, workflowRun: run }
}

/** Move into a node, skipping through anything that finishes on its own */
function enter(task: Task, run: WorkflowRun, nodeId: string | null, wf: Workflow, templates: ChecklistTemplate[], initiated = false, depth = 0): Task {
  const node = nodeId ? wf.nodes.find((n) => n.id === nodeId) : undefined
  if (!node || node.data.kind === 'end' || depth > 60) {
    const done: WorkflowRun = { ...run, status: 'completed', currentNodeId: null, currentChecklistId: undefined, clientSentAt: undefined,
      log: node ? [...run.log, entry(node, 'done', 'System')] : run.log }
    return withRun(task, done, 'completed')
  }
  if (node.data.kind === 'start') return enter(task, run, nextNodeId(wf, node.id), wf, templates, false, depth + 1)

  if (requiresInitiation(node) && !initiated) {
    return withRun(task, { ...run, status: 'awaiting-initiation', currentNodeId: node.id, currentChecklistId: undefined }, 'in-progress')
  }

  let t = task
  let r: WorkflowRun = { ...run, status: 'running', currentNodeId: node.id, currentChecklistId: undefined }

  if (node.data.kind === 'checklist') {
    const template = templates.find((tp) => tp.id === node.data.checklistTemplateId)
    let cl = t.checklists.find((c) => c.templateId === node.data.checklistTemplateId && !r.usedChecklistIds.includes(c.id))
    if (!cl && template) {
      cl = {
        id: `cl-${Date.now()}-${depth}`, templateId: template.id, templateName: template.name,
        requiresSignature: template.requiresSignature, assignedTo: t.assignedTo || undefined,
        items: template.items.map((i) => ({ ...i, completed: false })),
      }
      t = { ...t, checklists: [...t.checklists, cl] }
    }
    if (cl) {
      r.currentChecklistId = cl.id
      if (isChecklistComplete(cl)) {
        r = { ...r, usedChecklistIds: [...r.usedChecklistIds, cl.id], log: [...r.log, entry(node, 'auto', 'System')] }
        return enter(t, r, nextNodeId(wf, node.id), wf, templates, false, depth + 1)
      }
    }
  }
  return withRun(t, r, 'in-progress')
}

export function startRun(task: Task, wf: Workflow, templates: ChecklistTemplate[]): Task {
  const start = wf.nodes.find((n) => n.data.kind === 'start')
    ?? wf.nodes.find((n) => !wf.edges.some((e) => e.target === n.id))
  const run: WorkflowRun = { workflowId: wf.id, workflowName: wf.name, status: 'running', currentNodeId: null, usedChecklistIds: [], log: [] }
  return enter({ ...task, workflowId: wf.id }, run, start?.id ?? null, wf, templates)
}

/** Re-check the current step after the task changed (e.g. a checklist was just completed) */
export function syncRun(task: Task, workflows: Workflow[], templates: ChecklistTemplate[]): Task {
  const run = task.workflowRun
  if (!run || run.status !== 'running' || !run.currentNodeId) return task
  const wf = workflows.find((w) => w.id === run.workflowId)
  const node = wf?.nodes.find((n) => n.id === run.currentNodeId)
  if (!wf || !node || node.data.kind !== 'checklist') return task
  const cl = task.checklists.find((c) => c.id === run.currentChecklistId)
  if (!cl) return enter(task, run, node.id, wf, templates, true)   // checklist was removed: put it back
  if (!isChecklistComplete(cl)) return task
  const r: WorkflowRun = { ...run, usedChecklistIds: [...run.usedChecklistIds, cl.id], log: [...run.log, entry(node, 'auto', 'System')] }
  return enter(task, r, nextNodeId(wf, node.id), wf, templates)
}

/** The step in progress is finished (procedure/task done, or an approval decided yes/no) */
export function completeStep(task: Task, wf: Workflow, templates: ChecklistTemplate[], by: string, outcome?: 'yes' | 'no', note?: string): Task {
  const run = task.workflowRun
  const node = wf.nodes.find((n) => n.id === run?.currentNodeId)
  if (!run || !node || run.status !== 'running') return task
  const r: WorkflowRun = { ...run, clientSentAt: undefined, log: [...run.log, entry(node, outcome ?? 'done', by, note)] }
  return enter(task, r, nextNodeId(wf, node.id, node.data.kind === 'approval' ? outcome : undefined), wf, templates)
}

/** The project manager starts the step that was waiting for them */
export function initiateStep(task: Task, wf: Workflow, templates: ChecklistTemplate[], by: string): Task {
  const run = task.workflowRun
  const node = wf.nodes.find((n) => n.id === run?.currentNodeId)
  if (!run || !node || run.status !== 'awaiting-initiation') return task
  const r: WorkflowRun = { ...run, clientSentAt: isClientApproval(node) ? new Date().toISOString() : undefined, log: [...run.log, entry(node, 'initiated', by)] }
  return enter(task, r, node.id, wf, templates, true)
}
