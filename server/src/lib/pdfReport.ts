import PDFDocument from 'pdfkit'
import {
  CandidateReportRow, paymentLabel, paymentAmountRupees, docStatusDetail,
  documentsSubmittedText, documentsMissingText, preferredLocations,
  jobPosition, applicationIdLabel, ReportFilters, DOC_LABELS,
} from './reports'
import { STATUS_LABEL } from './statusLabels'
import { REQUIRED_DOCS, OPTIONAL_DOCS } from './applicationStatus'

const BRAND_COLOR = '#F7A607'
const DARK        = '#1a1d1f'

function collectPdfBuffer(doc: PDFKit.PDFDocument): Promise<Buffer> {
  const chunks: Buffer[] = []
  doc.on('data', (c: Buffer) => chunks.push(c))
  return new Promise((resolve, reject) => {
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)
  })
}

function drawHeader(doc: PDFKit.PDFDocument, title: string) {
  doc.fillColor(DARK).fontSize(16).font('Helvetica-Bold')
    .text('Ex-Serviceman Jobs', doc.page.margins.left, doc.page.margins.top)
  doc.fillColor(BRAND_COLOR).fontSize(11).font('Helvetica')
    .text(title, doc.page.margins.left, doc.y + 2)
  doc.moveDown(0.5)
  doc.strokeColor(BRAND_COLOR).lineWidth(1.5)
    .moveTo(doc.page.margins.left, doc.y).lineTo(doc.page.width - doc.page.margins.right, doc.y).stroke()
  doc.moveDown(0.8)
  doc.fillColor('black').font('Helvetica')
}

function addFooterPageNumbers(doc: PDFKit.PDFDocument) {
  const range = doc.bufferedPageRange()
  for (let i = range.start; i < range.start + range.count; i++) {
    doc.switchToPage(i)
    const bottom = doc.page.height - doc.page.margins.bottom + 10
    doc.fontSize(8).fillColor('#888888')
      .text(`Page ${i + 1 - range.start} of ${range.count}`, doc.page.margins.left, bottom, {
        width: doc.page.width - doc.page.margins.left - doc.page.margins.right,
        align: 'center',
      })
  }
}

/* ═══════════════════════════════════════════════════════════════════════
   A. Candidate summary PDF — multiple candidates, one table
═══════════════════════════════════════════════════════════════════════ */

export interface ReportMeta {
  generatedAt: Date
  generatedBy: string
  scope: 'all' | 'filtered' | 'selected'
  filters: ReportFilters
  totalRecords: number
}

function filterSummaryLine(filters: ReportFilters): string {
  const parts: string[] = []
  if (filters.name)          parts.push(`Name: ${filters.name}`)
  if (filters.mobile)        parts.push(`Mobile: ${filters.mobile}`)
  if (filters.email)         parts.push(`Email: ${filters.email}`)
  if (filters.applicationId) parts.push(`App ID: ${filters.applicationId}`)
  if (filters.status)        parts.push(`Status: ${filters.status}`)
  if (filters.paymentStatus) parts.push(`Payment: ${filters.paymentStatus}`)
  if (filters.docStatus)     parts.push(`Documents: ${filters.docStatus}`)
  if (filters.post)          parts.push(`Position: ${filters.post}`)
  if (filters.loc)           parts.push(`Location: ${filters.loc}`)
  if (filters.dateFrom)      parts.push(`From: ${filters.dateFrom}`)
  if (filters.dateTo)        parts.push(`To: ${filters.dateTo}`)
  return parts.length > 0 ? parts.join('  ·  ') : 'None'
}

interface Col { header: string; width: number; get: (r: CandidateReportRow) => string }

const SUMMARY_COLS: Col[] = [
  { header: 'App ID',    width: 70,  get: applicationIdLabel },
  { header: 'Name',      width: 95,  get: (r) => r.full_name ?? '—' },
  { header: 'Mobile',    width: 70,  get: (r) => r.mobile ?? '—' },
  { header: 'Position',  width: 85,  get: jobPosition },
  { header: 'Location',  width: 95,  get: preferredLocations },
  { header: 'Payment',   width: 60,  get: paymentLabel },
  { header: 'App Status', width: 95, get: (r) => STATUS_LABEL[r.application_status ?? ''] ?? r.application_status ?? '—' },
  { header: 'Documents', width: 95,  get: (r) => docStatusDetail(r).replace('Not Yet Available — ', 'N/A: ') },
]

function drawTableHeaderRow(doc: PDFKit.PDFDocument, x: number, y: number): number {
  doc.font('Helvetica-Bold').fontSize(8).fillColor('white')
  doc.rect(x, y, SUMMARY_COLS.reduce((s, c) => s + c.width, 0), 18).fill(DARK)
  let cx = x
  doc.fillColor('white')
  for (const col of SUMMARY_COLS) {
    doc.text(col.header, cx + 3, y + 5, { width: col.width - 6, ellipsis: true })
    cx += col.width
  }
  return y + 18
}

