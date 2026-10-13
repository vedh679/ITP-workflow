import type { DocBlock } from './types'

export const newBlockId = () => `blk-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`

/** Plain-text form of a structured document — used for search, version diffs and legacy views */
export function blocksToText(blocks: DocBlock[]): string {
  return blocks.map((b) => {
    if (b.type === 'field') return `[Project to complete: ${b.label || 'untitled field'}]`
    return b.text ?? ''
  }).join('\n')
}

/** Turn an old plain-text document into blocks (one paragraph per line) so it can be edited as a document */
export function contentToBlocks(content: string): DocBlock[] {
  const lines = content.split('\n')
  const blocks = lines.map((text): DocBlock => ({ id: newBlockId(), type: 'paragraph', text }))
  return blocks.length ? blocks : [{ id: newBlockId(), type: 'paragraph', text: '' }]
}

export const field = (label: string, fieldType: DocBlock['fieldType'] = 'text', hint = ''): DocBlock =>
  ({ id: newBlockId(), type: 'field', label, fieldType, hint })
export const heading = (text: string, level: 1 | 2 | 3 = 2): DocBlock => ({ id: newBlockId(), type: 'heading', text, level })
export const para = (text: string): DocBlock => ({ id: newBlockId(), type: 'paragraph', text })
