import type { ReactNode } from 'react'
import type { DocBlock } from '../types'

// When a project document is being updated to a new template version, blocks are coloured by what happened to them
export type AnnotationKind = 'new' | 'changed' | 'removed' | 'existing' | 'dim'
export interface Annotation { kind: AnnotationKind; before?: DocBlock }

export const TONES: Record<Exclude<AnnotationKind, 'dim'>, { border: string; bg: string; solid: string; label: string; meaning: string }> = {
  existing: { border: '#3B6FD4', bg: '#EEF4FF', solid: '#3B6FD4', label: 'EXISTING', meaning: 'Your existing entries, carried over' },
  new:      { border: '#16A34A', bg: '#F0FDF4', solid: '#16A34A', label: 'NEW',      meaning: 'New in the template' },
  changed:  { border: '#D97706', bg: '#FFFBEB', solid: '#D97706', label: 'CHANGED',  meaning: 'Changed in the template' },
  removed:  { border: '#E5484D', bg: '#FEF2F2', solid: '#E5484D', label: 'REMOVED',  meaning: 'Removed from the template' },
}

interface Props {
  title: string
  meta?: string
  blocks: DocBlock[]
  /** field values entered by the project team, by block id */
  values?: Record<string, string>
  /** when set, fields are fillable; headings and paragraphs always stay locked */
  onChange?: (blockId: string, value: string) => void
  /** shown as the paper behind the page */
  compact?: boolean
  /** colour blocks by what changed (used when updating to a new template version) */
  annotate?: Record<string, Annotation>
}

// A fill-in table stores what the project team entered as JSON (rows of cells) under the block's id
function parseRows(raw: string | undefined, cols: number): string[][] | null {
  if (!raw) return null
  try {
    const data = JSON.parse(raw) as string[][]
    return data.map((r) => Array.from({ length: cols }, (_, i) => r[i] ?? ''))
  } catch { return null }
}

const HEADING = {
  1: 'text-2xl font-bold mt-6 mb-2',
  2: 'text-lg font-semibold mt-5 mb-1.5',
  3: 'text-base font-semibold mt-4 mb-1',
} as const

/** A short description of a block as it used to be, for "was: …" lines */
function describe(b: DocBlock): string {
  if (b.type === 'heading' || b.type === 'paragraph') return b.text ?? ''
  if (b.type === 'field') return `${b.label ?? ''}${b.hint ? ` — ${b.hint}` : ''}`
  return `${b.label ? `${b.label}: ` : ''}${(b.columns ?? []).join(' | ')} (${(b.rows ?? []).length} row${(b.rows ?? []).length === 1 ? '' : 's'})`
}

function Annotated({ ann, children }: { ann: Annotation; children: ReactNode }) {
  if (ann.kind === 'dim') return <div className="opacity-35">{children}</div>
  const tone = TONES[ann.kind]
  return (
    <div className="relative my-2 rounded-lg pl-4 pr-3 py-2" style={{ borderLeft: `4px solid ${tone.border}`, background: tone.bg }}>
      <span className="absolute -top-2 right-2 text-[9px] font-bold tracking-wider text-white px-2 py-0.5 rounded-full" style={{ background: tone.solid }}>{tone.label}</span>
      {ann.kind === 'changed' && ann.before && (
        <p className="text-xs mb-1" style={{ color: '#B45309' }}>Was: <span className="line-through">{describe(ann.before) || '(empty)'}</span></p>
      )}
      <div className={ann.kind === 'removed' ? 'line-through opacity-60' : ''}>{children}</div>
    </div>
  )
}

