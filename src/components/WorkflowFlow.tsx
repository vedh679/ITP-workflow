import { useMemo } from 'react'
import {
  ReactFlow,
  Background,
  Handle,
  Position,
  MarkerType,
  type Node,
  type Edge,
  type NodeProps,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { useAppStore } from '../store'
import type { Workflow, WorkflowNodeData, WorkflowNodeKind, WorkflowRun } from '../types'

// Shared drawing code for the workflow builder (editable) and a task's
// workflow view (read-only, with step status).
export type WfNode = Node<WorkflowNodeData>

export const KIND_META: Record<WorkflowNodeKind, { label: string; color: string; icon: string }> = {
  start:     { label: 'Start',     color: '#16A34A', icon: '▶' },
  procedure: { label: 'Procedure', color: '#0B0B0B', icon: '☰' },
  task:      { label: 'Task',      color: '#6B6B6B', icon: '◆' },
  checklist: { label: 'Checklist', color: '#E2634B', icon: '☑' },
  approval:  { label: 'Approval',  color: '#D97706', icon: '?' },
  end:       { label: 'End',       color: '#E5484D', icon: '■' },
}

export const YES = '#16A34A'
export const NO = '#E5484D'

const handleStyle = { width: 10, height: 10, background: '#8F8F8F', border: '2px solid #FFFFFF' }
const CURRENT = '#E2634B'

function FlowNode({ data, selected }: NodeProps<WfNode>) {
  const templates = useAppStore((s) => s.templates)
  const members = useAppStore((s) => s.members)
  const meta = KIND_META[data.kind]
  const template = data.kind === 'checklist' ? templates.find((t) => t.id === data.checklistTemplateId) : undefined
  const approver = data.kind === 'approval' && data.approverType !== 'client' ? members.find((m) => m.id === data.approverId) : undefined
  const approverText = data.kind === 'approval' ? (data.approverType === 'client' ? 'Client' : approver ? approver.name : 'No approver') : ''
  const isCurrent = data.status === 'current' || data.status === 'awaiting'
  const isDone = data.status === 'done'
  const ring = isCurrent ? `0 0 0 4px ${data.status === 'awaiting' ? '#D9770666' : '#E2634B55'}` : selected ? '0 0 0 3px rgba(255,255,255,0.35)' : 'none'
  const badge = isDone ? (
    <span style={{ position: 'absolute', top: -8, right: -8, width: 18, height: 18, borderRadius: 9, background: '#16a34a', color: '#fff', fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2 }}>✓</span>
  ) : null

  if (data.kind === 'approval') {
    const outline = isCurrent ? (data.status === 'awaiting' ? '#f59e0b' : CURRENT) : meta.color
    return (
      <div style={{ position: 'relative', width: 210, height: 130, opacity: isDone ? 0.75 : 1 }}>
        {badge}
        <Handle type="target" position={Position.Top} style={handleStyle} />
        <div style={{ position: 'absolute', inset: 0, clipPath: 'polygon(50% 0,100% 50%,50% 100%,0 50%)', background: outline, filter: selected || isCurrent ? 'brightness(1.2)' : undefined }}>
          <div style={{ position: 'absolute', inset: 3, clipPath: 'polygon(50% 0,100% 50%,50% 100%,0 50%)', background: '#FFFFFF',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '0 46px', textAlign: 'center' }}>
            <span style={{ color: '#D97706', fontSize: 9, fontWeight: 700, letterSpacing: 1 }}>APPROVAL</span>
            <span style={{ color: '#0B0B0B', fontSize: 12, fontWeight: 600, lineHeight: 1.2 }}>{data.label || 'Untitled'}</span>
            <span style={{ color: '#8F8F8F', fontSize: 10 }}>{approverText}</span>
          </div>
        </div>
        <Handle id="yes" type="source" position={Position.Bottom} style={{ ...handleStyle, background: YES }} />
        <span style={{ position: 'absolute', left: '50%', bottom: -22, marginLeft: 10, color: YES, fontSize: 11, fontWeight: 700 }}>Yes</span>
        <Handle id="no" type="source" position={Position.Right} style={{ ...handleStyle, background: NO }} />
        <span style={{ position: 'absolute', right: -26, top: '50%', marginTop: -22, color: NO, fontSize: 11, fontWeight: 700 }}>No</span>
      </div>
    )
  }

  const pill = data.kind === 'start' || data.kind === 'end'
  const border = isCurrent ? (data.status === 'awaiting' ? '#f59e0b' : CURRENT) : meta.color
  return (
    <div style={{
      position: 'relative', background: '#FFFFFF', border: `2px solid ${border}`, borderRadius: pill ? 999 : 12,
      padding: pill ? '8px 28px' : '10px 14px', minWidth: pill ? 0 : 200, maxWidth: 240, color: '#0B0B0B', boxShadow: ring,
      textAlign: pill ? 'center' : 'left', opacity: isDone ? 0.75 : 1,
    }}>
      {badge}
      {data.kind !== 'start' && <Handle type="target" position={Position.Top} style={handleStyle} />}
      {pill ? (
        <span style={{ fontSize: 13, fontWeight: 700 }}>{data.label || meta.label}</span>
      ) : (
        <>
          <div style={{ color: meta.color, fontSize: 9, fontWeight: 700, letterSpacing: 1 }}>
            {meta.icon} {meta.label.toUpperCase()}{data.managerInitiates ? ' · PM INITIATES' : ''}
          </div>
          <div style={{ fontSize: 13, fontWeight: 600, marginTop: 2 }}>{data.label || 'Untitled'}</div>
          {data.kind === 'checklist' && (
            <div style={{ fontSize: 11, color: template ? '#6B6B6B' : '#E5484D', marginTop: 2 }}>
              {template ? `${template.name} · ${template.items.length} items` : 'No checklist selected'}
            </div>
          )}
          {data.description && data.kind !== 'checklist' && (
            <div style={{ fontSize: 11, color: '#6B6B6B', marginTop: 2, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{data.description}</div>
          )}
        </>
      )}
      {data.kind !== 'end' && <Handle type="source" position={Position.Bottom} style={handleStyle} />}
    </div>
  )
}

export const nodeTypes = { flow: FlowNode }

export function toFlowEdge(e: { id: string; source: string; target: string; sourceHandle?: string | null }): Edge {
  const color = e.sourceHandle === 'yes' ? YES : e.sourceHandle === 'no' ? NO : '#B8B8B8'
  return {
    id: e.id, source: e.source, target: e.target, sourceHandle: e.sourceHandle ?? undefined, type: 'smoothstep',
    label: e.sourceHandle === 'yes' ? 'Yes' : e.sourceHandle === 'no' ? 'No' : undefined,
    style: { stroke: color, strokeWidth: 2 },
    labelStyle: { fill: color, fontWeight: 700, fontSize: 11 },
    labelBgStyle: { fill: '#FFFFFF' },
    markerEnd: { type: MarkerType.ArrowClosed, color },
  }
}

/** Read-only diagram of a workflow showing where a task's run has got to */
export function WorkflowDiagram({ workflow, run, height = 300 }: { workflow: Workflow; run?: WorkflowRun; height?: number }) {
  const nodes: WfNode[] = useMemo(() => {
    const done = new Set(run?.log.map((l) => l.nodeId))
    return workflow.nodes.map((n) => {
      const status: WorkflowNodeData['status'] =
        run && run.currentNodeId === n.id && run.status === 'running' ? 'current'
        : run && run.currentNodeId === n.id && run.status === 'awaiting-initiation' ? 'awaiting'
        : run && done.has(n.id) ? 'done' : undefined
      return { id: n.id, type: 'flow', position: n.position, data: { ...n.data, status }, draggable: false, selectable: false, connectable: false }
    })
  }, [workflow, run])
  const edges = useMemo(() => workflow.edges.map(toFlowEdge), [workflow])

  return (
    <div style={{ height }} className="rounded-xl border border-slate-800 overflow-hidden bg-slate-950">
      <ReactFlow nodes={nodes} edges={edges} nodeTypes={nodeTypes}
        nodesDraggable={false} nodesConnectable={false} elementsSelectable={false}
        fitView fitViewOptions={{ padding: 0.15 }} minZoom={0.2} maxZoom={1.5} proOptions={{ hideAttribution: true }}>
        <Background color="#E4E4E4" gap={24} />
      </ReactFlow>
    </div>
  )
}
