import type { BmsDocument, BmsCategory, ProjectDocument, ChecklistAttachment, DocBlock } from './types'

/** The categories of core document held in the BMS (checklist templates live separately) */
export const CORE_CATEGORIES: { key: BmsCategory; blurb: string }[] = [
  { key: 'Policy',    blurb: 'Company rules and commitments' },
  { key: 'Procedure', blurb: 'How work is carried out' },
  { key: 'Form',      blurb: 'Records to fill in on site' },
  { key: 'Template',  blurb: 'Reusable document layouts' },
  { key: 'Register',  blurb: 'Logs and controlled lists' },
  { key: 'Manual',    blurb: 'Top-level system manuals' },
]

// A project holds one version of each BMS core document. When the admin publishes
// a newer version (or a brand-new document), the project falls behind and its
// project manager is prompted to update.
export type DocStatus = 'current' | 'update' | 'new'

export interface DocVersion {
  version: string
  title: string
  docNumber: string
  content: string
  blocks?: DocBlock[]
  file?: ChecklistAttachment
  changeNote: string
  createdAt: string
}

/** Every version of a document, oldest first (archived revisions, then the current one) */
export function versionsOf(doc: BmsDocument): DocVersion[] {
  const past: DocVersion[] = (doc.revisions ?? []).map((r) => ({
    version: r.version, title: r.title, docNumber: r.docNumber, content: r.content, blocks: r.blocks, file: r.file, changeNote: r.changeNote, createdAt: r.createdAt,
  }))
  return [...past, {
    version: doc.version, title: doc.title, docNumber: doc.docNumber, content: doc.content, blocks: doc.blocks, file: doc.file,
    changeNote: doc.changeNote ?? '', createdAt: doc.updatedAt,
  }]
}

export function docStatus(doc: BmsDocument, record?: ProjectDocument): DocStatus {
  if (!record) return 'new'
  return record.adoptedVersion === doc.version ? 'current' : 'update'
}

/** Versions published after the one the project holds, newest first */
export function changesSince(doc: BmsDocument, adoptedVersion?: string): DocVersion[] {
  const all = versionsOf(doc)
  const idx = adoptedVersion ? all.findIndex((v) => v.version === adoptedVersion) : -1
  return (idx >= 0 ? all.slice(idx + 1) : all.slice(-1)).reverse()
}

export function recordFor(records: ProjectDocument[], projectId: string, docId: string) {
  return records.find((r) => r.projectId === projectId && r.bmsDocumentId === docId)
}

/** Documents in a project that are behind the latest BMS version (or not yet added) */
export function pendingDocs(projectId: string, docs: BmsDocument[], records: ProjectDocument[]) {
  return docs
    .map((doc) => ({ doc, status: docStatus(doc, recordFor(records, projectId, doc.id)) }))
    .filter((x) => x.status !== 'current')
}

/** "Policy" → "Policies", "Form" → "Forms" */
export function pluralCategory(c: string): string {
  return c.endsWith('y') ? `${c.slice(0, -1)}ies` : `${c}s`
}