// A document laid out like a page. Text is fixed; fields are the spaces the project team completes.
export default function DocumentView({ title, meta, blocks, values = {}, onChange, compact, annotate }: Props) {
  const renderBlock = (b: DocBlock, fillable: boolean): ReactNode => {
    if (b.type === 'heading') {
      const lvl = b.level ?? 2
      return <div key={b.id} className={HEADING[lvl]}>{b.text}</div>
    }
    if (b.type === 'paragraph') {
      return <p key={b.id} className="text-[15px] leading-7 text-slate-200 whitespace-pre-wrap min-h-[1.75rem]">{b.text}</p>
    }
    if (b.type === 'table') {
      const ann = annotate?.[b.id]
      const cols = b.columns ?? []
      const base = (b.rows ?? []).map((r) => Array.from({ length: cols.length }, (_, i) => r[i] ?? ''))
      const fixed = b.tableMode !== 'fill'
      const rows = fixed ? base : (parseRows(values[b.id], cols.length) ?? base)
      const editable = fillable && !fixed
      // a column the admin locked stays fixed for the rows they set up; rows the team adds are fully editable
      const locked = (ci: number, ri: number) => fixed || (!!b.colLocked?.[ci] && ri < base.length)
      const canAdd = editable && b.allowAddRows !== false
      const save = (next: string[][]) => onChange?.(b.id, JSON.stringify(next))
      const cellBox = 'w-full bg-coral-tint/40 px-2 py-1.5 text-sm text-ink focus:outline-none focus:bg-coral-tint/70'
      // While updating: colour cells by what changed (new rows green, edited template text amber, existing entries blue)
      const oldBase = ann?.before?.rows
      const tone = (ri: number, ci: number, cell: string): string | undefined => {
        if (!ann || ann.kind === 'removed' || ann.kind === 'dim') return undefined
        if (ann.kind === 'new') return TONES.new.bg
        if (oldBase && ri >= oldBase.length && ri < base.length) return TONES.new.bg
        if (oldBase && locked(ci, ri) && ri < oldBase.length && (oldBase[ri]?.[ci] ?? '') !== cell) return TONES.changed.bg
        if (!locked(ci, ri) && cell && ri >= 0) return TONES.existing.bg
        return undefined
      }
      return (
        <div key={b.id} className="my-4">
          {(b.label || !fixed) && (
            <p className="text-xs font-semibold text-slate-400 mb-1">
              {b.label}{!fixed && <span className="font-normal text-coral-dark">{b.label ? ' · ' : ''}completed by the project team</span>}
            </p>
          )}
          <div className="overflow-x-auto rounded-lg border border-slate-700">
            <table className="w-full border-collapse text-sm">
              <thead className="bg-slate-800">
                <tr>
                  {cols.map((h, ci) => <th key={ci} className="px-3 py-2 text-left text-xs font-bold text-slate-300 border-b border-slate-700 border-l first:border-l-0">{h}</th>)}
                  {canAdd && <th className="w-8 border-b border-slate-700" />}
                </tr>
              </thead>
              <tbody>
                {rows.map((r, ri) => (
                  <tr key={ri} className="border-t border-slate-800">
                    {r.map((cell, ci) => {
                      const bg = tone(ri, ci, cell)
                      return (
                        <td key={ci} className="border-l border-slate-800 first:border-l-0 p-0 align-top" style={bg ? { background: bg } : undefined}>
                          {editable && !locked(ci, ri)
                            ? <input className={bg ? 'w-full bg-transparent px-2 py-1.5 text-sm text-ink focus:outline-none focus:bg-white/60' : cellBox} value={cell} onChange={(e) => save(rows.map((rr, i) => i === ri ? rr.map((c, j) => j === ci ? e.target.value : c) : rr))} />
                            : <div className={`px-3 py-1.5 whitespace-pre-wrap ${!bg && !fixed && !locked(ci, ri) && !cell ? 'text-slate-500 italic bg-coral-tint/30' : 'text-slate-200'}`}>{cell || (!fixed && !locked(ci, ri) ? '—' : '')}</div>}
                        </td>
                      )
                    })}
                    {canAdd && (
                      <td className="w-8 text-center border-l border-slate-800">
                        {ri >= base.length && <button type="button" title="Remove this row" onClick={() => save(rows.filter((_, i) => i !== ri))} className="text-slate-500 hover:text-red-600 text-xs">✕</button>}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {canAdd && (
            <button type="button" onClick={() => save([...rows, Array.from({ length: cols.length }, () => '')])}
              className="mt-2 text-sm font-semibold text-coral-dark hover:underline">+ Add row</button>
          )}
        </div>
      )
    }
    const value = values[b.id] ?? ''
    const box = 'w-full rounded-lg bg-coral-tint/40 border border-dashed border-coral/60 px-3 py-2 text-[15px] text-ink placeholder-slate-500 focus:outline-none focus:border-coral focus:bg-coral-tint/60'
    return (
      <div key={b.id} className="my-3">
        <label className="block text-xs font-semibold text-coral-dark mb-1">
          {b.label || 'Untitled field'} <span className="font-normal text-slate-500">· completed by the project team</span>
        </label>
        {fillable ? (
          b.fieldType === 'long'
            ? <textarea className={`${box} min-h-[96px]`} value={value} placeholder={b.hint || 'Enter details…'} onChange={(e) => onChange!(b.id, e.target.value)} />
            : <input type={b.fieldType === 'date' ? 'date' : 'text'} className={box} value={value} placeholder={b.hint || 'Enter details…'} onChange={(e) => onChange!(b.id, e.target.value)} />
        ) : (
          <div className={`${box} ${b.fieldType === 'long' ? 'min-h-[72px]' : ''} whitespace-pre-wrap ${value ? '' : 'text-slate-500 italic'}`}>
            {value || b.hint || 'To be completed by the project team'}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className={`bg-slate-800 rounded-3xl ${compact ? 'p-3' : 'p-5 sm:p-6'}`}>
      <article className={`mx-auto max-w-[794px] bg-white border border-slate-700 shadow-float rounded-md ${compact ? 'px-8 py-7' : 'px-10 sm:px-14 py-10 sm:py-12'} text-ink`}>
        <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
        {meta && <p className="text-xs text-slate-500 mt-1.5 pb-4 mb-2 border-b border-slate-700">{meta}</p>}

        {blocks.length === 0 && <p className="text-sm text-slate-500 mt-4">This document has no content yet.</p>}
        {blocks.map((b) => {
          const ann = annotate?.[b.id]
          const el = renderBlock(b, !!onChange && ann?.kind !== 'removed')
          return ann ? <Annotated key={b.id} ann={ann}>{el}</Annotated> : el
        })}
      </article>
    </div>
  )
}
