import ExcelJS from 'exceljs'
import {
  CandidateReportRow, paymentLabel, paymentAmountRupees, docStatusDetail,
  documentsSubmittedText, documentsMissingText, preferredLocations,
  jobPosition, applicationIdLabel, ReportFilters,
} from './reports'
import { STATUS_LABEL } from './statusLabels'

export interface ReportMeta {
  generatedAt: Date
  generatedBy: string
  scope: 'all' | 'filtered' | 'selected'
  filters: ReportFilters
  totalRecords: number
}

function filterSummary(filters: ReportFilters): string {
  const parts: string[] = []
  if (filters.name)          parts.push(`Name: "${filters.name}"`)
  if (filters.mobile)        parts.push(`Mobile: "${filters.mobile}"`)
  if (filters.email)         parts.push(`Email: "${filters.email}"`)
  if (filters.applicationId) parts.push(`Application ID: "${filters.applicationId}"`)
  if (filters.status)        parts.push(`Status: ${filters.status}`)
  if (filters.paymentStatus) parts.push(`Payment: ${filters.paymentStatus}`)
  if (filters.docStatus)     parts.push(`Documents: ${filters.docStatus}`)
  if (filters.post)          parts.push(`Position: "${filters.post}"`)
  if (filters.loc)           parts.push(`Location: "${filters.loc}"`)
  if (filters.dateFrom)      parts.push(`From: ${filters.dateFrom}`)
  if (filters.dateTo)        parts.push(`To: ${filters.dateTo}`)
  return parts.length > 0 ? parts.join(' · ') : 'None'
}

const COLUMNS: Array<{ header: string; key: string; width: number }> = [
  { header: 'Application ID',      key: 'appId',       width: 18 },
  { header: 'Registration Date',   key: 'regDate',      width: 18 },
  { header: 'Candidate Name',      key: 'name',         width: 24 },
  { header: 'Mobile Number',       key: 'mobile',       width: 16 },
  { header: 'Email',               key: 'email',        width: 26 },
  { header: 'Service Background',  key: 'force',        width: 16 },
  { header: 'Rank',                key: 'rank',         width: 16 },
  { header: 'Job Position',        key: 'post',         width: 20 },
  { header: 'Preferred Location',  key: 'loc',          width: 28 },
  { header: 'Payment Status',      key: 'payStatus',    width: 16 },
  { header: 'Payment Amount (₹)',  key: 'payAmount',    width: 16 },
  { header: 'Payment Reference',   key: 'payRef',       width: 22 },
  { header: 'Application Status', key: 'appStatus',     width: 24 },
  { header: 'Documents Submitted', key: 'docsSubmitted', width: 40 },
  { header: 'Documents Missing',   key: 'docsMissing',  width: 30 },
  { header: 'Document Status',    key: 'docStatus',     width: 28 },
  { header: 'Last Updated',       key: 'lastUpdated',   width: 18 },
]

function rowToRecord(row: CandidateReportRow): Record<string, unknown> {
  return {
    appId:       applicationIdLabel(row),
    regDate:     new Date(row.created_at),
    name:        row.full_name ?? '—',
    mobile:      row.mobile ?? '—',
    email:       row.email ?? '—',
    force:       row.force ?? '—',
    rank:        row.rank ?? '—',
    post:        jobPosition(row),
    loc:         preferredLocations(row),
    payStatus:   paymentLabel(row),
    payAmount:   paymentAmountRupees(row),
    payRef:      row.pay_payment_id ?? row.pay_order_id ?? '—',
    appStatus:   STATUS_LABEL[row.application_status ?? ''] ?? row.application_status ?? '—',
    docsSubmitted: documentsSubmittedText(row),
    docsMissing:   documentsMissingText(row),
    docStatus:     docStatusDetail(row),
    lastUpdated: new Date(row.last_updated),
  }
}

/**
 * One row per candidate/application — the primary report entity is the
 * candidate (which IS the registration application, 1:1 — see
 * server/src/lib/applicationStatus.ts). Documents and payment attempts are
 * pre-aggregated to a single value per candidate before this function ever
 * sees a row, so nothing here can multiply rows through a join.
 */
export async function buildCandidatesWorkbook(
  rows: CandidateReportRow[],
  meta: ReportMeta,
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook()
  wb.creator = 'Ex-Serviceman Jobs Admin Panel'
  wb.created = meta.generatedAt

  const ws = wb.addWorksheet('Candidate Report', {
    views: [{ state: 'frozen', ySplit: 5 }], // freeze title block + header row
  })

  ws.mergeCells('A1:E1')
  ws.getCell('A1').value = 'Ex-Serviceman Jobs — Candidate Report'
  ws.getCell('A1').font = { size: 14, bold: true }

  ws.getCell('A2').value = `Generated: ${meta.generatedAt.toLocaleString('en-IN')} by ${meta.generatedBy}`
  ws.getCell('A3').value = `Scope: ${meta.scope} · ${meta.totalRecords} record(s)`
  ws.getCell('A4').value = `Filters: ${filterSummary(meta.filters)}`
  for (const addr of ['A2', 'A3', 'A4']) ws.getCell(addr).font = { size: 10, italic: true, color: { argb: 'FF555555' } }

  // Row 5 is blank on purpose — separates the title block from the header
  // row the freeze pane and auto-filter both anchor to.
  const headerRowIndex = 6
  const headerRow = ws.getRow(headerRowIndex)
  COLUMNS.forEach((col, i) => {
    const cell = headerRow.getCell(i + 1)
    cell.value = col.header
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1A1D1F' } }
    cell.alignment = { vertical: 'middle' }
    ws.getColumn(i + 1).width = col.width
  })
  headerRow.height = 20

  rows.forEach((row, i) => {
    const record = rowToRecord(row)
    const excelRow = ws.getRow(headerRowIndex + 1 + i)
    COLUMNS.forEach((col, ci) => {
      excelRow.getCell(ci + 1).value = record[col.key] as any
    })
    excelRow.getCell(2).numFmt  = 'dd-mmm-yyyy'           // Registration Date
    excelRow.getCell(11).numFmt = '"₹"#,##0'              // Payment Amount
    excelRow.getCell(17).numFmt = 'dd-mmm-yyyy hh:mm AM/PM' // Last Updated
  })

  ws.autoFilter = {
    from: { row: headerRowIndex, column: 1 },
    to:   { row: headerRowIndex, column: COLUMNS.length },
  }

  // Readable row height + wrap for the two free-text document columns, which
  // can legitimately run long for a candidate with several documents.
  for (let i = 0; i < rows.length; i++) {
    const r = ws.getRow(headerRowIndex + 1 + i)
    r.getCell(14).alignment = { wrapText: true } // Documents Submitted
    r.getCell(15).alignment = { wrapText: true } // Documents Missing
  }

  const buf = await wb.xlsx.writeBuffer()
  return Buffer.from(buf)
}
