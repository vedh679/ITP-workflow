import { useState } from 'react'
import DocumentView from './DocumentView'
import { versionsOf } from '../projectDocs'
import type { BmsDocument, ProjectDocument, ProjectDocSubmission } from '../types'

interface Props {
  instance: ProjectDocument
  submission: ProjectDocSubmission
  template?: BmsDocument
  title: string
  canApprove: boolean
  canWithdraw: boolean
  onApprove: () => void
  onReturn: (comment: string) => void
  onWithdraw: () => void
}

// A change waiting for approval: what it changes, the document as it would be issued, and the decision.
export default function SubmissionPanel({ instance, submission, template, title, canApprove, canWithdraw, onApprove, onReturn, onWithdraw }: Props) {
  const [comment, setComment] = useState('')
  const [show, setShow] = useState(false)
  const blocks = template ? versionsOf(template).find((v) => v.version === submission.toVersion)?.blocks : undefined
  // the library has moved on since this update was submitted, so it can no longer be issued as it is
  const overtaken = submission.kind === 'update' && !!template && template.version !== submission.toVersion

  const changed = (blocks ?? []).filter((b) => (b.type === 'field' || b.type === 'table') && (submission.values[b.id] ?? '') !== (instance.fieldValues?.[b.id] ?? ''))
  const btn = 'px-4 py-2 rounded-full text-sm font-semibold disabled:opacity-40 transition-colors'

  return (
    <div className="rounded-3xl bg-blue-50 border border-blue-100 px-5 py-4 space-y-3">
      <div>
        <p className="text-sm font-semibold text-ink">Awaiting approval — {submission.kind === 'update' ? `adopt library v${submission.toVersion}` : 'edited project details'}</p>
        <p className="text-xs text-slate-400">Submitted by {submission.by} on {new Date(submission.at).toLocaleString()}. Revision {instance.revision ?? 1} stays current until this is approved.</p>
        {submission.note && <p className="text-sm text-slate-300 mt-1">Note: {submission.note}</p>}
      </div>
      {changed.length > 0 && (
        <ul className="text-sm text-slate-300 space-y-0.5">
          {changed.map((b) => (
            <li key={b.id}><span className="font-semibold text-ink">{b.label || 'Table'}</span>{b.type === 'field'
              ? <>: <span className="line-through text-slate-500">{instance.fieldValues?.[b.id] || '(empty)'}</span> → {submission.values[b.id] || '(empty)'}</>
              : ': table entries changed'}</li>
          ))}
        </ul>
      )}
      {blocks && <button onClick={() => setShow((v) => !v)} className="text-sm font-semibold text-coral-dark hover:underline">{show ? 'Hide' : 'View'} the document as submitted</button>}
      {show && blocks && <DocumentView compact title={title} meta={`Submitted for approval · template v${submission.toVersion}`} blocks={blocks} values={submission.values} />}
      {overtaken && <p className="text-sm text-red-600">The library now has v{template!.version}. Return or withdraw this so it can be updated to the newer version.</p>}
      {canApprove && (
        <textarea rows={2} value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Comments (needed if you return it)"
          className="w-full bg-white border border-slate-700 rounded-2xl px-3 py-2 text-sm text-ink placeholder-slate-500 focus:outline-none focus:border-ink resize-none" />
      )}
      <div className="flex gap-2 flex-wrap">
        {canApprove && <>
          <button onClick={onApprove} disabled={overtaken} className={`${btn} bg-ink hover:bg-ink-soft text-white`}>Approve &amp; issue</button>
          <button onClick={() => onReturn(comment.trim())} disabled={!comment.trim()} className={`${btn} bg-white border border-slate-700 text-slate-200`}>Return with comments</button>
        </>}
        {canWithdraw && <button onClick={onWithdraw} className={`${btn} text-slate-400 hover:text-ink`}>Withdraw</button>}
        {!canApprove && <span className="text-xs text-slate-500 self-center">Waiting for someone with "Approve &amp; issue".</span>}
      </div>
    </div>
  )
}
