import { useCallback, useEffect, useMemo } from 'react'
import {
  ReactFlow,
  Background,
  Controls,
  useNodesState,
  useEdgesState,
  addEdge,
  type Node,
  type Edge,
  type Connection,
  Handle,
  Position,
  NodeProps,
  BaseEdge,
  EdgeProps,
  getStraightPath,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import type { Task } from '../types'

// ── Node data types ───────────────────────────────────────────────
interface TaskNodeData extends Record<string, unknown> {
  label: string
  status: Task['status']
  canEdit: boolean
  onEdit: () => void
}
interface ChecklistNodeData extends Record<string, unknown> {
  checklistId: string
  label: string
  completed: number
  total: number
  onOpen: (checklistId: string) => void
}
interface AddNodeData extends Record<string, unknown> {
  taskId: string
  onAdd: (taskId: string) => void
}

// ── Task root node ────────────────────────────────────────────────
function TaskNode({ data }: NodeProps) {
  const d = data as TaskNodeData
  const statusColor =
    d.status === 'completed' ? '#22c55e' :
    d.status === 'in-progress' ? '#3b82f6' : '#94a3b8'

  return (
    <div
      onDoubleClick={() => d.canEdit && d.onEdit()}
      title={d.canEdit ? 'Double-click to edit' : undefined}
      style={{
        background: 'linear-gradient(135deg,#1e3a8a,#1d4ed8)',
        border: `3px solid ${statusColor}`,
        borderRadius: 16,
        padding: '16px 24px',
        minWidth: 200,
        boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
        color: '#fff',
        textAlign: 'center',
        cursor: d.canEdit ? 'pointer' : 'default',
        userSelect: 'none',
      }}
    >
      <div style={{ fontSize: 11, opacity: 0.7, marginBottom: 4, textTransform: 'uppercase', letterSpacing: 1 }}>
        Task{d.canEdit && <span style={{ opacity: 0.5, marginLeft: 4 }}>· dbl-click to edit</span>}
      </div>
      <div style={{ fontWeight: 700, fontSize: 16 }}>{d.label}</div>
      <div style={{
        marginTop: 8, display: 'inline-block',
        background: statusColor + '33', color: statusColor,
        borderRadius: 20, padding: '2px 10px', fontSize: 11, fontWeight: 600,
      }}>
        {d.status}
      </div>
      <Handle type="source" position={Position.Right} id="right"
        style={{ background: 'transparent', border: 'none', width: 1, height: 1 }} />
    </div>
  )
}

// ── Checklist node ────────────────────────────────────────────────
function ChecklistNode({ data }: NodeProps) {
  const d = data as ChecklistNodeData
  const pct = d.total > 0 ? Math.round((d.completed / d.total) * 100) : 0
  const allDone = d.total > 0 && d.completed === d.total

  return (
    <div
      onClick={() => d.onOpen(d.checklistId)}
      style={{
        background: '#1e293b',
        border: `1.5px solid ${allDone ? '#22c55e' : '#334155'}`,
        borderRadius: 12,
        padding: '12px 16px',
        minWidth: 200,
        boxShadow: '0 4px 16px rgba(0,0,0,0.25)',
        color: '#e2e8f0',
        cursor: 'pointer',
        transition: 'border-color 0.2s, box-shadow 0.2s',
        userSelect: 'none',
      }}
      onMouseEnter={(e) => {
        const el = e.currentTarget as HTMLDivElement
        el.style.borderColor = '#3b82f6'
        el.style.boxShadow = '0 4px 24px rgba(59,130,246,0.25)'
      }}
      onMouseLeave={(e) => {
        const el = e.currentTarget as HTMLDivElement
        el.style.borderColor = allDone ? '#22c55e' : '#334155'
        el.style.boxShadow = '0 4px 16px rgba(0,0,0,0.25)'
      }}
    >
      <Handle type="target" position={Position.Left}
        style={{ background: 'transparent', border: 'none', width: 1, height: 1 }} />

      <div style={{ fontWeight: 700, fontSize: 13, color: '#93c5fd', marginBottom: 10 }}>{d.label}</div>

      <div style={{ background: '#334155', borderRadius: 4, height: 4, marginBottom: 6 }}>
        <div style={{
          background: allDone ? '#22c55e' : '#3b82f6',
          width: `${pct}%`,
          height: '100%',
          borderRadius: 4,
          transition: 'width 0.3s',
        }} />
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 10, color: '#64748b' }}>{d.completed}/{d.total} complete</span>
        <span style={{ fontSize: 10, fontWeight: 600, color: '#3b82f6' }}>Open ›</span>
      </div>
    </div>
  )
}

// ── Add checklist node ────────────────────────────────────────────
function AddChecklistNode({ data }: NodeProps) {
  const d = data as AddNodeData
  return (
    <div
      onClick={() => d.onAdd(d.taskId)}
      style={{
        background: 'transparent',
        border: '2px dashed #334155',
        borderRadius: 12,
        padding: '10px 20px',
        cursor: 'pointer',
        color: '#475569',
        fontSize: 13,
        fontWeight: 600,
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        transition: 'border-color 0.2s, color 0.2s',
        userSelect: 'none',
      }}
      onMouseEnter={(e) => {
        const el = e.currentTarget as HTMLDivElement
        el.style.borderColor = '#3b82f6'
        el.style.color = '#3b82f6'
      }}
      onMouseLeave={(e) => {
        const el = e.currentTarget as HTMLDivElement
        el.style.borderColor = '#334155'
        el.style.color = '#475569'
      }}
    >
      <Handle type="target" position={Position.Left}
        style={{ background: 'transparent', border: 'none', width: 1, height: 1 }} />
      <span style={{ fontSize: 18, lineHeight: 1 }}>+</span> Add Checklist
    </div>
  )
}

