import { useState } from 'react'
import { useAppStore } from '../store'
import type { BmsDocument, BmsCategory, BmsRevision, ChecklistTemplate } from '../types'

// ─────────────────────────────────────────────────────────────────
// BMS (Business Management System) — core document templates with
// version control. Saving an edit archives the previous version and
// records what changed.
// ─────────────────────────────────────────────────────────────────
const BMS_CATEGORIES: BmsCategory[] = ['Policy', 'Procedure', 'Form', 'Template', 'Register', 'Manual']
const CHECKLIST: BmsCategory = 'Checklist Template'

function newBmsDoc(category: BmsCategory): BmsDocument {
  return { id: `${category === CHECKLIST ? 'tmpl' : 'bms'}-${Date.now()}`, title: '', docNumber: '', category, description: '', version: '1.0', content: '', updatedAt: new Date().toISOString() }
}

function bumpVersion(v: string): string {
  const parts = v.split('.')
  const last = parseInt(parts[parts.length - 1], 10)
  if (Number.isNaN(last)) return `${v}.1`
  parts[parts.length - 1] = String(last + 1)
  return parts.join('.')
}

// Checklist templates are shown as documents: the checklist items are the content (one per line)
function templateToDoc(t: ChecklistTemplate): BmsDocument {
  return { id: t.id, title: t.name, docNumber: t.docNumber ?? '', author: t.author, approvedBy: t.approvedBy, category: CHECKLIST, description: t.description,
    version: t.version ?? '1.0', content: t.items.map((i) => i.text).join('\n'), file: t.file,
    requiresSignature: t.requiresSignature, changeNote: t.changeNote ?? ((t.revisions?.length ?? 0) === 0 ? 'Initial release' : ''),
    revisions: t.revisions, updatedAt: t.updatedAt ?? t.createdAt }
}

function docToTemplate(d: BmsDocument, prev?: ChecklistTemplate): ChecklistTemplate {
  const items = d.content.split('\n').map((l) => l.trim()).filter(Boolean).map((text, i) => ({
    id: prev?.items.find((it) => it.text === text)?.id ?? `item-${Date.now()}-${i}`, text, completed: false }))
  return { id: d.id, name: d.title, description: d.description, items, requiresSignature: !!d.requiresSignature,
    createdAt: prev?.createdAt ?? d.updatedAt, docNumber: d.docNumber, author: d.author, approvedBy: d.approvedBy, version: d.version, changeNote: d.changeNote,
    revisions: d.revisions, file: d.file, updatedAt: d.updatedAt }
}

type DiffLine = { kind: 'add' | 'del' | 'same'; text: string }

// Line-level diff (LCS)
function diffLines(a: string, b: string): DiffLine[] {
  const x = a.split('\n'), y = b.split('\n')
  const dp: number[][] = Array.from({ length: x.length + 1 }, () => new Array(y.length + 1).fill(0))
  for (let i = x.length - 1; i >= 0; i--)
    for (let j = y.length - 1; j >= 0; j--)
      dp[i][j] = x[i] === y[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1])
  const out: DiffLine[] = []
  let i = 0, j = 0
  while (i < x.length && j < y.length) {
    if (x[i] === y[j]) { out.push({ kind: 'same', text: x[i] }); i++; j++ }
    else if (dp[i + 1][j] >= dp[i][j + 1]) out.push({ kind: 'del', text: x[i++] })
    else out.push({ kind: 'add', text: y[j++] })
  }
  while (i < x.length) out.push({ kind: 'del', text: x[i++] })
  while (j < y.length) out.push({ kind: 'add', text: y[j++] })
  return out
}

type Snapshot = Omit<BmsRevision, 'archivedAt'>

function snapshotOf(d: BmsDocument): Snapshot {
  return { version: d.version, title: d.title, docNumber: d.docNumber, category: d.category, description: d.description,
    content: d.content, file: d.file, author: d.author, approvedBy: d.approvedBy, requiresSignature: d.requiresSignature, changeNote: d.changeNote ?? '', createdAt: d.updatedAt }
}

function metaChanges(prev: Snapshot, cur: Snapshot): string[] {
  const rows: [string, string, string][] = [
    ['Title', prev.title, cur.title],
    ['Document no.', prev.docNumber, cur.docNumber],
    ['Category', prev.category, cur.category],
    ['Description', prev.description, cur.description],
    ['Author', prev.author ?? '', cur.author ?? ''],
    ['Approved by', prev.approvedBy ?? '', cur.approvedBy ?? ''],
    ['File', prev.file?.name ?? 'none', cur.file?.name ?? 'none'],
    ['Signature required', String(!!prev.requiresSignature), String(!!cur.requiresSignature)],
  ]
  return rows.filter(([k, a, b]) => a !== b && !(k === 'Signature required' && cur.category !== CHECKLIST)).map(([k, a, b]) => `${k}: "${a}" → "${b}"`)
}

