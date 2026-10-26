import { useState } from 'react'
import { useAppStore } from '../store'
import { INSPECTION_COLOR } from './TaskMindMap'
import AddInspectionModal from './AddInspectionModal'
import { isManager } from '../workflow'
import { afterPhotos, beforePhotos, diffInspection, diffIssue, exportInspection, historyEntry, readImages, uid } from '../inspections'
import type { ChecklistAttachment, Inspection, InspectionIssue, IssueSeverity, IssueStatus, Task } from '../types'

interface Props {
  task: Task
  inspection: Inspection
  onClose: () => void
  onDelete: () => void
}

const SEVERITY: Record<IssueSeverity, { label: string; chip: string }> = {
  minor:    { label: 'Minor',    chip: 'bg-slate-800 text-slate-300' },
  major:    { label: 'Major',    chip: 'bg-amber-100 text-amber-700' },
  critical: { label: 'Critical', chip: 'bg-red-100 text-red-600' },
}
const STATUS: Record<IssueStatus, { label: string; chip: string }> = {
  'open':        { label: 'Open',        chip: 'bg-red-50 text-red-600' },
  'in-progress': { label: 'In progress', chip: 'bg-amber-100 text-amber-700' },
  'closed':      { label: 'Closed',      chip: 'bg-green-100 text-green-700' },
}

const field = 'w-full bg-white border border-slate-700 rounded-2xl px-3 py-2.5 text-sm text-ink placeholder-slate-500 focus:outline-none focus:border-ink'
const lbl = 'block text-xs font-semibold text-slate-400 mb-1'
const btn = 'px-4 py-2 rounded-full text-sm font-semibold transition-colors'

function blankIssue(by: string): InspectionIssue {
  return { id: uid('iss'), title: '', description: '', severity: 'minor', status: 'open', raisedBy: by, raisedAt: new Date().toISOString(), beforePhotos: [] }
}

