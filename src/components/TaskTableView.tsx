import { useState, useEffect, useRef } from 'react'
import type { Task, AppUser, CustomTable } from '../types'
import { useAppStore } from '../store'
import MemberPicker from './MemberPicker'

type Sheet = 'itp' | 'checklists'

interface Props {
  task: Task
  members: AppUser[]
}

// ── Shared helpers ────────────────────────────────────────────────
function nameOf(email: string | undefined, members: AppUser[]) {
  if (!email) return '—'
  return members.find((m) => m.email === email)?.name ?? email
}

function fmtDate(iso: string | undefined) {
  if (!iso) return '—'
  return new Date(iso + (iso.includes('T') ? '' : 'T00:00:00'))
    .toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
}

// ── Shared table primitives ───────────────────────────────────────
function Th({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <th className={`sticky top-0 z-10 px-3 py-2.5 text-left text-xs font-bold text-slate-400 uppercase tracking-wide bg-slate-800 border-b border-r border-slate-700 whitespace-nowrap ${className}`}>
      {children}
    </th>
  )
}

function Td({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <td className={`px-3 py-2.5 text-sm text-slate-300 border-b border-r border-slate-800/80 ${className}`}>
      {children}
    </td>
  )
}

function RowNum({ n }: { n: number }) {
  return (
    <td className="sticky left-0 z-10 px-2 py-2.5 text-xs text-slate-600 text-right border-b border-r border-slate-800 bg-slate-900 select-none w-9 font-mono">
      {n}
    </td>
  )
}

