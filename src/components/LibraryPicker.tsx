import { useMemo, useState } from 'react'
import { useAppStore } from '../store'
import DocumentView from './DocumentView'
import { CORE_CATEGORIES, libraryTemplates, nextSequence, projectDocsOf, seqLabel } from '../projectDocs'
import type { BmsCategory, ProjectDocument } from '../types'

interface Props {
  projectId: string
  onClose: () => void
  onCreated: (id: string) => void
}

const field = 'w-full bg-white border border-slate-700 rounded-2xl px-3 py-2.5 text-sm text-ink placeholder-slate-500 focus:outline-none focus:border-ink'

// Browse the BMS library and pull a template into the project's document register.
// The new project document is the project's own copy: it has its own title and reference,
// holds what the team fills in, and remembers which template version it came from.
export default function LibraryPicker({ projectId, onClose, onCreated }: Props) {
  const { bmsDocuments, projectDocuments, projects, currentUser, createProjectDocument } = useAppStore()
  const project = projects.find((p) => p.id === projectId)

  const [category, setCategory] = useState<BmsCategory | 'All'>('All')
  const [search, setSearch] = useState('')
  const [pickedId, setPickedId] = useState<string | null>(null)

  const templates = useMemo(() => libraryTemplates(bmsDocuments), [bmsDocuments])
  const mine = projectDocsOf(projectDocuments, projectId)
  const usedCount = (id: string) => mine.filter((d) => d.bmsDocumentId === id).length

  const visible = templates.filter((t) =>
    (category === 'All' || t.category === category) &&
    `${t.title} ${t.docNumber} ${t.description}`.toLowerCase().includes(search.toLowerCase()))
  const picked = templates.find((t) => t.id === pickedId) ?? null

  const create = () => {
    if (!picked) return
    const now = new Date().toISOString()
    const doc: ProjectDocument = {
      id: `pdoc-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`, projectId, bmsDocumentId: picked.id,
      adoptedVersion: picked.version, adoptedAt: now, adoptedBy: currentUser?.name ?? 'Unknown', createdAt: now,
      sequence: nextSequence(projectDocuments, projectId, picked.id), revision: 1, lastEditedAt: now, versions: [], status: 'active',
      history: [{ version: picked.version, at: now, by: currentUser?.name ?? 'Unknown', note: 'Created from the BMS library' }],
    }
    createProjectDocument(doc)
    onCreated(doc.id)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="bg-white border border-slate-700 rounded-3xl shadow-float w-full max-w-6xl h-[88vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 flex-shrink-0">
          <div>
            <h2 className="text-lg font-bold text-ink">Add from the BMS library</h2>
            <p className="text-xs text-slate-400">Pick a template to add it to {project?.name ?? 'this project'}'s register. The name and number come from the template.</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-ink text-xl leading-none">✕</button>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Library */}
          <aside className="w-80 border-r border-slate-800 bg-slate-900 flex flex-col flex-shrink-0">
            <div className="p-3 space-y-2 border-b border-slate-800">
              <input className={field} placeholder="Search the library…" value={search} onChange={(e) => setSearch(e.target.value)} />
              <div className="flex gap-1.5 flex-wrap">
                {(['All', ...CORE_CATEGORIES.map((c) => c.key)] as const).map((c) => (
                  <button key={c} onClick={() => setCategory(c)}
                    className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${category === c ? 'bg-ink text-white' : 'bg-white border border-slate-700 text-slate-300 hover:text-ink'}`}>{c}</button>
                ))}
              </div>
            </div>
            <div className="flex-1 overflow-y-auto">
              {visible.length === 0 && <p className="p-4 text-sm text-slate-500">{templates.length === 0 ? 'The BMS library has no published templates yet.' : 'No templates match.'}</p>}
              {visible.map((t) => (
                <button key={t.id} onClick={() => setPickedId(t.id)}
                  className={`w-full text-left px-4 py-3 border-b border-slate-800 hover:bg-white transition-colors ${pickedId === t.id ? 'bg-white' : ''}`}>
                  <p className="text-sm font-semibold text-ink truncate">{t.title}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{t.docNumber || 'No number'} · {t.category} · v{t.version}</p>
                  {usedCount(t.id) > 0 && <p className="text-[11px] text-slate-400 mt-1">Already used {usedCount(t.id)}× in this project</p>}
                </button>
              ))}
            </div>
          </aside>

          {/* Preview + details */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {picked ? (
              <>
                <div className="flex-1 overflow-y-auto p-5">
                  {picked.description && <p className="text-sm text-slate-300 mb-3">{picked.description}</p>}
                  {picked.blocks
                    ? <DocumentView compact title={picked.title} blocks={picked.blocks} meta={`${picked.docNumber} · v${picked.version} · ${picked.category}`} />
                    : <pre className="whitespace-pre-wrap bg-slate-900 border border-slate-800 rounded-2xl p-4 text-sm text-slate-200 font-mono">{picked.content}</pre>}
                </div>
                <div className="flex-shrink-0 border-t border-slate-800 px-5 py-4 bg-white flex items-center gap-4 flex-wrap">
                  <div className="flex-1 min-w-[240px]">
                    <p className="text-sm font-semibold text-ink">{picked.title}</p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      <span className="font-mono">{picked.docNumber || 'No number'}</span> · {seqLabel(nextSequence(projectDocuments, projectId, picked.id))} in this project · template v{picked.version}
                    </p>
                    <p className="text-xs text-slate-400 mt-1">The name and number always match the BMS library. You'll fill in the project fields next, and you'll be told when the template gets a newer version.</p>
                  </div>
                  <button onClick={create}
                    className="px-6 py-2.5 rounded-full bg-ink hover:bg-ink-soft text-white text-sm font-semibold transition-colors whitespace-nowrap">Add to register</button>
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-center p-10">
                <div>
                  <p className="text-sm font-semibold text-ink">Choose a template</p>
                  <p className="text-sm text-slate-400 mt-1">Pick one from the library to preview it and add it to your register.</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