function ChecklistView({ content, signature }: { content: string; signature?: boolean }) {
  const items = content.split('\n').filter((l) => l.trim())
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-800">
        <span className="text-xs font-semibold text-slate-400">Checklist items</span>
        <span className="text-xs text-slate-500">{items.length} item{items.length === 1 ? '' : 's'}</span>
      </div>
      {items.length === 0 && <p className="px-4 py-3 text-sm text-slate-500">No items.</p>}
      {items.map((text, i) => (
        <div key={i} className="flex items-center gap-3 px-4 py-2.5 border-b border-slate-800 last:border-0">
          <span className="w-4 h-4 rounded border border-slate-600 flex-shrink-0" />
          <span className="text-sm text-slate-200">{text}</span>
        </div>
      ))}
      {signature && <div className="px-4 py-2 bg-slate-950 text-xs text-amber-300">✎ Signature required on completion</div>}
    </div>
  )
}

function ChecklistEditor({ content, onChange }: { content: string; onChange: (c: string) => void }) {
  const rows = content === '' ? [''] : content.split('\n')
  const set = (next: string[]) => onChange(next.join('\n'))
  const edit = (i: number, v: string) => set(rows.map((r, k) => k === i ? v : r))
  const remove = (i: number) => set(rows.length === 1 ? [''] : rows.filter((_, k) => k !== i))
  const move = (i: number, d: -1 | 1) => {
    const j = i + d
    if (j < 0 || j >= rows.length) return
    const next = [...rows]; [next[i], next[j]] = [next[j], next[i]]
    set(next)
  }
  const addAfter = (i: number) => { const next = [...rows]; next.splice(i + 1, 0, ''); set(next) }
  const btn = 'w-6 h-6 flex items-center justify-center rounded text-slate-500 hover:text-white hover:bg-slate-700 disabled:opacity-30'

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 space-y-2">
      {rows.map((text, i) => (
        <div key={i} className="flex items-center gap-2">
          <span className="w-4 h-4 rounded border border-slate-600 flex-shrink-0" />
          <input autoFocus={i === rows.length - 1 && i > 0 && text === ''} data-checklist-row
            className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-purple-500"
            placeholder={`Item ${i + 1}`} value={text}
            onChange={(e) => edit(i, e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addAfter(i) } }} />
          <button type="button" className={btn} disabled={i === 0} onClick={() => move(i, -1)} title="Move up">↑</button>
          <button type="button" className={btn} disabled={i === rows.length - 1} onClick={() => move(i, 1)} title="Move down">↓</button>
          <button type="button" className={btn} onClick={() => remove(i)} title="Remove item">✕</button>
        </div>
      ))}
      <button type="button" onClick={() => set([...rows, ''])} className="text-sm text-purple-300 hover:text-purple-200 font-semibold pt-1">+ Add item</button>
    </div>
  )
}

