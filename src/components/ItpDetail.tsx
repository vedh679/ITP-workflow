import { useState } from 'react'
import { useAppStore } from '../store'
import DocumentView from './DocumentView'
import DocumentEditor from './DocumentEditor'
import { libraryTemplates } from '../projectDocs'
import type { DocBlock, Task, TaskItp } from '../types'

interface Props {
  task: Task
  itp: TaskItp
  canEdit: boolean            // may change the ITP's content (project managers)
  onClose?: () => void        // when given, the ITP is a full-screen view with an Exit button; otherwise it fills its own tab
  onSave: (itp: TaskItp) => void
}

// One ITP's own inspection and test plan. It starts from the BMS template but belongs to this ITP,
// so a manager can change its content where this ITP needs something different.
export default function ItpDetail({ task, itp, canEdit, onClose, onSave }: Props) {
  const { bmsDocuments, currentUser } = useAppStore()
  const [values, setValues] = useState<Record<string, string>>(itp.fieldValues)
  const [editing, setEditing] = useState<DocBlock[] | null>(null)   // the content being changed

  const latest = libraryTemplates(bmsDocuments).find((t) => t.id === itp.templateId)
  const newer = latest && latest.version !== itp.templateVersion
  const dirty = JSON.stringify(values) !== JSON.stringify(itp.fieldValues)
  const stamp = () => ({ updatedAt: new Date().toISOString(), updatedBy: currentUser?.name ?? 'Unknown' })

  const btn = 'px-4 py-2 rounded-full text-sm font-semibold transition-colors'
  return (
    <div className={onClose ? 'absolute inset-0 z-20 bg-white flex flex-col' : 'h-full bg-white flex flex-col'}>
      <div className="flex-shrink-0 px-6 pt-5 pb-4 border-b border-slate-800">
        <div className="flex items-center gap-3 flex-wrap">
          {onClose && <>
            <button onClick={onClose} className="flex items-center gap-1.5 text-slate-400 hover:text-ink transition-colors text-sm font-medium">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
              Exit
            </button>
            <div className="h-4 w-px bg-slate-700" />
          </>}
          <div className="flex-1 min-w-0">
            <p className="text-xs text-slate-500 truncate">{task.name}</p>
            <h1 className="text-base font-bold text-ink truncate">{editing ? 'Editing this ITP\'s content' : 'Inspection & Test Plan'}</h1>
          </div>
          <span className="text-xs text-slate-500 hidden md:inline">Based on {itp.templateRef} · v{itp.templateVersion}</span>
          {editing ? (
            <>
              <button onClick={() => { onSave({ ...itp, blocks: editing, fieldValues: values, ...stamp() }); setEditing(null) }} className={`${btn} bg-ink hover:bg-ink-soft text-white`}>Save content</button>
              <button onClick={() => setEditing(null)} className={`${btn} bg-slate-800 hover:bg-slate-700 text-slate-200`}>Cancel</button>
            </>
          ) : (
            <>
              <button onClick={() => onSave({ ...itp, fieldValues: values, ...stamp() })} disabled={!dirty} className={`${btn} bg-ink hover:bg-ink-soft disabled:opacity-40 text-white`}>Save entries</button>
              {canEdit && <button onClick={() => setEditing(itp.blocks)} className={`${btn} bg-slate-800 hover:bg-slate-700 text-slate-200`}>Edit content</button>}
            </>
          )}
        </div>
        {newer && !editing && (
          <p className="mt-3 text-xs rounded-xl bg-amber-50 text-amber-700 px-3 py-2">The BMS library now has v{latest!.version} of {itp.templateRef}. This ITP keeps its own content and is not changed automatically.</p>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-4xl mx-auto">
          {editing ? (
            <div className="bg-slate-800 rounded-3xl p-5">
              <div className="mx-auto max-w-[794px] bg-white border border-slate-700 shadow-float rounded-md px-12 py-10">
                <DocumentEditor blocks={editing} onChange={setEditing} />
              </div>
            </div>
          ) : (
            <>
              <DocumentView title={task.name} meta={[itp.templateRef, `started from template v${itp.templateVersion}`, task.location].filter(Boolean).join(' · ')}
                blocks={itp.blocks} values={values} onChange={(id, v) => setValues((cur) => ({ ...cur, [id]: v }))} />
              {itp.updatedAt && <p className="text-xs text-slate-500 mt-3">Last updated by {itp.updatedBy} on {new Date(itp.updatedAt).toLocaleString()}</p>}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
