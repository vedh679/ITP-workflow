import type { ChecklistAttachment, Inspection, InspectionIssue, IssueChange, IssueHistoryEntry, AppUser, Task } from './types'

export const uid = (p: string) => `${p}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`

export const beforePhotos = (i: InspectionIssue): ChecklistAttachment[] => i.beforePhotos ?? i.photos ?? []
export const afterPhotos = (i: InspectionIssue): ChecklistAttachment[] => i.afterPhotos ?? []

export function historyEntry(by: string, action: IssueHistoryEntry['action'], summary: string, extra: Partial<IssueHistoryEntry> = {}): IssueHistoryEntry {
  return { id: uid('hist'), at: new Date().toISOString(), by, action, summary, ...extra }
}

/** Read image files, scaled down so they fit comfortably in browser storage */
export function readImages(files: FileList | File[] | null, maxSide = 1280): Promise<ChecklistAttachment[]> {
  const list = Array.from(files ?? []).filter((f) => f.type.startsWith('image/'))
  return Promise.all(list.map((f) => new Promise<ChecklistAttachment>((resolve) => {
    const fr = new FileReader()
    fr.onload = () => {
      const src = String(fr.result)
      const img = new Image()
      img.onload = () => {
        const scale = Math.min(1, maxSide / Math.max(img.width, img.height))
        const c = document.createElement('canvas')
        c.width = Math.round(img.width * scale); c.height = Math.round(img.height * scale)
        c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height)
        resolve({ id: uid('ph'), name: f.name, mimeType: 'image/jpeg', dataUrl: c.toDataURL('image/jpeg', 0.82) })
      }
      img.onerror = () => resolve({ id: uid('ph'), name: f.name, mimeType: f.type, dataUrl: src })
      img.src = src
    }
    fr.readAsDataURL(f)
  })))
}

/** Compare the editable fields of an issue and describe what changed */
export function diffIssue(before: InspectionIssue, after: InspectionIssue, nameOf: (email?: string) => string): IssueChange[] {
  const rows: [string, string, string][] = [
    ['Title', before.title, after.title],
    ['Description', before.description, after.description],
    ['Severity', before.severity, after.severity],
    ['Location', before.location ?? '', after.location ?? ''],
    ['Assigned to', nameOf(before.assignedTo), nameOf(after.assignedTo)],
    ['Due date', before.dueDate ?? '', after.dueDate ?? ''],
  ]
  return rows.filter(([, a, b]) => a !== b).map(([field, from, to]) => ({ field, from: from || '—', to: to || '—' }))
}

export function diffInspection(before: Inspection, after: Inspection, nameOf: (email?: string) => string): IssueChange[] {
  const rows: [string, string, string][] = [
    ['Type', before.type, after.type],
    ['Title', before.title, after.title],
    ['Date', before.date, after.date],
    ['Inspected by', nameOf(before.inspectedBy), nameOf(after.inspectedBy)],
    ['Location', before.location, after.location],
    ['Notes', before.notes, after.notes],
  ]
  return rows.filter(([, a, b]) => a !== b).map(([field, from, to]) => ({ field, from: from || '—', to: to || '—' }))
}

// ── Export ────────────────────────────────────────────────────────
const esc = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!))
const dt = (iso?: string) => iso ? new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : '—'
const d = (iso?: string) => iso ? new Date(iso.length === 10 ? iso + 'T00:00:00' : iso).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' }) : '—'

