import type { BmsDocument, BmsCategory, ProjectDocument, ChecklistAttachment, DocBlock, TaskItp } from './types'

/** The categories of core document held in the BMS (checklist templates live separately) */
export const CORE_CATEGORIES: { key: BmsCategory; blurb: string }[] = [
  { key: 'Policy',    blurb: 'Company rules and commitments' },
  { key: 'Procedure', blurb: 'How work is carried out' },
  { key: 'Form',      blurb: 'Records to fill in on site' },
  { key: 'Template',  blurb: 'Reusable document layouts' },
  { key: 'Register',  blurb: 'Logs and controlled lists' },
  { key: 'Manual',    blurb: 'Top-level system manuals' },
]

// The BMS library holds the templates (and every version of each). A project pulls a template in
// to create its own document, which it fills in and keeps in its document register. The document
// remembers its template version, and the project manager is prompted when the template moves on.
export type DocStatus = 'current' | 'update'

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

export function docStatus(template: BmsDocument, doc: ProjectDocument): DocStatus {
  return doc.adoptedVersion === template.version ? 'current' : 'update'
}

/** Versions published after the one the document is on, newest first */
export function changesSince(template: BmsDocument, adoptedVersion?: string): DocVersion[] {
  const all = versionsOf(template)
  const idx = adoptedVersion ? all.findIndex((v) => v.version === adoptedVersion) : -1
  return (idx >= 0 ? all.slice(idx + 1) : all.slice(-1)).reverse()
}

/** Only published documents are available to projects; drafts stay in the library */
export const publishedDocs = (docs: BmsDocument[]) => docs.filter((d) => d.status !== 'draft')

/** Library templates a project can pull in (checklist templates live separately) */
export const libraryTemplates = (docs: BmsDocument[]) => publishedDocs(docs)

/** A new ITP's own document, started from a BMS template */
export const itpFromTemplate = (t: BmsDocument): TaskItp => ({
  templateId: t.id, templateRef: t.docNumber, templateTitle: t.title, templateVersion: t.version,
  blocks: JSON.parse(JSON.stringify(t.blocks ?? [])), fieldValues: {},
})

/** The ITP document template in the BMS library */
export const itpTemplate = (docs: BmsDocument[]) =>
  libraryTemplates(docs).find((t) => t.docNumber === 'BMS-TP-010') ?? libraryTemplates(docs).find((t) => t.category === 'Template' && /inspection.*test plan/i.test(t.title))

export const isActive = (d: ProjectDocument) => d.status !== 'archived'

export const projectDocsOf = (records: ProjectDocument[], projectId: string) => records.filter((r) => r.projectId === projectId && isActive(r))

/** Project documents whose template has a newer published version */
export function pendingDocs(projectId: string, templates: BmsDocument[], records: ProjectDocument[]) {
  return projectDocsOf(records, projectId)
    .map((instance) => ({ instance, template: templates.find((t) => t.id === instance.bmsDocumentId) }))
    .filter((x): x is { instance: ProjectDocument; template: BmsDocument } => !!x.template && x.template.status !== 'draft' && docStatus(x.template, x.instance) === 'update')
    .map((x) => ({ ...x, status: 'update' as const }))
}

// ── Review: each project document is reviewed 12 months after its last edit ──
export const REGISTER_REVIEW_MONTHS = 12
const SOON_DAYS = 30

/** The date the 12-month period runs from: the last edit, or a review that confirmed no changes were needed */
export function reviewBase(d: ProjectDocument): Date {
  const times = [d.lastEditedAt, d.lastReviewedAt, d.createdAt, d.adoptedAt].filter(Boolean).map((t) => new Date(t as string).getTime())
  return new Date(Math.max(...times))
}

export function nextReviewDate(d: ProjectDocument): Date {
  const due = reviewBase(d)
  due.setMonth(due.getMonth() + REGISTER_REVIEW_MONTHS)
  return due
}

export type RegisterReviewState = 'ok' | 'due-soon' | 'overdue'

export function registerReviewState(d: ProjectDocument, now = new Date()): RegisterReviewState {
  const days = (nextReviewDate(d).getTime() - now.getTime()) / 86_400_000
  return days < 0 ? 'overdue' : days <= SOON_DAYS ? 'due-soon' : 'ok'
}

/** Active project documents whose review is overdue or due within a month */
export const reviewsDueIn = (projectId: string, records: ProjectDocument[]) =>
  projectDocsOf(records, projectId).filter((d) => registerReviewState(d) !== 'ok')

export const fmtDate = (d: Date) => d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })

/** Every project document made from a template, across projects */
export const usageOf = (templateId: string, records: ProjectDocument[]) => records.filter((r) => r.bmsDocumentId === templateId && isActive(r))

/** The next copy number for a template in a project (archived copies still count, so numbers never repeat) */
export const nextSequence = (records: ProjectDocument[], projectId: string, templateId: string) =>
  records.filter((r) => r.projectId === projectId && r.bmsDocumentId === templateId).reduce((n, r) => Math.max(n, r.sequence ?? 0), 0) + 1

export const seqLabel = (n: number) => `No. ${String(n).padStart(2, '0')}`

/** "Policy" → "Policies", "Form" → "Forms" */
export function pluralCategory(c: string): string {
  return c.endsWith('y') ? `${c.slice(0, -1)}ies` : `${c}s`
}
