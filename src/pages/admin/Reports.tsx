import { useEffect, useState, useCallback, useMemo } from 'react';
import {
  Search, FileSpreadsheet, FileText, Download, ChevronLeft, ChevronRight,
  Loader2, AlertCircle, ClipboardList, Filter, RotateCcw,
} from 'lucide-react';
import {
  getAdminReportCandidates, downloadAdminReport, buildReportExportUrl,
  type ReportCandidateRow, type ReportFilterParams,
} from '@/lib/api';
import { toast } from '@/hooks/useToast';

const LIMIT = 25;

const PAYMENT_STATUS_OPTIONS = [
  { value: '',             label: 'All payment statuses' },
  { value: 'pending',      label: 'Pending' },
  { value: 'successful',   label: 'Successful' },
  { value: 'failed',       label: 'Failed' },
  { value: 'cancelled',    label: 'Cancelled' },
  { value: 'not_required', label: 'Not Required (free registration)' },
] as const;

const DOC_STATUS_OPTIONS = [
  { value: '',                label: 'All document statuses' },
  { value: 'not_available',   label: 'Not Yet Available' },
  { value: 'missing_required', label: 'Missing Required Documents' },
  { value: 'under_review',    label: 'Under Review' },
  { value: 'approved',        label: 'All Required Approved' },
  { value: 'rejected',        label: 'Rejected' },
  { value: 'submitted',       label: 'Submitted' },
] as const;

const APP_STATUS_OPTIONS = [
  '', 'REGISTERED', 'APPLICATION_STARTED', 'PAYMENT_PENDING', 'PAYMENT_FAILED',
  'PAYMENT_CANCELLED', 'PAYMENT_SUCCESSFUL', 'DOCUMENTS_PENDING', 'DOCUMENTS_SUBMITTED',
  'DOCUMENTS_UNDER_REVIEW', 'DOCUMENTS_REJECTED', 'DOCUMENTS_VERIFIED', 'OFFICE_VISIT_PENDING',
  'PHYSICAL_VERIFICATION', 'COMPLETED', 'APPLICATION_ON_HOLD', 'APPLICATION_CANCELLED',
];

const PAYMENT_CHIP: Record<string, string> = {
  Successful:   'bg-green-100 text-green-700',
  Pending:      'bg-amber-100 text-amber-700',
  Failed:       'bg-red-100 text-red-700',
  Cancelled:    'bg-orange-100 text-orange-700',
  'Not Required': 'bg-gray-100 text-gray-500',
};

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

const emptyFilters: ReportFilterParams = {};