function StatusBadge({ value }: { value: string }) {
  const map: Record<string, string> = {
    'completed': 'bg-green-900/50 text-green-400 border-green-800',
    'in-progress': 'bg-blue-900/50 text-blue-400 border-blue-800',
    'pending': 'bg-slate-800 text-slate-400 border-slate-700',
  }
  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold border ${map[value] ?? 'bg-slate-800 text-slate-400'}`}>
      {value}
    </span>
  )
}

// ── Editable Excel-like grid ──────────────────────────────────────
const DEFAULT_COLS = ['Column 1', 'Column 2', 'Column 3']
const DEFAULT_ROWS = [['', '', ''], ['', '', ''], ['', '', '']]

function EditableGrid({ table, onChange }: { table: CustomTable; onChange: (t: CustomTable) => void }) {
  const [editCell, setEditCell] = useState<{ r: number; c: number } | null>(null)
  const [editHeader, setEditHeader] = useState<number | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
    inputRef.current?.select()
  }, [editCell, editHeader])

  const setCell = (r: number, c: number, val: string) => {
    const rows = table.rows.map((row, ri) =>
      ri === r ? row.map((cell, ci) => (ci === c ? val : cell)) : row
    )
    onChange({ ...table, rows })
  }

  const setHeader = (c: number, val: string) => {
    const columns = table.columns.map((col, ci) => (ci === c ? val : col))
    onChange({ ...table, columns })
  }

  const addRow = () => {
    onChange({ ...table, rows: [...table.rows, table.columns.map(() => '')] })
  }

  const deleteRow = (r: number) => {
    onChange({ ...table, rows: table.rows.filter((_, ri) => ri !== r) })
  }

  const addCol = () => {
    const label = `Column ${table.columns.length + 1}`
    onChange({
      columns: [...table.columns, label],
      rows: table.rows.map((row) => [...row, '']),
    })
  }

  const deleteCol = (c: number) => {
    onChange({
      columns: table.columns.filter((_, ci) => ci !== c),
      rows: table.rows.map((row) => row.filter((_, ci) => ci !== c)),
    })
  }

  const cellCls = 'relative border-r border-b border-slate-700 min-w-[120px]'
  const editInputCls = 'w-full h-full px-2 py-1.5 bg-blue-950/60 text-white text-sm outline-none border-2 border-blue-500 rounded-sm'
  const displayCls = 'px-2 py-1.5 text-sm text-slate-300 cursor-text select-none truncate min-h-[34px] hover:bg-slate-800/60'

  return (
    <div className="overflow-auto rounded-xl border border-slate-700">
      <table className="border-collapse" style={{ tableLayout: 'fixed' }}>
        <thead>
          <tr className="bg-slate-800">
            {/* Row-number gutter */}
            <th className="w-9 border-r border-b border-slate-700 bg-slate-800" />

            {table.columns.map((col, c) => (
              <th key={c} className="border-r border-b border-slate-700 min-w-[120px] group relative p-0">
                {editHeader === c ? (
                  <input
                    ref={inputRef}
                    value={col}
                    onChange={(e) => setHeader(c, e.target.value)}
                    onBlur={() => setEditHeader(null)}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === 'Escape') setEditHeader(null) }}
                    className="w-full px-2 py-1.5 bg-blue-950/60 text-white text-xs font-bold outline-none border-2 border-blue-500"
                  />
                ) : (
                  <div
                    onDoubleClick={() => setEditHeader(c)}
                    className="flex items-center justify-between px-2 py-1.5 cursor-default group"
                  >
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wide truncate">{col}</span>
                    {/* Delete column — only shows on hover, only if >1 col */}
                    {table.columns.length > 1 && (
                      <button
                        onClick={() => deleteCol(c)}
                        className="opacity-0 group-hover:opacity-100 ml-1 flex-shrink-0 w-4 h-4 rounded flex items-center justify-center text-slate-600 hover:text-red-400 hover:bg-red-900/20 transition-all"
                        title="Delete column"
                      >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    )}
                  </div>
                )}
              </th>
            ))}

            {/* Add column */}
            <th className="border-b border-slate-700 w-9 bg-slate-800/50">
              <button
                onClick={addCol}
                className="w-full h-full flex items-center justify-center text-slate-600 hover:text-blue-400 hover:bg-slate-700/50 transition-colors py-1.5"
                title="Add column"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              </button>
            </th>
          </tr>
        </thead>

        <tbody>
          {table.rows.map((row, r) => (
            <tr key={r} className={`group/row ${r % 2 === 0 ? 'bg-slate-950' : 'bg-slate-900/40'}`}>
              {/* Row number + delete */}
              <td className="border-r border-b border-slate-700 bg-slate-900 w-9">
                <div className="flex items-center justify-end px-1 gap-0.5">
                  <button
                    onClick={() => deleteRow(r)}
                    className="opacity-0 group-hover/row:opacity-100 w-4 h-4 flex items-center justify-center text-slate-700 hover:text-red-400 transition-all"
                    title="Delete row"
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                  <span className="text-xs text-slate-700 font-mono w-4 text-right select-none">{r + 1}</span>
                </div>
              </td>

              {row.map((cell, c) => (
                <td key={c} className={cellCls} onClick={() => setEditCell({ r, c })}>
                  {editCell?.r === r && editCell?.c === c ? (
                    <input
                      ref={inputRef}
                      value={cell}
                      onChange={(e) => setCell(r, c, e.target.value)}
                      onBlur={() => setEditCell(null)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') setEditCell(r + 1 < table.rows.length ? { r: r + 1, c } : null)
                        if (e.key === 'Escape') setEditCell(null)
                        if (e.key === 'Tab') {
                          e.preventDefault()
                          setEditCell(c + 1 < row.length ? { r, c: c + 1 } : r + 1 < table.rows.length ? { r: r + 1, c: 0 } : null)
                        }
                      }}
                      className={editInputCls}
                    />
                  ) : (
                    <div className={displayCls}>{cell || ''}</div>
                  )}
                </td>
              ))}

              {/* Spacer under add-col button */}
              <td className="border-b border-slate-700" />
            </tr>
          ))}

          {/* Add row */}
          <tr>
            <td colSpan={table.columns.length + 2} className="border-t border-slate-700">
              <button
                onClick={addRow}
                className="w-full flex items-center gap-2 px-3 py-2 text-xs text-slate-600 hover:text-blue-400 hover:bg-slate-800/40 transition-colors"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Add row
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  )
}

// ── Reusable label ────────────────────────────────────────────────
function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">{children}</p>
  )
}

// ── Sheet 1 — ITP editable form ───────────────────────────────────
function ITPSheet({ task, members }: { task: Task; members: AppUser[] }) {
  const updateTask = useAppStore((s) => s.updateTask)

  const [name, setName]             = useState(task.name)
  const [description, setDescription] = useState(task.description ?? '')
  const [location, setLocation]     = useState(task.location ?? '')
  const [dueDate, setDueDate]       = useState(task.dueDate ?? '')
  const [assignedTo, setAssignedTo] = useState(task.assignedTo ?? '')
  const [status, setStatus]         = useState(task.status)

  // Keep local state in sync when a different task is selected
  useEffect(() => {
    setName(task.name)
    setDescription(task.description ?? '')
    setLocation(task.location ?? '')
    setDueDate(task.dueDate ?? '')
    setAssignedTo(task.assignedTo ?? '')
    setStatus(task.status)
  }, [task.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-save on blur for text fields
  const save = (patch: Partial<Task>) => updateTask({ ...task, ...patch })

  // Derived read-only stats
  const totalItems = task.checklists.reduce((s, cl) => s + cl.items.length, 0)
  const doneItems  = task.checklists.reduce((s, cl) => s + cl.items.filter((i) => i.completed).length, 0)
  const doneLists  = task.checklists.filter((cl) =>
    cl.items.length > 0 && cl.items.every((i) => i.completed) &&
    (!cl.requiresSignature || !!cl.signature)
  ).length
  const pct = totalItems > 0 ? Math.round(doneItems / totalItems * 100) : 0

  const inputCls = 'w-full bg-transparent text-slate-100 placeholder-slate-600 rounded-lg px-3 py-2 border border-slate-800 hover:border-slate-600 focus:border-blue-500 focus:outline-none text-sm transition-colors'

  return (
    <div className="overflow-y-auto h-full">
      <div className="max-w-2xl mx-auto px-8 py-8 space-y-6">

        {/* Task name */}
        <div>
          <FieldLabel>Task Name</FieldLabel>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={() => name.trim() && save({ name: name.trim() })}
            placeholder="Task name…"
            className={inputCls + ' text-base font-semibold'}
          />
        </div>

        {/* Description */}
        <div>
          <FieldLabel>Description</FieldLabel>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            onBlur={() => save({ description })}
            placeholder="Brief description…"
            rows={3}
            className={inputCls + ' resize-none'}
          />
        </div>

        {/* Location + Due date */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <FieldLabel>Location</FieldLabel>
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              onBlur={() => save({ location })}
              placeholder="e.g. Site B, Level 2"
              className={inputCls}
            />
          </div>
          <div>
            <FieldLabel>Due Date</FieldLabel>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => { setDueDate(e.target.value); save({ dueDate: e.target.value }) }}
              className={inputCls + ' [color-scheme:dark]'}
            />
          </div>
        </div>

        {/* Status */}
        <div>
          <FieldLabel>Status</FieldLabel>
          <div className="flex gap-2">
            {(['pending', 'in-progress', 'completed'] as Task['status'][]).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => { setStatus(s); save({ status: s }) }}
                className={`px-4 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                  status === s
                    ? s === 'completed' ? 'bg-green-900/60 text-green-400 border-green-700'
                      : s === 'in-progress' ? 'bg-blue-900/60 text-blue-400 border-blue-700'
                      : 'bg-slate-700 text-slate-300 border-slate-600'
                    : 'bg-transparent text-slate-600 border-slate-800 hover:border-slate-600 hover:text-slate-400'
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* Responsible person */}
        <div>
          <FieldLabel>Responsible Person</FieldLabel>
          <MemberPicker
            members={members}
            value={assignedTo}
            onChange={(email) => { setAssignedTo(email); save({ assignedTo: email }) }}
            placeholder="Search by name…"
          />
        </div>

        {/* Divider */}
        <div className="border-t border-slate-800" />

        {/* Read-only stats */}
        <div>
          <FieldLabel>Progress</FieldLabel>
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Checklists', value: `${doneLists} / ${task.checklists.length}` },
              { label: 'Items done', value: `${doneItems} / ${totalItems}` },
              { label: '% Complete', value: `${pct}%` },
            ].map(({ label, value }) => (
              <div key={label} className="bg-slate-900 border border-slate-800 rounded-xl px-4 py-3">
                <p className="text-xs text-slate-500 mb-1">{label}</p>
                <p className="text-lg font-bold text-white">{value}</p>
              </div>
            ))}
          </div>
          {totalItems > 0 && (
            <div className="mt-3 h-2 bg-slate-800 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${pct === 100 ? 'bg-green-500' : 'bg-blue-500'}`}
                style={{ width: `${pct}%` }}
              />
            </div>
          )}
        </div>

        {/* Created (read-only) */}
        <div>
          <FieldLabel>Created</FieldLabel>
          <p className="text-sm text-slate-500 px-3 py-2">{fmtDate(task.createdAt)}</p>
        </div>

        {/* Divider */}
        <div className="border-t border-slate-800" />

        {/* Free-form table */}
        <div>
          <FieldLabel>Notes Table</FieldLabel>
          <EditableGrid
            table={task.customTable ?? { columns: DEFAULT_COLS, rows: DEFAULT_ROWS }}
            onChange={(t) => updateTask({ ...task, customTable: t })}
          />
        </div>

        {/* Bottom padding */}
        <div className="h-4" />

      </div>
    </div>
  )
}

