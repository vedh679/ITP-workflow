import { useCallback, useMemo, useState } from 'react'
import {
  ReactFlow,
  Background,
  Controls,
  useNodesState,
  useEdgesState,
  type Edge,
  type Connection,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { useAppStore } from '../store'
import { KIND_META, YES, NO, nodeTypes, toFlowEdge, type WfNode } from '../components/WorkflowFlow'
import type { Workflow, WorkflowNodeData, WorkflowNodeKind } from '../types'

// ─────────────────────────────────────────────────────────────────
// Workflow builder — ITP process flow diagrams with procedures,
// tasks, checklists and approval (yes / no) decisions.
// ─────────────────────────────────────────────────────────────────
const ADDABLE: WorkflowNodeKind[] = ['procedure', 'task', 'checklist', 'approval', 'end', 'start']

// ── Validation ────────────────────────────────────────────────────
function validate(nodes: WfNode[], edges: Edge[]): string[] {
  const out: string[] = []
  const starts = nodes.filter((n) => n.data.kind === 'start')
  if (starts.length === 0) out.push('Add a Start step.')
  if (starts.length > 1) out.push('Only one Start step is allowed.')
  if (!nodes.some((n) => n.data.kind === 'end')) out.push('Add an End step.')
  for (const n of nodes) {
    const name = `"${n.data.label || KIND_META[n.data.kind].label}"`
    const incoming = edges.some((e) => e.target === n.id)
    const outgoing = edges.filter((e) => e.source === n.id)
    if (n.data.kind !== 'start' && !incoming) out.push(`${name} has nothing leading into it.`)
    if (n.data.kind === 'approval') {
      if (!outgoing.some((e) => e.sourceHandle === 'yes')) out.push(`${name} needs a Yes path.`)
      if (!outgoing.some((e) => e.sourceHandle === 'no')) out.push(`${name} needs a No path.`)
      if (n.data.approverType !== 'client' && !n.data.approverId) out.push(`${name} has no approver.`)
    } else if (n.data.kind !== 'end' && outgoing.length === 0) out.push(`${name} leads nowhere.`)
    if (n.data.kind === 'checklist' && !n.data.checklistTemplateId) out.push(`${name} has no checklist selected.`)
  }
  return out
}

// ── Canvas for one workflow ───────────────────────────────────────
function WorkflowEditor({ workflow }: { workflow: Workflow }) {
  const updateWorkflow = useAppStore((s) => s.updateWorkflow)
  const deleteWorkflow = useAppStore((s) => s.deleteWorkflow)
  const templates = useAppStore((s) => s.templates)
  const members = useAppStore((s) => s.members)

  const [name, setName] = useState(workflow.name)
  const [description, setDescription] = useState(workflow.description)
  const [nodes, setNodes, onNodesChange] = useNodesState<WfNode>(
    workflow.nodes.map((n) => ({ id: n.id, type: 'flow', position: n.position, data: n.data })))
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>(workflow.edges.map(toFlowEdge))

  const selected = nodes.find((n) => n.selected) ?? null
  const approvers = members.filter((m) => m.role === 'admin' || m.role === 'manager')

  const snapshot = useMemo(() => JSON.stringify({
    name, description,
    nodes: nodes.map((n) => ({ id: n.id, position: { x: Math.round(n.position.x), y: Math.round(n.position.y) }, data: n.data })),
    edges: edges.map((e) => ({ id: e.id, source: e.source, target: e.target, sourceHandle: e.sourceHandle ?? null })),
  }), [name, description, nodes, edges])
  const savedSnapshot = useMemo(() => JSON.stringify({
    name: workflow.name, description: workflow.description,
    nodes: workflow.nodes.map((n) => ({ id: n.id, position: { x: Math.round(n.position.x), y: Math.round(n.position.y) }, data: n.data })),
    edges: workflow.edges.map((e) => ({ id: e.id, source: e.source, target: e.target, sourceHandle: e.sourceHandle ?? null })),
  }), [workflow])
  const dirty = snapshot !== savedSnapshot
  const warnings = useMemo(() => validate(nodes, edges), [nodes, edges])

  const save = () => {
    const parsed = JSON.parse(snapshot)
    updateWorkflow({ ...workflow, name: name.trim() || 'Untitled workflow', description, nodes: parsed.nodes,
      edges: parsed.edges.map((e: { id: string; source: string; target: string; sourceHandle: string | null }) => e), updatedAt: new Date().toISOString() })
  }

  // Connecting: a Yes/No handle can only have one path; label/colour come from the handle
  const onConnect = useCallback((c: Connection) => {
    if (!c.source || !c.target || c.source === c.target) return
    setEdges((eds) => {
      const kept = c.sourceHandle ? eds.filter((e) => !(e.source === c.source && e.sourceHandle === c.sourceHandle)) : eds
      if (kept.some((e) => e.source === c.source && e.target === c.target && (e.sourceHandle ?? null) === (c.sourceHandle ?? null))) return kept
      return [...kept, toFlowEdge({ id: `e-${Date.now()}`, source: c.source!, target: c.target!, sourceHandle: c.sourceHandle })]
    })
  }, [setEdges])

  // Add a step; if one is selected, place it below and connect from it
  const addNode = (kind: WorkflowNodeKind) => {
    const id = `n-${Date.now()}`
    const anchor = selected ?? [...nodes].sort((a, b) => b.position.y - a.position.y)[0]
    const pos = anchor ? { x: anchor.position.x, y: anchor.position.y + (anchor.data.kind === 'approval' ? 190 : 120) } : { x: 250, y: 0 }
    const data: WorkflowNodeData = { kind, label: kind === 'start' || kind === 'end' ? KIND_META[kind].label : '', description: '' }
    setNodes((ns) => [...ns.map((n) => ({ ...n, selected: false })), { id, type: 'flow', position: pos, data, selected: true }])
    if (selected && selected.data.kind !== 'end' && kind !== 'start') {
      let handle: string | undefined
      if (selected.data.kind === 'approval') {
        const used = edges.filter((e) => e.source === selected.id).map((e) => e.sourceHandle)
        handle = !used.includes('yes') ? 'yes' : !used.includes('no') ? 'no' : undefined
        if (!handle) return
      }
      setEdges((eds) => [...eds, toFlowEdge({ id: `e-${Date.now()}`, source: selected.id, target: id, sourceHandle: handle })])
    }
  }

  const patchSelected = (patch: Partial<WorkflowNodeData>) =>
    selected && setNodes((ns) => ns.map((n) => n.id === selected.id ? { ...n, data: { ...n.data, ...patch } } : n))
  const removeSelected = () => {
    if (!selected) return
    setNodes((ns) => ns.filter((n) => n.id !== selected.id))
    setEdges((es) => es.filter((e) => e.source !== selected.id && e.target !== selected.id))
  }
  const removeWorkflow = () => {
    if (window.confirm(`Delete workflow "${workflow.name}"?`)) deleteWorkflow(workflow.id)
  }

  const input = 'w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-ink placeholder-slate-500 focus:outline-none focus:border-purple-500'
  const label = 'block text-xs font-semibold text-slate-400 mb-1'

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-6 py-3 border-b border-slate-800 flex-shrink-0">
        <div className="flex-1 min-w-0 space-y-1">
          <input className="w-full bg-transparent text-ink font-bold text-lg focus:outline-none border-b border-transparent focus:border-purple-500"
            value={name} onChange={(e) => setName(e.target.value)} placeholder="Workflow name" />
          <input className="w-full bg-transparent text-sm text-slate-400 focus:outline-none border-b border-transparent focus:border-purple-500"
            value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Description" />
        </div>
        {dirty && <span className="text-xs text-amber-300">Unsaved changes</span>}
        <button onClick={save} disabled={!dirty} className="px-4 py-2 rounded-full bg-purple-600 hover:bg-purple-500 disabled:opacity-40 text-white text-sm font-semibold">Save</button>
        <button onClick={removeWorkflow} className="px-3 py-2 rounded-lg bg-red-900/40 hover:bg-red-900/60 text-red-300 text-sm font-semibold">Delete</button>
      </div>

      {/* Palette */}
      <div className="flex items-center gap-2 px-6 py-2 border-b border-slate-800 bg-slate-900/60 flex-shrink-0 flex-wrap">
        <span className="text-xs font-semibold text-slate-400 mr-1">Add step</span>
        {ADDABLE.map((k) => (
          <button key={k} onClick={() => addNode(k)}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold border bg-slate-800 hover:bg-slate-700"
            style={{ borderColor: KIND_META[k].color, color: KIND_META[k].color }}>
            + {KIND_META[k].label}
          </button>
        ))}
        <span className="text-xs text-slate-500 ml-2">
          {selected ? 'New steps are added below the selected step and connected to it.' : 'Select a step first to chain new steps automatically. Drag from a handle to connect.'}
        </span>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Canvas */}
        <div className="flex-1 relative">
          <ReactFlow
            nodes={nodes} edges={edges}
            onNodesChange={onNodesChange} onEdgesChange={onEdgesChange} onConnect={onConnect}
            nodeTypes={nodeTypes}
            deleteKeyCode={['Backspace', 'Delete']}
            fitView fitViewOptions={{ padding: 0.3 }} minZoom={0.3} maxZoom={1.75}
            proOptions={{ hideAttribution: true }}
          >
            <Background color="#E4E4E4" gap={24} />
            <Controls />
          </ReactFlow>
          {warnings.length > 0 && (
            <details className="absolute bottom-3 left-3 max-w-sm bg-amber-50 border border-amber-100 rounded-2xl px-3 py-2 text-xs text-amber-700 shadow-float">
              <summary className="cursor-pointer font-semibold">{warnings.length} thing{warnings.length === 1 ? '' : 's'} to fix</summary>
              <ul className="mt-2 space-y-1 list-disc pl-4 text-amber-700">{warnings.map((w) => <li key={w}>{w}</li>)}</ul>
            </details>
          )}
        </div>

        {/* Properties */}
        <aside className="w-72 border-l border-slate-800 bg-slate-900 p-4 overflow-y-auto flex-shrink-0">
          {selected ? (
            <div className="space-y-4">
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border" style={{ color: KIND_META[selected.data.kind].color, borderColor: KIND_META[selected.data.kind].color }}>
                {KIND_META[selected.data.kind].label.toUpperCase()}
              </span>
              <div><label className={label}>Title</label>
                <input className={input} value={selected.data.label} onChange={(e) => patchSelected({ label: e.target.value })}
                  placeholder={selected.data.kind === 'approval' ? 'e.g. Inspector approves?' : 'Step title'} /></div>
              {selected.data.kind !== 'start' && selected.data.kind !== 'end' && (
                <div><label className={label}>{selected.data.kind === 'procedure' ? 'Procedure steps' : 'Description / instructions'}</label>
                  <textarea className={`${input} ${selected.data.kind === 'procedure' ? 'h-40' : 'h-24'}`} value={selected.data.description}
                    onChange={(e) => patchSelected({ description: e.target.value })} /></div>
              )}
              {selected.data.kind === 'checklist' && (
                <div><label className={label}>Checklist</label>
                  <select className={input} value={selected.data.checklistTemplateId ?? ''} onChange={(e) => patchSelected({ checklistTemplateId: e.target.value || undefined })}>
                    <option value="">Select a checklist template…</option>
                    {templates.map((t) => <option key={t.id} value={t.id}>{t.name} (v{t.version ?? '1.0'})</option>)}
                  </select></div>
              )}
              {selected.data.kind === 'approval' && (
                <>
                  <div><label className={label}>Decided by</label>
                    <select className={input} value={selected.data.approverType ?? 'member'} onChange={(e) => patchSelected({ approverType: e.target.value as 'member' | 'client' })}>
                      <option value="member">A team member</option>
                      <option value="client">The client</option>
                    </select></div>
                  {selected.data.approverType !== 'client' ? (
                    <div><label className={label}>Approver</label>
                      <select className={input} value={selected.data.approverId ?? ''} onChange={(e) => patchSelected({ approverId: e.target.value || undefined })}>
                        <option value="">Select an approver…</option>
                        {approvers.map((m) => <option key={m.id} value={m.id}>{m.name} ({m.role})</option>)}
                      </select></div>
                  ) : (
                    <p className="text-xs text-slate-400">The project manager sends the work to the client, then records the client's decision here in the task.</p>
                  )}
                  <p className="text-xs text-slate-500">Connect the <span style={{ color: YES }}>Yes</span> handle (bottom) and the <span style={{ color: NO }}>No</span> handle (right) to the steps that follow each decision. A No path can loop back to an earlier step for rework.</p>
                </>
              )}
              {selected.data.kind !== 'start' && selected.data.kind !== 'end' && (
                <label className="flex items-start gap-2 text-sm text-slate-300">
                  <input type="checkbox" className="mt-0.5"
                    checked={selected.data.kind === 'approval' ? selected.data.managerInitiates !== false : !!selected.data.managerInitiates}
                    onChange={(e) => patchSelected({ managerInitiates: e.target.checked })} />
                  <span>Project manager must initiate this step<span className="block text-xs text-slate-500">When the step before it finishes, the project manager is prompted to start it.</span></span>
                </label>
              )}
              <button onClick={removeSelected} className="w-full px-3 py-2 rounded-lg bg-red-900/40 hover:bg-red-900/60 text-red-300 text-sm font-semibold">Delete step</button>
            </div>
          ) : (
            <p className="text-sm text-slate-500">Select a step to edit its details. Press Delete to remove a selected step or connection.</p>
          )}
        </aside>
      </div>
    </div>
  )
}

