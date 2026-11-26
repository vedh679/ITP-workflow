import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useAppStore } from '../store'
import AppHeader from '../components/AppHeader'
import LibraryPicker from '../components/LibraryPicker'
import DocumentUpdate from '../components/DocumentUpdate'
import DocumentView from '../components/DocumentView'
import { CORE_CATEGORIES, REGISTER_REVIEW_MONTHS, changesSince, docStatus, fmtDate, isActive, isVersionOnly, nextReviewDate, pendingDocs, pluralCategory, registerReviewState, reviewsDueIn, seqLabel, versionsOf, type DocStatus } from '../projectDocs'
import { canAccessRegister, canApproveIssue, canManageProject } from '../access'
import SubmissionPanel from '../components/SubmissionPanel'
import type { BmsCategory, DocBlock, ProjectDocument } from '../types'

// A project's document register: the documents this project has created by pulling templates in
// from the BMS library. Each one is the project's own copy — with its own title and reference,
// holding what the team fills in — and remembers which template version it came from.
const STATUS_STYLE: Record<DocStatus, { label: string; chip: string }> = {
  current: { label: 'Up to date',       chip: 'bg-green-100 text-green-700' },
  update:  { label: 'Template updated', chip: 'bg-amber-100 text-amber-700' },
}

// The document laid out as a page. Headings and paragraphs are locked; the project team completes the fields.
function FillableDocument({ title, meta, blocks, savedValues, draft, saveLabel, canEdit, updatedLine, onSave, onSaveDraft, onDiscardDraft }: {
  title: string; meta: string; blocks: DocBlock[]; savedValues: Record<string, string>; draft?: { values: Record<string, string>; savedAt: string }
  saveLabel?: string
  canEdit: boolean; updatedLine?: string; onSave: (values: Record<string, string>) => void
  onSaveDraft: (values: Record<string, string>) => void; onDiscardDraft: () => void
}) {
  const [values, setValues] = useState<Record<string, string>>(canEdit && draft ? draft.values : savedValues)
  const dirty = JSON.stringify(values) !== JSON.stringify(savedValues)
  const draftSaved = !!draft && JSON.stringify(values) === JSON.stringify(draft.values)
  const hasFields = blocks.some((b) => b.type === 'field' || (b.type === 'table' && b.tableMode === 'fill'))
  return (
    <div className="space-y-3">
      <DocumentView title={title} meta={meta} blocks={blocks} values={values}
        onChange={canEdit ? (id, v) => setValues((cur) => ({ ...cur, [id]: v })) : undefined} />
      {hasFields && (
        <div className="flex items-center gap-3 flex-wrap">
          {canEdit ? (
            <>
              <button onClick={() => onSave(values)} disabled={!dirty}
                className="px-5 py-2 rounded-full bg-ink hover:bg-ink-soft disabled:opacity-40 text-white text-sm font-semibold transition-colors">{saveLabel}</button>
              <button onClick={() => onSaveDraft(values)} disabled={!dirty || draftSaved}
                className="px-5 py-2 rounded-full bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-200 text-sm font-semibold transition-colors">Save draft</button>
              {draft && <button onClick={onDiscardDraft} className="px-4 py-2 rounded-full text-red-600 hover:bg-red-50 text-sm font-semibold">Discard draft</button>}
              {draftSaved && dirty ? <span className="text-xs text-amber-700">Draft saved {new Date(draft!.savedAt).toLocaleString()} — not yet a new revision</span>
                : dirty ? <span className="text-xs text-amber-700">Unsaved changes</span> : null}
            </>
          ) : (
            <span className="text-xs text-slate-500">Read-only view — project details are completed on the version the document is on.</span>
          )}
          {updatedLine && !dirty && <span className="text-xs text-slate-500">{updatedLine}</span>}
        </div>
      )}
    </div>
  )
}

