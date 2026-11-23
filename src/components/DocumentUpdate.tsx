import { useMemo, useState } from 'react'
import DocumentView, { TONES, type Annotation } from './DocumentView'
import { carryValues, droppedEntries, mergeBlocks } from '../docDiff'
import { changesSince, seqLabel, versionsOf } from '../projectDocs'
import type { BmsDocument, ProjectDocument } from '../types'

interface Props {
  name: string
  number: string
  instance: ProjectDocument
  template: BmsDocument
  canWork: boolean
  onSaveDraft: (values: Record<string, string>) => void
  onDiscardDraft: () => void
  onApply: (values: Record<string, string>, note: string) => void
  onCancel: () => void
}

// Bringing a project document up to a new template version. The new version is laid out with everything
// the template now contains AND everything the project had entered. What is new, changed, removed or already
// there is colour-coded; the project manager checks it, edits it, and applying it makes it the next revision.
export default function DocumentUpdate({ name, number, instance, template, canWork, onSaveDraft, onDiscardDraft, onApply, onCancel }: Props) {
  const versions = versionsOf(template)
  const oldVersion = versions.find((v) => v.version === instance.adoptedVersion)
  const newVersion = versions[versions.length - 1]
  const oldBlocks = oldVersion?.blocks ?? []
  const newBlocks = newVersion.blocks ?? []
  const revision = instance.revision ?? 1

  const draft = instance.updateDraft && instance.updateDraft.toVersion === newVersion.version ? instance.updateDraft : undefined
  const [values, setValues] = useState<Record<string, string>>(() => draft?.values ?? carryValues(oldBlocks, newBlocks, instance.fieldValues ?? {}))
  const [onlyChanges, setOnlyChanges] = useState(false)
  const [checked, setChecked] = useState(false)
  const [note, setNote] = useState('')

  const merged = useMemo(() => mergeBlocks(oldBlocks, newBlocks), [oldBlocks, newBlocks])
  const dropped = droppedEntries(oldBlocks, newBlocks, instance.fieldValues ?? {})
  const changes = changesSince(template, instance.adoptedVersion)

  const hasEntry = (id: string) => !!values[id]?.trim()
  const annotate: Record<string, Annotation> = {}
  const counts = { new: 0, changed: 0, removed: 0, existing: 0 }
  for (const m of merged) {
    const fillable = m.block.type === 'field' || (m.block.type === 'table' && m.block.tableMode === 'fill')
    if (m.change === 'new') { annotate[m.block.id] = { kind: 'new' }; counts.new++ }
    else if (m.change === 'changed') { annotate[m.block.id] = { kind: 'changed', before: m.before }; counts.changed++ }
    else if (m.change === 'removed') { annotate[m.block.id] = { kind: 'removed', before: m.before }; counts.removed++ }
    else if (fillable && hasEntry(m.block.id)) { annotate[m.block.id] = { kind: 'existing' }; counts.existing++ }
    else if (onlyChanges) annotate[m.block.id] = { kind: 'dim' }
  }
  // entries inside a changed block still count as carried over
  for (const m of merged) if (m.change === 'changed' && (m.block.type === 'field' || m.block.type === 'table') && hasEntry(m.block.id)) counts.existing++

  const newIds = new Set(newBlocks.map((b) => b.id))
  const finalValues = () => Object.fromEntries(Object.entries(values).filter(([k]) => newIds.has(k)))
  const nothingChanged = counts.new + counts.changed + counts.removed === 0

  return (
    <div className="space-y-5 max-w-4xl">
      <div>
        <button onClick={onCancel} className="mb-3 inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-medium transition-colors">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          Back to the document
        </button>
        <h2 className="text-2xl font-bold text-ink">Update {name}</h2>
        <p className="text-sm text-slate-400 mt-1">
          <span className="font-mono">{number}</span> · {seqLabel(instance.sequence)} · from template v{instance.adoptedVersion} (revision {revision}) to <span className="font-semibold text-ink">template v{newVersion.version}</span> (revision {revision + 1})
        </p>
        {draft && <p className="text-xs text-amber-700 mt-1">Resuming your saved draft from {new Date(draft.savedAt).toLocaleString()}.</p>}
      </div>

      {/* What the library changed */}
      <div className="rounded-3xl bg-slate-900 border border-slate-800 px-5 py-4">
        <p className="text-sm font-bold text-ink mb-2">What changed in the BMS library</p>
        <ul className="space-y-1">
          {changes.map((c) => (
            <li key={c.version} className="text-sm text-slate-300"><span className="font-semibold text-ink">v{c.version}</span> <span className="text-slate-500">· {new Date(c.createdAt).toLocaleDateString()} —</span> {c.changeNote || 'No change note recorded.'}</li>
          ))}
        </ul>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-3 flex-wrap">
        {(['existing', 'new', 'changed', 'removed'] as const).map((k) => (
          <span key={k} className="inline-flex items-center gap-2 text-xs text-slate-300 rounded-full pl-1 pr-3 py-1" style={{ background: TONES[k].bg, border: `1px solid ${TONES[k].border}55` }}>
            <span className="text-[9px] font-bold tracking-wider text-white px-2 py-0.5 rounded-full" style={{ background: TONES[k].solid }}>{TONES[k].label}</span>
            {TONES[k].meaning} <span className="font-bold text-ink">{counts[k]}</span>
          </span>
        ))}
        <label className="ml-auto flex items-center gap-2 text-xs text-slate-400 cursor-pointer">
          <input type="checkbox" checked={onlyChanges} onChange={(e) => setOnlyChanges(e.target.checked)} /> Fade everything unchanged
        </label>
      </div>

      {nothingChanged && <p className="rounded-2xl bg-slate-900 border border-slate-800 px-4 py-3 text-sm text-slate-300">The layout of this template didn't change between these versions, so your existing entries carry over as they are.</p>}
      {dropped.length > 0 && (
        <p className="rounded-2xl bg-red-50 border border-red-100 px-4 py-3 text-sm text-red-600">
          {dropped.length} entr{dropped.length === 1 ? 'y' : 'ies'} belong to content that was removed from the template ({dropped.map((d) => d.label || 'a table').join(', ')}). {dropped.length === 1 ? 'It' : 'They'} won't appear in the new revision, but stay in revision {revision}, which is kept.
        </p>
      )}

      <DocumentView title={name} meta={[number, seqLabel(instance.sequence), `updating to template v${newVersion.version}`, template.category].join(' · ')}
        blocks={merged.map((m) => m.block)} values={values} annotate={annotate}
        onChange={canWork ? (id, v) => setValues((cur) => ({ ...cur, [id]: v })) : undefined} />

      {/* Check and apply */}
      <div className="sticky bottom-0 rounded-3xl bg-white border border-slate-700 shadow-float px-5 py-4 space-y-3">
        {canWork ? (
          <>
            <label className="flex items-start gap-2 text-sm text-ink cursor-pointer">
              <input type="checkbox" className="mt-1" checked={checked} onChange={(e) => setChecked(e.target.checked)} />
              <span>I've checked the new and changed content, and my existing entries, and made any edits needed.</span>
            </label>
            <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note for the revision history (optional)"
              className="w-full bg-white border border-slate-700 rounded-2xl px-3 py-2 text-sm text-ink placeholder-slate-500 focus:outline-none focus:border-ink" />
            <div className="flex items-center gap-2 flex-wrap">
              <button onClick={() => onApply(finalValues(), note.trim())} disabled={!checked}
                className="px-5 py-2.5 rounded-full bg-ink hover:bg-ink-soft disabled:opacity-40 text-white text-sm font-semibold transition-colors">Apply update — make this revision {revision + 1}</button>
              <button onClick={() => onSaveDraft(finalValues())} className="px-4 py-2.5 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-semibold">Save draft</button>
              {draft && <button onClick={() => { onDiscardDraft(); onCancel() }} className="px-4 py-2.5 rounded-full bg-red-50 hover:bg-red-100 text-red-600 text-sm font-semibold">Discard draft</button>}
              <button onClick={onCancel} className="px-4 py-2.5 rounded-full text-slate-400 hover:text-ink text-sm font-semibold">Cancel</button>
              <span className="text-xs text-slate-500 ml-auto">Revision {revision} is kept as it was. The 12-month review period restarts when you apply.</span>
            </div>
          </>
        ) : <p className="text-sm text-slate-500">Only the project manager can apply this update.</p>}
      </div>
    </div>
  )
}
