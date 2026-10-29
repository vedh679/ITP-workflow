import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useAppStore } from '../store'
import AppHeader from '../components/AppHeader'
import { CORE_CATEGORIES, publishedDocs, pluralCategory, changesSince, docStatus, pendingDocs, recordFor, versionsOf, type DocStatus } from '../projectDocs'
import { isManager } from '../workflow'
import { isCentral } from '../access'
import DocumentView from '../components/DocumentView'
import type { BmsCategory, BmsDocument, DocBlock } from '../types'

// The core documents (policies, procedures, forms …) a project works to. Each project
// holds one version of each; when the admin publishes a newer version the project
// manager is prompted to bring the project up to date.
const STATUS_STYLE: Record<DocStatus, { label: string; chip: string }> = {
  current: { label: 'Up to date',       chip: 'bg-green-100 text-green-700' },
  update:  { label: 'Update available', chip: 'bg-amber-100 text-amber-700' },
  new:     { label: 'New document',     chip: 'bg-amber-100 text-amber-700' },
}

// The document laid out as a page. Headings and paragraphs are locked; the project team completes the fields.
function FillableDocument({ title, meta, blocks, savedValues, canEdit, updatedLine, onSave }: {
  title: string; meta: string; blocks: DocBlock[]; savedValues: Record<string, string>
  canEdit: boolean; updatedLine?: string; onSave: (values: Record<string, string>) => void
}) {
  const [values, setValues] = useState<Record<string, string>>(savedValues)
  const dirty = JSON.stringify(values) !== JSON.stringify(savedValues)
  const hasFields = blocks.some((b) => b.type === 'field')
  return (
    <div className="space-y-3">
      <DocumentView title={title} meta={meta} blocks={blocks} values={values}
        onChange={canEdit ? (id, v) => setValues((cur) => ({ ...cur, [id]: v })) : undefined} />
      {hasFields && (
        <div className="flex items-center gap-3 flex-wrap">
          {canEdit ? (
            <>
              <button onClick={() => onSave(values)} disabled={!dirty}
                className="px-5 py-2 rounded-full bg-ink hover:bg-ink-soft disabled:opacity-40 text-white text-sm font-semibold transition-colors">Save project details</button>
              {dirty && <span className="text-xs text-amber-700">Unsaved changes</span>}
            </>
          ) : (
            <span className="text-xs text-slate-500">Read-only view — project details can be completed on the version the project holds.</span>
          )}
          {updatedLine && !dirty && <span className="text-xs text-slate-500">{updatedLine}</span>}
        </div>
      )}
    </div>
  )
}