// ── Custom tree edge — orthogonal, shared trunk ───────────────────
// Draws: horizontal from source → down/up to target row → horizontal to target
interface TreeEdgeData extends Record<string, unknown> {
  trunkX: number   // X coordinate of the shared vertical spine
  dashed?: boolean
}

function TreeEdge({ sourceX, sourceY, targetX, targetY, data, markerEnd, style }: EdgeProps) {
  const d = data as TreeEdgeData
  const trunkX = d?.trunkX ?? (sourceX + targetX) / 2

  // Path: source → trunk (horizontal) → target Y (vertical) → target (horizontal)
  const path = `M${sourceX},${sourceY} H${trunkX} V${targetY} H${targetX}`

  return (
    <BaseEdge
      path={path}
      markerEnd={markerEnd}
      style={{
        ...style,
        strokeDasharray: d?.dashed ? '6 4' : undefined,
      }}
    />
  )
}

// Simple straight horizontal edge from root to trunk
function TrunkEdge({ sourceX, sourceY, targetX, targetY, style, markerEnd }: EdgeProps) {
  const [path] = getStraightPath({ sourceX, sourceY, targetX, targetY })
  return <BaseEdge path={path} style={style} markerEnd={markerEnd} />
}

const nodeTypes = {
  taskNode: TaskNode,
  checklistNode: ChecklistNode,
  addNode: AddChecklistNode,
}

const edgeTypes = {
  treeEdge: TreeEdge,
  trunkEdge: TrunkEdge,
}

// ── Main component ────────────────────────────────────────────────
interface Props {
  task: Task
  onAddChecklist: (taskId: string) => void
  onOpenChecklist: (checklistId: string) => void
  onEditTask: (task: Task) => void
  canEdit?: boolean
}

export default function TaskMindMap({ task, onAddChecklist, onOpenChecklist, onEditTask, canEdit = true }: Props) {
  const { initialNodes, initialEdges } = useMemo(() => {
    const SPACING_Y = 110
    const ROOT_X = 60
    const TRUNK_X = 340   // where the vertical spine sits
    const CHECKLIST_X = 380
    const NODE_HEIGHT = 80 // approximate height of checklist node
    const NODE_CENTER = NODE_HEIGHT / 2

    const checklists = task.checklists
    const branchCount = checklists.length + 1
    const totalHeight = branchCount * SPACING_Y

    // Root centered vertically against all branches
    const rootCenterY = totalHeight / 2
    const ROOT_NODE_HEIGHT = 110
    const rootY = rootCenterY - ROOT_NODE_HEIGHT / 2

    const nodes: Node[] = [
      {
        id: 'root',
        type: 'taskNode',
        position: { x: ROOT_X, y: rootY },
        data: {
          label: task.name,
          status: task.status,
          canEdit,
          onEdit: () => onEditTask(task),
        } as TaskNodeData,
        draggable: true,
      },
    ]

    const edges: Edge[] = []

    checklists.forEach((cl, idx) => {
      const nodeId = `cl-${cl.id}`
      const completed = cl.items.filter((i) => i.completed).length
      const nodeY = idx * SPACING_Y

      nodes.push({
        id: nodeId,
        type: 'checklistNode',
        position: { x: CHECKLIST_X, y: nodeY },
        data: {
          checklistId: cl.id,
          label: cl.templateName,
          completed,
          total: cl.items.length,
          onOpen: onOpenChecklist,
        } as ChecklistNodeData,
        draggable: true,
      })

      edges.push({
        id: `e-${nodeId}`,
        source: 'root',
        target: nodeId,
        type: 'treeEdge',
        // sourceY will be rootCenterY (handle at center-right of root)
        // targetY will be nodeY + NODE_CENTER (handle at center-left of checklist)
        data: { trunkX: TRUNK_X } as TreeEdgeData,
        style: { stroke: '#475569', strokeWidth: 1.5 },
      })
    })

    // Add button — only visible to admins and managers
    if (canEdit) {
      const addY = checklists.length * SPACING_Y
      nodes.push({
        id: 'add-node',
        type: 'addNode',
        position: { x: CHECKLIST_X, y: addY },
        data: { taskId: task.id, onAdd: onAddChecklist } as AddNodeData,
        draggable: false,
      })
      edges.push({
        id: 'e-add',
        source: 'root',
        target: 'add-node',
        type: 'treeEdge',
        data: { trunkX: TRUNK_X, dashed: true } as TreeEdgeData,
        style: { stroke: '#334155', strokeWidth: 1.5 },
      })
    }

    return { initialNodes: nodes, initialEdges: edges }
  }, [task, onOpenChecklist, onAddChecklist, canEdit])

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges)

  useEffect(() => {
    setNodes(initialNodes)
    setEdges(initialEdges)
  }, [initialNodes, initialEdges, setNodes, setEdges])

  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge(params, eds)),
    [setEdges]
  )

  return (
    <div style={{ width: '100%', height: '100%', background: '#0f172a' }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        fitView
        fitViewOptions={{ padding: 0.25 }}
        minZoom={0.3}
        maxZoom={2}
      >
        <Background color="#1e293b" gap={24} />
        <Controls style={{ background: '#1e293b', borderColor: '#334155', color: '#94a3b8' }} />
      </ReactFlow>
    </div>
  )
}