// ── Sheet 2 — Checklists ─────────────────────────────────────────
function ChecklistsSheet({ task, members }: { task: Task; members: AppUser[] }) {
  if (task.checklists.length === 0) {
    return <EmptySheet message="No checklists attached to this task." />
  }

  return (
    <div className="overflow-auto h-full">
      <table className="w-full border-collapse">
        <thead>
          <tr>
            <th className="sticky top-0 left-0 z-20 px-2 w-9 bg-slate-800 border-b border-r border-slate-700" />
            <Th>#</Th>
            <Th>Checklist Name</Th>
            <Th>Assigned To</Th>
            <Th>Items Done</Th>
            <Th>Total Items</Th>
            <Th>Progress</Th>
            <Th>Sig. Required</Th>
            <Th>Signed By</Th>
            <Th>Signed Date</Th>
            <Th>Attachments</Th>
            <Th>Status</Th>
          </tr>
        </thead>
        <tbody>
          {task.checklists.map((cl, idx) => {
            const done = cl.items.filter((i) => i.completed).length
            const total = cl.items.length
            const pct = total > 0 ? Math.round(done / total * 100) : 0
            const isSigned = !!cl.signature
            const isComplete = done === total && total > 0 && (!cl.requiresSignature || isSigned)
            const status = isComplete ? 'completed' : done > 0 ? 'in-progress' : 'pending'

            return (
              <tr key={cl.id} className={idx % 2 === 0 ? 'bg-slate-950' : 'bg-slate-900/40'}>
                <RowNum n={idx + 1} />
                <Td className="text-slate-500 font-mono text-xs">{String(idx + 1).padStart(2, '0')}</Td>
                <Td className="font-medium text-white whitespace-nowrap">{cl.templateName}</Td>
                <Td className="whitespace-nowrap">{nameOf(cl.assignedTo, members)}</Td>
                <Td className="text-center">{done}</Td>
                <Td className="text-center">{total}</Td>
                <Td>
                  <div className="flex items-center gap-2" style={{ minWidth: 100 }}>
                    <div className="flex-1 h-1.5 bg-slate-700 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${pct === 100 ? 'bg-green-500' : 'bg-blue-500'}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="text-xs w-8 text-right">{pct}%</span>
                  </div>
                </Td>
                <Td className="text-center">
                  {cl.requiresSignature
                    ? <span className="text-amber-400 text-xs font-semibold">Yes</span>
                    : <span className="text-slate-600 text-xs">No</span>}
                </Td>
                <Td className="whitespace-nowrap">{isSigned ? cl.signature!.name : '—'}</Td>
                <Td className="whitespace-nowrap text-xs">{isSigned ? fmtDate(cl.signature!.date.split('T')[0]) : '—'}</Td>
                <Td className="text-center">{(cl.attachments ?? []).length || '—'}</Td>
                <Td><StatusBadge value={status} /></Td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}


function EmptySheet({ message }: { message: string }) {
  return (
    <div className="flex items-center justify-center h-full">
      <p className="text-slate-600 text-sm">{message}</p>
    </div>
  )
}

// ── PDF export ────────────────────────────────────────────────────
function buildPDF(
  task: Task,
  members: AppUser[],
  includeTable: boolean,
  selectedChecklists: string[],
) {
  const fmt = (iso?: string) => {
    if (!iso) return '—'
    return new Date(iso + (iso.includes('T') ? '' : 'T00:00:00'))
      .toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
  }
  const name = (email?: string) => {
    if (!email) return '—'
    return members.find((m) => m.email === email)?.name ?? email
  }

  const totalItems = task.checklists.reduce((s, cl) => s + cl.items.length, 0)
  const doneItems  = task.checklists.reduce((s, cl) => s + cl.items.filter(i => i.completed).length, 0)
  const doneLists  = task.checklists.filter(cl =>
    cl.items.length > 0 && cl.items.every(i => i.completed) && (!cl.requiresSignature || !!cl.signature)
  ).length
  const pct = totalItems > 0 ? Math.round(doneItems / totalItems * 100) : 0

  // ── ITP header table
  const fields: [string, string][] = [
    ['Task Name',          task.name],
    ['Description',        task.description || '—'],
    ['Location',           task.location || '—'],
    ['Due Date',           fmt(task.dueDate)],
    ['Responsible Person', name(task.assignedTo)],
    ['Status',             task.status],
    ['Checklists',         `${doneLists} / ${task.checklists.length} complete`],
    ['Items',              `${doneItems} / ${totalItems} complete (${pct}%)`],
    ['Created',            fmt(task.createdAt)],
  ]
  const itpRows = fields.map(([k, v]) => `
    <tr>
      <td style="padding:7px 10px;font-size:11px;font-weight:600;color:#475569;text-transform:uppercase;
          letter-spacing:.04em;background:#f8fafc;border:1px solid #e2e8f0;white-space:nowrap;width:180px">${k}</td>
      <td style="padding:7px 10px;font-size:13px;color:#1e293b;border:1px solid #e2e8f0">${v}</td>
    </tr>`).join('')

  // ── Notes table
  let tableSection = ''
  const ct = task.customTable
  const tableHasContent = ct && ct.rows.some(r => r.some(c => c.trim() !== ''))
  if (includeTable && ct && tableHasContent) {
    const headerCells = ct.columns.map(c =>
      `<th style="padding:7px 10px;font-size:11px;font-weight:700;color:#475569;text-transform:uppercase;
        letter-spacing:.04em;background:#f8fafc;border:1px solid #e2e8f0;text-align:left">${c}</th>`
    ).join('')
    const dataRows = ct.rows.map((row, ri) => {
      const cells = row.map(cell =>
        `<td style="padding:7px 10px;font-size:13px;color:#1e293b;border:1px solid #e2e8f0">${cell || ''}</td>`
      ).join('')
      return `<tr style="background:${ri % 2 === 0 ? '#fff' : '#f8fafc'}">${cells}</tr>`
    }).join('')
    tableSection = `
      <h2 style="font-size:14px;font-weight:700;color:#334155;margin:28px 0 10px;
          padding-bottom:6px;border-bottom:2px solid #e2e8f0">Notes Table</h2>
      <table style="width:100%;border-collapse:collapse">
        <thead><tr>${headerCells}</tr></thead>
        <tbody>${dataRows}</tbody>
      </table>`
  }

  // ── Checklist sections
  const clSections = task.checklists
    .filter(cl => selectedChecklists.includes(cl.id))
    .map(cl => {
      const done = cl.items.filter(i => i.completed).length
      const total = cl.items.length
      const clPct = total > 0 ? Math.round(done / total * 100) : 0
      const itemRows = cl.items.map((it, idx) => `
        <tr style="background:${idx % 2 === 0 ? '#fff' : '#f8fafc'}">
          <td style="padding:6px 10px;font-size:11px;color:#94a3b8;font-family:monospace;
              border:1px solid #e2e8f0;width:36px;text-align:center">${String(idx+1).padStart(2,'0')}</td>
          <td style="padding:6px 10px;font-size:13px;color:#1e293b;border:1px solid #e2e8f0">${it.text}</td>
          <td style="padding:6px 10px;text-align:center;border:1px solid #e2e8f0;width:80px">
            <span style="display:inline-block;padding:2px 10px;border-radius:20px;font-size:11px;font-weight:600;
              background:${it.completed ? '#dcfce7' : '#fef9c3'};color:${it.completed ? '#166534' : '#854d0e'}">
              ${it.completed ? '✓ Done' : 'Pending'}
            </span>
          </td>
        </tr>`).join('')

      const sigBlock = cl.requiresSignature
        ? cl.signature
          ? `<p style="margin:10px 0 0;font-size:12px;color:#166534;background:#dcfce7;
              padding:8px 12px;border-radius:6px;display:inline-block">
              ✓ Signed by <strong>${cl.signature.name}</strong> on ${fmt(cl.signature.date)}</p>`
          : `<p style="margin:10px 0 0;font-size:12px;color:#92400e;background:#fef3c7;
              padding:8px 12px;border-radius:6px;display:inline-block">⚠ Signature not yet provided</p>`
        : ''

      return `
        <h2 style="font-size:14px;font-weight:700;color:#334155;margin:28px 0 4px;
            padding-bottom:6px;border-bottom:2px solid #e2e8f0">${cl.templateName}</h2>
        <p style="font-size:12px;color:#64748b;margin:0 0 10px">
          Assigned to: <strong>${name(cl.assignedTo)}</strong> &nbsp;·&nbsp;
          ${done}/${total} items complete (${clPct}%)
        </p>
        <table style="width:100%;border-collapse:collapse">
          <thead>
            <tr style="background:#f8fafc">
              <th style="padding:7px 10px;font-size:11px;font-weight:700;color:#475569;text-transform:uppercase;
                  letter-spacing:.04em;border:1px solid #e2e8f0;text-align:center;width:36px">#</th>
              <th style="padding:7px 10px;font-size:11px;font-weight:700;color:#475569;text-transform:uppercase;
                  letter-spacing:.04em;border:1px solid #e2e8f0;text-align:left">Description</th>
              <th style="padding:7px 10px;font-size:11px;font-weight:700;color:#475569;text-transform:uppercase;
                  letter-spacing:.04em;border:1px solid #e2e8f0;text-align:center;width:80px">Status</th>
            </tr>
          </thead>
          <tbody>${itemRows}</tbody>
        </table>
        ${sigBlock}`
    }).join('')

  return `<!DOCTYPE html><html><head><title>ITP — ${task.name}</title>
  <style>
    body{font-family:system-ui,-apple-system,sans-serif;color:#1e293b;padding:32px;max-width:860px;margin:0 auto}
    @media print{body{padding:20px}@page{margin:15mm}}
  </style></head><body>
    <p style="font-size:10px;color:#94a3b8;margin:0 0 6px;text-transform:uppercase;letter-spacing:.06em">
      Inspection &amp; Test Plan</p>
    <h1 style="font-size:24px;font-weight:800;color:#0f172a;margin:0 0 2px">${task.name}</h1>
    <p style="font-size:12px;color:#94a3b8;margin:0 0 20px">
      Exported ${new Date().toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}
    </p>
    <table style="width:100%;border-collapse:collapse">${itpRows}</table>
    ${tableSection}
    ${clSections}
  </body></html>`
}

// ── Export modal ──────────────────────────────────────────────────
function ExportModal({ task, members, onClose }: { task: Task; members: AppUser[]; onClose: () => void }) {
  const ct = task.customTable
  const tableHasContent = !!ct && ct.rows.some(r => r.some(c => c.trim() !== ''))
  const [includeTable, setIncludeTable] = useState(tableHasContent)
  const [selectedCl, setSelectedCl] = useState<string[]>([])

  const toggleCl = (id: string) =>
    setSelectedCl(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])

  const handleExport = () => {
    const html = buildPDF(task, members, includeTable, selectedCl)
    const win = window.open('', '_blank')
    if (!win) return
    win.document.write(html)
    win.document.close()
    win.focus()
    setTimeout(() => win.print(), 400)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-md">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-600/20 flex items-center justify-center">
              <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h2 className="text-base font-bold text-white">Export as PDF</h2>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="px-6 py-5 space-y-5">
          {/* Always included */}
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Always included</p>
            <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-slate-800/50 border border-slate-700">
              <div className="w-5 h-5 rounded bg-blue-600 flex items-center justify-center flex-shrink-0">
                <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <span className="text-sm text-slate-300">ITP header fields</span>
            </div>

            {/* Notes table toggle — only shown if the table exists */}
            {ct && (
              <button
                onClick={() => setIncludeTable(v => !v)}
                className={`mt-2 w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border text-left transition-all ${
                  includeTable
                    ? 'bg-blue-600/10 border-blue-600/40'
                    : 'bg-slate-800/30 border-slate-700 hover:border-slate-500'
                }`}
              >
                <div className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                  includeTable ? 'bg-blue-600 border-blue-600' : 'border-slate-600'
                }`}>
                  {includeTable && (
                    <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </div>
                <div>
                  <span className="text-sm text-slate-300">Notes table</span>
                  {!tableHasContent && (
                    <span className="ml-2 text-xs text-slate-600">(empty)</span>
                  )}
                </div>
              </button>
            )}
          </div>

          {/* Checklists */}
          {task.checklists.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                  Include checklists
                </p>
                <button
                  onClick={() =>
                    setSelectedCl(selectedCl.length === task.checklists.length ? [] : task.checklists.map(c => c.id))
                  }
                  className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
                >
                  {selectedCl.length === task.checklists.length ? 'Deselect all' : 'Select all'}
                </button>
              </div>
              <div className="space-y-2">
                {task.checklists.map(cl => {
                  const done = cl.items.filter(i => i.completed).length
                  const checked = selectedCl.includes(cl.id)
                  return (
                    <button
                      key={cl.id}
                      onClick={() => toggleCl(cl.id)}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border text-left transition-all ${
                        checked
                          ? 'bg-blue-600/10 border-blue-600/40'
                          : 'bg-slate-800/30 border-slate-700 hover:border-slate-500'
                      }`}
                    >
                      <div className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                        checked ? 'bg-blue-600 border-blue-600' : 'border-slate-600'
                      }`}>
                        {checked && (
                          <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <span className="text-sm text-slate-300 truncate block">{cl.templateName}</span>
                        <span className="text-xs text-slate-600">{done}/{cl.items.length} items complete</span>
                      </div>
                      {cl.requiresSignature && (
                        <span className="text-xs text-amber-500 flex-shrink-0">Sig. req.</span>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-3 px-6 py-5 border-t border-slate-800">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-slate-700 text-slate-300 hover:bg-slate-800 text-sm font-medium transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleExport}
            className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold transition-colors flex items-center justify-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Export PDF
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Root component ────────────────────────────────────────────────
const SHEETS: { id: Sheet; label: string; icon: React.ReactNode }[] = [
  {
    id: 'itp',
    label: 'ITP',
    icon: (
      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
      </svg>
    ),
  },
  {
    id: 'checklists',
    label: 'Checklists',
    icon: (
      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
      </svg>
    ),
  },
]

export default function TaskTableView({ task, members }: Props) {
  const currentUser = useAppStore((s) => s.currentUser)
  const canManage = currentUser?.role === 'admin' || currentUser?.role === 'manager'
  const [sheet, setSheet] = useState<Sheet>('itp')
  const [showExport, setShowExport] = useState(false)

  return (
    <div className="flex flex-col h-full bg-slate-950">
      {/* Sheet tabs */}
      <div className="flex-shrink-0 flex items-center gap-1 px-4 pt-3 border-b border-slate-800 bg-slate-900">
        {SHEETS.map((s) => (
          <button
            key={s.id}
            onClick={() => setSheet(s.id)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-t-lg text-sm font-medium transition-all border-t border-l border-r -mb-px ${
              sheet === s.id
                ? 'bg-slate-950 border-slate-700 text-white'
                : 'bg-transparent border-transparent text-slate-500 hover:text-slate-300'
            }`}
          >
            {s.icon}
            {s.label}
          </button>
        ))}

        {/* Right side: row counts + export button */}
        <div className="ml-auto pb-2 flex items-center gap-3">
          <span className="text-xs text-slate-600">
            {sheet === 'itp' && '9 fields'}
            {sheet === 'checklists' && `${task.checklists.length} row${task.checklists.length !== 1 ? 's' : ''} · 12 columns`}
          </span>

          {/* Export — ITP sheet only, managers/admins only */}
          {sheet === 'itp' && canManage && (
            <button
              onClick={() => setShowExport(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600/15 hover:bg-blue-600/30 border border-blue-600/30 text-blue-400 hover:text-blue-300 text-xs font-semibold transition-all"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Export PDF
            </button>
          )}
        </div>
      </div>

      {/* Table area */}
      <div className="flex-1 overflow-hidden">
        {sheet === 'itp'        && <ITPSheet        task={task} members={members} />}
        {sheet === 'checklists' && <ChecklistsSheet task={task} members={members} />}
      </div>

      {/* Export modal */}
      {showExport && (
        <ExportModal task={task} members={members} onClose={() => setShowExport(false)} />
      )}
    </div>
  )
}