function VersionHistory({ doc }: { doc: BmsDocument }) {
  const [open, setOpen] = useState<Record<string, 'changes' | 'full' | undefined>>({})
  const all: { snap: Snapshot; archivedAt?: string }[] = [
    ...(doc.revisions ?? []).map((r) => ({ snap: r as Snapshot, archivedAt: r.archivedAt })),
    { snap: snapshotOf(doc) },
  ]
  const newestFirst = all.map((v, i) => ({ ...v, prev: i > 0 ? all[i - 1].snap : undefined })).reverse()

  return (
    <section className="space-y-3">
      <h3 className="text-sm font-bold text-white">Version history</h3>
      {newestFirst.map(({ snap, archivedAt, prev }) => {
        const key = `${snap.version}-${snap.createdAt}`
        const mode = open[key]
        const toggle = (m: 'changes' | 'full') => setOpen({ ...open, [key]: mode === m ? undefined : m })
        return (
          <div key={key} className="bg-slate-900 border border-slate-800 rounded-xl p-4">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-bold text-white">v{snap.version}</span>
              <span className={`text-[10px] px-2 py-0.5 rounded-full border ${archivedAt ? 'bg-slate-800 text-slate-400 border-slate-700' : 'bg-emerald-900/40 text-emerald-300 border-emerald-800/40'}`}>
                {archivedAt ? 'Archived' : 'Current'}
              </span>
              <span className="text-xs text-slate-500">{new Date(snap.createdAt).toLocaleString()}</span>
              <div className="ml-auto flex gap-2">
                {prev && <button onClick={() => toggle('changes')} className={`text-xs px-2 py-1 rounded-md ${mode === 'changes' ? 'bg-purple-600 text-white' : 'bg-slate-800 text-slate-300'}`}>Changes</button>}
                <button onClick={() => toggle('full')} className={`text-xs px-2 py-1 rounded-md ${mode === 'full' ? 'bg-purple-600 text-white' : 'bg-slate-800 text-slate-300'}`}>Full text</button>
              </div>
            </div>
            <p className="text-sm text-slate-300 mt-2"><span className="text-slate-500">What changed: </span>{snap.changeNote || (prev ? '—' : 'Initial release')}</p>
            {mode === 'changes' && prev && (
              <div className="mt-3 space-y-2">
                {metaChanges(prev, snap).map((m) => <p key={m} className="text-xs text-amber-300">{m}</p>)}
                <div className="whitespace-pre-wrap text-xs font-mono bg-slate-950 border border-slate-800 rounded-lg p-3">
                  {diffLines(prev.content, snap.content).map((l, i) => (
                    <div key={i} className={l.kind === 'add' ? 'bg-emerald-900/30 text-emerald-300' : l.kind === 'del' ? 'bg-red-900/30 text-red-300 line-through' : 'text-slate-500'}>
                      {l.kind === 'add' ? '+ ' : l.kind === 'del' ? '- ' : '  '}{l.text}
                    </div>
                  ))}
                </div>
                <p className="text-[11px] text-slate-500">Compared with v{prev.version}</p>
              </div>
            )}
            {mode === 'full' && (
              <div className="mt-3 space-y-2">
                {snap.category === CHECKLIST
                  ? <ChecklistView content={snap.content} signature={snap.requiresSignature} />
                  : <pre className="whitespace-pre-wrap text-xs font-mono bg-slate-950 border border-slate-800 rounded-lg p-3 text-slate-200">{snap.content || 'No template content.'}</pre>}
                {snap.file && <a href={snap.file.dataUrl} download={snap.file.name} className="text-xs text-purple-300 underline">Download {snap.file.name}</a>}
              </div>
            )}
          </div>
        )
      })}
    </section>
  )
}

type Filter = BmsCategory | 'All'