// ── Panel: workflow list + editor ─────────────────────────────────
export default function WorkflowPanel() {
  const workflows = useAppStore((s) => s.workflows)
  const addWorkflow = useAppStore((s) => s.addWorkflow)
  const [selectedId, setSelectedId] = useState<string | null>(workflows[0]?.id ?? null)
  const selected = workflows.find((w) => w.id === selectedId) ?? workflows[0] ?? null

  const create = () => {
    const now = new Date().toISOString()
    const w: Workflow = {
      id: `wf-${Date.now()}`, name: 'New workflow', description: '', createdAt: now, updatedAt: now, edges: [],
      nodes: [{ id: 'start', position: { x: 250, y: 0 }, data: { kind: 'start', label: 'Start', description: '' } }],
    }
    addWorkflow(w)
    setSelectedId(w.id)
  }

  return (
    <>
      <aside className="w-72 border-r border-slate-800 bg-slate-900 flex flex-col flex-shrink-0">
        <div className="p-3 border-b border-slate-800">
          <button onClick={create} className="w-full px-3 py-2 rounded-full bg-purple-600 hover:bg-purple-500 text-white text-sm font-semibold">+ New workflow</button>
        </div>
        <div className="flex-1 overflow-y-auto">
          {workflows.length === 0 && <p className="p-4 text-sm text-slate-500">No workflows yet.</p>}
          {workflows.map((w) => (
            <button key={w.id} onClick={() => setSelectedId(w.id)}
              className={`w-full text-left px-4 py-3 border-b border-slate-800 hover:bg-slate-800 ${selected?.id === w.id ? 'bg-slate-800' : ''}`}>
              <p className="text-sm font-semibold text-ink truncate">{w.name}</p>
              <p className="text-xs text-slate-500 mt-0.5">{w.nodes.length} steps · Updated {new Date(w.updatedAt).toLocaleDateString()}</p>
            </button>
          ))}
        </div>
      </aside>
      {selected
        ? <WorkflowEditor key={selected.id} workflow={selected} />
        : <div className="flex-1 flex items-center justify-center"><p className="text-slate-500 text-sm">Create a workflow to get started</p></div>}
    </>
  )
}