// Photo upload with thumbnails
function PhotoPicker({ label, photos, onChange, required, hint }: {
  label: string; photos: ChecklistAttachment[]; onChange: (p: ChecklistAttachment[]) => void; required?: boolean; hint?: string
}) {
  const [busy, setBusy] = useState(false)
  const add = async (files: FileList | null) => {
    setBusy(true)
    const imgs = await readImages(files)
    setBusy(false)
    onChange([...photos, ...imgs])
  }
  return (
    <div>
      <label className={lbl}>{label} {required && <span className="text-red-500">*</span>}</label>
      <div className="flex items-center gap-3 flex-wrap">
        <label className={`${btn} !py-1.5 !text-xs bg-slate-800 hover:bg-slate-700 text-slate-200 cursor-pointer`}>
          {busy ? 'Adding…' : photos.length ? '+ Add another photo' : '+ Add photo'}
          <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => { add(e.target.files); e.target.value = '' }} />
        </label>
        {required && photos.length === 0 && <span className="text-xs text-red-600">{hint ?? 'At least one photo is required'}</span>}
      </div>
      {photos.length > 0 && (
        <div className="flex gap-2 mt-2 flex-wrap">
          {photos.map((p) => (
            <div key={p.id} className="relative">
              <img src={p.dataUrl} alt={p.name} className="w-20 h-20 object-cover rounded-xl border border-slate-700" />
              <button type="button" onClick={() => onChange(photos.filter((x) => x.id !== p.id))}
                className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-ink text-white text-[10px]">✕</button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function Gallery({ title, photos }: { title: string; photos: ChecklistAttachment[] }) {
  if (photos.length === 0) return null
  return (
    <div>
      <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500 mb-1.5">{title}</p>
      <div className="flex gap-2 flex-wrap">
        {photos.map((p) => <a key={p.id} href={p.dataUrl} target="_blank" rel="noreferrer" title={p.name}><img src={p.dataUrl} alt={p.name} className="w-24 h-24 object-cover rounded-xl border border-slate-700" /></a>)}
      </div>
    </div>
  )
}

// Full-screen view of one inspection: its details and the issues / snags raised against it.
export default function InspectionDetail({ task, inspection, onClose, onDelete }: Props) {
  const { members, currentUser, updateTask } = useAppStore()
  const manager = isManager(currentUser)
  const me = currentUser?.name ?? 'Unknown'
  const live = (task.inspections ?? []).find((i) => i.id === inspection.id) ?? inspection
  const team = members.filter((m) => m.projectIds.includes(task.projectId))
  const nameOf = (email?: string) => members.find((m) => m.email === email)?.name ?? email ?? ''

  const [draft, setDraft] = useState<{ issue: InspectionIssue; original?: InspectionIssue } | null>(null)
  const [filter, setFilter] = useState<'all' | IssueStatus>('all')
  const [closing, setClosing] = useState<{ id: string; note: string; photos: ChecklistAttachment[] } | null>(null)
  const [showHistory, setShowHistory] = useState<Record<string, boolean>>({})
  const [editing, setEditing] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const color = INSPECTION_COLOR[live.type]
  const issues = live.issues
  const counts = { open: issues.filter((i) => i.status === 'open').length, 'in-progress': issues.filter((i) => i.status === 'in-progress').length, closed: issues.filter((i) => i.status === 'closed').length }
  const shown = issues.filter((i) => filter === 'all' || i.status === filter)
  const locked = live.status === 'completed'
  const today = new Date().toISOString().slice(0, 10)

  const log = (summary: string) => [{ id: uid('log'), at: new Date().toISOString(), by: me, summary }, ...(live.log ?? [])]
  const saveInspection = (next: Inspection) =>
    updateTask({ ...task, inspections: (task.inspections ?? []).map((i) => i.id === next.id ? next : i) })
  const patchIssue = (id: string, fn: (i: InspectionIssue) => InspectionIssue) =>
    saveInspection({ ...live, issues: live.issues.map((i) => i.id === id ? fn(i) : i) })

  const canUpdate = (i: InspectionIssue) => manager || i.assignedTo === currentUser?.email || i.raisedBy === me

  // ── Raise / edit ──
  const submitIssue = () => {
    if (!draft) return
    const { issue, original } = draft
    const before = beforePhotos(issue)
    if (!issue.title.trim() || before.length === 0) return

    if (!original) {
      const created = { ...issue, title: issue.title.trim(), beforePhotos: before, photos: undefined,
        history: [historyEntry(me, 'created', 'Issue raised', { photos: before, note: `Severity: ${issue.severity}` })] }
      saveInspection({ ...live, issues: [created, ...live.issues] })
    } else {
      const changes = diffIssue(original, issue, nameOf)
      const oldIds = new Set(beforePhotos(original).map((p) => p.id))
      const added = before.filter((p) => !oldIds.has(p.id))
      const removed = beforePhotos(original).filter((p) => !before.some((b) => b.id === p.id))
      if (added.length) changes.push({ field: 'Before photos', from: '—', to: `${added.length} added (${added.map((p) => p.name).join(', ')})` })
      if (removed.length) changes.push({ field: 'Before photos', from: `${removed.length} removed (${removed.map((p) => p.name).join(', ')})`, to: '—' })
      if (changes.length) {
        patchIssue(issue.id, () => ({ ...issue, title: issue.title.trim(), beforePhotos: before, photos: undefined,
          history: [...(original.history ?? []), historyEntry(me, 'edited', `Edited ${changes.map((c) => c.field.toLowerCase()).join(', ')}`, { changes, photos: added.length ? added : undefined })] }))
      }
    }
    setDraft(null)
  }

  const startWork = (i: InspectionIssue) =>
    patchIssue(i.id, (x) => ({ ...x, status: 'in-progress', history: [...(x.history ?? []), historyEntry(me, 'started', 'Work started', { changes: [{ field: 'Status', from: 'Open', to: 'In progress' }] })] }))

  const confirmClose = () => {
    if (!closing || closing.photos.length === 0) return
    const c = closing
    patchIssue(c.id, (x) => ({
      ...x, status: 'closed', closedAt: new Date().toISOString(), closedBy: me, closeNote: c.note.trim() || undefined, afterPhotos: c.photos,
      history: [...(x.history ?? []), historyEntry(me, 'closed', 'Issue closed', {
        changes: [{ field: 'Status', from: STATUS[x.status].label, to: 'Closed' }], note: c.note.trim() || undefined, photos: c.photos })],
    }))
    setClosing(null)
  }

  const reopen = (i: InspectionIssue) =>
    patchIssue(i.id, (x) => ({
      ...x, status: 'open', closedAt: undefined, closedBy: undefined, closeNote: undefined, afterPhotos: [],
      history: [...(x.history ?? []), historyEntry(me, 'reopened', 'Issue reopened — after photos cleared (earlier ones stay in the history)', { changes: [{ field: 'Status', from: 'Closed', to: 'Open' }] })],
    }))

  const deleteIssue = (i: InspectionIssue) => {
    if (!window.confirm(`Delete "${i.title}"? This is recorded in the inspection activity.`)) return
    saveInspection({ ...live, issues: live.issues.filter((x) => x.id !== i.id), log: log(`Issue deleted: "${i.title}" (${STATUS[i.status].label})`) })
  }

  const toggleComplete = () => {
    if (!locked && counts.open + counts['in-progress'] > 0 &&
      !window.confirm(`${counts.open + counts['in-progress']} issue(s) are still open. Mark the inspection complete anyway?`)) return
    saveInspection({ ...live, status: locked ? 'open' : 'completed', completedAt: locked ? undefined : new Date().toISOString(),
      log: log(locked ? 'Inspection reopened' : 'Inspection marked complete') })
  }

  const editInspection = (next: Inspection) => {
    const changes = diffInspection(live, next, nameOf)
    saveInspection(changes.length
      ? { ...next, log: log(`Details edited — ${changes.map((c) => `${c.field}: ${c.from} → ${c.to}`).join('; ')}`) }
      : next)
    setEditing(false)
  }

  const draftBefore = draft ? beforePhotos(draft.issue) : []
  const canSubmit = !!draft && !!draft.issue.title.trim() && draftBefore.length > 0

  return (
    <div className="absolute inset-0 z-20 bg-white flex flex-col">
      {/* Top bar */}
      <div className="flex-shrink-0 px-6 pt-5 pb-4 border-b border-slate-800">
        <div className="flex items-center gap-3 flex-wrap">
          <button onClick={onClose} className="flex items-center gap-1.5 text-slate-400 hover:text-ink transition-colors text-sm font-medium">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
            Exit
          </button>
          <div className="h-4 w-px bg-slate-700" />
          <div className="flex-1 min-w-0">
            <p className="text-xs text-slate-500 truncate">{task.name}</p>
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-[11px] font-bold text-white px-2.5 py-0.5 rounded-full whitespace-nowrap flex-shrink-0" style={{ background: color }}>{live.type}</span>
              <h1 className="text-base font-bold text-ink truncate">{live.title}</h1>
              {locked && <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-green-100 text-green-700 whitespace-nowrap">Completed</span>}
            </div>
          </div>
          <button onClick={() => exportInspection(task, live, members, me)} className={`${btn} bg-slate-800 hover:bg-slate-700 text-slate-200`} title="Print or save as PDF, with all issues, photos and change history">Export PDF</button>
          {(manager || live.inspectedBy === currentUser?.email) && (
            <button onClick={toggleComplete} className={`${btn} ${locked ? 'bg-slate-800 hover:bg-slate-700 text-slate-200' : 'bg-ink hover:bg-ink-soft text-white'}`}>
              {locked ? 'Reopen inspection' : 'Mark complete'}
            </button>
          )}
          {manager && <button onClick={() => setEditing(true)} className={`${btn} bg-slate-800 hover:bg-slate-700 text-slate-200`}>Edit details</button>}
          {manager && !confirmDelete && <button onClick={() => setConfirmDelete(true)} className={`${btn} bg-red-50 hover:bg-red-100 text-red-600`}>Delete</button>}
          {manager && confirmDelete && (
            <span className="flex items-center gap-2 text-sm text-red-600">Delete this inspection and its issues?
              <button onClick={onDelete} className={`${btn} bg-red-600 hover:bg-red-700 text-white !py-1`}>Delete</button>
              <button onClick={() => setConfirmDelete(false)} className={`${btn} bg-slate-800 text-slate-200 !py-1`}>Keep</button>
            </span>
          )}
        </div>

        <div className="flex gap-x-6 gap-y-1 flex-wrap mt-3 text-xs text-slate-400">
          <span>Date: <span className="text-slate-200 font-medium">{new Date(live.date + 'T00:00:00').toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' })}</span></span>
          {live.inspectedBy && <span>Inspected by: <span className="text-slate-200 font-medium">{nameOf(live.inspectedBy)}</span></span>}
          {live.location && <span>Location: <span className="text-slate-200 font-medium">{live.location}</span></span>}
          {live.notes && <span className="basis-full">Notes: <span className="text-slate-200">{live.notes}</span></span>}
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-6 py-5">
        <div className="max-w-3xl mx-auto space-y-5">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[['Issues / snags', issues.length, 'text-ink'], ['Open', counts.open, counts.open ? 'text-red-600' : 'text-ink'], ['In progress', counts['in-progress'], 'text-ink'], ['Closed', counts.closed, 'text-green-700']].map(([k, v, c]) => (
              <div key={k as string} className="bg-slate-900 border border-slate-800 rounded-3xl px-4 py-3">
                <p className="text-xs text-slate-400">{k}</p>
                <p className={`text-2xl font-bold tracking-tight ${c}`}>{v}</p>
              </div>
            ))}
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-lg font-bold text-ink mr-2">Issues / snags</h2>
            <div className="flex gap-1 bg-slate-800 rounded-full p-1">
              {(['all', 'open', 'in-progress', 'closed'] as const).map((f) => (
                <button key={f} onClick={() => setFilter(f)}
                  className={`px-3 py-1 rounded-full text-xs font-medium capitalize ${filter === f ? 'bg-ink text-white' : 'text-slate-300 hover:text-ink'}`}>{f === 'in-progress' ? 'In progress' : f}</button>
              ))}
            </div>
            {!locked && !draft && (
              <button onClick={() => setDraft({ issue: blankIssue(me) })} className={`${btn} bg-ink hover:bg-ink-soft text-white ml-auto`}>+ Raise issue</button>
            )}
          </div>
          {locked && <p className="text-xs text-slate-500">This inspection is marked complete. Reopen it to raise more issues.</p>}

          {/* New / edit issue form */}
          {draft && (
            <div className="bg-white border border-ink rounded-3xl p-5 space-y-3 shadow-float">
              <h3 className="text-sm font-bold text-ink">{draft.original ? 'Edit issue / snag' : 'New issue / snag'}</h3>
              <div><label className={lbl}>Title *</label>
                <input autoFocus className={field} value={draft.issue.title} onChange={(e) => setDraft({ ...draft, issue: { ...draft.issue, title: e.target.value } })} placeholder="e.g. Rebar cover below specification at gridline C" /></div>
              <div><label className={lbl}>Description</label>
                <textarea rows={2} className={`${field} resize-none`} value={draft.issue.description} onChange={(e) => setDraft({ ...draft, issue: { ...draft.issue, description: e.target.value } })} placeholder="What was found, and what needs to be done" /></div>
              <div>
                <label className={lbl}>Severity</label>
                <div className="flex gap-2">
                  {(['minor', 'major', 'critical'] as IssueSeverity[]).map((s) => (
                    <button key={s} type="button" onClick={() => setDraft({ ...draft, issue: { ...draft.issue, severity: s } })}
                      className={`px-4 py-1.5 rounded-full text-sm font-medium border transition-colors ${draft.issue.severity === s ? 'bg-ink border-ink text-white' : 'border-slate-700 text-slate-400 hover:border-slate-500'}`}>{SEVERITY[s].label}</button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div><label className={lbl}>Location</label>
                  <input className={field} value={draft.issue.location ?? ''} onChange={(e) => setDraft({ ...draft, issue: { ...draft.issue, location: e.target.value } })} placeholder={live.location || 'Where?'} /></div>
                <div><label className={lbl}>Assigned to</label>
                  <select className={field} value={draft.issue.assignedTo ?? ''} onChange={(e) => setDraft({ ...draft, issue: { ...draft.issue, assignedTo: e.target.value || undefined } })}>
                    <option value="">Unassigned</option>
                    {team.map((m) => <option key={m.id} value={m.email}>{m.name}</option>)}
                  </select></div>
                <div><label className={lbl}>Due date</label>
                  <input type="date" className={field} value={draft.issue.dueDate ?? ''} onChange={(e) => setDraft({ ...draft, issue: { ...draft.issue, dueDate: e.target.value || undefined } })} /></div>
              </div>
              <PhotoPicker label="Before photo" required photos={draftBefore} hint="A before photo is required to raise an issue"
                onChange={(p) => setDraft({ ...draft, issue: { ...draft.issue, beforePhotos: p, photos: undefined } })} />
              <div className="flex gap-2 pt-1">
                <button onClick={submitIssue} disabled={!canSubmit} className={`${btn} bg-ink hover:bg-ink-soft disabled:opacity-40 text-white`}>{draft.original ? 'Save changes' : 'Raise issue'}</button>
                <button onClick={() => setDraft(null)} className={`${btn} bg-slate-800 hover:bg-slate-700 text-slate-200`}>Cancel</button>
              </div>
            </div>
          )}

          {/* Issues */}
          {shown.length === 0 && !draft && (
            <div className="text-center py-12 bg-slate-900 border border-slate-800 rounded-3xl">
              <p className="text-sm text-slate-400">{issues.length === 0 ? 'No issues or snags recorded for this inspection yet.' : 'No issues match this filter.'}</p>
            </div>
          )}
          {shown.map((i) => {
            const hist = [...(i.history ?? [])].reverse()
            return (
              <div key={i.id} className={`border rounded-3xl p-5 ${i.status === 'closed' ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-700'}`}>
                <div className="flex items-start gap-3 flex-wrap">
                  <div className="flex-1 min-w-[220px]">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${SEVERITY[i.severity].chip}`}>{SEVERITY[i.severity].label}</span>
                      <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${STATUS[i.status].chip}`}>{STATUS[i.status].label}</span>
                    </div>
                    <h3 className={`text-sm font-bold mt-2 ${i.status === 'closed' ? 'text-slate-400 line-through' : 'text-ink'}`}>{i.title}</h3>
                    {i.description && <p className="text-sm text-slate-300 mt-1 whitespace-pre-wrap">{i.description}</p>}
                  </div>
                  <div className="flex gap-1.5 flex-wrap">
                    {!locked && canUpdate(i) && i.status === 'open' && <button onClick={() => startWork(i)} className={`${btn} !py-1.5 !text-xs bg-slate-800 hover:bg-slate-700 text-slate-200`}>Start work</button>}
                    {!locked && canUpdate(i) && i.status !== 'closed' && <button onClick={() => setClosing({ id: i.id, note: '', photos: [] })} className={`${btn} !py-1.5 !text-xs bg-green-600 hover:bg-green-700 text-white`}>Close issue</button>}
                    {!locked && canUpdate(i) && i.status === 'closed' && <button onClick={() => reopen(i)} className={`${btn} !py-1.5 !text-xs bg-slate-800 hover:bg-slate-700 text-slate-200`}>Reopen</button>}
                    {!locked && canUpdate(i) && i.status !== 'closed' && <button onClick={() => setDraft({ issue: { ...i, beforePhotos: beforePhotos(i) }, original: i })} className={`${btn} !py-1.5 !text-xs bg-slate-800 hover:bg-slate-700 text-slate-200`}>Edit</button>}
                    {manager && !locked && <button onClick={() => deleteIssue(i)} className={`${btn} !py-1.5 !text-xs bg-red-50 hover:bg-red-100 text-red-600`}>Delete</button>}
                  </div>
                </div>

                <div className="flex gap-x-5 gap-y-1 flex-wrap mt-3 text-xs text-slate-500">
                  {i.location && <span>📍 {i.location}</span>}
                  {i.assignedTo && <span>Assigned to <span className="text-slate-300 font-medium">{nameOf(i.assignedTo)}</span></span>}
                  {i.dueDate && <span>Due <span className={`font-medium ${i.status !== 'closed' && i.dueDate < today ? 'text-red-600' : 'text-slate-300'}`}>{new Date(i.dueDate + 'T00:00:00').toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}</span></span>}
                  <span>Raised by {i.raisedBy} · {new Date(i.raisedAt).toLocaleDateString()}</span>
                </div>

                {/* Before / after */}
                <div className="flex gap-6 flex-wrap mt-3">
                  <Gallery title="Before" photos={beforePhotos(i)} />
                  <Gallery title="After" photos={afterPhotos(i)} />
                  {i.status !== 'closed' && afterPhotos(i).length === 0 && <p className="text-xs text-slate-500 self-end">An after photo is required to close this issue.</p>}
                </div>

                {i.status === 'closed' && (
                  <p className="mt-3 text-xs text-green-700 bg-green-50 border border-green-100 rounded-2xl px-3 py-2">
                    Closed by {i.closedBy} on {i.closedAt && new Date(i.closedAt).toLocaleDateString()}{i.closeNote ? ` — ${i.closeNote}` : ''}
                  </p>
                )}

                {/* Close: after photo required */}
                {closing?.id === i.id && (
                  <div className="mt-3 p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
                    <PhotoPicker label="After photo" required photos={closing.photos} hint="An after photo is required to close the issue"
                      onChange={(p) => setClosing({ ...closing, photos: p })} />
                    <div><label className={lbl}>How was it resolved? (optional)</label>
                      <input autoFocus className={field} value={closing.note} onChange={(e) => setClosing({ ...closing, note: e.target.value })} placeholder="e.g. Spacers installed, cover re-measured" /></div>
                    <div className="flex gap-2">
                      <button onClick={confirmClose} disabled={closing.photos.length === 0} className={`${btn} bg-green-600 hover:bg-green-700 disabled:opacity-40 text-white`}>Confirm close</button>
                      <button onClick={() => setClosing(null)} className={`${btn} bg-slate-800 text-slate-200`}>Cancel</button>
                    </div>
                  </div>
                )}

                {/* Change history */}
                <button onClick={() => setShowHistory({ ...showHistory, [i.id]: !showHistory[i.id] })} className="mt-3 text-xs font-semibold text-slate-400 hover:text-ink">
                  {showHistory[i.id] ? '▾' : '▸'} Change history ({hist.length})
                </button>
                {showHistory[i.id] && (
                  <div className="mt-2 rounded-2xl border border-slate-800 divide-y divide-slate-800 bg-white">
                    {hist.length === 0 && <p className="px-3 py-2 text-xs text-slate-500">No history recorded for this issue.</p>}
                    {hist.map((h) => (
                      <div key={h.id} className="px-3 py-2.5 text-xs">
                        <div className="flex items-baseline gap-2 flex-wrap">
                          <span className="font-semibold text-ink">{h.summary}</span>
                          <span className="text-slate-500">{h.by} · {new Date(h.at).toLocaleString()}</span>
                        </div>
                        {(h.changes ?? []).map((c, k) => (
                          <p key={k} className="text-slate-400 mt-0.5">{c.field}: <span className="line-through">{c.from}</span> → <span className="text-slate-200">{c.to}</span></p>
                        ))}
                        {h.note && <p className="text-slate-400 mt-0.5 italic">"{h.note}"</p>}
                        {(h.photos?.length ?? 0) > 0 && (
                          <div className="flex gap-1.5 mt-1.5 flex-wrap">
                            {h.photos!.map((p) => <a key={p.id} href={p.dataUrl} target="_blank" rel="noreferrer"><img src={p.dataUrl} alt={p.name} className="w-12 h-12 object-cover rounded-lg border border-slate-700" /></a>)}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}

          {/* Inspection-level activity */}
          {(live.log?.length ?? 0) > 0 && (
            <div>
              <h2 className="text-sm font-bold text-ink mb-2 mt-4">Inspection activity</h2>
              <div className="rounded-2xl border border-slate-800 divide-y divide-slate-800">
                {live.log!.map((l) => (
                  <div key={l.id} className="px-4 py-2 text-xs flex gap-3 flex-wrap">
                    <span className="text-slate-500 w-40 flex-shrink-0">{new Date(l.at).toLocaleString()}</span>
                    <span className="text-slate-400 w-28 flex-shrink-0">{l.by}</span>
                    <span className="text-ink flex-1 min-w-[200px]">{l.summary}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {editing && <AddInspectionModal projectId={task.projectId} initial={live} onSave={editInspection} onClose={() => setEditing(false)} />}
    </div>
  )
}
