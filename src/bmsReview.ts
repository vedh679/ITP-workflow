import type { BmsDocument } from './types'

// Controlled documents are reviewed on a cycle. Publishing a version counts as a review;
// after that the next review is due `reviewIntervalMonths` later.
export const DEFAULT_REVIEW_MONTHS = 12
const SOON_DAYS = 30

export type ReviewState = 'ok' | 'due-soon' | 'overdue' | 'draft'

export function nextReviewDue(doc: BmsDocument): Date | null {
  if (doc.status === 'draft') return null
  const base = new Date(doc.lastReviewedAt ?? doc.publishedAt ?? doc.updatedAt)
  const due = new Date(base)
  due.setMonth(due.getMonth() + (doc.reviewIntervalMonths ?? DEFAULT_REVIEW_MONTHS))
  return due
}

export function reviewState(doc: BmsDocument, now = new Date()): ReviewState {
  const due = nextReviewDue(doc)
  if (!due) return 'draft'
  const days = (due.getTime() - now.getTime()) / 86_400_000
  return days < 0 ? 'overdue' : days <= SOON_DAYS ? 'due-soon' : 'ok'
}

/** Published documents that are overdue or due within a month */
export const reviewsDue = (docs: BmsDocument[]) => docs.filter((d) => ['overdue', 'due-soon'].includes(reviewState(d)))

export const fmtDate = (d: Date | null) => d ? d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : '—'
