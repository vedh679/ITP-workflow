import type { DocBlock } from '../types'

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
}

const HEADING = {
  1: 'text-2xl font-bold mt-6 mb-2',
  2: 'text-lg font-semibold mt-5 mb-1.5',
  3: 'text-base font-semibold mt-4 mb-1',
} as const

// A document laid out like a page. Text is fixed; fields are the spaces the project team completes.
export default function DocumentView({ title, meta, blocks, values = {}, onChange, compact }: Props) {
  const fillable = !!onChange
  return (
    <div className={`bg-slate-800 rounded-3xl ${compact ? 'p-3' : 'p-5 sm:p-6'}`}>
      <article className={`mx-auto max-w-[794px] bg-white border border-slate-700 shadow-float rounded-md ${compact ? 'px-8 py-7' : 'px-10 sm:px-14 py-10 sm:py-12'} text-ink`}>
        <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
        {meta && <p className="text-xs text-slate-500 mt-1.5 pb-4 mb-2 border-b border-slate-700">{meta}</p>}

        {blocks.length === 0 && <p className="text-sm text-slate-500 mt-4">This document has no content yet.</p>}
        {blocks.map((b) => {
          if (b.type === 'heading') {
            const lvl = b.level ?? 2
            return <div key={b.id} className={HEADING[lvl]}>{b.text}</div>
          }
          if (b.type === 'paragraph') {
            return <p key={b.id} className="text-[15px] leading-7 text-slate-200 whitespace-pre-wrap min-h-[1.75rem]">{b.text}</p>
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
        })}
      </article>
    </div>
  )
}