export default function AdminReports() {
  const [filters, setFilters] = useState<ReportFilterParams>(emptyFilters);
  const [draftFilters, setDraftFilters] = useState<ReportFilterParams>(emptyFilters);
  const [showFilters, setShowFilters] = useState(false);

  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<ReportCandidateRow[] | null>(null);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [exporting, setExporting] = useState<string | null>(null); // which export is in flight, to disable buttons and avoid double-submits

  const totalPages = Math.max(1, Math.ceil(total / LIMIT));

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    getAdminReportCandidates(filters, page, LIMIT)
      .then((res) => { setRows(res.candidates); setTotal(res.total) })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [filters, page]);

  useEffect(() => { load() }, [load]);

  const applyFilters = () => { setFilters(draftFilters); setPage(1); setSelected(new Set()) };
  const clearFilters = () => {
    setDraftFilters(emptyFilters);
    setFilters(emptyFilters);
    setPage(1);
    setSelected(new Set());
  };
  const activeFilterCount = useMemo(
    () => Object.values(filters).filter((v) => v !== undefined && v !== '').length,
    [filters],
  );

  const allOnPageSelected = rows !== null && rows.length > 0 && rows.every((r) => selected.has(r.id));
  const toggleAllOnPage = () => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allOnPageSelected) { rows!.forEach((r) => next.delete(r.id)) }
      else { rows!.forEach((r) => next.add(r.id)) }
      return next;
    });
  };
  const toggleOne = (id: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const runExport = async (format: 'xlsx' | 'pdf', scope: 'all' | 'filtered' | 'selected') => {
    if (scope === 'selected' && selected.size === 0) {
      toast({ title: 'No candidates selected', description: 'Select at least one row first.', variant: 'error' });
      return;
    }
    const key = `${format}-${scope}`;
    setExporting(key);
    try {
      const url = buildReportExportUrl(format, scope, filters, scope === 'selected' ? [...selected] : undefined);
      await downloadAdminReport(url, `exserviceman-candidates.${format}`);
      toast({ title: 'Report downloaded', description: `${scope === 'all' ? 'All' : scope === 'filtered' ? 'Filtered' : 'Selected'} candidates exported to ${format.toUpperCase()}.` });
    } catch (e) {
      toast({ title: 'Export failed', description: (e as Error).message, variant: 'error' });
    } finally {
      setExporting(null);
    }
  };

  const set = (k: keyof ReportFilterParams, v: string) =>
    setDraftFilters((prev) => ({ ...prev, [k]: v || undefined }));

  return (
    <div className='p-4 md:p-6 space-y-5'>
      <div className='flex flex-wrap items-center justify-between gap-3'>
        <div>
          <h1 className='text-lg font-extrabold text-gray-900' style={{ fontFamily: 'Plus Jakarta Sans' }}>
            Candidate Reports
          </h1>
          <p className='text-xs text-gray-500 mt-0.5'>
            {total} candidate{total === 1 ? '' : 's'} match the current filters.
          </p>
        </div>

        <div className='flex items-center gap-2 flex-wrap'>
          <button
            onClick={() => setShowFilters((s) => !s)}
            className={`flex items-center gap-1.5 h-9 px-3 rounded-xl text-xs font-bold border transition-colors
              ${showFilters ? 'bg-[#1a1d1f] text-white border-[#1a1d1f]' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}>
            <Filter className='w-3.5 h-3.5' /> Filters {activeFilterCount > 0 && `(${activeFilterCount})`}
          </button>

          <ExportButton
            icon={FileSpreadsheet} label='Export All (Excel)'
            busy={exporting === 'xlsx-all'} disabled={!!exporting}
            onClick={() => runExport('xlsx', 'all')}
          />
          <ExportButton
            icon={FileSpreadsheet} label={`Export Filtered${activeFilterCount ? '' : ' = All'} (Excel)`}
            busy={exporting === 'xlsx-filtered'} disabled={!!exporting}
            onClick={() => runExport('xlsx', 'filtered')}
          />
          <ExportButton
            icon={FileText} label='Export All (PDF)'
            busy={exporting === 'pdf-all'} disabled={!!exporting}
            onClick={() => runExport('pdf', 'all')}
          />
          <ExportButton
            icon={FileText} label={`Export Filtered${activeFilterCount ? '' : ' = All'} (PDF)`}
            busy={exporting === 'pdf-filtered'} disabled={!!exporting}
            onClick={() => runExport('pdf', 'filtered')}
          />
          <ExportButton
            icon={Download} label={`Export Selected (${selected.size})`}
            busy={exporting === 'xlsx-selected'} disabled={!!exporting || selected.size === 0}
            onClick={() => runExport('xlsx', 'selected')}
          />
        </div>
      </div>

      {/* Filters panel */}
      {showFilters && (
        <div className='bg-white border border-gray-100 rounded-2xl shadow-sm p-4 space-y-3'>
          <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3'>
            <LabeledInput label='Candidate Name' value={draftFilters.name ?? ''} onChange={(v) => set('name', v)} />
            <LabeledInput label='Mobile Number' value={draftFilters.mobile ?? ''} onChange={(v) => set('mobile', v)} />
            <LabeledInput label='Email Address' value={draftFilters.email ?? ''} onChange={(v) => set('email', v)} />
            <LabeledInput label='Application Number' value={draftFilters.applicationId ?? ''} onChange={(v) => set('applicationId', v)} />
            <LabeledInput label='Job Position' value={draftFilters.post ?? ''} onChange={(v) => set('post', v)} />
            <LabeledInput label='Preferred Location' value={draftFilters.loc ?? ''} onChange={(v) => set('loc', v)} />

            <LabeledSelect label='Application Status' value={draftFilters.status ?? ''} onChange={(v) => set('status', v)}>
              {APP_STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>{s === '' ? 'All statuses' : s.replace(/_/g, ' ')}</option>
              ))}
            </LabeledSelect>

            <LabeledSelect label='Payment Status' value={draftFilters.paymentStatus ?? ''} onChange={(v) => set('paymentStatus', v)}>
              {PAYMENT_STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </LabeledSelect>

            <LabeledSelect label='Document Status' value={draftFilters.docStatus ?? ''} onChange={(v) => set('docStatus', v)}>
              {DOC_STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </LabeledSelect>

            <LabeledInput type='date' label='Registered From' value={draftFilters.dateFrom ?? ''} onChange={(v) => set('dateFrom', v)} />
            <LabeledInput type='date' label='Registered To'   value={draftFilters.dateTo ?? ''}   onChange={(v) => set('dateTo', v)} />
          </div>

          <div className='flex items-center gap-2 pt-1'>
            <button onClick={applyFilters}
              className='h-9 px-4 bg-[#F7A607] hover:bg-[#e09500] text-white text-xs font-bold rounded-xl transition-colors flex items-center gap-1.5'>
              <Search className='w-3.5 h-3.5' /> Apply Filters
            </button>
            <button onClick={clearFilters}
              className='h-9 px-4 border border-gray-200 text-gray-600 text-xs font-bold rounded-xl hover:bg-gray-50 transition-colors flex items-center gap-1.5'>
              <RotateCcw className='w-3.5 h-3.5' /> Clear Filters
            </button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className='bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden'>
        {loading ? (
          <div className='p-8 space-y-3'>
            {[1, 2, 3, 4, 5].map((i) => <div key={i} className='h-10 bg-gray-100 rounded-xl animate-pulse' />)}
          </div>
        ) : error ? (
          <div className='py-16 text-center'>
            <AlertCircle className='w-10 h-10 text-red-300 mx-auto mb-3' />
            <p className='text-sm font-semibold text-gray-700'>Could not load the report</p>
            <p className='text-xs text-gray-400 mt-1'>{error}</p>
            <button onClick={load} className='mt-4 text-xs font-bold text-[#F7A607] hover:underline'>Try again</button>
          </div>
        ) : !rows || rows.length === 0 ? (
          <div className='py-16 text-center'>
            <ClipboardList className='w-10 h-10 text-gray-300 mx-auto mb-3' />
            <p className='text-sm font-semibold text-gray-500'>No candidates match these filters</p>
          </div>
        ) : (
          <div className='overflow-x-auto'>
            <table className='w-full text-xs'>
              <thead>
                <tr className='bg-gray-50 border-b border-gray-100'>
                  <th className='sticky left-0 bg-gray-50 px-3 py-2.5 w-8'>
                    <input type='checkbox' checked={allOnPageSelected} onChange={toggleAllOnPage} className='rounded border-gray-300' />
                  </th>
                  {[
                    'Application ID', 'Registration Date', 'Candidate Name', 'Mobile', 'Email',
                    'Service Background', 'Rank', 'Job Position', 'Preferred Location',
                    'Payment Status', 'Application Status', 'Documents Submitted',
                    'Document Status', 'Last Updated',
                  ].map((h) => (
                    <th key={h} className='text-left px-3 py-2.5 font-bold text-gray-500 uppercase tracking-wide text-[10px] whitespace-nowrap'>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className='divide-y divide-gray-50'>
                {rows.map((r) => (
                  <tr key={r.id} className='hover:bg-gray-50 transition-colors'>
                    <td className='sticky left-0 bg-white px-3 py-2.5'>
                      <input type='checkbox' checked={selected.has(r.id)} onChange={() => toggleOne(r.id)} className='rounded border-gray-300' />
                    </td>
                    <td className='px-3 py-2.5 font-mono text-gray-700 whitespace-nowrap'>{r.applicationId}</td>
                    <td className='px-3 py-2.5 whitespace-nowrap'>{fmtDate(r.registrationDate)}</td>
                    <td className='px-3 py-2.5 font-semibold text-gray-900 whitespace-nowrap max-w-[160px] truncate'>{r.name ?? '—'}</td>
                    <td className='px-3 py-2.5 whitespace-nowrap'>{r.mobile ?? '—'}</td>
                    <td className='px-3 py-2.5 whitespace-nowrap max-w-[180px] truncate'>{r.email ?? '—'}</td>
                    <td className='px-3 py-2.5 whitespace-nowrap'>{r.serviceBackground ?? '—'}</td>
                    <td className='px-3 py-2.5 whitespace-nowrap'>{r.rank ?? '—'}</td>
                    <td className='px-3 py-2.5 whitespace-nowrap'>{r.jobPosition}</td>
                    <td className='px-3 py-2.5 whitespace-nowrap max-w-[200px] truncate'>{r.preferredLocation}</td>
                    <td className='px-3 py-2.5'>
                      <span className={`text-[10px] font-bold px-2 py-1 rounded-full whitespace-nowrap ${PAYMENT_CHIP[r.paymentStatus] ?? 'bg-gray-100 text-gray-500'}`}>
                        {r.paymentStatus}
                      </span>
                    </td>
                    <td className='px-3 py-2.5 whitespace-nowrap'>{r.applicationStatus}</td>
                    <td className='px-3 py-2.5 max-w-[240px] truncate' title={r.documentsSubmitted}>{r.documentsSubmitted}</td>
                    <td className='px-3 py-2.5 whitespace-nowrap max-w-[200px] truncate' title={r.documentStatus}>{r.documentStatus}</td>
                    <td className='px-3 py-2.5 whitespace-nowrap'>{fmtDate(r.lastUpdated)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {rows && rows.length > 0 && totalPages > 1 && (
        <div className='flex items-center justify-between'>
          <p className='text-xs text-gray-500'>
            {((page - 1) * LIMIT) + 1}–{Math.min(page * LIMIT, total)} of {total}
          </p>
          <div className='flex gap-2'>
            <button onClick={() => setPage((p) => p - 1)} disabled={page === 1}
              className='p-2 rounded-lg border border-gray-200 disabled:opacity-40 hover:bg-gray-50'>
              <ChevronLeft className='w-4 h-4 text-gray-600' />
            </button>
            <span className='flex items-center text-xs font-semibold text-gray-700 px-3'>{page} / {totalPages}</span>
            <button onClick={() => setPage((p) => p + 1)} disabled={page >= totalPages}
              className='p-2 rounded-lg border border-gray-200 disabled:opacity-40 hover:bg-gray-50'>
              <ChevronRight className='w-4 h-4 text-gray-600' />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function ExportButton({
  icon: Icon, label, onClick, busy, disabled,
}: {
  icon: React.ElementType; label: string; onClick: () => void; busy: boolean; disabled: boolean;
}) {
  return (
    <button onClick={onClick} disabled={disabled}
      className='flex items-center gap-1.5 h-9 px-3 rounded-xl text-xs font-bold border border-gray-200 bg-white
        text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap'>
      {busy ? <Loader2 className='w-3.5 h-3.5 animate-spin' /> : <Icon className='w-3.5 h-3.5' />}
      {label}
    </button>
  );
}

function LabeledInput({
  label, value, onChange, type = 'text',
}: { label: string; value: string; onChange: (v: string) => void; type?: string }) {
  return (
    <label className='block'>
      <span className='text-[10px] font-bold text-gray-400 uppercase tracking-wide'>{label}</span>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)}
        className='mt-1 w-full h-9 text-xs border border-gray-200 rounded-xl px-3 bg-white focus:outline-none focus:ring-2 focus:ring-[#F7A607]/30' />
    </label>
  );
}

function LabeledSelect({
  label, value, onChange, children,
}: { label: string; value: string; onChange: (v: string) => void; children: React.ReactNode }) {
  return (
    <label className='block'>
      <span className='text-[10px] font-bold text-gray-400 uppercase tracking-wide'>{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)}
        className='mt-1 w-full h-9 text-xs border border-gray-200 rounded-xl px-2 bg-white focus:outline-none focus:ring-2 focus:ring-[#F7A607]/30'>
        {children}
      </select>
    </label>
  );
}
