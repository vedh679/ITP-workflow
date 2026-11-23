import { useLayoutEffect, useRef, useState } from 'react'
import { newBlockId, newTable } from '../docBlocks'
import type { DocBlock } from '../types'

// Word-style editor for BMS core documents. Headings and paragraphs are the fixed body of the
// document; "project fields" leave a space for each project team to fill in.
type Style = 'h1' | 'h2' | 'h3' | 'p'
const styleOf = (b: DocBlock): Style => b.type === 'heading' ? (`h${b.level ?? 2}` as Style) : 'p'

function AutoTextarea({ value, onChange, className, placeholder, autoFocus, onFocus }: {
  value: string; onChange: (v: string) => void; className?: string; placeholder?: string; autoFocus?: boolean; onFocus?: () => void
}) {
  const ref = useRef<HTMLTextAreaElement>(null)
  useLayoutEffect(() => {
    const el = ref.current
    if (el) { el.style.height = 'auto'; el.style.height = `${el.scrollHeight}px` }
  }, [value])
  return <textarea ref={ref} rows={1} value={value} autoFocus={autoFocus} onFocus={onFocus} placeholder={placeholder}
    onChange={(e) => onChange(e.target.value)} className={`w-full resize-none overflow-hidden bg-transparent focus:outline-none ${className ?? ''}`} />
}

const TEXT_CLASS: Record<Style, string> = {
  h1: 'text-2xl font-bold', h2: 'text-lg font-semibold', h3: 'text-base font-semibold', p: 'text-[15px] leading-7 text-slate-200',
}

