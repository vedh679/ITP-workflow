import { useState } from 'react'
import { useAppStore } from '../store'
import { INSPECTION_COLOR } from './TaskMindMap'
import type { Inspection, InspectionType } from '../types'

export const INSPECTION_TYPES: { type: InspectionType; blurb: string }[] = [
  { type: 'QICC', blurb: 'QICC inspection' },
  { type: 'NOWRI', blurb: 'NOWRI inspection' },
  { type: 'Joint Inspection', blurb: 'Carried out jointly with another party' },
  { type: 'Quality Inspection', blurb: 'Internal quality inspection' },
]

interface Props {
  projectId: string
  initial?: Inspection
  onSave: (inspection: Inspection) => void
  onClose: () => void
}

const field = 'w-full bg-white border border-slate-700 rounded-2xl px-3 py-2.5 text-sm text-ink placeholder-slate-500 focus:outline-none focus:border-ink'
const label = 'block text-sm font-medium text-slate-300 mb-1.5'

// Creates (or edits) an inspection on a task. The type classifies it as QICC, NOWRI, Joint or Quality.
export default function AddInspectionModal({ projectId, initial, onSave, onClose }: Props) {
  const { members, currentUser } = useAppStore()
  const team = members.filter((m) => m.projectIds.includes(projectId))
  const [type, setType] = useState<InspectionType | null>(initial?.type ?? null)
  const [title, setTitle] = useState(initial?.title ?? '')
  const [date, setDate] = useState(initial?.date ?? new Date().toISOString().slice(0, 10))
  const [inspectedBy, setInspectedBy] = useState(initial?.inspectedBy ?? currentUser?.email ?? '')
  const [location, setLocation] = useState(initial?.location ?? '')
  const [notes, setNotes] = useState(initial?.notes ?? '')

  const canSave = !!type && !!title.trim() && !!date

  const save = () => {
    if (!canSave || !type) return
    onSave({
      id: initial?.id ?? `insp-${Date.now()}`, type, title: title.trim(), date, inspectedBy, location, notes,
      status: initial?.status ?? 'open', completedAt: initial?.completedAt, issues: initial?.issues ?? [],
      createdAt: initial?.createdAt ?? new Date().toISOString(),
      log: initial?.log ?? [{ id: `log-${Date.now()}`, at: new Date().toISOString(), by: currentUser?.name ?? 'Unknown', summary: `Inspection created (${type})` }],
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="bg-white border border-slate-700 rounded-3xl shadow-float w-full max-w-lg max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-800">
          <h2 className="text-lg font-bold text-ink">{initial ? 'Edit inspection' : 'Add inspection'}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-ink text-xl leading-none">✕</button>
        </div>

        <div className="px-6 py-5 space-y-4">
          <div>
            <label className={label}>Inspection type <span className="text-red-500">*</span></label>
            <div className="grid grid-cols-2 gap-2">
              {INSPECTION_TYPES.map(({ type: t, blurb }) => (
                <button key={t} type="button" onClick={() => setType(t)}
                  className={`text-left px-4 py-3 rounded-2xl border transition-all ${type === t ? 'bg-white shadow-float' : 'border-slate-700 bg-slate-900 hover:border-slate-500'}`}
                  style={type === t ? { borderColor: INSPECTION_COLOR[t], boxShadow: `0 0 0 1px ${INSPECTION_COLOR[t]}` } : undefined}>
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: INSPECTION_COLOR[t] }} />
                    <span className="text-sm font-bold text-ink">{t}</span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">{blurb}</p>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className={label}>Title <span className="text-red-500">*</span></label>
            <input autoFocus className={field} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Level 3 slab — pre-pour inspection" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div><label className={label}>Date <span className="text-red-500">*</span></label>
              <input type="date" className={field} value={date} onChange={(e) => setDate(e.target.value)} /></div>
            <div><label className={label}>Inspected by</label>
              <select className={field} value={inspectedBy} onChange={(e) => setInspectedBy(e.target.value)}>
                <option value="">Select…</option>
                {team.map((m) => <option key={m.id} value={m.email}>{m.name}{m.team ? ` · ${m.team}` : ''}</option>)}
              </select></div>
          </div>

          <div><label className={label}>Location</label>
            <input className={field} value={location} onChange={(e) => setLocation(e.target.value)} placeholder="e.g. Building A, Level 3" /></div>

          <div><label className={label}>Notes</label>
            <textarea rows={2} className={`${field} resize-none`} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Scope, attendees, reference documents…" /></div>
        </div>

        <div className="flex gap-3 px-6 py-5 border-t border-slate-800">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-semibold transition-colors">Cancel</button>
          <button onClick={save} disabled={!canSave}
            className="flex-1 py-2.5 rounded-full bg-ink hover:bg-ink-soft disabled:opacity-40 text-white text-sm font-semibold transition-colors">{initial ? 'Save changes' : 'Add inspection'}</button>
        </div>
      </div>
    </div>
  )
}