export async function buildCandidatesSummaryPdf(
  rows: CandidateReportRow[],
  meta: ReportMeta,
): Promise<Buffer> {
  const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 36, bufferPages: true })
  const bufferPromise = collectPdfBuffer(doc)

  drawHeader(doc, 'Candidate Report')
  doc.fontSize(9).fillColor('#444444')
    .text(`Generated: ${meta.generatedAt.toLocaleString('en-IN')} by ${meta.generatedBy}`)
    .text(`Scope: ${meta.scope}  ·  Total records: ${meta.totalRecords}`)
    .text(`Filters: ${filterSummaryLine(meta.filters)}`)
  doc.moveDown(0.6)

  // Summary counts — a quick read without opening the full table.
  const paid    = rows.filter((r) => paymentLabel(r) === 'Successful').length
  const pending = rows.filter((r) => paymentLabel(r) === 'Pending').length
  const missing = rows.filter((r) => r.doc_status_computed === 'MISSING_REQUIRED').length
  doc.font('Helvetica-Bold').fontSize(9).fillColor('black')
    .text(`Payment — Successful: ${paid}   Pending: ${pending}   |   Missing Required Documents: ${missing}`)
  doc.moveDown(0.5)

  const tableX = doc.page.margins.left
  let y = doc.y
  y = drawTableHeaderRow(doc, tableX, y)
  doc.font('Helvetica').fontSize(8).fillColor('black')

  const rowHeight = 16
  const bottomLimit = doc.page.height - doc.page.margins.bottom

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    if (y + rowHeight > bottomLimit) {
      doc.addPage()
      y = doc.page.margins.top
      y = drawTableHeaderRow(doc, tableX, y)
      doc.font('Helvetica').fontSize(8).fillColor('black')
    }
    if (i % 2 === 1) {
      doc.rect(tableX, y, SUMMARY_COLS.reduce((s, c) => s + c.width, 0), rowHeight).fill('#f6f6f6')
      doc.fillColor('black')
    }
    let cx = tableX
    for (const col of SUMMARY_COLS) {
      doc.text(col.get(row), cx + 3, y + 4, { width: col.width - 6, height: rowHeight - 2, ellipsis: true })
      cx += col.width
    }
    y += rowHeight
  }

  addFooterPageNumbers(doc)
  doc.end()
  return bufferPromise
}

/* ═══════════════════════════════════════════════════════════════════════
   B. Individual candidate PDF
═══════════════════════════════════════════════════════════════════════ */

export interface CandidateDossier {
  candidate: CandidateReportRow & {
    registration_status?: string | null
    created_at: string
    updated_at?: string
  }
  notes: Array<{ note: string; admin_id: string | null; created_at: string }>
  officeVisits: Array<{ visit_date: string | null; status: string; physical_verification_status: string | null }>
  generatedBy: string
  includeAdminNotes: boolean
}

function kv(doc: PDFKit.PDFDocument, label: string, value: string, x: number, y: number, width: number) {
  doc.font('Helvetica').fontSize(8).fillColor('#777777').text(label, x, y, { width })
  doc.font('Helvetica-Bold').fontSize(10).fillColor('black').text(value || '—', x, y + 11, { width })
}