// Builder for one table: caption, whether it is locked or filled in by the project team, headers and cells
function TableEditor({ b, patch, autoFocus }: { b: DocBlock; patch: (p: Partial<DocBlock>) => void; autoFocus?: boolean }) {
  const cols = b.columns ?? []
  const rows = b.rows ?? []
  const fill = b.tableMode === 'fill'
  const locked = cols.map((_, i) => !!b.colLocked?.[i])
  const cell = 'w-full bg-white border border-slate-700 rounded-md px-2 py-1 text-sm focus:outline-none focus:border-coral'

  const setHeader = (ci: number, v: string) => patch({ columns: cols.map((c, i) => i === ci ? v : c) })
  const setCell = (ri: number, ci: number, v: string) => patch({ rows: rows.map((r, i) => i === ri ? r.map((c, j) => j === ci ? v : c) : r) })
  const addColumn = () => patch({ columns: [...cols, `Column ${cols.length + 1}`], colLocked: [...locked, false], rows: rows.map((r) => [...r, '']) })
  const removeColumn = (ci: number) => cols.length > 1 && patch({ columns: cols.filter((_, i) => i !== ci), colLocked: locked.filter((_, i) => i !== ci), rows: rows.map((r) => r.filter((_, j) => j !== ci)) })
  const addRow = () => patch({ rows: [...rows, cols.map(() => '')] })
  const removeRow = (ri: number) => patch({ rows: rows.filter((_, i) => i !== ri) })
  const small = 'text-xs font-semibold text-coral-dark hover:underline'

  return (
    <div className="my-1.5 space-y-2.5">
      <div className="flex gap-2 flex-wrap items-center">
        <input value={b.label ?? ''} autoFocus={autoFocus} onChange={(e) => patch({ label: e.target.value })} placeholder="Table caption (optional)"
          className="flex-1 min-w-[180px] bg-white border border-slate-700 rounded-lg px-3 py-1.5 text-sm font-semibold focus:outline-none focus:border-coral" />
        <select value={b.tableMode ?? 'fill'} onChange={(e) => patch({ tableMode: e.target.value as 'fixed' | 'fill' })}
          className="bg-white border border-slate-700 rounded-lg px-2 py-1.5 text-sm text-slate-300 focus:outline-none">
          <option value="fill">Project team fills in</option>
          <option value="fixed">Fixed (locked)</option>
        </select>
      </div>
      <p className="text-xs text-slate-500">
        {fill ? 'The project team completes the unlocked columns. What you type below is the starting content — lock a column to keep it fixed.'
              : 'This table is locked like the document text: project teams can read it but not change it.'}
      </p>

      <div className="overflow-x-auto rounded-lg border border-slate-700 bg-white">
        <table className="w-full border-collapse">
          <thead className="bg-slate-800">
            <tr>
              {cols.map((h, ci) => (
                <th key={ci} className="p-1.5 border-l border-slate-700 first:border-l-0 align-top min-w-[130px]">
                  <input value={h} onChange={(e) => setHeader(ci, e.target.value)} className={`${cell} font-bold`} />
                  <div className="flex items-center justify-between mt-1 px-0.5">
                    {fill
                      ? <label className="flex items-center gap-1 text-[11px] font-normal text-slate-400"><input type="checkbox" checked={locked[ci]} onChange={(e) => patch({ colLocked: locked.map((l, i) => i === ci ? e.target.checked : l) })} /> Locked</label>
                      : <span />}
                    {cols.length > 1 && <button type="button" onClick={() => removeColumn(ci)} title="Remove column" className="text-slate-500 hover:text-red-600 text-xs">✕</button>}
                  </div>
                </th>
              ))}
              <th className="w-8" />
            </tr>
          </thead>
          <tbody>
            {rows.map((r, ri) => (
              <tr key={ri} className="border-t border-slate-800">
                {cols.map((_, ci) => (
                  <td key={ci} className={`p-1 border-l border-slate-800 first:border-l-0 ${fill && !locked[ci] ? 'bg-coral-tint/30' : ''}`}>
                    <input value={r[ci] ?? ''} onChange={(e) => setCell(ri, ci, e.target.value)} className={cell} placeholder={fill && !locked[ci] ? 'Project fills in' : ''} />
                  </td>
                ))}
                <td className="text-center"><button type="button" onClick={() => removeRow(ri)} title="Remove row" className="text-slate-500 hover:text-red-600 text-xs">✕</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center gap-4 flex-wrap">
        <button type="button" onClick={addRow} className={small}>+ Add row</button>
        <button type="button" onClick={addColumn} className={small}>+ Add column</button>
        {fill && (
          <label className="flex items-center gap-1.5 text-xs text-slate-400 ml-auto">
            <input type="checkbox" checked={b.allowAddRows !== false} onChange={(e) => patch({ allowAddRows: e.target.checked })} />
            Project team can add rows
          </label>
        )}
      </div>
    </div>
  )
}

export default function DocumentEditor({ blocks, onChange }: { blocks: DocBlock[]; onChange: (b: DocBlock[]) => void }) {
  const [active, setActive] = useState<string | null>(null)
  const [focusId, setFocusId] = useState<string | null>(null)

  const patch = (id: string, p: Partial<DocBlock>) => onChange(blocks.map((b) => b.id === id ? { ...b, ...p } : b))
  const remove = (id: string) => onChange(blocks.filter((b) => b.id !== id))
  const move = (id: string, d: -1 | 1) => {
    const i = blocks.findIndex((b) => b.id === id), j = i + d
    if (j < 0 || j >= blocks.length) return
    const next = [...blocks]; [next[i], next[j]] = [next[j], next[i]]
    onChange(next)
  }
  const insert = (b: DocBlock) => {
    const i = active ? blocks.findIndex((x) => x.id === active) : -1
    const next = [...blocks]
    next.splice(i >= 0 ? i + 1 : next.length, 0, b)
    onChange(next); setActive(b.id); setFocusId(b.id)
  }
  const setStyle = (b: DocBlock, st: Style) =>
    patch(b.id, st === 'p' ? { type: 'paragraph', level: undefined } : { type: 'heading', level: Number(st[1]) as 1 | 2 | 3 })

  const tool = 'px-3.5 py-1.5 rounded-full text-sm font-medium transition-colors'
  const ctl = 'w-7 h-7 flex items-center justify-center rounded-full text-slate-500 hover:text-ink hover:bg-slate-800 disabled:opacity-30'

  return (
    <div className="bg-slate-800 rounded-3xl p-4 sm:p-5">
      {/* Toolbar */}
      <div className="sticky top-0 z-10 flex items-center gap-2 flex-wrap bg-white border border-slate-700 rounded-full px-3 py-2 mb-4 shadow-float">
        <span className="text-xs font-semibold text-slate-500 mr-1 pl-1">Insert</span>
        <button type="button" onClick={() => insert({ id: newBlockId(), type: 'heading', level: 2, text: '' })} className={`${tool} bg-slate-800 hover:bg-slate-700 text-slate-200`}>Heading</button>
        <button type="button" onClick={() => insert({ id: newBlockId(), type: 'paragraph', text: '' })} className={`${tool} bg-slate-800 hover:bg-slate-700 text-slate-200`}>Paragraph</button>
        <button type="button" onClick={() => insert(newTable())} className={`${tool} bg-slate-800 hover:bg-slate-700 text-slate-200`}>Table</button>
        <button type="button" onClick={() => insert({ id: newBlockId(), type: 'field', label: '', fieldType: 'text', hint: '' })} className={`${tool} bg-coral-tint text-coral-dark hover:bg-coral/20`}>+ Project field</button>
        <span className="text-xs text-slate-500 ml-auto pr-2 hidden md:inline">New items go below the one you're editing. Headings and paragraphs are locked for project teams.</span>
      </div>

      {/* Page */}
      <div className="mx-auto max-w-[794px] bg-white border border-slate-700 shadow-float rounded-md px-10 sm:px-14 py-10 min-h-[420px] text-ink">
        {blocks.length === 0 && <p className="text-sm text-slate-500">Empty document — use Insert above to add a heading, paragraph or project field.</p>}
        {blocks.map((b, i) => (
          <div key={b.id} onFocusCapture={() => setActive(b.id)}
            className={`group relative -mx-4 px-4 py-1 rounded-xl border ${active === b.id ? 'border-slate-700 bg-slate-900/60' : 'border-transparent hover:border-slate-800'}`}>
            {/* Hover controls */}
            <div className={`absolute -top-3 right-2 z-[1] flex items-center gap-0.5 bg-white border border-slate-700 rounded-full px-1 py-0.5 shadow-sm ${active === b.id ? 'flex' : 'hidden group-hover:flex'}`}>
              {b.type !== 'field' && b.type !== 'table' && (
                <select value={styleOf(b)} onChange={(e) => setStyle(b, e.target.value as Style)}
                  className="text-xs bg-transparent text-slate-300 focus:outline-none cursor-pointer pl-1">
                  <option value="h1">Heading 1</option><option value="h2">Heading 2</option><option value="h3">Heading 3</option><option value="p">Paragraph</option>
                </select>
              )}
              {b.type === 'field' && <span className="text-xs text-coral-dark font-semibold px-2">Project field</span>}
              {b.type === 'table' && <span className="text-xs text-slate-300 font-semibold px-2">Table</span>}
              <button type="button" className={ctl} disabled={i === 0} onClick={() => move(b.id, -1)} title="Move up">↑</button>
              <button type="button" className={ctl} disabled={i === blocks.length - 1} onClick={() => move(b.id, 1)} title="Move down">↓</button>
              <button type="button" className={ctl} onClick={() => remove(b.id)} title="Delete">✕</button>
            </div>

            {b.type === 'table' ? (
              <TableEditor b={b} patch={(p) => patch(b.id, p)} autoFocus={focusId === b.id} />
            ) : b.type === 'field' ? (
              <div className="my-1.5 space-y-2">
                <div className="flex gap-2 flex-wrap">
                  <input value={b.label ?? ''} autoFocus={focusId === b.id} onChange={(e) => patch(b.id, { label: e.target.value })}
                    placeholder="Field label (e.g. Project name)" className="flex-1 min-w-[180px] bg-white border border-slate-700 rounded-lg px-3 py-1.5 text-sm font-semibold focus:outline-none focus:border-coral" />
                  <select value={b.fieldType ?? 'text'} onChange={(e) => patch(b.id, { fieldType: e.target.value as DocBlock['fieldType'] })}
                    className="bg-white border border-slate-700 rounded-lg px-2 py-1.5 text-sm text-slate-300 focus:outline-none">
                    <option value="text">Short answer</option><option value="long">Long answer</option><option value="date">Date</option>
                  </select>
                </div>
                <input value={b.hint ?? ''} onChange={(e) => patch(b.id, { hint: e.target.value })} placeholder="Guidance for the project team (optional)"
                  className="w-full bg-white border border-slate-700 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-coral" />
                <div className={`rounded-lg bg-coral-tint/40 border border-dashed border-coral/60 px-3 py-2 text-sm text-slate-500 italic ${b.fieldType === 'long' ? 'min-h-[72px]' : ''}`}>
                  {b.hint || 'Project team fills this in'}
                </div>
              </div>
            ) : (
              <AutoTextarea value={b.text ?? ''} onChange={(v) => patch(b.id, { text: v })} autoFocus={focusId === b.id}
                placeholder={b.type === 'heading' ? 'Heading' : 'Write fixed text here…'}
                className={`${TEXT_CLASS[styleOf(b)]} ${b.type === 'heading' ? 'mt-3' : ''}`} />
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