export function buildInspectionHtml(task: Task, insp: Inspection, members: AppUser[], exportedBy: string): string {
  const nameOf = (email?: string) => members.find((m) => m.email === email)?.name ?? email ?? '—'
  const open = insp.issues.filter((i) => i.status === 'open').length
  const prog = insp.issues.filter((i) => i.status === 'in-progress').length
  const closed = insp.issues.filter((i) => i.status === 'closed').length
  const photoRow = (label: string, photos: ChecklistAttachment[]) => photos.length === 0
    ? `<p class="muted"><strong>${label}:</strong> none</p>`
    : `<p class="label">${label}</p><div class="photos">${photos.map((p) => `<figure><img src="${p.dataUrl}"/><figcaption>${esc(p.name)}</figcaption></figure>`).join('')}</div>`

  const issues = insp.issues.map((i, n) => `
    <section class="issue">
      <h3>${n + 1}. ${esc(i.title)}</h3>
      <p><span class="chip sev-${i.severity}">${esc(i.severity)}</span> <span class="chip st-${i.status}">${esc(i.status)}</span></p>
      ${i.description ? `<p>${esc(i.description).replace(/\n/g, '<br/>')}</p>` : ''}
      <table class="meta">
        <tr><td>Location</td><td>${esc(i.location || '—')}</td><td>Assigned to</td><td>${esc(nameOf(i.assignedTo))}</td></tr>
        <tr><td>Due date</td><td>${esc(d(i.dueDate))}</td><td>Raised</td><td>${esc(i.raisedBy)} · ${esc(dt(i.raisedAt))}</td></tr>
        ${i.status === 'closed' ? `<tr><td>Closed</td><td>${esc(i.closedBy)} · ${esc(dt(i.closedAt))}</td><td>Resolution</td><td>${esc(i.closeNote || '—')}</td></tr>` : ''}
      </table>
      ${photoRow('Before', beforePhotos(i))}
      ${photoRow('After', afterPhotos(i))}
      <p class="label">Change history</p>
      <table class="hist">
        <tr><th>When</th><th>Who</th><th>What</th></tr>
        ${(i.history ?? []).map((h) => `<tr><td>${esc(dt(h.at))}</td><td>${esc(h.by)}</td><td>${esc(h.summary)}${(h.changes ?? []).map((c) => `<br/><span class="muted">${esc(c.field)}: ${esc(c.from)} → ${esc(c.to)}</span>`).join('')}${h.note ? `<br/><span class="muted">Note: ${esc(h.note)}</span>` : ''}${(h.photos ?? []).length ? `<div class="photos small">${h.photos!.map((p) => `<img src="${p.dataUrl}"/>`).join('')}</div>` : ''}</td></tr>`).join('') || '<tr><td colspan="3" class="muted">No history recorded.</td></tr>'}
      </table>
    </section>`).join('')

  return `<!doctype html><html><head><meta charset="utf-8"/><title>${esc(insp.title)} — inspection report</title><style>
    body{font-family:system-ui,-apple-system,sans-serif;color:#1e293b;padding:32px;max-width:860px;margin:0 auto;font-size:13px}
    h1{font-size:22px;margin:0 0 4px} h2{font-size:15px;margin:26px 0 8px;border-bottom:2px solid #e2e8f0;padding-bottom:6px} h3{font-size:14px;margin:0 0 6px}
    .muted{color:#64748b} .label{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:#475569;margin:10px 0 4px}
    table{border-collapse:collapse;width:100%;margin:6px 0} td,th{border:1px solid #e2e8f0;padding:5px 8px;text-align:left;vertical-align:top;font-size:12px}
    th{background:#f8fafc;font-size:11px;text-transform:uppercase;letter-spacing:.04em;color:#475569} .meta td:nth-child(odd){background:#f8fafc;font-weight:600;color:#475569;width:15%}
    .issue{border:1px solid #cbd5e1;border-radius:10px;padding:14px 16px;margin:14px 0;page-break-inside:avoid}
    .chip{display:inline-block;padding:2px 10px;border-radius:99px;font-size:11px;font-weight:700;text-transform:capitalize;background:#f1f5f9}
    .sev-major{background:#fef3c7;color:#92400e}.sev-critical{background:#fee2e2;color:#b91c1c}.st-closed{background:#dcfce7;color:#166534}.st-open{background:#fee2e2;color:#b91c1c}.st-in-progress{background:#fef3c7;color:#92400e}
    .photos{display:flex;gap:10px;flex-wrap:wrap} figure{margin:0} img{max-width:250px;max-height:190px;border-radius:8px;border:1px solid #e2e8f0} figcaption{font-size:10px;color:#64748b;margin-top:2px} .photos.small{margin-top:4px;gap:6px} .photos.small img{max-width:90px;max-height:70px}
    .summary{display:flex;gap:10px;margin:10px 0} .summary div{flex:1;border:1px solid #e2e8f0;border-radius:10px;padding:8px 12px} .summary b{display:block;font-size:20px}
    @media print{body{padding:0}}
  </style></head><body>
    <p class="muted" style="margin:0 0 6px;text-transform:uppercase;letter-spacing:.06em;font-size:11px">Inspection report · ${esc(insp.type)}</p>
    <h1>${esc(insp.title)}</h1>
    <p class="muted">Task: <strong>${esc(task.name)}</strong> · Status: <strong>${insp.status === 'completed' ? 'Completed' : 'Open'}</strong></p>
    <table class="meta">
      <tr><td>Date</td><td>${esc(d(insp.date))}</td><td>Inspected by</td><td>${esc(nameOf(insp.inspectedBy))}</td></tr>
      <tr><td>Location</td><td>${esc(insp.location || '—')}</td><td>Notes</td><td>${esc(insp.notes || '—')}</td></tr>
    </table>
    <div class="summary"><div><b>${insp.issues.length}</b>Issues / snags</div><div><b>${open}</b>Open</div><div><b>${prog}</b>In progress</div><div><b>${closed}</b>Closed</div></div>
    <h2>Issues / snags</h2>
    ${issues || '<p class="muted">No issues or snags were recorded for this inspection.</p>'}
    <h2>Inspection activity</h2>
    <table class="hist"><tr><th>When</th><th>Who</th><th>What</th></tr>
      ${(insp.log ?? []).map((l) => `<tr><td>${esc(dt(l.at))}</td><td>${esc(l.by)}</td><td>${esc(l.summary)}</td></tr>`).join('') || '<tr><td colspan="3" class="muted">No activity recorded.</td></tr>'}
    </table>
    <p class="muted" style="margin-top:24px;font-size:11px">Exported ${esc(dt(new Date().toISOString()))} by ${esc(exportedBy)}</p>
  </body></html>`
}

export function exportInspection(task: Task, insp: Inspection, members: AppUser[], exportedBy: string) {
  const win = window.open('', '_blank')
  if (!win) { window.alert('Allow pop-ups for this site to export the inspection.'); return }
  win.document.write(buildInspectionHtml(task, insp, members, exportedBy))
  win.document.close()
  win.focus()
  // wait for the photos to render before printing
  setTimeout(() => win.print(), 600)
}
