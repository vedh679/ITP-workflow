import { useState } from 'react'
import { useAppStore } from '../store'
import type { BmsDocument, BmsCategory, BmsRevision, BmsPending, BmsReview, ChecklistTemplate } from '../types'
import { useAppStore as useStore } from '../store'
import { CORE_CATEGORIES } from '../projectDocs'
import { blocksToText, contentToBlocks, newBlockId } from '../docBlocks'
import { DEFAULT_REVIEW_MONTHS, fmtDate, nextReviewDue, reviewState, reviewsDue } from '../bmsReview'
import DocumentEditor from '../components/DocumentEditor'
import DocumentView from '../components/DocumentView'

// ─────────────────────────────────────────────────────────────────
// BMS (Business Management System) — core document templates with
// version control. Saving an edit archives the previous version and
// records what changed.
// ─────────────────────────────────────────────────────────────────
const BMS_CATEGORIES: BmsCategory[] = CORE_CATEGORIES.map((c) => c.key)
const CHECKLIST: BmsCategory = 'Checklist Template'

function newBmsDoc(category: BmsCategory): BmsDocument {
  return { id: `${category === CHECKLIST ? 'tmpl' : 'bms'}-${Date.now()}`, title: '', docNumber: '', category, description: '', version: '1.0', content: '', updatedAt: new Date().toISOString(),
    blocks: category === CHECKLIST ? undefined : [{ id: newBlockId(), type: 'heading', level: 2, text: '' }] }
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
    content: d.content, blocks: d.blocks, file: d.file, author: d.author, approvedBy: d.approvedBy, requiresSignature: d.requiresSignature, changeNote: d.changeNote ?? '', createdAt: d.updatedAt }
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
  const btn = 'w-6 h-6 flex items-center justify-center rounded text-slate-500 hover:text-ink hover:bg-slate-700 disabled:opacity-30'

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 space-y-2">
      {rows.map((text, i) => (
        <div key={i} className="flex items-center gap-2">
          <span className="w-4 h-4 rounded border border-slate-600 flex-shrink-0" />
          <input autoFocus={i === rows.length - 1 && i > 0 && text === ''} data-checklist-row
            className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-ink placeholder-slate-500 focus:outline-none focus:border-purple-500"
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
      <h3 className="text-sm font-bold text-ink">Version history</h3>
      {newestFirst.map(({ snap, archivedAt, prev }) => {
        const key = `${snap.version}-${snap.createdAt}`
        const mode = open[key]
        const toggle = (m: 'changes' | 'full') => setOpen({ ...open, [key]: mode === m ? undefined : m })
        return (
          <div key={key} className="bg-slate-900 border border-slate-800 rounded-xl p-4">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-bold text-ink">v{snap.version}</span>
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
                  : snap.blocks
                    ? <DocumentView compact title={snap.title} blocks={snap.blocks} meta={`${snap.docNumber} · v${snap.version}`} />
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
  const [notice, setNotice] = useState('')
  const [reviewing, setReviewing] = useState<{ comment: string } | null>(null)
  const [needsReview, setNeedsReview] = useState(false)
  const [showReviews, setShowReviews] = useState(false)
  const currentUser = useStore((s) => s.currentUser)
  const me = currentUser?.name ?? 'Unknown'

  const isChecklist = filter === CHECKLIST
  const docs = isChecklist ? templates.map(templateToDoc) : bmsDocs
  const addDoc = (d: BmsDocument) => isChecklist ? addTemplate(docToTemplate(d)) : addBms(d)
  const updateDoc = (d: BmsDocument) => isChecklist ? updateTemplate(docToTemplate(d, templates.find((t) => t.id === d.id))) : updateBms(d)
  const deleteDoc = (id: string) => isChecklist ? deleteTemplate(id) : deleteBms(id)

  const dueIds = new Set(reviewsDue(docs).map((d) => d.id))
  const visible = docs.filter((d) =>
    (filter === 'All' || d.category === filter) &&
    (!needsReview || dueIds.has(d.id)) &&
    `${d.title} ${d.docNumber}`.toLowerCase().includes(search.toLowerCase()))
  const selected = docs.find((d) => d.id === selectedId) ?? (draft ? null : visible[0] ?? null)

  const isExisting = !!draft && docs.some((d) => d.id === draft.id)
  // Core documents start as drafts; a version that is already published needs a new version number and a change note
  const publishedExisting = isExisting && !!selected && selected.status !== 'draft'
  const versionClash = publishedExisting && !!draft && draft.version.trim() === selected!.version
  const canDraft = !!draft && !!draft.title.trim() && !!draft.version.trim()
  const canSave = canDraft &&
    (!isChecklist || draft!.content.split('\n').some((l) => l.trim())) &&
    (!publishedExisting || (!!draft!.changeNote?.trim() && !versionClash))

  const startNew = (category: BmsCategory = 'Policy') => { setDraft(newBmsDoc(isChecklist ? CHECKLIST : category)); setSelectedId(null); setReviewing(null) }
  const startEdit = () => {
    if (!selected) return
    setSelectedId(selected.id); setNotice('')
    if (isChecklist) {
      setDraft({ ...selected, version: bumpVersion(selected.version), changeNote: '', blocks: undefined })
    } else if (selected.pending) {
      // carry on with the saved draft of the next version
      const { savedAt: _a, savedBy: _b, ...fields } = selected.pending
      setDraft({ ...selected, ...fields, blocks: fields.blocks ?? contentToBlocks(fields.content) })
    } else {
      setDraft({ ...selected, version: selected.status === 'draft' ? selected.version : bumpVersion(selected.version),
        changeNote: '', blocks: selected.blocks ?? contentToBlocks(selected.content) })
    }
  }

  // ── Core documents: save as a draft, or publish (roll out to the projects) ──
  const bodyOf = (d: BmsDocument): BmsDocument => d.blocks ? { ...d, content: blocksToText(d.blocks) } : d
  const pendingOf = (d: BmsDocument): BmsPending => ({
    title: d.title, docNumber: d.docNumber, category: d.category, description: d.description, version: d.version,
    content: d.content, blocks: d.blocks, file: d.file, author: d.author, approvedBy: d.approvedBy,
    reviewIntervalMonths: d.reviewIntervalMonths, changeNote: d.changeNote ?? '', savedAt: new Date().toISOString(), savedBy: me,
  })
  const saveDraftDoc = () => {
    if (!draft || !canDraft) return
    const body = bodyOf(draft), now = new Date().toISOString()
    const prev = docs.find((d) => d.id === draft.id)
    if (!prev) addBms({ ...body, status: 'draft', changeNote: 'Initial release', revisions: [], pending: undefined, updatedAt: now })
    else if (prev.status === 'draft') updateBms({ ...prev, ...body, status: 'draft', updatedAt: now })
    else updateBms({ ...prev, pending: pendingOf(body) })   // the published version stays live
    setSelectedId(draft.id); setDraft(null)
    setNotice('Draft saved. Projects can’t see it until you publish.')
  }
  const publishDoc = () => {
    if (!draft || !canSave) return
    const body = bodyOf(draft), now = new Date().toISOString()
    const prev = docs.find((d) => d.id === draft.id)
    // publishing a version counts as a review of the document
    const stamp = { status: 'published' as const, publishedAt: now, publishedBy: me, lastReviewedAt: now, lastReviewedBy: me, pending: undefined, updatedAt: now }
    if (!prev) addBms({ ...body, ...stamp, changeNote: 'Initial release', revisions: [] })
    else if (prev.status === 'draft') updateBms({ ...prev, ...body, ...stamp, changeNote: 'Initial release', revisions: prev.revisions ?? [] })
    else updateBms({ ...prev, ...body, ...stamp, reviews: prev.reviews, changeNote: draft.changeNote!.trim(), revisions: [...(prev.revisions ?? []), { ...snapshotOf(prev), archivedAt: now }] })
    setSelectedId(draft.id); setDraft(null)
    setNotice(`Published v${body.version} — it is now rolled out. Project managers will be prompted to update.`)
  }
  /** Publish what is already saved (a never-published draft, or a saved draft of the next version) */
  const publishSaved = () => {
    if (!selected) return
    const now = new Date().toISOString()
    const stamp = { status: 'published' as const, publishedAt: now, publishedBy: me, lastReviewedAt: now, lastReviewedBy: me, pending: undefined, updatedAt: now }
    if (selected.status === 'draft') {
      updateBms({ ...selected, ...stamp, changeNote: 'Initial release', revisions: selected.revisions ?? [] })
      setNotice(`Published v${selected.version} — it is now rolled out to the projects.`)
    } else if (selected.pending) {
      const { savedAt: _a, savedBy: _b, ...fields } = selected.pending
      updateBms({ ...selected, ...fields, ...stamp, revisions: [...(selected.revisions ?? []), { ...snapshotOf(selected), archivedAt: now }] })
      setNotice(`Published v${selected.pending.version} — it is now rolled out. Project managers will be prompted to update.`)
    }
  }
  // ── Review & update ──
  const recordReview = (outcome: BmsReview['outcome'], comment: string) => {
    if (!selected) return
    const now = new Date().toISOString()
    const entry: BmsReview = { id: `rev-${Date.now()}`, at: now, by: me, version: selected.version, outcome, comment: comment.trim() }
    updateBms({ ...selected, lastReviewedAt: now, lastReviewedBy: me, reviews: [entry, ...(selected.reviews ?? [])] })
  }
  const reviewNoChanges = () => {
    if (!reviewing || !selected) return
    recordReview('no-changes', reviewing.comment)
    const next = new Date(); next.setMonth(next.getMonth() + (selected.reviewIntervalMonths ?? DEFAULT_REVIEW_MONTHS))
    setReviewing(null); setNotice(`Review recorded — no changes needed. Next review due ${fmtDate(next)}.`)
  }
  const reviewStartUpdate = () => {
    if (!reviewing || !selected) return
    const comment = reviewing.comment.trim()
    recordReview('changes-needed', comment)
    setReviewing(null)
    startEdit()
    // carry the reviewer's notes into the change note of the new version
    setDraft((d) => d && { ...d, changeNote: d.changeNote || comment })
  }

  // ── Create from an existing document (handy for templates) ──
  const duplicate = () => {
    if (!selected || isChecklist) return
    const now = new Date().toISOString()
    const copy: BmsDocument = {
      ...selected, id: `bms-${Date.now()}`, title: `${selected.title} (copy)`, docNumber: '', version: '1.0', status: 'draft',
      blocks: selected.blocks?.map((b) => ({ ...b, id: newBlockId() })), revisions: [], pending: undefined, reviews: [],
      lastReviewedAt: undefined, lastReviewedBy: undefined, publishedAt: undefined, publishedBy: undefined,
      changeNote: 'Initial release', updatedAt: now,
    }
    addBms(copy); setSelectedId(copy.id); setDraft(null); setReviewing(null)
    setNotice('Copied as a new draft. Give it a document number, make your changes, then publish.')
  }

  const discardPending = () => {
    if (!selected?.pending || !window.confirm('Discard the saved draft of the next version? The published version is not affected.')) return
    updateBms({ ...selected, pending: undefined }); setNotice('Draft discarded.')
  }

  const save = () => {
    if (!draft || !canSave) return
    const now = new Date().toISOString()
    const prev = docs.find((d) => d.id === draft.id)
    // structured documents: keep the plain-text form in step with the blocks (used for search and version diffs)
    const body = draft.blocks && !isChecklist ? { ...draft, content: blocksToText(draft.blocks) } : draft
    if (prev) {
      // Archive the version being replaced
      const archived: BmsRevision = { ...snapshotOf(prev), archivedAt: now }
      updateDoc({ ...body, changeNote: draft.changeNote!.trim(), revisions: [...(prev.revisions ?? []), archived], updatedAt: now })
    } else {
      addDoc({ ...body, changeNote: 'Initial release', revisions: [], updatedAt: now })
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

  const input = 'w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-ink placeholder-slate-500 focus:outline-none focus:border-purple-500'
  const label = 'block text-xs font-semibold text-slate-400 mb-1'

  const categoryBar = (
    <div className="flex items-center gap-3 px-6 py-2 border-b border-slate-800 bg-slate-900/60 flex-shrink-0">
      <label className="text-xs font-semibold text-slate-400">Category</label>
      <select className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-ink focus:outline-none focus:border-purple-500"
        value={filter} onChange={(e) => { setFilter(e.target.value as Filter); setDraft(null); setSelectedId(null) }}>
        <option value="All">All documents</option>
        {BMS_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
        <option value={CHECKLIST}>Checklist Templates</option>
      </select>
      {!isChecklist && (
        <div className="ml-auto flex items-center gap-2">
          <span className="text-xs text-slate-500">{docs.filter((d) => d.status === 'draft' || d.pending).length} draft{docs.filter((d) => d.status === 'draft' || d.pending).length === 1 ? '' : 's'}</span>
          <button onClick={() => setNeedsReview((v) => !v)}
            className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors ${needsReview ? 'bg-ink text-white' : dueIds.size ? 'bg-amber-100 text-amber-700' : 'bg-slate-800 text-slate-300'}`}>
            {dueIds.size} due for review
          </button>
        </div>
      )}
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
            {isChecklist
              ? <button onClick={() => startNew()} className="px-3 rounded-full bg-purple-600 hover:bg-purple-500 text-white text-sm font-semibold whitespace-nowrap">+ New</button>
              : <button onClick={() => startNew('Policy')} className="px-3 rounded-full bg-purple-600 hover:bg-purple-500 text-white text-sm font-semibold whitespace-nowrap">+ Document</button>}
            {!isChecklist && <button onClick={() => startNew('Template')} className="px-3 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-semibold whitespace-nowrap">+ Template</button>}
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {visible.length === 0 && <p className="p-4 text-sm text-slate-500">No documents found.</p>}
          {visible.map((d) => (
            <button key={d.id} onClick={() => { setSelectedId(d.id); setDraft(null); setNotice(''); setReviewing(null) }}
              className={`w-full text-left px-4 py-3 border-b border-slate-800 hover:bg-slate-800 ${selectedId === d.id && !draft ? 'bg-slate-800' : ''}`}>
              <p className="text-sm font-semibold text-ink truncate flex items-center gap-2">
                <span className="truncate">{d.title}</span>
                {!isChecklist && d.status === 'draft' && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 flex-shrink-0">Draft</span>}
                {!isChecklist && ['overdue', 'due-soon'].includes(reviewState(d)) && <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0 ${reviewState(d) === 'overdue' ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-700'}`}>{reviewState(d) === 'overdue' ? 'Review overdue' : 'Review due'}</span>}
                {!isChecklist && d.status !== 'draft' && d.pending && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 flex-shrink-0">Draft v{d.pending.version}</span>}
              </p>
              <p className="text-xs text-slate-500 mt-0.5">{d.category !== CHECKLIST && `${d.docNumber || 'No number'} · `}v{d.version} · {d.category === CHECKLIST ? `${d.content.split('\n').filter((l) => l.trim()).length} items` : d.category}</p>
            </button>
          ))}
        </div>
      </aside>

      {/* Detail / editor */}
      <main className="flex-1 overflow-y-auto p-6">
        {draft ? (
          <div className={`${isChecklist ? 'max-w-2xl' : 'max-w-4xl'} space-y-4`}>
            <h2 className="text-ink font-bold text-lg">{publishedExisting ? `Edit — new version (current is v${selected?.version})` : isExisting && !isChecklist ? 'Edit draft' : isChecklist ? 'New checklist' : 'New document'}</h2>
            <div><label className={label}>Title</label><input className={input} value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} /></div>
            <div className={`grid ${isChecklist ? 'grid-cols-2' : 'grid-cols-3'} gap-3`}>
              {!isChecklist && <div><label className={label}>Document no.</label><input className={input} placeholder="BMS-QP-001" value={draft.docNumber} onChange={(e) => setDraft({ ...draft, docNumber: e.target.value })} /></div>}
              <div><label className={label}>Category</label>
                <select className={input} disabled={isChecklist} value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value as BmsCategory })}>
                  {(isChecklist ? [CHECKLIST] : BMS_CATEGORIES).map((c) => <option key={c}>{c}</option>)}
                </select></div>
              <div><label className={label}>{publishedExisting ? 'New version' : 'Version'}</label><input className={input} value={draft.version} onChange={(e) => setDraft({ ...draft, version: e.target.value })} /></div>
            </div>
            <div><label className={label}>Description</label><input className={input} value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} /></div>
            <div className={`grid ${isChecklist ? 'grid-cols-2' : 'grid-cols-3'} gap-3`}>
              <div><label className={label}>Author</label><input className={input} value={draft.author ?? ''} onChange={(e) => setDraft({ ...draft, author: e.target.value })} /></div>
              <div><label className={label}>Approved by</label><input className={input} value={draft.approvedBy ?? ''} onChange={(e) => setDraft({ ...draft, approvedBy: e.target.value })} /></div>
              {!isChecklist && <div><label className={label}>Review every (months)</label>
                <input type="number" min={1} max={60} className={input} value={draft.reviewIntervalMonths ?? DEFAULT_REVIEW_MONTHS}
                  onChange={(e) => setDraft({ ...draft, reviewIntervalMonths: Math.min(60, Math.max(1, Number(e.target.value) || DEFAULT_REVIEW_MONTHS)) })} /></div>}
            </div>
            {isChecklist ? (
              <div><label className={label}>Checklist items</label>
                <ChecklistEditor content={draft.content} onChange={(c) => setDraft({ ...draft, content: c })} /></div>
            ) : (
              <div><label className={label}>Document</label>
                <DocumentEditor blocks={draft.blocks ?? []} onChange={(blocks) => setDraft({ ...draft, blocks })} /></div>
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
            {publishedExisting && (
              <div>
                <label className={label}>What changed from v{selected?.version}? {isChecklist ? '(required)' : '(required to publish)'}</label>
                <textarea className={`${input} h-20`} placeholder={isChecklist ? 'e.g. Added first aid kit check' : 'e.g. Added section 6 – records retention; updated sign-off roles'} value={draft.changeNote ?? ''} onChange={(e) => setDraft({ ...draft, changeNote: e.target.value })} />
                {versionClash && <p className="text-xs text-red-400 mt-1">Version number must differ from the current version.</p>}
                <p className="text-xs text-slate-500 mt-1">{isChecklist ? `Saving archives v${selected?.version} and keeps it in the version history.` : `Publishing archives v${selected?.version} and keeps it in the version history. Save as a draft to keep working without rolling anything out.`}</p>
              </div>
            )}
            <div className="flex gap-2 pt-2 flex-wrap items-center">
              {isChecklist ? (
                <button onClick={save} disabled={!canSave} className="px-4 py-2 rounded-full bg-purple-600 hover:bg-purple-500 disabled:opacity-40 text-white text-sm font-semibold">{isExisting ? 'Save as new version' : 'Save'}</button>
              ) : (
                <>
                  <button onClick={saveDraftDoc} disabled={!canDraft} className="px-4 py-2 rounded-full bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-200 text-sm font-semibold">
                    {publishedExisting ? 'Save draft version' : 'Save draft'}
                  </button>
                  <button onClick={publishDoc} disabled={!canSave} className="px-4 py-2 rounded-full bg-purple-600 hover:bg-purple-500 disabled:opacity-40 text-white text-sm font-semibold">
                    {publishedExisting ? `Publish v${draft.version}` : 'Publish'}
                  </button>
                </>
              )}
              <button onClick={() => { setDraft(null); setSelectedId(selected?.id ?? null) }} className="px-4 py-2 rounded-lg bg-slate-800 text-slate-300 text-sm font-semibold">Cancel</button>
              {!isChecklist && <span className="text-xs text-slate-500">Publishing rolls the document out to every project and prompts the project managers.</span>}
            </div>
          </div>
        ) : selected ? (
          <div className={`${selected.blocks ? 'max-w-4xl' : 'max-w-2xl'} space-y-4`}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-ink font-bold text-xl">{selected.title}</h2>
                <p className="text-xs text-slate-500 mt-1">{selected.category !== CHECKLIST && `${selected.docNumber || 'No number'} · `}v{selected.version} · {selected.category} · Updated {new Date(selected.updatedAt).toLocaleDateString()}
                  {!isChecklist && selected.status !== 'draft' && selected.publishedBy && ` · Published by ${selected.publishedBy}`}
                  {!isChecklist && selected.status !== 'draft' && ` · Next review ${fmtDate(nextReviewDue(selected))}`}</p>
              </div>
              <div className="flex gap-2 flex-shrink-0">
                {!isChecklist && selected.status !== 'draft' && (
                  <button onClick={() => setReviewing(reviewing ? null : { comment: '' })} className="px-3 py-1.5 rounded-full bg-ink hover:bg-ink-soft text-white text-sm font-semibold">Review & update</button>
                )}
                <button onClick={startEdit} className="px-3 py-1.5 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-semibold">{!isChecklist && selected.status !== 'draft' ? 'Make changes' : 'Edit'}</button>
                {!isChecklist && <button onClick={duplicate} title="Create a new draft from this document" className="px-3 py-1.5 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-semibold">Duplicate</button>}
                <button onClick={remove} className="px-3 py-1.5 rounded-lg bg-red-900/40 hover:bg-red-900/60 text-red-300 text-sm font-semibold">Delete</button>
              </div>
            </div>
            {notice && (
              <div className="rounded-2xl bg-green-50 border border-green-100 px-4 py-3 text-sm text-green-700 flex items-center gap-3">
                <span className="flex-1">{notice}</span>
                <button onClick={() => setNotice('')} className="text-green-700/70 hover:text-green-700">✕</button>
              </div>
            )}
            {!isChecklist && selected.status !== 'draft' && ['overdue', 'due-soon'].includes(reviewState(selected)) && !reviewing && (
              <div className={`rounded-3xl border px-5 py-3 flex items-center gap-3 flex-wrap ${reviewState(selected) === 'overdue' ? 'bg-red-50 border-red-100' : 'bg-amber-50 border-amber-100'}`}>
                <p className={`text-sm flex-1 min-w-[220px] ${reviewState(selected) === 'overdue' ? 'text-red-600' : 'text-amber-700'}`}>
                  <span className="font-semibold">{reviewState(selected) === 'overdue' ? 'Review overdue' : 'Review due soon'}</span> — due {fmtDate(nextReviewDue(selected))}. Check the document is still right, and update it if not.
                </p>
                <button onClick={() => setReviewing({ comment: '' })} className="px-4 py-1.5 rounded-full bg-ink hover:bg-ink-soft text-white text-sm font-semibold">Review & update</button>
              </div>
            )}
            {reviewing && !isChecklist && (
              <div className="rounded-3xl bg-white border border-ink shadow-float px-5 py-4 space-y-3">
                <div>
                  <h3 className="text-sm font-bold text-ink">Review & update</h3>
                  <p className="text-xs text-slate-400">Read through v{selected.version} below. {selected.lastReviewedAt ? `Last reviewed ${fmtDate(new Date(selected.lastReviewedAt))} by ${selected.lastReviewedBy}.` : ''} Then record the outcome.</p>
                </div>
                <textarea rows={2} className={`${input} resize-none`} placeholder="Review notes — what you checked, or what needs to change" value={reviewing.comment}
                  onChange={(e) => setReviewing({ comment: e.target.value })} />
                <div className="flex gap-2 flex-wrap">
                  <button onClick={reviewNoChanges} className="px-4 py-2 rounded-full bg-ink hover:bg-ink-soft text-white text-sm font-semibold">No changes needed — mark as reviewed</button>
                  <button onClick={reviewStartUpdate} disabled={!reviewing.comment.trim()} className="px-4 py-2 rounded-full bg-coral hover:bg-coral-dark disabled:opacity-40 text-white text-sm font-semibold">Changes needed — start update</button>
                  <button onClick={() => setReviewing(null)} className="px-4 py-2 rounded-full bg-slate-800 text-slate-200 text-sm font-semibold">Cancel</button>
                </div>
                <p className="text-[11px] text-slate-500">Starting an update opens the editor with your notes as the change note. Nothing is rolled out until you publish.</p>
              </div>
            )}
            {!isChecklist && selected.status === 'draft' && (
              <div className="rounded-3xl bg-amber-50 border border-amber-100 px-5 py-4 flex items-center gap-4 flex-wrap">
                <div className="flex-1 min-w-[220px]">
                  <p className="text-sm font-semibold text-amber-700">Draft — not rolled out</p>
                  <p className="text-xs text-amber-700/80">Projects can’t see this document yet. Publish it to roll it out to every project.</p>
                </div>
                <button onClick={publishSaved} className="px-5 py-2 rounded-full bg-ink hover:bg-ink-soft text-white text-sm font-semibold transition-colors">Publish v{selected.version}</button>
              </div>
            )}
            {!isChecklist && selected.status !== 'draft' && selected.pending && (
              <div className="rounded-3xl bg-amber-50 border border-amber-100 px-5 py-4 space-y-2">
                <p className="text-sm font-semibold text-amber-700">Draft v{selected.pending.version} saved — not rolled out</p>
                <p className="text-xs text-amber-700/80">Saved by {selected.pending.savedBy} on {new Date(selected.pending.savedAt).toLocaleString()}. Projects are still on v{selected.version} until you publish.</p>
                {selected.pending.changeNote ? <p className="text-xs text-amber-700">What changed: {selected.pending.changeNote}</p> : <p className="text-xs text-amber-700">Add a change note (Edit draft) before publishing.</p>}
                <div className="flex gap-2 flex-wrap pt-1">
                  <button onClick={publishSaved} disabled={!selected.pending.changeNote.trim()} className="px-5 py-2 rounded-full bg-ink hover:bg-ink-soft disabled:opacity-40 text-white text-sm font-semibold transition-colors">Publish v{selected.pending.version}</button>
                  <button onClick={startEdit} className="px-4 py-2 rounded-full bg-white border border-amber-100 hover:bg-amber-100 text-amber-700 text-sm font-semibold">Edit draft</button>
                  <button onClick={discardPending} className="px-4 py-2 rounded-full bg-white border border-amber-100 hover:bg-amber-100 text-amber-700 text-sm font-semibold">Discard draft</button>
                </div>
              </div>
            )}
            {selected.description && <p className="text-sm text-slate-300">{selected.description}</p>}
            <div className="flex gap-6 text-sm">
              <p><span className="text-slate-500">Author: </span><span className="text-slate-200">{selected.author || '—'}</span></p>
              <p><span className="text-slate-500">Approved by: </span><span className="text-slate-200">{selected.approvedBy || '—'}</span></p>
            </div>
            {selected.category === CHECKLIST
              ? <ChecklistView content={selected.content} signature={selected.requiresSignature} />
              : selected.blocks
                ? <DocumentView title={selected.title} blocks={selected.blocks}
                    meta={[selected.docNumber, `v${selected.version}`, selected.category, selected.author && `Author: ${selected.author}`, selected.approvedBy && `Approved by: ${selected.approvedBy}`].filter(Boolean).join(' · ')} />
                : <pre className="whitespace-pre-wrap bg-slate-900 border border-slate-800 rounded-xl p-4 text-sm text-slate-200 font-mono">{selected.content || 'No template content.'}</pre>}
            {selected.file && (
              <a href={selected.file.dataUrl} download={selected.file.name} className="inline-block text-sm text-purple-300 hover:text-purple-200 underline">Download {selected.file.name}</a>
            )}
            <VersionHistory doc={selected} />
            {!isChecklist && selected.status !== 'draft' && (
              <section>
                <button onClick={() => setShowReviews((v) => !v)} className="text-sm font-bold text-ink">{showReviews ? '▾' : '▸'} Review history ({selected.reviews?.length ?? 0})</button>
                {showReviews && (
                  <div className="mt-2 rounded-2xl border border-slate-800 divide-y divide-slate-800 bg-white">
                    {(selected.reviews?.length ?? 0) === 0 && <p className="px-4 py-3 text-xs text-slate-500">No reviews recorded yet. Publishing a version also counts as a review.</p>}
                    {(selected.reviews ?? []).map((r) => (
                      <div key={r.id} className="px-4 py-3 text-xs">
                        <div className="flex items-baseline gap-2 flex-wrap">
                          <span className={`font-semibold ${r.outcome === 'no-changes' ? 'text-green-700' : 'text-coral-dark'}`}>{r.outcome === 'no-changes' ? 'Reviewed — no changes needed' : 'Reviewed — changes needed'}</span>
                          <span className="text-slate-500">v{r.version} · {r.by} · {new Date(r.at).toLocaleString()}</span>
                        </div>
                        {r.comment && <p className="text-slate-400 mt-0.5">{r.comment}</p>}
                      </div>
                    ))}
                  </div>
                )}
              </section>
            )}
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