export default function DocumentsPage() {
  const navigate = useNavigate()
  const { currentUser, currentProjectId, projects, bmsDocuments: allBmsDocuments, projectDocuments, adoptProjectDocument, saveProjectDocumentFields } = useAppStore()
  const [adminProjectId, setAdminProjectId] = useState(projects[0]?.id ?? '')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [category, setCategory] = useState<BmsCategory | null>(null)   // null = the category tiles
  const [showLatest, setShowLatest] = useState(false)
  const [search, setSearch] = useState('')            // filters the list inside a category
  const [globalQuery, setGlobalQuery] = useState('')  // searches every core document
  const [searchOpen, setSearchOpen] = useState(false)

  if (!currentUser) return <Navigate to="/" replace />   // signed out
  const bmsDocuments = publishedDocs(allBmsDocuments)   // drafts are only visible to the BMS team

  const manager = isManager(currentUser)
  const isAdmin = isCentral(currentUser)   // IT works across all projects
  const projectId = isAdmin ? adminProjectId : (currentProjectId ?? '')
  const project = projects.find((p) => p.id === projectId)

  const rows = bmsDocuments
    .filter((d) => d.category === category)
    .filter((d) => `${d.title} ${d.docNumber}`.toLowerCase().includes(search.toLowerCase()))
    .map((doc) => {
      const record = recordFor(projectDocuments, projectId, doc.id)
      return { doc, record, status: docStatus(doc, record) }
    })
    // documents needing attention first
    .sort((a, b) => Number(b.status !== 'current') - Number(a.status !== 'current'))

  const results = globalQuery.trim()
    ? bmsDocuments.filter((d) => `${d.title} ${d.docNumber} ${d.category} ${d.description} ${d.author ?? ''} ${d.content}`.toLowerCase().includes(globalQuery.trim().toLowerCase())).slice(0, 8)
    : []
  const openResult = (d: BmsDocument) => {
    setCategory(d.category); setSelectedId(d.id); setShowLatest(false); setSearch('')
    setGlobalQuery(''); setSearchOpen(false)
  }

  // Anyone on the project team (and managers / admins) can complete the project-specific fields
  const canFill = isAdmin || manager || currentUser.projectIds.includes(projectId)

  const pending = pendingDocs(projectId, bmsDocuments, projectDocuments)
  const selected = rows.find((r) => r.doc.id === selectedId) ?? rows[0] ?? null

  const update = (doc: BmsDocument) => {
    adoptProjectDocument(projectId, doc.id, doc.version, currentUser.name)
    setShowLatest(false)
  }

  const heldVersion = selected?.record ? versionsOf(selected.doc).find((v) => v.version === selected.record!.adoptedVersion) : undefined
  const latestVersion = selected ? versionsOf(selected.doc).slice(-1)[0] : undefined
  const shown = selected ? (showLatest || !heldVersion ? latestVersion : heldVersion) : undefined
  const changes = selected && selected.status !== 'current' ? changesSince(selected.doc, selected.record?.adoptedVersion) : []

  return (
    <div className="flex flex-col h-full bg-white overflow-hidden">
      <AppHeader active="documents" />

      <div className="px-10 pt-6 pb-4 flex items-end justify-between gap-4 flex-wrap flex-shrink-0">
        <div>
          {category && (
            <button onClick={() => { setCategory(null); setSelectedId(null); setSearch('') }}
              className="mb-3 inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-medium transition-colors">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
              All categories
            </button>
          )}
          <h1 className="text-4xl font-normal tracking-tight text-ink">{category ? pluralCategory(category) : 'Document Register'}</h1>
          <p className="text-slate-400 mt-1">
            {category ? CORE_CATEGORIES.find((c) => c.key === category)?.blurb : 'Where the team keeps its up-to-date documents'}
            {project ? <> · <span className="text-slate-200 font-medium">{project.name}</span></> : ''}
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {/* Search every core document */}
          <div className="relative w-80 max-w-full">
            <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input value={globalQuery}
              onChange={(e) => { setGlobalQuery(e.target.value); setSearchOpen(true) }}
              onFocus={() => setSearchOpen(true)}
              onKeyDown={(e) => { if (e.key === 'Escape') setSearchOpen(false); if (e.key === 'Enter' && results[0]) openResult(results[0]) }}
              placeholder="Search the register…"
              className="w-full pl-11 pr-4 py-2.5 rounded-full bg-slate-800 text-sm text-ink placeholder-slate-500 focus:outline-none focus:bg-white focus:ring-1 focus:ring-ink" />
            {searchOpen && globalQuery.trim() && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setSearchOpen(false)} />
                <div className="absolute right-0 top-full mt-2 w-[26rem] max-w-[90vw] z-20 bg-white border border-slate-800 rounded-3xl shadow-float overflow-hidden">
                  {results.length === 0 ? (
                    <p className="px-5 py-4 text-sm text-slate-500">No documents match "{globalQuery.trim()}".</p>
                  ) : results.map((d) => {
                    const st = docStatus(d, recordFor(projectDocuments, projectId, d.id))
                    return (
                      <button key={d.id} onClick={() => openResult(d)}
                        className="w-full text-left px-5 py-3 hover:bg-slate-900 border-b border-slate-800 last:border-0 flex items-center gap-3 transition-colors">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-ink truncate">{d.title}</p>
                          <p className="text-xs text-slate-500 truncate">{d.docNumber || 'No number'} · {d.category} · v{d.version}</p>
                        </div>
                        <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap ${STATUS_STYLE[st].chip}`}>{STATUS_STYLE[st].label}</span>
                      </button>
                    )
                  })}
                </div>
              </>
            )}
          </div>

          {isAdmin && (
            <select value={projectId} onChange={(e) => { setAdminProjectId(e.target.value); setSelectedId(null) }}
              className="px-4 py-2.5 rounded-full bg-slate-800 text-sm font-medium text-slate-200 focus:outline-none">
              {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          )}
        </div>
      </div>

      {/* Prompt for the project manager */}
      {pending.length > 0 && (
        <div className="mx-10 mb-4 px-5 py-3 rounded-3xl bg-amber-50 border border-amber-100 flex items-center gap-4 flex-wrap flex-shrink-0">
          <div className="w-9 h-9 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center font-bold">!</div>
          <div className="flex-1 min-w-[220px]">
            <p className="text-sm font-semibold text-amber-700">
              {manager ? 'Your register is out of date' : 'The register is out of date'}
            </p>
            <p className="text-xs text-amber-700/80">
              {pending.length} document{pending.length === 1 ? ' has' : 's have'} a newer version in the BMS core library or {pending.length === 1 ? 'is' : 'are'} not yet in the register:{' '}
              {pending.map((p) => p.doc.title).join(', ')}.
              {manager ? ' Review each one and update the register to the latest version.' : ' The project manager has been prompted to update.'}
            </p>
          </div>
          {manager && (
            <button onClick={() => { setCategory(pending[0].doc.category); setSelectedId(pending[0].doc.id); setShowLatest(true) }}
              className="px-4 py-2 rounded-full bg-ink hover:bg-ink-soft text-white text-sm font-semibold transition-colors">
              Review first
            </button>
          )}
        </div>
      )}

      {category === null ? (
        /* ── Category tiles ── */
        <div className="flex-1 overflow-y-auto px-10 pb-10">
          <div className="grid gap-5 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
            {CORE_CATEGORIES.map(({ key, blurb }) => {
              const inCat = bmsDocuments.filter((d) => d.category === key)
              const behind = pending.filter((p) => p.doc.category === key).length
              return (
                <button key={key} onClick={() => { setCategory(key); setSelectedId(null); setSearch('') }}
                  className="group text-left bg-slate-900 hover:bg-white border border-slate-800 hover:border-slate-600 hover:shadow-float rounded-3xl p-6 transition-all flex flex-col gap-5">
                  <div className="flex items-start justify-between">
                    <div className="w-12 h-12 rounded-full bg-ink text-white flex items-center justify-center">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.7} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                    </div>
                    {behind > 0 && (
                      <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-coral text-white whitespace-nowrap">{behind} to update</span>
                    )}
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
      ) : (
      <div className="flex flex-1 overflow-hidden border-t border-slate-800">
        {/* Document list */}
        <aside className="w-80 border-r border-slate-800 bg-slate-900 flex flex-col flex-shrink-0">
          <div className="p-3 border-b border-slate-800">
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search documents…"
              className="w-full bg-white border border-slate-700 rounded-full px-4 py-2 text-sm text-ink placeholder-slate-500 focus:outline-none focus:border-ink" />
          </div>
          <div className="flex-1 overflow-y-auto">
            {rows.length === 0 && <p className="p-4 text-sm text-slate-500">No {category?.toLowerCase()} documents{search ? ' match your search' : ' have been published yet'}.</p>}
            {rows.map(({ doc, record, status }) => (
              <button key={doc.id} onClick={() => { setSelectedId(doc.id); setShowLatest(false) }}
                className={`w-full text-left px-4 py-3 border-b border-slate-800 hover:bg-white transition-colors ${selected?.doc.id === doc.id ? 'bg-white' : ''}`}>
                <p className="text-sm font-semibold text-ink truncate">{doc.title}</p>
                <p className="text-xs text-slate-500 mt-0.5">{doc.docNumber || 'No number'} · {doc.category}</p>
                <div className="flex items-center gap-2 mt-1.5">
                  <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${STATUS_STYLE[status].chip}`}>{STATUS_STYLE[status].label}</span>
                  <span className="text-xs text-slate-500">
                    {status === 'update' ? `v${record!.adoptedVersion} → v${doc.version}` : status === 'new' ? `v${doc.version}` : `v${doc.version}`}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </aside>

        {/* Detail */}
        <main className="flex-1 overflow-y-auto p-8">
          {selected && shown ? (
            <div className={`${shown.blocks ? 'max-w-4xl' : 'max-w-2xl'} space-y-5`}>
              <div>
                <h2 className="text-2xl font-bold text-ink">{selected.doc.title}</h2>
                <p className="text-xs text-slate-500 mt-1">
                  {selected.doc.docNumber || 'No number'} · {selected.doc.category}
                  {selected.doc.author ? ` · Author: ${selected.doc.author}` : ''}
                  {selected.doc.approvedBy ? ` · Approved by: ${selected.doc.approvedBy}` : ''}
                </p>
                {selected.doc.description && <p className="text-sm text-slate-300 mt-2">{selected.doc.description}</p>}
              </div>

              {/* Status / update card */}
              {selected.status === 'current' ? (
                <div className="rounded-3xl bg-green-50 border border-green-100 px-5 py-4 flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-green-100 text-green-700 flex items-center justify-center font-bold">✓</div>
                  <div>
                    <p className="text-sm font-semibold text-green-700">This project is on the latest version (v{selected.doc.version})</p>
                    {selected.record && <p className="text-xs text-green-700/80">Adopted by {selected.record.adoptedBy} on {new Date(selected.record.adoptedAt).toLocaleDateString()}</p>}
                  </div>
                </div>
              ) : (
                <div className="rounded-3xl bg-amber-50 border border-amber-100 px-5 py-4 space-y-3">
                  <div>
                    <p className="text-sm font-semibold text-amber-700">
                      {selected.status === 'new'
                        ? `New document — v${selected.doc.version} has not been added to this project yet`
                        : `Update available — project is on v${selected.record!.adoptedVersion}, latest is v${selected.doc.version}`}
                    </p>
                    {changes.length > 0 && <p className="text-xs text-amber-700/80 mt-0.5">What changed in the BMS:</p>}
                  </div>
                  {selected.status === 'update' && (
                    <ul className="space-y-1.5">
                      {changes.map((c) => (
                        <li key={c.version} className="text-sm text-amber-700">
                          <span className="font-semibold">v{c.version}</span>
                          <span className="text-amber-700/70"> · {new Date(c.createdAt).toLocaleDateString()} — </span>
                          {c.changeNote || 'No change note recorded.'}
                        </li>
                      ))}
                    </ul>
                  )}
                  {manager ? (
                    <button onClick={() => update(selected.doc)}
                      className="px-5 py-2 rounded-full bg-ink hover:bg-ink-soft text-white text-sm font-semibold transition-colors">
                      {selected.status === 'new' ? `Add v${selected.doc.version} to project` : `Update project to v${selected.doc.version}`}
                    </button>
                  ) : (
                    <p className="text-xs text-amber-700/80">Waiting for the project manager to update.</p>
                  )}
                </div>
              )}

              {/* Version being viewed */}
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-ink">Version {shown.version}</span>
                {selected.status === 'update' && heldVersion && (
                  <div className="flex gap-1 bg-slate-800 rounded-full p-1 ml-2">
                    <button onClick={() => setShowLatest(false)} className={`px-3 py-1 rounded-full text-xs font-medium ${!showLatest ? 'bg-ink text-white' : 'text-slate-300'}`}>Project's v{heldVersion.version}</button>
                    <button onClick={() => setShowLatest(true)} className={`px-3 py-1 rounded-full text-xs font-medium ${showLatest ? 'bg-ink text-white' : 'text-slate-300'}`}>Latest v{selected.doc.version}</button>
                  </div>
                )}
              </div>
              {shown.blocks ? (
                <FillableDocument key={`${projectId}-${selected.doc.id}-${shown.version}-${selected.record?.fieldsUpdatedAt ?? ''}`}
                  title={shown.title}
                  meta={[shown.docNumber, `v${shown.version}`, selected.doc.category].filter(Boolean).join(' · ')}
                  blocks={shown.blocks}
                  savedValues={selected.record?.fieldValues ?? {}}
                  canEdit={!!selected.record && canFill && shown.version === selected.record.adoptedVersion}
                  updatedLine={selected.record?.fieldsUpdatedAt ? `Last updated by ${selected.record.fieldsUpdatedBy} on ${new Date(selected.record.fieldsUpdatedAt).toLocaleString()}` : undefined}
                  onSave={(vals) => saveProjectDocumentFields(projectId, selected.doc.id, vals, currentUser.name)} />
              ) : (
                <pre className="whitespace-pre-wrap bg-slate-900 border border-slate-800 rounded-3xl p-5 text-sm text-slate-200 font-mono">{shown.content || 'No content.'}</pre>
              )}
              {shown.file && (
                <a href={shown.file.dataUrl} download={shown.file.name} className="inline-block text-sm text-coral-dark hover:underline">Download {shown.file.name}</a>
              )}

              {/* Adoption history */}
              {selected.record && (
                <div>
                  <h3 className="text-sm font-bold text-ink mb-2">Project history</h3>
                  <div className="rounded-3xl border border-slate-800 divide-y divide-slate-800 overflow-hidden">
                    {[...selected.record.history].reverse().map((h, i) => (
                      <div key={i} className="px-4 py-2.5 text-sm flex items-center gap-3">
                        <span className="font-semibold text-ink">v{h.version}</span>
                        <span className="text-slate-400">{h.by} · {new Date(h.at).toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <p className="text-slate-500 text-sm">{project ? 'No BMS documents have been published yet.' : 'Select a project to see its documents.'}</p>
          )}
        </main>
      </div>
      )}
    </div>
  )
}