export default function BmsPanel() {
  const bmsDocs = useAppStore((s) => s.bmsDocuments)
  const templates = useAppStore((s) => s.templates)
  const addBms = useAppStore((s) => s.addBmsDocument)
  const updateBms = useAppStore((s) => s.updateBmsDocument)
  const deleteBms = useAppStore((s) => s.deleteBmsDocument)
  const addTemplate = useAppStore((s) => s.addTemplate)
  const updateTemplate = useAppStore((s) => s.updateTemplate)
  const deleteTemplate = useAppStore((s) => s.deleteTemplate)

  const [selectedId, setSelectedId] = useState<string | null>(bmsDocs[0]?.id ?? null)
  const [draft, setDraft] = useState<BmsDocument | null>(null)
  const [filter, setFilter] = useState<Filter>('All')
  const [search, setSearch] = useState('')

  const isChecklist = filter === CHECKLIST
  const docs = isChecklist ? templates.map(templateToDoc) : bmsDocs
  const addDoc = (d: BmsDocument) => isChecklist ? addTemplate(docToTemplate(d)) : addBms(d)
  const updateDoc = (d: BmsDocument) => isChecklist ? updateTemplate(docToTemplate(d, templates.find((t) => t.id === d.id))) : updateBms(d)
  const deleteDoc = (id: string) => isChecklist ? deleteTemplate(id) : deleteBms(id)

  const visible = docs.filter((d) =>
    (filter === 'All' || d.category === filter) &&
    `${d.title} ${d.docNumber}`.toLowerCase().includes(search.toLowerCase()))
  const selected = docs.find((d) => d.id === selectedId) ?? (draft ? null : visible[0] ?? null)

  const isExisting = !!draft && docs.some((d) => d.id === draft.id)
  const versionClash = isExisting && !!selected && !!draft && draft.version.trim() === selected.version
  const canSave = !!draft && !!draft.title.trim() && !!draft.version.trim() &&
    (!isChecklist || draft.content.split('\n').some((l) => l.trim())) &&
    (!isExisting || (!!draft.changeNote?.trim() && !versionClash))

  const startNew = () => { setDraft(newBmsDoc(isChecklist ? CHECKLIST : 'Template')); setSelectedId(null) }
  const startEdit = () => { if (!selected) return; setSelectedId(selected.id); setDraft({ ...selected, version: bumpVersion(selected.version), changeNote: '' }) }
  const save = () => {
    if (!draft || !canSave) return
    const now = new Date().toISOString()
    const prev = docs.find((d) => d.id === draft.id)
    if (prev) {
      // Archive the version being replaced
      const archived: BmsRevision = { ...snapshotOf(prev), archivedAt: now }
      updateDoc({ ...draft, changeNote: draft.changeNote!.trim(), revisions: [...(prev.revisions ?? []), archived], updatedAt: now })
    } else {
      addDoc({ ...draft, changeNote: 'Initial release', revisions: [], updatedAt: now })
    }
    setSelectedId(draft.id)
    setDraft(null)
  }
  const remove = () => {
    if (!selected || !window.confirm(`Delete "${selected.title}" and all its archived versions?`)) return
    deleteDoc(selected.id)
    setSelectedId(null)
  }
  const onFile = (f?: File) => {
    if (!f || !draft) return
    const reader = new FileReader()
    reader.onload = () => setDraft((d) => d && ({ ...d, file: { id: `f-${Date.now()}`, name: f.name, mimeType: f.type, dataUrl: String(reader.result) } }))
    reader.readAsDataURL(f)
  }

  const input = 'w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-purple-500'
  const label = 'block text-xs font-semibold text-slate-400 mb-1'

  const categoryBar = (
    <div className="flex items-center gap-3 px-6 py-2 border-b border-slate-800 bg-slate-900/60 flex-shrink-0">
      <label className="text-xs font-semibold text-slate-400">Category</label>
      <select className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-purple-500"
        value={filter} onChange={(e) => { setFilter(e.target.value as Filter); setDraft(null); setSelectedId(null) }}>
        <option value="All">All documents</option>
        {BMS_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
        <option value={CHECKLIST}>Checklist Templates</option>
      </select>
    </div>
  )

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      {categoryBar}
      <div className="flex flex-1 overflow-hidden">
      {/* List */}
      <aside className="w-80 border-r border-slate-800 bg-slate-900 flex flex-col flex-shrink-0">
        <div className="p-3 space-y-2 border-b border-slate-800">
          <div className="flex gap-2">
            <input className={input} placeholder="Search documents…" value={search} onChange={(e) => setSearch(e.target.value)} />
            <button onClick={startNew} className="px-3 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-sm font-semibold whitespace-nowrap">+ New</button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {visible.length === 0 && <p className="p-4 text-sm text-slate-500">No documents found.</p>}
          {visible.map((d) => (
            <button key={d.id} onClick={() => { setSelectedId(d.id); setDraft(null) }}
              className={`w-full text-left px-4 py-3 border-b border-slate-800 hover:bg-slate-800 ${selectedId === d.id && !draft ? 'bg-slate-800' : ''}`}>
              <p className="text-sm font-semibold text-white truncate">{d.title}</p>
              <p className="text-xs text-slate-500 mt-0.5">{d.category !== CHECKLIST && `${d.docNumber || 'No number'} · `}v{d.version} · {d.category === CHECKLIST ? `${d.content.split('\n').filter((l) => l.trim()).length} items` : d.category}</p>
            </button>
          ))}
        </div>
      </aside>

      {/* Detail / editor */}
      <main className="flex-1 overflow-y-auto p-6">
        {draft ? (
          <div className="max-w-2xl space-y-4">
            <h2 className="text-white font-bold text-lg">{isExisting ? `Edit — new version (current is v${selected?.version})` : isChecklist ? 'New checklist' : 'New document'}</h2>
            <div><label className={label}>Title</label><input className={input} value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} /></div>
            <div className={`grid ${isChecklist ? 'grid-cols-2' : 'grid-cols-3'} gap-3`}>
              {!isChecklist && <div><label className={label}>Document no.</label><input className={input} placeholder="BMS-QP-001" value={draft.docNumber} onChange={(e) => setDraft({ ...draft, docNumber: e.target.value })} /></div>}
              <div><label className={label}>Category</label>
                <select className={input} disabled={isChecklist} value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value as BmsCategory })}>
                  {(isChecklist ? [CHECKLIST] : BMS_CATEGORIES).map((c) => <option key={c}>{c}</option>)}
                </select></div>
              <div><label className={label}>{isExisting ? 'New version' : 'Version'}</label><input className={input} value={draft.version} onChange={(e) => setDraft({ ...draft, version: e.target.value })} /></div>
            </div>
            <div><label className={label}>Description</label><input className={input} value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className={label}>Author</label><input className={input} value={draft.author ?? ''} onChange={(e) => setDraft({ ...draft, author: e.target.value })} /></div>
              <div><label className={label}>Approved by</label><input className={input} value={draft.approvedBy ?? ''} onChange={(e) => setDraft({ ...draft, approvedBy: e.target.value })} /></div>
            </div>
            {isChecklist ? (
              <div><label className={label}>Checklist items</label>
                <ChecklistEditor content={draft.content} onChange={(c) => setDraft({ ...draft, content: c })} /></div>
            ) : (
              <div><label className={label}>Template content</label>
                <textarea className={`${input} font-mono h-64`} value={draft.content} onChange={(e) => setDraft({ ...draft, content: e.target.value })} /></div>
            )}
            {isChecklist && (
              <label className="flex items-center gap-2 text-sm text-slate-300">
                <input type="checkbox" checked={!!draft.requiresSignature} onChange={(e) => setDraft({ ...draft, requiresSignature: e.target.checked })} />
                Signature required on completion
              </label>
            )}
            {!isChecklist && (
              <div><label className={label}>Template file (optional)</label>
                <input type="file" className="text-sm text-slate-400" onChange={(e) => onFile(e.target.files?.[0])} />
                {draft.file && <p className="text-xs text-slate-400 mt-1">{draft.file.name}</p>}</div>
            )}
            {isExisting && (
              <div>
                <label className={label}>What changed from v{selected?.version}? (required)</label>
                <textarea className={`${input} h-20`} placeholder={isChecklist ? 'e.g. Added first aid kit check' : 'e.g. Added section 6 – records retention; updated sign-off roles'} value={draft.changeNote ?? ''} onChange={(e) => setDraft({ ...draft, changeNote: e.target.value })} />
                {versionClash && <p className="text-xs text-red-400 mt-1">Version number must differ from the current version.</p>}
                <p className="text-xs text-slate-500 mt-1">Saving archives v{selected?.version} and keeps it in the version history.</p>
              </div>
            )}
            <div className="flex gap-2 pt-2">
              <button onClick={save} disabled={!canSave} className="px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 disabled:opacity-40 text-white text-sm font-semibold">{isExisting ? 'Save as new version' : 'Save'}</button>
              <button onClick={() => { setDraft(null); setSelectedId(selected?.id ?? null) }} className="px-4 py-2 rounded-lg bg-slate-800 text-slate-300 text-sm font-semibold">Cancel</button>
            </div>
          </div>
        ) : selected ? (
          <div className="max-w-2xl space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-white font-bold text-xl">{selected.title}</h2>
                <p className="text-xs text-slate-500 mt-1">{selected.category !== CHECKLIST && `${selected.docNumber || 'No number'} · `}v{selected.version} · {selected.category} · Updated {new Date(selected.updatedAt).toLocaleDateString()}</p>
              </div>
              <div className="flex gap-2 flex-shrink-0">
                <button onClick={startEdit} className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-semibold">Edit</button>
                <button onClick={remove} className="px-3 py-1.5 rounded-lg bg-red-900/40 hover:bg-red-900/60 text-red-300 text-sm font-semibold">Delete</button>
              </div>
            </div>
            {selected.description && <p className="text-sm text-slate-300">{selected.description}</p>}
            <div className="flex gap-6 text-sm">
              <p><span className="text-slate-500">Author: </span><span className="text-slate-200">{selected.author || '—'}</span></p>
              <p><span className="text-slate-500">Approved by: </span><span className="text-slate-200">{selected.approvedBy || '—'}</span></p>
            </div>
            {selected.category === CHECKLIST
              ? <ChecklistView content={selected.content} signature={selected.requiresSignature} />
              : <pre className="whitespace-pre-wrap bg-slate-900 border border-slate-800 rounded-xl p-4 text-sm text-slate-200 font-mono">{selected.content || 'No template content.'}</pre>}
            {selected.file && (
              <a href={selected.file.dataUrl} download={selected.file.name} className="inline-block text-sm text-purple-300 hover:text-purple-200 underline">Download {selected.file.name}</a>
            )}
            <VersionHistory doc={selected} />
          </div>
        ) : (
          <div className="flex items-center justify-center h-full">
            <p className="text-slate-500 text-sm">Select a document or create a new one</p>
          </div>
        )}
      </main>
      </div>
    </div>
  )
}