export async function buildCandidatePdf(d: CandidateDossier): Promise<Buffer> {
  const doc = new PDFDocument({ size: 'A4', margin: 40, bufferPages: true })
  const bufferPromise = collectPdfBuffer(doc)
  const r = d.candidate

  drawHeader(doc, `Candidate Report — ${applicationIdLabel(r)}`)

  const colW = (doc.page.width - doc.page.margins.left - doc.page.margins.right - 20) / 2
  const leftX  = doc.page.margins.left
  const rightX = leftX + colW + 20
  let y = doc.y

  /* ── Candidate information ── */
  doc.font('Helvetica-Bold').fontSize(11).fillColor(DARK).text('Candidate Information', leftX, y)
  y = doc.y + 6
  kv(doc, 'Application Number', applicationIdLabel(r), leftX, y, colW)
  kv(doc, 'Registration Date',  new Date(r.created_at).toLocaleDateString('en-IN'), rightX, y, colW)
  y += 32
  kv(doc, 'Candidate Name', r.full_name ?? '—', leftX, y, colW)
  kv(doc, 'Mobile Number',  r.mobile ?? '—', rightX, y, colW)
  y += 32
  kv(doc, 'Email', r.email ?? '—', leftX, y, colW)
  kv(doc, 'Service Background / Rank', `${r.force ?? '—'} / ${r.rank ?? '—'}`, rightX, y, colW)
  y += 40

  /* ── Job preferences ── */
  doc.font('Helvetica-Bold').fontSize(11).fillColor(DARK).text('Job Preferences', leftX, y)
  y = doc.y + 6
  kv(doc, 'Job Position', jobPosition(r), leftX, y, colW)
  kv(doc, 'Preferred Location(s)', preferredLocations(r), rightX, y, colW)
  y += 40

  /* ── Payment ── */
  doc.font('Helvetica-Bold').fontSize(11).fillColor(DARK).text('Payment', leftX, y)
  y = doc.y + 6
  kv(doc, 'Payment Status', paymentLabel(r), leftX, y, colW)
  kv(doc, 'Amount', `₹${paymentAmountRupees(r).toLocaleString('en-IN')}`, rightX, y, colW)
  y += 32
  kv(doc, 'Transaction Reference', r.pay_payment_id ?? r.pay_order_id ?? '—', leftX, y, colW)
  y += 40

  /* ── Documents ── */
  doc.font('Helvetica-Bold').fontSize(11).fillColor(DARK).text('Documents', leftX, y)
  y = doc.y + 8

  const allTypes = [...REQUIRED_DOCS, ...OPTIONAL_DOCS]
  const byType = new Map(r.documents.map((doc2) => [doc2.doc_type, doc2]))
  const notAvailable = r.doc_status_computed === 'NOT_AVAILABLE'

  if (notAvailable) {
    doc.font('Helvetica').fontSize(9).fillColor('#777777')
      .text(docStatusDetail(r), leftX, y, { width: colW * 2 + 20 })
    y = doc.y + 10
  } else {
    const headerY = y
    doc.font('Helvetica-Bold').fontSize(8).fillColor('white')
    doc.rect(leftX, headerY, colW * 2 + 20, 16).fill(DARK)
    doc.fillColor('white')
      .text('Document', leftX + 4, headerY + 4, { width: 160 })
      .text('Status',   leftX + 170, headerY + 4, { width: 90 })
      .text('Reason (if rejected)', leftX + 265, headerY + 4, { width: colW * 2 + 20 - 269 })
    y = headerY + 16
    doc.font('Helvetica').fillColor('black').fontSize(8)

    for (const type of allTypes) {
      const rec = byType.get(type)
      const required = (REQUIRED_DOCS as readonly string[]).includes(type)
      const label = `${DOC_LABELS[type] ?? type}${required ? ' (Required)' : ' (Optional)'}`
      const status = rec ? rec.status : (required ? 'Missing' : 'Not Submitted')
      doc.text(label, leftX + 4, y + 3, { width: 160 })
      doc.text(status, leftX + 170, y + 3, { width: 90 })
      if (rec?.rejection_reason) doc.text(rec.rejection_reason, leftX + 265, y + 3, { width: colW * 2 + 20 - 269 })
      y += 16
    }
    y += 10
  }

  /* ── Application ── */
  doc.font('Helvetica-Bold').fontSize(11).fillColor(DARK).text('Application', leftX, y)
  y = doc.y + 6
  kv(doc, 'Current Status', STATUS_LABEL[r.application_status ?? ''] ?? r.application_status ?? '—', leftX, y, colW)
  kv(doc, 'Last Updated', new Date(r.last_updated).toLocaleString('en-IN'), rightX, y, colW)
  y += 40

  /* ── Office visit, if any ── */
  if (d.officeVisits.length > 0) {
    const v = d.officeVisits[0]
    doc.font('Helvetica-Bold').fontSize(11).fillColor(DARK).text('Office Visit', leftX, y)
    y = doc.y + 6
    kv(doc, 'Scheduled Date', v.visit_date ? new Date(v.visit_date).toLocaleDateString('en-IN') : '—', leftX, y, colW)
    kv(doc, 'Status', v.status ?? '—', rightX, y, colW)
    y += 32
  }

  /* ── Admin notes — only when explicitly requested, since notes can
     contain internal commentary not meant for every report consumer. ── */
  if (d.includeAdminNotes && d.notes.length > 0) {
    doc.font('Helvetica-Bold').fontSize(11).fillColor(DARK).text('Administrative Notes', leftX, y)
    y = doc.y + 6
    doc.font('Helvetica').fontSize(8).fillColor('black')
    for (const n of d.notes.slice(0, 10)) {
      const line = `${new Date(n.created_at).toLocaleDateString('en-IN')} — ${n.note}`
      doc.text(line, leftX, y, { width: colW * 2 + 20 })
      y = doc.y + 4
    }
  }

  doc.fontSize(8).fillColor('#999999')
    .text(`Generated by ${d.generatedBy} on ${new Date().toLocaleString('en-IN')}`, leftX, doc.page.height - doc.page.margins.bottom - 20)

  addFooterPageNumbers(doc)
  doc.end()
  return bufferPromise
}