export default function DocumentsPage() {
  const { currentUser, currentProjectId, projects, bmsDocuments, projectDocuments,
    updateProjectDocument, submitProjectDocChange, approveProjectDocChange, returnProjectDocChange, saveProjectDocEditDraft, discardProjectDocEditDraft, saveProjectDocUpdateDraft, discardProjectDocUpdateDraft, reviewProjectDocument } = useAppStore()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [category, setCategory] = useState<BmsCategory | null>(null)   // null = the category tiles
  const [search, setSearch] = useState('')
  const [globalQuery, setGlobalQuery] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  const [showLatest, setShowLatest] = useState(false)
  const [showArchived, setShowArchived] = useState(false)
  const [picker, setPicker] = useState(false)
  const [notice, setNotice] = useState('')
  const [updating, setUpdating] = useState(false)                 // the guided update to a new template version
  const [viewingPast, setViewingPast] = useState<number | null>(null) // an earlier revision, read-only
  const [reviewing, setReviewing] = useState<{ comment: string } | null>(null)

  if (!currentUser) return <Navigate to="/" replace />   // signed out
  if (!canAccessRegister(currentUser)) return <Navigate to="/home" replace />   // IT doesn't use the document register

  const manager = canManageProject(currentUser)
  const projectId = currentProjectId ?? ''
  const project = projects.find((p) => p.id === projectId)
  const approver = canApproveIssue(currentUser, project)

  // This project's documents, each joined to the library template it came from
  const mine = projectDocuments.filter((d) => d.projectId === projectId)
  const join = (instance: ProjectDocument) => {
    const template = bmsDocuments.find((t) => t.id === instance.bmsDocumentId)
    // the name and number always come from the BMS template, never from the project
    return { instance, template, name: template?.title ?? 'Template no longer available', number: template?.docNumber ?? '', status: template ? docStatus(template, instance) : ('current' as DocStatus) }
  }
  const active = mine.filter(isActive).map(join)
  const archived = mine.filter((d) => !isActive(d)).map(join)
  const pending = pendingDocs(projectId, bmsDocuments, projectDocuments)
  const dueReviews = reviewsDueIn(projectId, projectDocuments, bmsDocuments).map(join)

  const awaiting = active.filter((j) => j.instance.submission)

  const matches = (j: ReturnType<typeof join>, q: string) =>
    `${j.name} ${j.number} ${j.template?.content ?? ''}`.toLowerCase().includes(q.toLowerCase())

  const rows = (showArchived ? archived : active)
    .filter((j) => j.template?.category === category)
    .filter((j) => matches(j, search))
    .sort((a, b) => Number(b.status !== 'current') - Number(a.status !== 'current') || a.name.localeCompare(b.name) || a.instance.sequence - b.instance.sequence)
  const results = globalQuery.trim() ? active.filter((j) => matches(j, globalQuery.trim())).slice(0, 8) : []

  const selected = rows.find((r) => r.instance.id === selectedId) ?? rows[0] ?? null
  const inst = selected?.instance
  const tpl = selected?.template
  const versionOnly = isVersionOnly(tpl)

  // Which version of the template the document is on, and the latest
  const allVersions = tpl ? versionsOf(tpl) : []
  const heldVersion = tpl && inst ? allVersions.find((v) => v.version === inst.adoptedVersion) : undefined
  const latestVersion = allVersions.slice(-1)[0]
  const shown = showLatest || !heldVersion ? latestVersion : heldVersion
  const changes = tpl && selected?.status === 'update' ? changesSince(tpl, inst?.adoptedVersion) : []
  const pastRevision = inst && viewingPast !== null ? inst.versions?.find((v) => v.revision === viewingPast) : undefined
  // a past revision shows the content, name and number it was issued with
  const pastVersion = pastRevision ? allVersions.find((v) => v.version === pastRevision.templateVersion) : undefined

  const canFill = manager || currentUser.projectIds.includes(projectId)
  const openResult = (j: ReturnType<typeof join>) => {
    setCategory(j.template?.category ?? null); setSelectedId(j.instance.id); setShowLatest(false); setSearch(''); setGlobalQuery(''); setSearchOpen(false)
  }

  // A completed change: issued straight away by someone with "Approve & issue", otherwise sent for approval
  const complete = (kind: 'edit' | 'update', toVersion: string, values: Record<string, string>, note = '') => {
    if (!inst || !selected) return
    submitProjectDocChange(inst.id, { kind, toVersion, values, note: note || undefined }, currentUser.name)
    if (!approver) { setNotice(`Submitted for approval. Revision ${inst.revision ?? 1} stays current until it is approved.`); return }
    approveProjectDocChange(inst.id, currentUser.name)
    const next = new Date(); next.setMonth(next.getMonth() + REGISTER_REVIEW_MONTHS)
    setNotice(`Approved and issued: "${selected.name}" is now revision ${(inst.revision ?? 1) + 1} on template v${toVersion}. Revision ${inst.revision ?? 1} is kept.${versionOnly ? '' : ` Next review due ${fmtDate(next)}.`}`)
  }

  if (!project) {
    return (
      <div className="flex flex-col h-full bg-white overflow-hidden">
        <AppHeader active="documents" />
        <p className="p-10 text-sm text-slate-500">Select a project to see its document register.</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full bg-white overflow-hidden">
      <AppHeader active="documents" />

      <div className={`pt-1 pb-3 flex items-center justify-between gap-4 flex-shrink-0 ${category === null ? 'px-[max(2.5rem,calc((100%-64rem)/2))]' : 'px-10 flex-wrap'}`}>
        <div className={`flex items-center gap-3 min-w-0 ${category === null ? 'flex-1' : 'flex-wrap'}`}>
          {category && (
            <button onClick={() => { setCategory(null); setSelectedId(null); setSearch(''); setShowArchived(false) }}
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-medium transition-colors">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
              All categories
            </button>
          )}
          <h1 className="text-2xl font-medium tracking-tight text-ink whitespace-nowrap flex-shrink-0">{category ? pluralCategory(category) : 'Document Register'}</h1>
          <p className="text-sm text-slate-400 truncate min-w-0">
            {category ? CORE_CATEGORIES.find((c) => c.key === category)?.blurb : 'Where the team keeps its up-to-date documents'}
            {' · '}<span className="text-slate-200 font-medium">{project.name}</span>
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {/* Search the register */}
          <div className="relative w-72 max-w-full">
            <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input value={globalQuery} onChange={(e) => { setGlobalQuery(e.target.value); setSearchOpen(true) }} onFocus={() => setSearchOpen(true)}
              onKeyDown={(e) => { if (e.key === 'Escape') setSearchOpen(false); if (e.key === 'Enter' && results[0]) openResult(results[0]) }}
              placeholder="Search the register…"
              className="w-full pl-11 pr-4 py-1.5 rounded-full bg-slate-800 text-sm text-ink placeholder-slate-500 focus:outline-none focus:bg-white focus:ring-1 focus:ring-ink" />
            {searchOpen && globalQuery.trim() && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setSearchOpen(false)} />
                <div className="absolute right-0 top-full mt-2 w-[26rem] max-w-[90vw] z-20 bg-white border border-slate-800 rounded-3xl shadow-float overflow-hidden">
                  {results.length === 0 ? <p className="px-5 py-4 text-sm text-slate-500">Nothing in the register matches "{globalQuery.trim()}".</p>
                    : results.map((j) => (
                      <button key={j.instance.id} onClick={() => openResult(j)}
                        className="w-full text-left px-5 py-3 hover:bg-slate-900 border-b border-slate-800 last:border-0 flex items-center gap-3 transition-colors">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-ink truncate">{j.name}</p>
                          <p className="text-xs text-slate-500 truncate">{j.number} · {seqLabel(j.instance.sequence)} · {j.template?.category} · template v{j.instance.adoptedVersion}</p>
                        </div>
                        <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap ${STATUS_STYLE[j.status].chip}`}>{STATUS_STYLE[j.status].label}</span>
                      </button>
                    ))}
                </div>
              </>
            )}
          </div>
          {manager && (
            <button onClick={() => setPicker(true)} className="px-4 py-1.5 rounded-full bg-ink hover:bg-ink-soft text-white text-sm font-semibold transition-colors whitespace-nowrap">+ Add from library</button>
          )}
        </div>
      </div>

      {notice && (
        <div className="mx-10 mb-4 rounded-2xl bg-green-50 border border-green-100 px-4 py-3 text-sm text-green-700 flex items-center gap-3 flex-shrink-0">
          <span className="flex-1">{notice}</span>
          <button onClick={() => setNotice('')} className="text-green-700/70 hover:text-green-700">✕</button>
        </div>
      )}

      {/* Prompts for the project manager: a template has moved on, or a document is due its 12-month review */}
      {(pending.length > 0 || dueReviews.length > 0 || (approver && awaiting.length > 0)) && (
        <div className="mx-10 mb-4 px-5 py-3 rounded-3xl bg-amber-50 border border-amber-100 flex items-center gap-4 flex-wrap flex-shrink-0">
          <div className="w-9 h-9 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center font-bold">!</div>
          <div className="flex-1 min-w-[220px] space-y-0.5">
            {approver && awaiting.length > 0 && (
              <p className="text-sm text-amber-700"><span className="font-semibold">{awaiting.length} awaiting your approval</span>: {awaiting.map((j) => `${j.name} (${seqLabel(j.instance.sequence)})`).join(', ')}.</p>
            )}
            {pending.length > 0 && (
              <p className="text-sm text-amber-700"><span className="font-semibold">{pending.length} document{pending.length === 1 ? '' : 's'} to update</span> — the BMS library has a newer template: {pending.map((p) => `${p.template.title} (${seqLabel(p.instance.sequence)})`).join(', ')}.</p>
            )}
            {dueReviews.length > 0 && (
              <p className="text-sm text-amber-700"><span className="font-semibold">{dueReviews.length} due for review</span> — 12 months since the last edit: {dueReviews.map((j) => `${j.name} (${seqLabel(j.instance.sequence)})`).join(', ')}.</p>
            )}
            {!manager && !approver && <p className="text-xs text-amber-700/80">The project manager has been prompted.</p>}
          </div>
          {(manager || approver) && (
            <button onClick={() => { const first = approver && awaiting[0] ? { c: awaiting[0].template?.category ?? null, id: awaiting[0].instance.id } : pending[0] ? { c: pending[0].template.category, id: pending[0].instance.id } : { c: dueReviews[0].template?.category ?? null, id: dueReviews[0].instance.id }
              setCategory(first.c); setSelectedId(first.id); setShowLatest(false); setUpdating(false); setViewingPast(null) }}
              className="px-4 py-2 rounded-full bg-ink hover:bg-ink-soft text-white text-sm font-semibold transition-colors">Review first</button>
          )}
        </div>
      )}

      {category === null ? (
        /* ── Category tiles ── */
        <div className="flex-1 overflow-y-auto px-10 pb-10">
        <div className="max-w-5xl mx-auto">
          {active.length === 0 && (
            <div className="mb-5 rounded-3xl border border-dashed border-slate-600 bg-slate-900 px-6 py-8 text-center">
              <p className="text-sm font-semibold text-ink">Your register is empty</p>
              <p className="text-sm text-slate-400 mt-1">{manager ? 'Pull a template in from the BMS library to create your first project document.' : 'The project manager adds documents here from the BMS library.'}</p>
              {manager && <button onClick={() => setPicker(true)} className="mt-4 px-5 py-2.5 rounded-full bg-ink hover:bg-ink-soft text-white text-sm font-semibold">+ Add from library</button>}
            </div>
          )}
          <div className="grid gap-5 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
            {CORE_CATEGORIES.map(({ key, blurb }) => {
              const inCat = active.filter((j) => j.template?.category === key)
              const behind = pending.filter((p) => p.template.category === key).length
              return (
                <button key={key} onClick={() => { setCategory(key); setSelectedId(null); setSearch('') }}
                  className="group text-left bg-slate-900 hover:bg-white border border-slate-800 hover:border-slate-600 hover:shadow-float rounded-3xl p-6 transition-all flex flex-col gap-5">
                  <div className="flex items-start justify-between">
                    <div className="w-12 h-12 rounded-full bg-ink text-white flex items-center justify-center">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.7} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                    </div>
                    {behind > 0 && <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-coral text-white whitespace-nowrap">{behind} to update</span>}
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-ink">{pluralCategory(key)}</h3>
                    <p className="text-slate-400 text-sm mt-0.5">{blurb}</p>
                  </div>
                  <div className="flex items-end justify-between">
                    <div className="flex items-baseline gap-2">
                      <span className="text-4xl font-bold tracking-tight text-ink">{inCat.length}</span>
                      <span className="text-sm text-slate-500">document{inCat.length === 1 ? '' : 's'}</span>
                    </div>
                    <span className="text-slate-500 group-hover:text-ink group-hover:translate-x-1 transition-all text-xl">→</span>
                  </div>
                </button>
              )
            })}
          </div>
        </div>
        </div>
      ) : (
        <div className="flex flex-1 overflow-hidden border-t border-slate-800">
          {/* Document list */}
          <aside className="w-80 border-r border-slate-800 bg-slate-900 flex flex-col flex-shrink-0">
            <div className="p-3 space-y-2 border-b border-slate-800">
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search documents…"
                className="w-full bg-white border border-slate-700 rounded-full px-4 py-2 text-sm text-ink placeholder-slate-500 focus:outline-none focus:border-ink" />
              {archived.some((j) => j.template?.category === category) && (
                <button onClick={() => setShowArchived((v) => !v)} className="text-xs font-semibold text-slate-400 hover:text-ink">{showArchived ? '← Back to active documents' : `Show archived (${archived.filter((j) => j.template?.category === category).length})`}</button>
              )}
            </div>
            <div className="flex-1 overflow-y-auto">
              {rows.length === 0 && (
                <div className="p-4 text-sm text-slate-500">
                  <p>{showArchived ? 'No archived documents.' : `No ${category.toLowerCase()} documents in the register yet.`}</p>
                  {manager && !showArchived && <button onClick={() => setPicker(true)} className="mt-2 text-ink font-semibold hover:underline">+ Add from library</button>}
                </div>
              )}
              {rows.map((j) => (
                <button key={j.instance.id} onClick={() => { setSelectedId(j.instance.id); setShowLatest(false); setNotice(''); setUpdating(false); setViewingPast(null); setReviewing(null) }}
                  className={`w-full text-left px-4 py-3 border-b border-slate-800 hover:bg-white transition-colors ${inst?.id === j.instance.id ? 'bg-white' : ''}`}>
                  <p className="text-sm font-semibold text-ink truncate">{j.name}</p>
                  <p className="text-xs text-slate-500 mt-0.5"><span className="font-mono">{j.number}</span> · {seqLabel(j.instance.sequence)}</p>
                  <div className="flex items-center gap-2 mt-1.5">
                    <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${STATUS_STYLE[j.status].chip}`}>{STATUS_STYLE[j.status].label}</span>
                    <span className="text-xs text-slate-500">{j.status === 'update' ? `v${j.instance.adoptedVersion} → v${j.template?.version}` : `template v${j.instance.adoptedVersion}`}</span>
                    {j.instance.submission && <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">Awaiting approval</span>}
                    {j.instance.returned && !j.instance.submission && <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-red-100 text-red-600">Returned</span>}
                    {!isVersionOnly(j.template) && registerReviewState(j.instance) !== 'ok' && (
                      <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${registerReviewState(j.instance) === 'overdue' ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-700'}`}>{registerReviewState(j.instance) === 'overdue' ? 'Review overdue' : 'Review due'}</span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </aside>

          {/* Detail */}
          <main className="flex-1 overflow-y-auto p-8">
            {updating && selected && inst && tpl ? (
              <DocumentUpdate key={`${inst.id}-${tpl.version}`} name={selected.name} number={selected.number} instance={inst} template={tpl} canWork={manager} canApprove={approver} reference={versionOnly}
                onCancel={() => setUpdating(false)}
                onSaveDraft={(vals) => { saveProjectDocUpdateDraft(inst.id, tpl.version, vals, currentUser.name); setNotice('Draft saved. You can carry on with the update later.') }}
                onDiscardDraft={() => { discardProjectDocUpdateDraft(inst.id); setNotice('Draft discarded.') }}
                onApply={(vals, note) => { complete('update', tpl.version, vals, note); setUpdating(false); setShowLatest(false) }} />
            ) : selected && inst && shown ? (
              <div className={`${shown.blocks ? 'max-w-4xl' : 'max-w-2xl'} space-y-5`}>
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="min-w-0">
                    <h2 className="text-2xl font-bold text-ink">{selected.name}</h2>
                    <p className="text-xs text-slate-500 mt-1"><span className="font-mono">{selected.number}</span> · {seqLabel(inst.sequence)} · {tpl?.category}</p>
                    <p className="text-xs text-slate-400 mt-1.5">
                      Name and number come from the BMS library and can't be changed here · <span className="font-semibold text-slate-300">Revision {inst.revision ?? 1}</span> on template v{inst.adoptedVersion}
                      {inst.createdAt && ` · added ${new Date(inst.createdAt).toLocaleDateString()} by ${inst.adoptedBy}`}
                    </p>
                    {versionOnly ? <p className="text-xs text-slate-400 mt-1">Version reference: use this version of the form. There is nothing to fill in here and no project review.</p> : <p className="text-xs text-slate-400 mt-1 flex items-center gap-2 flex-wrap">
                      {inst.lastReviewedAt && `Last reviewed ${fmtDate(new Date(inst.lastReviewedAt))} by ${inst.lastReviewedBy} · `}Last edited {fmtDate(new Date(inst.lastEditedAt ?? inst.adoptedAt))} · next review due <span className="font-semibold text-slate-300">{fmtDate(nextReviewDate(inst))}</span>
                      {registerReviewState(inst) !== 'ok' && <span className={`font-semibold px-2 py-0.5 rounded-full ${registerReviewState(inst) === 'overdue' ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-700'}`}>{registerReviewState(inst) === 'overdue' ? 'Review overdue' : 'Review due soon'}</span>}
                      {manager && isActive(inst) && !reviewing && <button onClick={() => setReviewing({ comment: '' })} className="font-semibold text-coral-dark hover:underline">Review now</button>}
                    </p>}
                  </div>
                  {manager && (
                    <div className="flex gap-2">
                      {isActive(inst)
                        ? <>
                            <button onClick={() => { if (window.confirm(`Archive "${selected.name}" (${seqLabel(inst.sequence)})? It leaves the active register but is kept, and can be restored.`)) { updateProjectDocument(inst.id, { status: 'archived' }); setNotice(`"${selected.name}" archived.`) } }}
                              className="px-4 py-1.5 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-semibold">Archive</button>
                          </>
                        : <button onClick={() => {
                              if (versionOnly && active.some((j) => j.instance.bmsDocumentId === inst.bmsDocumentId)) { window.alert('This form is already in the register.'); return }
                              updateProjectDocument(inst.id, { status: 'active' }); setShowArchived(false); setNotice(`"${selected.name}" restored.`) }}
                            className="px-4 py-1.5 rounded-full bg-ink text-white text-sm font-semibold">Restore</button>}
                    </div>
                  )}
                </div>

                {inst.issue && <p className="text-xs text-slate-400 -mt-3">Revision {inst.revision} prepared by <span className="font-semibold text-slate-300">{inst.issue.preparedBy}</span> · approved by <span className="font-semibold text-slate-300">{inst.issue.approvedBy}</span> on {fmtDate(new Date(inst.issue.approvedAt))}</p>}

                {inst.submission && isActive(inst) && (
                  <SubmissionPanel key={inst.submission.at} instance={inst} submission={inst.submission} template={tpl} title={selected.name} canApprove={approver}
                    canWithdraw={manager || inst.submission.by === currentUser.name}
                    onApprove={() => { approveProjectDocChange(inst.id, currentUser.name); setNotice(`Approved and issued as revision ${(inst.revision ?? 1) + 1}. Revision ${inst.revision ?? 1} is kept.`) }}
                    onReturn={(comment) => { returnProjectDocChange(inst.id, comment, currentUser.name); setNotice('Returned. The work is kept as a draft.') }}
                    onWithdraw={() => { returnProjectDocChange(inst.id, '', currentUser.name); setNotice('Withdrawn. The work is kept as a draft.') }} />
                )}
                {inst.returned && !inst.submission && (
                  <p className="rounded-2xl bg-red-50 border border-red-100 px-4 py-3 text-sm text-red-600">
                    {inst.returned.comment ? <>Returned by {inst.returned.by}: <span className="font-semibold">{inst.returned.comment}</span></> : <>Withdrawn by {inst.returned.by}.</>} The work is kept as a draft; revision {inst.revision ?? 1} stays current.
                  </p>
                )}

                {reviewing && manager && !versionOnly && isActive(inst) && (
                  <div className="rounded-3xl bg-white border border-ink shadow-float px-5 py-4 space-y-3">
                    <div>
                      <h3 className="text-sm font-bold text-ink">Review {selected.name} ({seqLabel(inst.sequence)})</h3>
                      <p className="text-xs text-slate-400">Read through the document below. If it's still right, confirm the review. The revision number stays the same and the next review moves 12 months on. If something needs changing, edit it and save instead.</p>
                    </div>
                    <textarea rows={2} value={reviewing.comment} onChange={(e) => setReviewing({ comment: e.target.value })} placeholder="Review notes — what you checked (optional)"
                      className="w-full bg-white border border-slate-700 rounded-2xl px-3 py-2 text-sm text-ink placeholder-slate-500 focus:outline-none focus:border-ink resize-none" />
                    <div className="flex gap-2 flex-wrap">
                      <button onClick={() => { reviewProjectDocument(inst.id, reviewing.comment, currentUser.name); const next = new Date(); next.setMonth(next.getMonth() + REGISTER_REVIEW_MONTHS); setReviewing(null); setNotice(`Review recorded — no changes, so this stays revision ${inst.revision ?? 1}. Next review due ${fmtDate(next)}.`) }}
                        className="px-4 py-2 rounded-full bg-ink hover:bg-ink-soft text-white text-sm font-semibold">No changes needed — confirm reviewed</button>
                      <button onClick={() => setReviewing(null)} className="px-4 py-2 rounded-full bg-slate-800 text-slate-200 text-sm font-semibold">Close</button>
                    </div>
                  </div>
                )}

                {!tpl && <p className="rounded-2xl bg-red-50 border border-red-100 px-4 py-3 text-sm text-red-600">The library template this document was created from is no longer available.</p>}

                {/* The template has a newer version */}
                {tpl && selected.status === 'update' && isActive(inst) && !inst.submission && (
                  <div className="rounded-3xl bg-amber-50 border border-amber-100 px-5 py-4 space-y-3">
                    <div>
                      <p className="text-sm font-semibold text-amber-700">The template has been updated — this document is on v{inst.adoptedVersion}, the library is on v{tpl.version}</p>
                      <p className="text-xs text-amber-700/80 mt-0.5">What changed in the BMS library:</p>
                    </div>
                    <ul className="space-y-1.5">
                      {changes.map((c) => (
                        <li key={c.version} className="text-sm text-amber-700">
                          <span className="font-semibold">v{c.version}</span>
                          <span className="text-amber-700/70"> · {new Date(c.createdAt).toLocaleDateString()} — </span>
                          {c.changeNote || 'No change note recorded.'}
                        </li>
                      ))}
                    </ul>
                    {manager ? (
                      <div className="flex items-center gap-3 flex-wrap">
                        <button onClick={() => { setUpdating(true); setViewingPast(null); setReviewing(null) }}
                          className="px-5 py-2 rounded-full bg-ink hover:bg-ink-soft text-white text-sm font-semibold transition-colors">{versionOnly ? `Review & adopt v${tpl.version}` : inst.updateDraft ? 'Continue the update' : 'Review & update'}</button>
                        <span className="text-xs text-amber-700/80">{versionOnly
                          ? `You'll see what changed in the form, then ${approver ? 'approve and issue it' : 'submit it for approval'}.`
                          : `You'll see your existing entries and everything new from the template side by side, check it, edit it, then ${approver ? 'approve and issue it' : 'submit it for approval'}.`}
                          {!versionOnly && inst.updateDraft && (inst.updateDraft.toVersion === tpl.version ? ' A draft is saved.' : ` Your draft for v${inst.updateDraft.toVersion} will be carried forward.`)}</span>
                      </div>
                    ) : <p className="text-xs text-amber-700/80">Waiting for the project manager to update.</p>}
                  </div>
                )}

                {pastRevision ? (
                  <>
                    <div className="rounded-2xl bg-slate-900 border border-slate-700 px-4 py-3 flex items-center gap-3 flex-wrap">
                      <p className="text-sm text-slate-300 flex-1">Viewing <span className="font-semibold text-ink">revision {pastRevision.revision}</span> (template v{pastRevision.templateVersion}) — kept exactly as it was until {new Date(pastRevision.endedAt).toLocaleDateString()}. Read-only.</p>
                      <button onClick={() => setViewingPast(null)} className="px-4 py-1.5 rounded-full bg-ink text-white text-sm font-semibold">Back to the current revision</button>
                    </div>
                    {pastVersion?.blocks
                      ? <FillableDocument key={`past-${pastRevision.revision}`} title={pastVersion.title}
                          meta={[pastVersion.docNumber, seqLabel(inst.sequence), `revision ${pastRevision.revision}`, `template v${pastRevision.templateVersion}`].join(' · ')}
                          blocks={pastVersion.blocks} savedValues={pastRevision.fieldValues} canEdit={false} onSave={() => {}} onSaveDraft={() => {}} onDiscardDraft={() => {}} />
                      : <p className="text-sm text-slate-500">This revision's layout is no longer available.</p>}
                  </>
                ) : (
                  <>
                {/* Version being viewed */}
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-ink">Template version {shown.version}</span>
                  {selected.status === 'update' && heldVersion && (
                    <div className="flex gap-1 bg-slate-800 rounded-full p-1 ml-2">
                      <button onClick={() => setShowLatest(false)} className={`px-3 py-1 rounded-full text-xs font-medium ${!showLatest ? 'bg-ink text-white' : 'text-slate-300'}`}>This document's v{heldVersion.version}</button>
                      <button onClick={() => setShowLatest(true)} className={`px-3 py-1 rounded-full text-xs font-medium ${showLatest ? 'bg-ink text-white' : 'text-slate-300'}`}>Latest v{tpl?.version}</button>
                    </div>
                  )}
                </div>

                {shown.blocks && versionOnly ? (
                  <DocumentView title={selected.name} meta={[selected.number, `version ${shown.version}`, tpl?.category].filter(Boolean).join(' · ')} blocks={shown.blocks} />
                ) : shown.blocks ? (
                  <FillableDocument key={`${inst.id}-${shown.version}-${inst.fieldsUpdatedAt ?? ''}-${inst.editDraft?.savedAt ? 'd' : 'n'}`}
                    title={selected.name}
                    meta={[selected.number, seqLabel(inst.sequence), `template v${shown.version}`, tpl?.category].filter(Boolean).join(' · ')}
                    blocks={shown.blocks}
                    savedValues={inst.fieldValues ?? {}}
                    draft={inst.editDraft}
                    onSaveDraft={(vals) => { saveProjectDocEditDraft(inst.id, vals, currentUser.name); setNotice(`Draft saved. Revision ${inst.revision ?? 1} stays current until the change is ${approver ? 'approved and issued' : 'submitted and approved'}.`) }}
                    onDiscardDraft={() => discardProjectDocEditDraft(inst.id)}
                    canEdit={isActive(inst) && canFill && !inst.submission && shown.version === inst.adoptedVersion}
                    saveLabel={approver ? 'Approve & issue' : 'Submit for approval'}
                    updatedLine={inst.fieldsUpdatedAt ? `Last updated by ${inst.fieldsUpdatedBy} on ${new Date(inst.fieldsUpdatedAt).toLocaleString()}` : undefined}
                    onSave={(vals) => { if (JSON.stringify(inst.fieldValues ?? {}) === JSON.stringify(vals)) { setNotice('No changes to issue.'); return } complete('edit', inst.adoptedVersion, vals) }} />
                ) : (
                  <pre className="whitespace-pre-wrap bg-slate-900 border border-slate-800 rounded-3xl p-5 text-sm text-slate-200 font-mono">{shown.content || 'No content.'}</pre>
                )}
                {shown.file && <a href={shown.file.dataUrl} download={shown.file.name} className="inline-block text-sm text-coral-dark hover:underline">Download {shown.file.name}</a>}
                  </>
                )}

                {/* Revisions */}
                {(inst.versions?.length ?? 0) > 0 && (
                  <div>
                    <h3 className="text-sm font-bold text-ink mb-2">Revisions</h3>
                    <div className="rounded-3xl border border-slate-800 divide-y divide-slate-800 overflow-hidden">
                      <div className="px-4 py-2.5 text-sm flex items-center gap-3 flex-wrap bg-slate-900">
                        <span className="font-semibold text-ink">Revision {inst.revision ?? 1}</span><span className="text-slate-300">template v{inst.adoptedVersion}</span>
                        <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-green-100 text-green-700">Current</span>
                        <span className="text-slate-400 text-xs">since {new Date(inst.adoptedAt).toLocaleDateString()}</span>
                      </div>
                      {[...(inst.versions ?? [])].reverse().map((v) => (
                        <div key={v.revision} className="px-4 py-2.5 text-sm flex items-center gap-3 flex-wrap">
                          <span className="font-semibold text-ink">Revision {v.revision}</span><span className="text-slate-300">template v{v.templateVersion}</span>
                          <span className="text-slate-400 text-xs">{new Date(v.startedAt).toLocaleDateString()} – {new Date(v.endedAt).toLocaleDateString()} · replaced by {v.endedBy}{v.note ? ` — ${v.note}` : ''}{v.issue ? ` · was approved by ${v.issue.approvedBy}` : ''}</span>
                          <button onClick={() => { setViewingPast(v.revision); setReviewing(null) }} className="ml-auto text-xs font-semibold text-coral-dark hover:underline">View</button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* History */}
                <div>
                  <h3 className="text-sm font-bold text-ink mb-2">History</h3>
                  <div className="rounded-3xl border border-slate-800 divide-y divide-slate-800 overflow-hidden">
                    {[...inst.history].reverse().map((h, i) => (
                      <div key={i} className="px-4 py-2.5 text-sm flex items-center gap-3 flex-wrap">
                        <span className="font-semibold text-ink">template v{h.version}</span>
                        {h.note && <span className="text-slate-300">{h.note}</span>}
                        <span className="text-slate-400">{h.by} · {new Date(h.at).toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-slate-500 text-sm">Select a document, or add one from the library.</p>
            )}
          </main>
        </div>
      )}

      {picker && (
        <LibraryPicker projectId={projectId} onClose={() => setPicker(false)}
          onCreated={(id) => {
            const created = useAppStore.getState().projectDocuments.find((d) => d.id === id)
            const t = useAppStore.getState().bmsDocuments.find((b) => b.id === created?.bmsDocumentId)
            setPicker(false); setCategory(t?.category ?? null); setSelectedId(id); setShowLatest(false); setShowArchived(false)
            setNotice(`Added "${t?.title}" (${seqLabel(created?.sequence ?? 1)}) to the register.${isVersionOnly(t) ? ' The team can now see which version to use.' : ' Fill in the project fields below.'}`)
          }} />
      )}
    </div>
  )
}
