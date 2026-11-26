import type { DocBlock } from './types'

// Comparing two versions of a template, block by block, and carrying a project document's content across.

export type BlockChange = 'same' | 'new' | 'changed' | 'removed'

export interface MergedBlock {
  block: DocBlock
  change: BlockChange
  before?: DocBlock      // the block as it was in the old version (changed / removed)
}

/** What makes two blocks "the same" — everything the admin can edit */
const fingerprint = (b: DocBlock) => JSON.stringify([b.type, b.text, b.level, b.label, b.hint, b.fieldType, b.columns, b.rows, b.tableMode, b.colLocked, b.allowAddRows])

/**
 * Lay the new version out in order, marking each block new / changed / unchanged by its id,
 * and slot blocks that were removed back in where they used to be.
 */
export function mergeBlocks(oldBlocks: DocBlock[], newBlocks: DocBlock[]): MergedBlock[] {
  const oldById = new Map(oldBlocks.map((b) => [b.id, b]))
  const newIds = new Set(newBlocks.map((b) => b.id))

  const merged: MergedBlock[] = []
  // removed blocks keyed by the old block they followed (or '' for the start)
  const removedAfter = new Map<string, DocBlock[]>()
  let prevKept = ''
  for (const ob of oldBlocks) {
    if (newIds.has(ob.id)) { prevKept = ob.id } else removedAfter.set(prevKept, [...(removedAfter.get(prevKept) ?? []), ob])
  }
  const pushRemoved = (key: string) => (removedAfter.get(key) ?? []).forEach((b) => merged.push({ block: b, change: 'removed', before: b }))

  pushRemoved('')
  for (const nb of newBlocks) {
    const ob = oldById.get(nb.id)
    merged.push(!ob ? { block: nb, change: 'new' } : fingerprint(ob) === fingerprint(nb) ? { block: nb, change: 'same' } : { block: nb, change: 'changed', before: ob })
    if (ob) pushRemoved(nb.id)
  }
  return merged
}

function parseRows(raw: string | undefined, cols: number): string[][] | null {
  if (!raw) return null
  try { return (JSON.parse(raw) as string[][]).map((r) => Array.from({ length: cols }, (_, i) => r[i] ?? '')) } catch { return null }
}

/** For each column of the new table, which old column its entries come from (-1 for a new column) */
function columnMap(oldCols: string[], newCols: string[]): number[] {
  return newCols.map((name, i) => {
    const same = oldCols.indexOf(name)
    if (same >= 0) return same
    // same number of columns and the old heading at this position is gone: it was renamed
    return oldCols.length === newCols.length && !newCols.includes(oldCols[i]) ? i : -1
  })
}

const isDate = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v)

/**
 * Carry what a project has entered into the new version of the template.
 * Fields keep their entries when the block still exists. A fill-in table keeps the team's rows, matched column by
 * column on the headings; locked template cells take the new wording, and rows the admin added to the template
 * are slotted in after the rows it already had (before any rows the team added).
 */
export function carryValues(oldBlocks: DocBlock[], newBlocks: DocBlock[], values: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {}
  for (const nb of newBlocks) {
    const ob = oldBlocks.find((b) => b.id === nb.id)
    if (nb.type === 'field' && values[nb.id] !== undefined && (nb.fieldType !== 'date' || !values[nb.id] || isDate(values[nb.id]))) out[nb.id] = values[nb.id]
    if (nb.type === 'table' && nb.tableMode === 'fill') {
      const newCols = nb.columns ?? []
      const oldCols = ob?.columns ?? newCols
      const stored = parseRows(values[nb.id], oldCols.length)
      if (!stored) continue
      const map = columnMap(oldCols, newCols)
      const oldBase = ob?.rows?.length ?? 0
      const newBase = (nb.rows ?? []).map((r) => Array.from({ length: newCols.length }, (_, i) => r[i] ?? ''))
      const moved = stored.map((row, ri) => newCols.map((_, ci) => {
        const templateOwned = ri < oldBase && ri < newBase.length && !!nb.colLocked?.[ci]
        if (templateOwned) return newBase[ri][ci]
        return map[ci] >= 0 ? row[map[ci]] : (ri < oldBase ? newBase[ri]?.[ci] ?? '' : '')
      }))
      out[nb.id] = JSON.stringify([...moved.slice(0, oldBase), ...newBase.slice(oldBase), ...moved.slice(oldBase)])
    }
  }
  return out
}

/** Entries that can't come across even though their field or table is still there */
export function lossWarnings(oldBlocks: DocBlock[], newBlocks: DocBlock[], values: Record<string, string>): string[] {
  const warnings: string[] = []
  for (const nb of newBlocks) {
    const ob = oldBlocks.find((b) => b.id === nb.id)
    const value = values[nb.id]
    if (!ob || !value) continue
    if (nb.type === 'field' && nb.fieldType === 'date' && !isDate(value)) warnings.push(`"${nb.label}" is now a date, so "${value}" can't be carried over. Enter the date again.`)
    if (nb.type === 'table' && ob.tableMode === 'fill') {
      const name = nb.label || 'A table'
      if (nb.tableMode !== 'fill') { warnings.push(`${name} is no longer filled in by the project, so its entries won't carry over.`); continue }
      const oldCols = ob.columns ?? []
      const kept = new Set(columnMap(oldCols, nb.columns ?? []))
      const rows = parseRows(value, oldCols.length) ?? []
      oldCols.forEach((col, ci) => {
        if (!kept.has(ci) && rows.some((r, ri) => r[ci] && r[ci] !== (ob.rows?.[ri]?.[ci] ?? ''))) warnings.push(`${name}: the column "${col}" was removed, so what was entered in it won't carry over.`)
      })
    }
  }
  return warnings
}

/** Entries that will be left behind because the field or table they belong to was removed from the template */
export function droppedEntries(oldBlocks: DocBlock[], newBlocks: DocBlock[], values: Record<string, string>): DocBlock[] {
  const newIds = new Set(newBlocks.map((b) => b.id))
  return oldBlocks.filter((b) => !newIds.has(b.id) && (b.type === 'field' || (b.type === 'table' && b.tableMode === 'fill')) && !!values[b.id])
}
