import { useState, useRef } from 'react'
import type { Task, TaskChecklist, ChecklistAttachment } from '../types'
import { useAppStore } from '../store'
import MemberPicker from './MemberPicker'

interface Props {
  task: Task
  checklist: TaskChecklist
  onClose: () => void
  onDelete?: () => void   // managers/admins only
}

type Step = 1 | 2 | 3

// ── Step indicator ────────────────────────────────────────────────
function StepBar({ step, total, requiresSignature }: { step: Step; total: number; requiresSignature: boolean }) {
  const steps = [
    { n: 1 as Step, label: 'Checks' },
    { n: 2 as Step, label: 'Attachments' },
    { n: 3 as Step, label: requiresSignature ? 'Sign off' : 'Complete' },
  ]
  return (
    <div className="flex items-center justify-center gap-0">
      {steps.map((s, idx) => {
        const done = step > s.n
        const active = step === s.n
        return (
          <div key={s.n} className="flex items-center">
            {/* Connector line */}
            {idx > 0 && (
              <div className={`w-16 h-px mx-1 transition-colors duration-300 ${done || (step >= s.n) ? 'bg-blue-500' : 'bg-slate-700'}`} />
            )}
            <div className="flex flex-col items-center gap-1.5">
              <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold transition-all duration-300 ${
                done    ? 'bg-green-500 text-white' :
                active  ? 'bg-blue-600 text-white ring-4 ring-blue-500/30' :
                          'bg-slate-800 text-slate-500 border border-slate-700'
              }`}>
                {done ? (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                ) : s.n}
              </div>
              <span className={`text-xs font-medium transition-colors ${
                active ? 'text-white' : done ? 'text-green-400' : 'text-slate-600'
              }`}>{s.label}</span>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── Page 1 — Checks ───────────────────────────────────────────────
function PageChecks({
  checklist,
  onToggle,
}: {
  checklist: TaskChecklist
  onToggle: (id: string) => void
}) {
  const done = checklist.items.filter((i) => i.completed).length
  const total = checklist.items.length

  return (
    <div className="flex-1 overflow-y-auto px-8 py-6">
      <div className="max-w-2xl mx-auto">
        {/* Summary pill */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-white">Inspection Checks</h2>
          <span className={`px-4 py-1.5 rounded-full text-sm font-semibold ${
            done === total && total > 0
              ? 'bg-green-900/40 text-green-400 border border-green-800'
              : 'bg-slate-800 text-slate-300 border border-slate-700'
          }`}>
            {done} / {total} complete
          </span>
        </div>

        {/* Progress bar */}
        <div className="mb-8">
          <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${done === total && total > 0 ? 'bg-green-500' : 'bg-blue-500'}`}
              style={{ width: `${total > 0 ? Math.round((done / total) * 100) : 0}%` }}
            />
          </div>
        </div>

        {/* Items */}
        <div className="space-y-3">
          {checklist.items.map((item, idx) => (
            <button
              key={item.id}
              type="button"
              onClick={() => onToggle(item.id)}
              className={`w-full flex items-start gap-4 p-5 rounded-2xl border text-left transition-all duration-200 ${
                item.completed
                  ? 'bg-green-950/25 border-green-800/50'
                  : 'bg-slate-900 border-slate-800 hover:border-slate-600'
              }`}
            >
              {/* Checkbox */}
              <div className={`flex-shrink-0 mt-0.5 w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${
                item.completed ? 'bg-green-500 border-green-500' : 'border-slate-600'
              }`}>
                {item.completed && (
                  <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </div>

              {/* Number + text */}
              <div className="flex-1 flex items-baseline gap-3">
                <span className="text-xs text-slate-600 font-mono flex-shrink-0">{String(idx + 1).padStart(2, '0')}</span>
                <span className={`text-sm font-medium leading-relaxed ${
                  item.completed ? 'line-through text-slate-600' : 'text-slate-200'
                }`}>
                  {item.text}
                </span>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Page 2 — Attachments ──────────────────────────────────────────
function PageAttachments({
  checklist,
  onAddAttachments,
  onRemoveAttachment,
}: {
  checklist: TaskChecklist
  onAddAttachments: (files: ChecklistAttachment[]) => void
  onRemoveAttachment: (id: string) => void
}) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [dragOver, setDragOver] = useState(false)
  const [loading, setLoading] = useState(false)

  const attachments = checklist.attachments ?? []

  const readFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return
    setLoading(true)
    const results: ChecklistAttachment[] = []
    let pending = files.length

    Array.from(files).forEach((file) => {
      const reader = new FileReader()
      reader.onload = (e) => {
        results.push({
          id: `att-${Date.now()}-${Math.random().toString(36).slice(2)}`,
          name: file.name,
          mimeType: file.type,
          dataUrl: e.target?.result as string,
        })
        pending--
        if (pending === 0) {
          onAddAttachments(results)
          setLoading(false)
        }
      }
      reader.readAsDataURL(file)
    })
  }

  const isImage = (mimeType: string) => mimeType.startsWith('image/')

  return (
    <div className="flex-1 overflow-y-auto px-8 py-6">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-xl font-bold text-white">Attachments</h2>
          <span className="text-xs text-slate-500 font-medium px-3 py-1 bg-slate-800 rounded-full">Optional</span>
        </div>
        <p className="text-slate-400 text-sm mb-6">Upload any photos, drawings, or documents relevant to this inspection.</p>

        {/* Drop zone */}
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault()
            setDragOver(false)
            readFiles(e.dataTransfer.files)
          }}
          onClick={() => fileRef.current?.click()}
          className={`relative flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed py-12 cursor-pointer transition-all duration-200 ${
            dragOver
              ? 'border-blue-500 bg-blue-500/10'
              : 'border-slate-700 hover:border-slate-500 bg-slate-900/50 hover:bg-slate-800/50'
          }`}
        >
          {loading ? (
            <div className="flex flex-col items-center gap-3">
              <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
              <span className="text-sm text-slate-400">Reading files…</span>
            </div>
          ) : (
            <>
              <div className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-colors ${
                dragOver ? 'bg-blue-500/20' : 'bg-slate-800'
              }`}>
                <svg className={`w-7 h-7 transition-colors ${dragOver ? 'text-blue-400' : 'text-slate-500'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                    d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <div className="text-center">
                <p className="text-sm font-medium text-slate-300">Drop files here or <span className="text-blue-400">browse</span></p>
                <p className="text-xs text-slate-600 mt-1">Images, PDFs, documents — any format</p>
              </div>
            </>
          )}
          <input
            ref={fileRef}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => readFiles(e.target.files)}
          />
        </div>

        {/* Uploaded files */}
        {attachments.length > 0 && (
          <div className="mt-6 space-y-3">
            <p className="text-sm font-semibold text-slate-400">{attachments.length} file{attachments.length !== 1 ? 's' : ''} attached</p>
            {attachments.map((att) => (
              <div key={att.id} className="flex items-center gap-4 p-4 bg-slate-900 border border-slate-800 rounded-2xl group">
                {/* Preview / icon */}
                <div className="w-14 h-14 rounded-xl overflow-hidden flex-shrink-0 bg-slate-800 flex items-center justify-center">
                  {isImage(att.mimeType) ? (
                    <img src={att.dataUrl} alt={att.name} className="w-full h-full object-cover" />
                  ) : (
                    <svg className="w-7 h-7 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-200 truncate">{att.name}</p>
                  <p className="text-xs text-slate-600 mt-0.5">{att.mimeType || 'Unknown type'}</p>
                </div>

                <button
                  type="button"
                  onClick={() => onRemoveAttachment(att.id)}
                  className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center text-slate-600 hover:text-red-400 hover:bg-red-900/20 transition-colors"
                  title="Remove"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Page 3 — Sign off / Complete ──────────────────────────────────
function PageSignOff({
  checklist,
  onSign,
  onClearSignature,
}: {
  checklist: TaskChecklist
  onSign: (name: string) => void
  onClearSignature: () => void
}) {
  const [signerName, setSignerName] = useState('')
  const isSigned = !!checklist.signature
  const allDone = checklist.items.every((i) => i.completed)

  if (!checklist.requiresSignature) {
    // No signature needed — just a completion summary
    return (
      <div className="flex-1 flex flex-col items-center justify-center px-8 py-6">
        <div className="max-w-md text-center">
          <div className={`w-20 h-20 rounded-full mx-auto mb-6 flex items-center justify-center ${
            allDone ? 'bg-green-500/20' : 'bg-amber-500/20'
          }`}>
            {allDone ? (
              <svg className="w-10 h-10 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            ) : (
              <svg className="w-10 h-10 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            )}
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">
            {allDone ? 'All checks complete!' : 'Incomplete checks'}
          </h2>
          <p className="text-slate-400 text-sm">
            {allDone
              ? 'Every inspection item has been verified. You can now close this checklist.'
              : `${checklist.items.filter((i) => !i.completed).length} item(s) are still unchecked. You can still close, but the checklist won't be marked complete.`}
          </p>
        </div>
      </div>
    )
  }

  // Signature required
  return (
    <div className="flex-1 flex flex-col items-center justify-center px-8 py-6">
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <div className={`w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center ${
            isSigned ? 'bg-green-500/20' : 'bg-amber-500/20'
          }`}>
            <svg className={`w-8 h-8 ${isSigned ? 'text-green-400' : 'text-amber-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">
            {isSigned ? 'Signed off' : 'Sign off required'}
          </h2>
          <p className="text-slate-400 text-sm">
            {isSigned
              ? 'This checklist has been signed and is ready to close.'
              : 'This checklist requires an authorised signature before it can be completed.'}
          </p>
        </div>

        {isSigned && checklist.signature ? (
          <div className="bg-green-950/30 border border-green-800/40 rounded-2xl p-5">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div>
                <p className="text-green-300 font-bold text-base">{checklist.signature.name}</p>
                <p className="text-green-700 text-xs">
                  {new Date(checklist.signature.date).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClearSignature}
              className="w-full py-2 rounded-xl border border-slate-700 text-slate-500 hover:text-red-400 hover:border-red-900/40 text-sm transition-colors"
            >
              Clear signature
            </button>
          </div>
        ) : (
          <div className="bg-slate-900 border border-amber-900/30 rounded-2xl p-5 space-y-3">
            <label className="block text-sm font-medium text-slate-300">
              Your full name
            </label>
            <input
              autoFocus
              type="text"
              value={signerName}
              onChange={(e) => setSignerName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && signerName.trim()) onSign(signerName.trim()) }}
              placeholder="Enter your full name to sign…"
              className="w-full bg-slate-800 text-slate-100 placeholder-slate-500 rounded-xl px-4 py-3 border border-amber-800/50 focus:outline-none focus:border-amber-500 text-sm transition-colors"
            />
            <button
              type="button"
              onClick={() => signerName.trim() && onSign(signerName.trim())}
              disabled={!signerName.trim()}
              className="w-full py-3 rounded-xl bg-amber-600 hover:bg-amber-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-bold transition-colors flex items-center justify-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
              </svg>
              Confirm signature
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Main wizard ───────────────────────────────────────────────────
export default function ChecklistDetail({ task, checklist, onClose, onDelete }: Props) {
  const { members, currentUser, updateTask } = useAppStore()
  const [step, setStep] = useState<Step>(1)
  const [menuOpen, setMenuOpen] = useState(false)
  const [showReassign, setShowReassign] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  const canManage = currentUser?.role === 'admin' || currentUser?.role === 'manager'

  const memberNameMap: Record<string, string> = Object.fromEntries(members.map((m) => [m.email, m.name]))

  // Always read from live store so toggles persist immediately
  const liveChecklist = task.checklists.find((cl) => cl.id === checklist.id) ?? checklist

  // Members scoped to this task's project
  const projectMembers = members.filter((m) => m.projectIds.includes(task.projectId))

  const updateChecklist = (updated: Partial<typeof liveChecklist>) => {
    updateTask({
      ...task,
      checklists: task.checklists.map((cl) =>
        cl.id === liveChecklist.id ? { ...cl, ...updated } : cl
      ),
    })
  }

  const toggleItem = (itemId: string) => {
    updateChecklist({
      items: liveChecklist.items.map((it) =>
        it.id === itemId ? { ...it, completed: !it.completed } : it
      ),
    })
  }

  const addAttachments = (files: ChecklistAttachment[]) => {
    updateChecklist({ attachments: [...(liveChecklist.attachments ?? []), ...files] })
  }

  const removeAttachment = (id: string) => {
    updateChecklist({ attachments: (liveChecklist.attachments ?? []).filter((a) => a.id !== id) })
  }

  const sign = (name: string) => {
    updateChecklist({ signature: { name, date: new Date().toISOString() } })
  }

  const clearSignature = () => {
    updateChecklist({ signature: undefined })
  }

  // ── PDF export via window.print ──
  const handleExportPDF = () => {
    setMenuOpen(false)
    const doneCnt = liveChecklist.items.filter((i) => i.completed).length
    const attachments = liveChecklist.attachments ?? []

    const itemRows = liveChecklist.items.map((it, idx) => `
      <tr style="border-bottom:1px solid #e2e8f0">
        <td style="padding:8px 4px;color:#64748b;font-size:11px;width:32px">${String(idx + 1).padStart(2, '0')}</td>
        <td style="padding:8px 4px;font-size:13px">${it.text}</td>
        <td style="padding:8px 4px;text-align:center;width:80px">
          <span style="display:inline-block;padding:2px 10px;border-radius:20px;font-size:11px;font-weight:600;
            background:${it.completed ? '#dcfce7' : '#fef9c3'};color:${it.completed ? '#166534' : '#854d0e'}">
            ${it.completed ? '✓ Done' : 'Pending'}
          </span>
        </td>
      </tr>
    `).join('')

    const imageAttachments = attachments.filter((a) => a.mimeType.startsWith('image/'))
    const otherAttachments = attachments.filter((a) => !a.mimeType.startsWith('image/'))

    const attachSection = attachments.length === 0 ? '<p style="color:#94a3b8;font-size:13px">No attachments.</p>' : `
      ${imageAttachments.map((a) => `
        <div style="display:inline-block;margin:6px;vertical-align:top">
          <img src="${a.dataUrl}" style="max-width:200px;max-height:160px;border-radius:8px;border:1px solid #e2e8f0" />
          <p style="font-size:11px;color:#64748b;margin:4px 0 0;text-align:center">${a.name}</p>
        </div>
      `).join('')}
      ${otherAttachments.map((a) => `
        <p style="font-size:12px;color:#374151;margin:4px 0">📎 ${a.name}</p>
      `).join('')}
    `

    const sigSection = liveChecklist.requiresSignature
      ? liveChecklist.signature
        ? `<p style="font-size:13px"><strong>Signed by:</strong> ${liveChecklist.signature.name} &nbsp;·&nbsp;
            ${new Date(liveChecklist.signature.date).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}</p>`
        : `<p style="font-size:13px;color:#b45309">⚠ Signature not yet provided.</p>`
      : `<p style="font-size:13px;color:#64748b">No signature required.</p>`

    const html = `<!DOCTYPE html><html><head><title>${liveChecklist.templateName}</title>
    <style>
      body{font-family:system-ui,sans-serif;color:#1e293b;padding:32px;max-width:800px;margin:0 auto}
      table{width:100%;border-collapse:collapse}
      h1{font-size:22px;margin:0 0 4px}
      h2{font-size:15px;margin:24px 0 10px;color:#334155;border-bottom:1px solid #e2e8f0;padding-bottom:6px}
      @media print{body{padding:16px}}
    </style></head><body>
      <p style="font-size:11px;color:#94a3b8;margin:0 0 6px;text-transform:uppercase;letter-spacing:.05em">Inspection & Test Plan</p>
      <h1>${liveChecklist.templateName}</h1>
      <p style="font-size:13px;color:#64748b;margin:4px 0 0">Task: <strong>${task.name}</strong>
        ${task.location ? ' &nbsp;·&nbsp; ' + task.location : ''}
        ${liveChecklist.assignedTo ? ' &nbsp;·&nbsp; Assigned to: <strong>' + (memberNameMap[liveChecklist.assignedTo] ?? liveChecklist.assignedTo) + '</strong>' : ''}
      </p>
      <p style="font-size:12px;color:#94a3b8;margin:6px 0 0">Exported: ${new Date().toLocaleString()}</p>

      <h2>Inspection Checks &nbsp;<span style="font-size:12px;font-weight:400;color:#64748b">${doneCnt}/${liveChecklist.items.length} complete</span></h2>
      <table><tbody>${itemRows}</tbody></table>

      <h2>Attachments</h2>
      ${attachSection}

      <h2>Sign-off</h2>
      ${sigSection}
    </body></html>`

    const win = window.open('', '_blank')
    if (!win) return
    win.document.write(html)
    win.document.close()
    win.focus()
    setTimeout(() => { win.print() }, 400)
  }

  const canFinish = !liveChecklist.requiresSignature || !!liveChecklist.signature

  return (
    <div className="absolute inset-0 z-20 bg-slate-950 flex flex-col" onClick={() => { if (menuOpen) setMenuOpen(false) }}>

      {/* ── Top bar ── */}
      <div className="flex-shrink-0 px-6 pt-5 pb-4 border-b border-slate-800">
        {/* Row 1: back + task name + assigned pill + actions menu */}
        <div className="flex items-center gap-3 mb-5">
          <button
            onClick={onClose}
            className="flex items-center gap-1.5 text-slate-400 hover:text-white transition-colors text-sm font-medium flex-shrink-0"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Exit
          </button>

          <div className="h-4 w-px bg-slate-700" />

          <div className="flex-1 min-w-0">
            <p className="text-xs text-slate-500 font-medium truncate">{task.name}</p>
            <h1 className="text-base font-bold text-white truncate">{liveChecklist.templateName}</h1>
          </div>

          {/* Assigned pill — clickable for managers to reassign */}
          {liveChecklist.assignedTo ? (
            <button
              onClick={() => canManage && setShowReassign(true)}
              title={canManage ? 'Click to reassign' : undefined}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-800 border border-slate-700 flex-shrink-0 transition-colors ${canManage ? 'hover:border-blue-500 cursor-pointer' : 'cursor-default'}`}
            >
              <div className="w-5 h-5 rounded-full bg-blue-600/40 text-blue-300 flex items-center justify-center text-xs font-bold">
                {(memberNameMap[liveChecklist.assignedTo] ?? liveChecklist.assignedTo).charAt(0)}
              </div>
              <span className="text-xs text-slate-300 font-medium">
                {memberNameMap[liveChecklist.assignedTo] ?? liveChecklist.assignedTo}
              </span>
              {canManage && (
                <svg className="w-3 h-3 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                </svg>
              )}
            </button>
          ) : canManage ? (
            <button
              onClick={() => setShowReassign(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-dashed border-slate-700 text-slate-500 hover:border-blue-500 hover:text-blue-400 text-xs transition-colors flex-shrink-0"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Assign
            </button>
          ) : null}

          {/* ⋯ Actions menu */}
          {canManage && (
            <div ref={menuRef} className="relative flex-shrink-0" onClick={(e) => e.stopPropagation()}>
              <button
                onClick={() => setMenuOpen((v) => !v)}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                title="More actions"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <circle cx="12" cy="5" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="12" cy="19" r="1.5"/>
                </svg>
              </button>

              {menuOpen && (
                <div className="absolute right-0 top-full mt-2 w-48 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl overflow-hidden z-30">
                  <button
                    onClick={handleExportPDF}
                    className="w-full flex items-center gap-3 px-4 py-3 text-sm text-slate-300 hover:bg-slate-800 hover:text-white transition-colors text-left"
                  >
                    <svg className="w-4 h-4 text-blue-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    Export as PDF
                  </button>
                  <button
                    onClick={() => { setMenuOpen(false); setShowReassign(true) }}
                    className="w-full flex items-center gap-3 px-4 py-3 text-sm text-slate-300 hover:bg-slate-800 hover:text-white transition-colors text-left"
                  >
                    <svg className="w-4 h-4 text-slate-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                    Change assignee
                  </button>
                  <div className="h-px bg-slate-800 mx-2" />
                  <button
                    onClick={() => { setMenuOpen(false); setConfirmDelete(true) }}
                    className="w-full flex items-center gap-3 px-4 py-3 text-sm text-red-400 hover:bg-red-900/20 transition-colors text-left"
                  >
                    <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                    Delete checklist
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Row 2: step bar */}
        <StepBar step={step} total={liveChecklist.items.length} requiresSignature={liveChecklist.requiresSignature} />
      </div>

      {/* ── Reassign modal ── */}
      {showReassign && (
        <div className="absolute inset-0 z-30 bg-black/60 backdrop-blur-sm flex items-center justify-center p-6">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <h3 className="text-base font-bold text-white mb-4">Change assignee</h3>
            <MemberPicker
              members={projectMembers}
              value={liveChecklist.assignedTo ?? ''}
              onChange={(email) => {
                updateChecklist({ assignedTo: email || undefined })
                setShowReassign(false)
              }}
              placeholder="Search by name…"
            />
            <button
              onClick={() => setShowReassign(false)}
              className="mt-3 w-full py-2 rounded-xl border border-slate-700 text-slate-400 hover:text-white text-sm transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* ── Delete confirmation ── */}
      {confirmDelete && (
        <div className="absolute inset-0 z-30 bg-black/60 backdrop-blur-sm flex items-center justify-center p-6">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <div className="w-12 h-12 rounded-xl bg-red-900/30 flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </div>
            <h3 className="text-base font-bold text-white text-center mb-1">Delete checklist?</h3>
            <p className="text-slate-400 text-sm text-center mb-6">
              <strong className="text-slate-300">{liveChecklist.templateName}</strong> will be permanently removed from this task.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmDelete(false)}
                className="flex-1 py-2.5 rounded-xl border border-slate-700 text-slate-300 hover:bg-slate-800 text-sm font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => { onDelete?.(); onClose() }}
                className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-bold transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Page content ── */}
      {step === 1 && (
        <PageChecks checklist={liveChecklist} onToggle={toggleItem} />
      )}
      {step === 2 && (
        <PageAttachments
          checklist={liveChecklist}
          onAddAttachments={addAttachments}
          onRemoveAttachment={removeAttachment}
        />
      )}
      {step === 3 && (
        <PageSignOff
          checklist={liveChecklist}
          onSign={sign}
          onClearSignature={clearSignature}
        />
      )}

      {/* ── Bottom navigation ── */}
      <div className="flex-shrink-0 px-8 py-5 border-t border-slate-800 flex items-center justify-between">
        {/* Back */}
        {step > 1 ? (
          <button
            onClick={() => setStep((s) => (s - 1) as Step)}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-slate-700 text-slate-300 hover:text-white hover:border-slate-500 text-sm font-medium transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back
          </button>
        ) : (
          <div /> // spacer
        )}

        {/* Right action */}
        {step < 3 ? (
          <button
            onClick={() => setStep((s) => (s + 1) as Step)}
            className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold transition-colors"
          >
            Continue
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        ) : (
          <button
            onClick={onClose}
            disabled={!canFinish}
            className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold transition-colors ${
              canFinish
                ? 'bg-green-600 hover:bg-green-700 text-white'
                : 'bg-slate-800 text-slate-500 cursor-not-allowed'
            }`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
            </svg>
            {canFinish ? 'Finish & close' : 'Signature required'}
          </button>
        )}
      </div>

    </div>
  )
}
