import { useEffect, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  Search, Users, ChevronLeft, ChevronRight, Shield, X, Phone, Mail,
  FileText, PhoneCall, StickyNote, Activity, Building2, Loader2,
  CheckCircle, AlertCircle, Clock, CalendarClock, Download,
} from 'lucide-react';
import {
  getAdminApplicants, getAdminApplicant, updateApplicantStatus,
  reviewDocument, logCall, addAdminNote, recordOfficeVisit, downloadCandidatePdf,
  type AdminApplicantDetail, type AdminApplicantRow, type ApplicantRecord,
  type PaymentRecord, type DocumentRecord, type CallLogRecord,
  type AdminNoteRecord, type ActivityEventRecord, type OfficeVisitRecord,
} from '@/lib/api';
import {
  STATUS_LABEL, STATUS_CHIP, adminFiltersFor, CALL_STATUS_OPTIONS,
  DOC_META, DOC_STATUS_CHIP, isPaid,
} from '@/constants/applicationStatus';
import { SecureDocLink } from '@/components/shared/SecureDocLink';
import { usePaymentsEnabled } from '@/hooks/usePaymentsEnabled';
import { toast } from '@/hooks/useToast';

const FORCE_COLOR: Record<string, string> = {
  Army:            'bg-green-100 text-green-700',
  Navy:            'bg-blue-100 text-blue-700',
  'Air Force':     'bg-sky-100 text-sky-700',
  'Para Military': 'bg-orange-100 text-orange-700',
};

const fmtDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

const fmtDateTime = (iso: string) =>
  new Date(iso).toLocaleString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit',
  });

/* ══════════════════════════════════════════════════════════════════════════
   DETAIL DRAWER
══════════════════════════════════════════════════════════════════════════ */
type Tab = 'details' | 'documents' | 'calls' | 'notes' | 'timeline' | 'visit';

function DetailDrawer({ id, onClose, onChanged }: {
  id: number; onClose: () => void; onChanged: () => void;
}) {
  const [data, setData]   = useState<AdminApplicantDetail | null>(null);
  const [tab, setTab]     = useState<Tab>('details');
  const [busy, setBusy]   = useState(false);

  const load = useCallback(() => {
    getAdminApplicant(id)
      .then(setData)
      .catch((e: Error) => toast({ title: 'Could not load applicant', description: (e as Error).message, variant: 'error' }));
  }, [id]);

  useEffect(() => { load() }, [load]);

  const refresh = () => { load(); onChanged() };

  if (!data) {
    return (
      <div className='fixed inset-0 z-50 flex items-center justify-center p-4' onClick={onClose}>
        <div className='absolute inset-0 bg-black/40' />
        <div className='relative bg-white rounded-3xl p-10'>
          <Loader2 className='w-6 h-6 text-[#F7A607] animate-spin' />
        </div>
      </div>
    );
  }

  const a = data.applicant;

  const TABS: Array<{ key: Tab; label: string; icon: React.ElementType; count?: number }> = [
    { key: 'details',   label: 'Details',   icon: Users },
    { key: 'documents', label: 'Documents', icon: FileText,   count: data.documents.length },
    { key: 'calls',     label: 'Calls',     icon: PhoneCall,  count: data.calls.length },
    { key: 'notes',     label: 'Notes',     icon: StickyNote, count: data.notes.length },
    { key: 'timeline',  label: 'Timeline',  icon: Activity },
    { key: 'visit',     label: 'Visit',     icon: Building2,  count: data.officeVisits.length },
  ];

  return (
    <div className='fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4' onClick={onClose}>
      <div className='absolute inset-0 bg-black/40' />
      <motion.div
        initial={{ opacity: 0, y: 32 }} animate={{ opacity: 1, y: 0 }}
        className='relative bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl w-full max-w-2xl max-h-[92vh] flex flex-col'
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className='bg-[#1a1d1f] rounded-t-3xl p-5 shrink-0'>
          <div className='flex items-start justify-between gap-3'>
            <div className='min-w-0'>
              <p className='text-xs text-gray-400'>{a.registration_ref ?? `#${a.id}`}</p>
              <p className='text-base font-bold text-white mt-0.5 truncate'>
                {a.full_name ?? 'Profile incomplete'}
              </p>
              <div className='flex items-center gap-3 mt-1.5 flex-wrap'>
                {a.mobile && (
                  <a href={`tel:${a.mobile}`} className='flex items-center gap-1 text-xs text-gray-300 hover:text-[#F7A607]'>
                    <Phone className='w-3 h-3' />{a.mobile}
                  </a>
                )}
                <span className='flex items-center gap-1 text-xs text-gray-400 truncate'>
                  <Mail className='w-3 h-3 shrink-0' />{a.email}
                </span>
              </div>
            </div>
            <div className='flex items-center gap-2 shrink-0'>
              <button
                onClick={async () => {
                  setBusy(true);
                  try {
                    await downloadCandidatePdf(id, a.registration_ref ?? `DRAFT-${id}`);
                  } catch (err) {
                    toast({ title: 'Could not generate PDF', description: (err as Error).message, variant: 'error' });
                  } finally { setBusy(false) }
                }}
                disabled={busy}
                title='Download Candidate PDF'
                className='w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center hover:bg-white/20 disabled:opacity-50'>
                <Download className='w-4 h-4 text-[#F7A607]' />
              </button>
              <button onClick={onClose} className='w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center hover:bg-white/20'>
                <X className='w-4 h-4 text-white' />
              </button>
            </div>
          </div>

          {/* Status + transitions */}
          <div className='mt-4 flex items-center gap-2 flex-wrap'>
            <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full
              ${STATUS_CHIP[a.application_status ?? ''] ?? 'bg-gray-100 text-gray-600'}`}>
              {STATUS_LABEL[a.application_status ?? ''] ?? 'Unknown'}
            </span>
            {data.allowedStatuses.length > 0 && (
              <select
                value=''
                disabled={busy}
                onChange={async (e) => {
                  const next = e.target.value;
                  if (!next) return;
                  setBusy(true);
                  try {
                    await updateApplicantStatus(id, next);
                    toast({ title: `Moved to ${STATUS_LABEL[next] ?? next}` });
                    refresh();
                  } catch (err) {
                    toast({ title: 'Status change refused', description: (err as Error).message, variant: 'error' });
                  } finally { setBusy(false) }
                }}
                className='text-[11px] bg-white/10 text-white border border-white/20 rounded-lg px-2 py-1
                  focus:outline-none focus:ring-1 focus:ring-[#F7A607]'
              >
                <option value='' className='text-gray-900'>Move to…</option>
                {data.allowedStatuses.map((s) => (
                  <option key={s} value={s} className='text-gray-900'>{STATUS_LABEL[s] ?? s}</option>
                ))}
              </select>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className='flex gap-1 px-3 pt-3 border-b border-gray-100 overflow-x-auto shrink-0'>
          {TABS.map(({ key, label, icon: Icon, count }) => (
            <button key={key} onClick={() => setTab(key)}
              className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-t-lg whitespace-nowrap transition-colors
                ${tab === key ? 'text-[#F7A607] border-b-2 border-[#F7A607]' : 'text-gray-500 hover:text-gray-700'}`}>
              <Icon className='w-3.5 h-3.5' />{label}
              {count !== undefined && count > 0 && (
                <span className='text-[9px] bg-gray-100 text-gray-600 px-1.5 rounded-full'>{count}</span>
              )}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className='flex-1 overflow-y-auto p-5'>
          {tab === 'details'   && <DetailsTab a={a} payments={data.payments} />}
          {tab === 'documents' && <DocumentsTab docs={data.documents} onReviewed={refresh} unlocked={isPaid(a.application_status)} />}
          {tab === 'calls'     && <CallsTab id={id} calls={data.calls} onAdded={refresh} />}
          {tab === 'notes'     && <NotesTab id={id} notes={data.notes} onAdded={refresh} />}
          {tab === 'timeline'  && <TimelineTab events={data.timeline} />}
          {tab === 'visit'     && <VisitTab id={id} visits={data.officeVisits} onAdded={refresh} />}
        </div>
      </motion.div>
    </div>
  );
}

/* ── Tabs ─────────────────────────────────────────────────────────────── */
function Row({ label, value }: { label: string; value: React.ReactNode }) {
  if (!value) return null;
  return (
    <div className='flex justify-between items-start gap-4 py-2 border-b border-gray-50 last:border-0'>
      <span className='text-xs text-gray-400 shrink-0'>{label}</span>
      <span className='text-xs font-semibold text-gray-800 text-right break-all'>{value}</span>
    </div>
  );
}

function DetailsTab({ a, payments }: { a: ApplicantRecord; payments: PaymentRecord[] }) {
  const paymentsEnabled = usePaymentsEnabled();
  const paid = payments.find((p) => p.status === 'paid');
  return (
    <div className='space-y-5'>
      <section>
        <p className='text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1'>Application</p>
        <Row label='Application ID'  value={a.registration_ref} />
        <Row label='Mobile'          value={a.mobile} />
        <Row label='Force'           value={a.force} />
        <Row label='Rank'            value={a.rank} />
        <Row label='Unit'            value={a.unit} />
        <Row label='Retirement'      value={a.retirement_date ? fmtDate(a.retirement_date) : null} />
        <Row label='Preferred Post'  value={a.post === 'Other' ? a.other_post : a.post} />
        <Row label='Gun License'     value={a.gun_license} />
        <Row label='1st Priority'    value={a.loc1} />
        <Row label='2nd Priority'    value={a.loc2} />
        <Row label='3rd Priority'    value={a.loc3} />
        <Row label='Registered On'   value={fmtDate(a.created_at)} />
        <Row label='Last Activity'   value={a.last_activity_at ? fmtDateTime(a.last_activity_at) : null} />
        <Row label='Assigned Admin'  value={a.assigned_admin} />
      </section>

      {/* Payment is currently free — this section would otherwise show a
          misleading "Fee: ₹0 · Pending" for every applicant. */}
      {paymentsEnabled && (
        <section>
          <p className='text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1'>Payment</p>
          <Row label='Fee' value={`₹${a.application_fee ?? 0}`} />
          <Row label='Status' value={
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full
              ${paid ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
              {paid ? 'Paid' : 'Pending'}
            </span>
          } />
          {paid && <>
            <Row label='Order ID'   value={paid.razorpay_order_id} />
            <Row label='Payment ID' value={paid.razorpay_payment_id} />
            <Row label='Paid At'    value={paid.paid_at ? fmtDateTime(paid.paid_at) : null} />
          </>}
          {!paid && payments.length > 0 && (
            <p className='text-xs text-gray-500 mt-2'>
              {payments.length} payment attempt{payments.length > 1 ? 's' : ''} — none completed.
            </p>
          )}
        </section>
      )}
    </div>
  );
}

function DocumentsTab({ docs, onReviewed, unlocked }: {
  docs: DocumentRecord[]; onReviewed: () => void; unlocked: boolean;
}) {
  const [busyId, setBusyId] = useState<number | null>(null);

  if (docs.length === 0) {
    return (
      <div className='text-center py-10'>
        <FileText className='w-8 h-8 text-gray-300 mx-auto mb-2' />
        <p className='text-sm font-semibold text-gray-500'>No documents uploaded</p>
        <p className='text-xs text-gray-400 mt-1'>
          {unlocked ? 'The applicant has not uploaded anything yet.'
                     : 'Documents are not available until the application reaches the documents stage.'}
        </p>
      </div>
    );
  }

  const act = async (docId: number, action: 'approve' | 'reject') => {
    let reason: string | undefined;
    if (action === 'reject') {
      const input = window.prompt('Reason for rejection (the applicant will see this):');
      if (!input?.trim()) return;
      reason = input.trim();
    }
    setBusyId(docId);
    try {
      await reviewDocument(docId, action, reason);
      toast({ title: action === 'approve' ? 'Document approved' : 'Document rejected' });
      onReviewed();
    } catch (e) {
      toast({ title: 'Review failed', description: (e as Error).message, variant: 'error' });
    } finally { setBusyId(null) }
  };

  return (
    <div className='space-y-2.5'>
      {docs.map((d) => (
        <div key={d.id} className='border border-gray-100 rounded-2xl p-3.5'>
          <div className='flex items-start justify-between gap-3'>
            <div className='min-w-0'>
              <p className='text-sm font-bold text-gray-900'>{DOC_META[d.doc_type]?.label ?? d.doc_type}</p>
              <p className='text-[11px] text-gray-400 truncate mt-0.5'>{d.original_name}</p>
              <div className='flex items-center gap-2 mt-1.5'>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${DOC_STATUS_CHIP[d.status]}`}>
                  {d.status.replace(/_/g, ' ')}
                </span>
                <span className='text-[10px] text-gray-400'>{fmtDate(d.uploaded_at)}</span>
              </div>
              {d.rejection_reason && (
                <p className='text-[11px] text-red-600 mt-1.5'>Reason: {d.rejection_reason}</p>
              )}
            </div>
            <div className='flex flex-col items-end gap-1.5 shrink-0'>
              <SecureDocLink docId={d.id} />
              {d.status !== 'APPROVED' && (
                <div className='flex gap-1'>
                  <button onClick={() => act(d.id, 'approve')} disabled={busyId === d.id}
                    className='px-2 py-1 text-[10px] font-bold bg-green-600 hover:bg-green-700 text-white rounded-lg disabled:opacity-50'>
                    Approve
                  </button>
                  <button onClick={() => act(d.id, 'reject')} disabled={busyId === d.id}
                    className='px-2 py-1 text-[10px] font-bold bg-red-600 hover:bg-red-700 text-white rounded-lg disabled:opacity-50'>
                    Reject
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function CallsTab({ id, calls, onAdded }: { id: number; calls: CallLogRecord[]; onAdded: () => void }) {
  const [status, setStatus]     = useState('CALLED');
  const [notes, setNotes]       = useState('');
  const [followup, setFollowup] = useState('');
  const [busy, setBusy]         = useState(false);

  const submit = async () => {
    setBusy(true);
    try {
      await logCall(id, { callStatus: status, notes, nextFollowupDate: followup || undefined });
      setNotes(''); setFollowup('');
      toast({ title: 'Call logged' });
      onAdded();
    } catch (e) {
      toast({ title: 'Could not log call', description: (e as Error).message, variant: 'error' });
    } finally { setBusy(false) }
  };

  return (
    <div className='space-y-4'>
      <div className='bg-gray-50 rounded-2xl p-4 space-y-3'>
        <p className='text-[10px] font-bold text-gray-500 uppercase tracking-widest'>Record a call</p>
        <div className='grid grid-cols-2 gap-2'>
          <select value={status} onChange={(e) => setStatus(e.target.value)}
            className='h-9 text-xs border border-gray-200 rounded-xl px-2 bg-white focus:outline-none focus:ring-2 focus:ring-[#F7A607]/30'>
            {CALL_STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <input type='date' value={followup} onChange={(e) => setFollowup(e.target.value)}
            className='h-9 text-xs border border-gray-200 rounded-xl px-2 bg-white focus:outline-none focus:ring-2 focus:ring-[#F7A607]/30' />
        </div>
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2}
          placeholder='What did the applicant say?'
          className='w-full text-xs border border-gray-200 rounded-xl p-2.5 bg-white resize-none focus:outline-none focus:ring-2 focus:ring-[#F7A607]/30' />
        <button onClick={submit} disabled={busy}
          className='w-full h-9 bg-[#F7A607] hover:bg-[#e09500] text-white text-xs font-bold rounded-xl disabled:opacity-50'>
          {busy ? 'Saving…' : 'Save Call Log'}
        </button>
      </div>

      {calls.length === 0
        ? <p className='text-xs text-gray-400 text-center py-4'>No calls recorded yet.</p>
        : calls.map((c) => (
            <div key={c.id} className='border border-gray-100 rounded-2xl p-3.5'>
              <div className='flex items-center justify-between gap-2'>
                <span className='text-xs font-bold text-gray-900'>
                  {CALL_STATUS_OPTIONS.find((o) => o.value === c.call_status)?.label ?? c.call_status}
                </span>
                <span className='text-[10px] text-gray-400'>{fmtDateTime(c.created_at)}</span>
              </div>
              {c.notes && <p className='text-xs text-gray-600 mt-1.5 leading-relaxed'>{c.notes}</p>}
              {c.next_followup_date && (
                <p className='flex items-center gap-1 text-[11px] text-amber-600 font-semibold mt-1.5'>
                  <CalendarClock className='w-3 h-3' />Follow up {fmtDate(c.next_followup_date)}
                </p>
              )}
            </div>
          ))}
    </div>
  );
}

function NotesTab({ id, notes, onAdded }: { id: number; notes: AdminNoteRecord[]; onAdded: () => void }) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!text.trim()) return;
    setBusy(true);
    try {
      await addAdminNote(id, text.trim());
      setText('');
      onAdded();
    } catch (e) {
      toast({ title: 'Could not save note', description: (e as Error).message, variant: 'error' });
    } finally { setBusy(false) }
  };

  return (
    <div className='space-y-4'>
      <div className='bg-gray-50 rounded-2xl p-4 space-y-2.5'>
        <textarea value={text} onChange={(e) => setText(e.target.value)} rows={3}
          placeholder='Internal note — not visible to the applicant'
          className='w-full text-xs border border-gray-200 rounded-xl p-2.5 bg-white resize-none focus:outline-none focus:ring-2 focus:ring-[#F7A607]/30' />
        <button onClick={submit} disabled={busy || !text.trim()}
          className='w-full h-9 bg-[#F7A607] hover:bg-[#e09500] text-white text-xs font-bold rounded-xl disabled:opacity-50'>
          {busy ? 'Saving…' : 'Add Note'}
        </button>
      </div>

      {notes.length === 0
        ? <p className='text-xs text-gray-400 text-center py-4'>No notes yet.</p>
        : notes.map((n) => (
            <div key={n.id} className='border border-gray-100 rounded-2xl p-3.5'>
              <p className='text-xs text-gray-700 leading-relaxed whitespace-pre-wrap'>{n.note}</p>
              <p className='text-[10px] text-gray-400 mt-2'>{fmtDateTime(n.created_at)}</p>
            </div>
          ))}
    </div>
  );
}

function TimelineTab({ events }: { events: ActivityEventRecord[] }) {
  if (events.length === 0)
    return <p className='text-xs text-gray-400 text-center py-6'>No activity recorded.</p>;

  return (
    <ol className='relative border-l border-gray-200 ml-2 space-y-4'>
      {events.map((e) => (
        <li key={e.id} className='ml-4'>
          <span className='absolute -left-[5px] w-2.5 h-2.5 rounded-full bg-[#F7A607] mt-1' />
          <p className='text-[10px] text-gray-400'>{fmtDateTime(e.created_at)}</p>
          <p className='text-xs font-semibold text-gray-800 mt-0.5'>
            {e.description || e.event_type.replace(/_/g, ' ').toLowerCase()}
          </p>
          <p className='text-[10px] text-gray-400 mt-0.5 capitalize'>{e.actor_type}</p>
        </li>
      ))}
    </ol>
  );
}

function VisitTab({ id, visits, onAdded }: { id: number; visits: OfficeVisitRecord[]; onAdded: () => void }) {
  const [form, setForm] = useState({
    visitDate: '', visitTime: '', assignedStaff: '',
    status: 'SCHEDULED', physicalVerificationStatus: '', notes: '',
  });
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    try {
      await recordOfficeVisit(id, {
        ...form,
        physicalVerificationStatus: form.physicalVerificationStatus || undefined,
      });
      setForm({ visitDate: '', visitTime: '', assignedStaff: '', status: 'SCHEDULED', physicalVerificationStatus: '', notes: '' });
      toast({ title: 'Office visit recorded' });
      onAdded();
    } catch (e) {
      toast({ title: 'Could not save visit', description: (e as Error).message, variant: 'error' });
    } finally { setBusy(false) }
  };

  const set = (k: string, v: string) => setForm((p) => ({ ...p, [k]: v }));

  return (
    <div className='space-y-4'>
      <div className='bg-gray-50 rounded-2xl p-4 space-y-2.5'>
        <p className='text-[10px] font-bold text-gray-500 uppercase tracking-widest'>Record office visit</p>
        <div className='grid grid-cols-2 gap-2'>
          <input type='date' value={form.visitDate} onChange={(e) => set('visitDate', e.target.value)}
            className='h-9 text-xs border border-gray-200 rounded-xl px-2 bg-white focus:outline-none focus:ring-2 focus:ring-[#F7A607]/30' />
          <input type='time' value={form.visitTime} onChange={(e) => set('visitTime', e.target.value)}
            className='h-9 text-xs border border-gray-200 rounded-xl px-2 bg-white focus:outline-none focus:ring-2 focus:ring-[#F7A607]/30' />
          <select value={form.status} onChange={(e) => set('status', e.target.value)}
            className='h-9 text-xs border border-gray-200 rounded-xl px-2 bg-white focus:outline-none focus:ring-2 focus:ring-[#F7A607]/30'>
            {['SCHEDULED', 'ATTENDED', 'RESCHEDULED', 'NO_SHOW', 'COMPLETED'].map((s) => (
              <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
            ))}
          </select>
          <select value={form.physicalVerificationStatus} onChange={(e) => set('physicalVerificationStatus', e.target.value)}
            className='h-9 text-xs border border-gray-200 rounded-xl px-2 bg-white focus:outline-none focus:ring-2 focus:ring-[#F7A607]/30'>
            <option value=''>Verification…</option>
            {['PENDING', 'IN_PROGRESS', 'VERIFIED', 'FAILED'].map((s) => (
              <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
            ))}
          </select>
        </div>
        <input value={form.assignedStaff} onChange={(e) => set('assignedStaff', e.target.value)}
          placeholder='Assigned staff member'
          className='w-full h-9 text-xs border border-gray-200 rounded-xl px-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-[#F7A607]/30' />
        <textarea value={form.notes} onChange={(e) => set('notes', e.target.value)} rows={2}
          placeholder='Notes on the paperwork / verification'
          className='w-full text-xs border border-gray-200 rounded-xl p-2.5 bg-white resize-none focus:outline-none focus:ring-2 focus:ring-[#F7A607]/30' />
        <button onClick={submit} disabled={busy}
          className='w-full h-9 bg-[#F7A607] hover:bg-[#e09500] text-white text-xs font-bold rounded-xl disabled:opacity-50'>
          {busy ? 'Saving…' : 'Save Visit'}
        </button>
      </div>

      {visits.length === 0
        ? <p className='text-xs text-gray-400 text-center py-4'>No office visits recorded.</p>
        : visits.map((v) => (
            <div key={v.id} className='border border-gray-100 rounded-2xl p-3.5'>
              <div className='flex items-center justify-between gap-2'>
                <span className='text-xs font-bold text-gray-900'>{v.status.replace(/_/g, ' ')}</span>
                <span className='text-[10px] text-gray-400'>{fmtDate(v.visit_date)} {v.visit_time ?? ''}</span>
              </div>
              {v.assigned_staff && <p className='text-[11px] text-gray-500 mt-1'>Staff: {v.assigned_staff}</p>}
              {v.physical_verification_status && (
                <p className='text-[11px] text-gray-500 mt-0.5'>Verification: {v.physical_verification_status}</p>
              )}
              {v.notes && <p className='text-xs text-gray-600 mt-1.5'>{v.notes}</p>}
            </div>
          ))}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   PAGE
══════════════════════════════════════════════════════════════════════════ */
export default function AdminRegistrations() {
  const paymentsEnabled = usePaymentsEnabled();
  const FILTERS = adminFiltersFor(paymentsEnabled);

  // Dashboard tiles deep-link into a pre-selected filter.
  const [filter,  setFilter]  = useState(
    () => new URLSearchParams(window.location.search).get('filter') ?? '',
  );
  const [search,  setSearch]  = useState('');
  const [query,   setQuery]   = useState('');
  const [page,    setPage]    = useState(1);
  const [data,    setData]    = useState<{ applicants: AdminApplicantRow[]; total: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [openId,  setOpenId]  = useState<number | null>(null);

  const LIMIT = 20;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = { page: String(page), limit: String(LIMIT) };
      if (filter) params.filter = filter;
      if (query)  params.search = query;
      setData(await getAdminApplicants(params));
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [filter, query, page]);

  useEffect(() => { load() }, [load]);

  const totalPages = data ? Math.ceil(data.total / LIMIT) : 1;

  return (
    <div className='p-4 md:p-6 space-y-5 max-w-7xl mx-auto'>
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
        className='bg-[#1a1d1f] rounded-2xl p-5 text-white'>
        <div className='flex items-start justify-between gap-4'>
          <div>
            <p className='text-xs text-gray-400 mb-0.5'>Admin</p>
            <h1 className='text-lg font-extrabold' style={{ fontFamily: 'Plus Jakarta Sans' }}>Applicants</h1>
            <p className='text-xs text-gray-400 mt-1'>
              {paymentsEnabled
                ? 'Every application — paid or not. Call unpaid applicants and follow them through to completion.'
                : 'Every application. Follow each one through to completion.'}
            </p>
          </div>
          {data && (
            <div className='text-right shrink-0'>
              <p className='text-2xl font-extrabold text-[#F7A607]'>{data.total}</p>
              <p className='text-xs text-gray-400 mt-0.5'>
                {FILTERS.find((f) => f.key === filter)?.label ?? 'Total'}
              </p>
            </div>
          )}
        </div>
      </motion.div>

      {/* Filters */}
      <div className='flex gap-1.5 overflow-x-auto pb-1'>
        {FILTERS.map(({ key, label }) => (
          <button key={key} onClick={() => { setFilter(key); setPage(1) }}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all shrink-0
              ${filter === key ? 'bg-[#1a1d1f] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
            {label}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className='flex gap-2'>
        <div className='relative flex-1'>
          <Search className='absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none' />
          <input type='text' value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && (setPage(1), setQuery(search))}
            placeholder='Search by name, application ID, phone or email…'
            className='w-full h-9 pl-9 pr-8 text-sm border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-[#F7A607]/30 focus:border-[#F7A607]' />
          {search && (
            <button onClick={() => { setSearch(''); setQuery(''); setPage(1) }}
              className='absolute right-3 top-1/2 -translate-y-1/2'>
              <X className='w-3.5 h-3.5 text-gray-400' />
            </button>
          )}
        </div>
        <button onClick={() => { setPage(1); setQuery(search) }}
          className='px-4 bg-[#F7A607] hover:bg-[#e09500] text-white text-xs font-bold rounded-xl transition-colors'>
          Search
        </button>
      </div>

      {/* Table */}
      <div className='bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden'>
        {loading ? (
          <div className='p-8 space-y-3'>
            {[1, 2, 3, 4, 5].map((i) => <div key={i} className='h-12 bg-gray-100 rounded-xl animate-pulse' />)}
          </div>
        ) : !data || data.applicants.length === 0 ? (
          <div className='py-16 text-center'>
            <Users className='w-10 h-10 text-gray-300 mx-auto mb-3' />
            <p className='text-sm font-semibold text-gray-500'>No applicants found</p>
          </div>
        ) : (
          <>
            <div className={`hidden lg:grid ${paymentsEnabled ? 'lg:grid-cols-[2fr_1.2fr_1.3fr_1fr_0.8fr_1fr]' : 'lg:grid-cols-[2fr_1.2fr_1.3fr_1fr_1fr]'} gap-3 px-4 py-2.5 bg-gray-50 border-b border-gray-100`}>
              {(paymentsEnabled
                ? ['Applicant', 'Application ID', 'Status', 'Documents', 'Fee', 'Last Activity']
                : ['Applicant', 'Application ID', 'Status', 'Documents', 'Last Activity']
              ).map((h) => (
                <p key={h} className='text-[10px] font-bold text-gray-500 uppercase tracking-wider'>{h}</p>
              ))}
            </div>

            <div className='divide-y divide-gray-50'>
              {data.applicants.map((r) => (
                <div key={r.id} onClick={() => setOpenId(r.id)}
                  className={`grid grid-cols-1 ${paymentsEnabled ? 'lg:grid-cols-[2fr_1.2fr_1.3fr_1fr_0.8fr_1fr]' : 'lg:grid-cols-[2fr_1.2fr_1.3fr_1fr_1fr]'} gap-2 lg:gap-3 px-4 py-3.5
                    hover:bg-gray-50 transition-colors cursor-pointer`}>

                  {/* Applicant */}
                  <div className='flex items-center gap-3 min-w-0'>
                    <div className='w-8 h-8 rounded-full bg-[#292e31] flex items-center justify-center shrink-0'>
                      <span className='text-[10px] font-bold text-[#F7A607]'>
                        {r.full_name
                          ? r.full_name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()
                          : (r.email[0] ?? '?').toUpperCase()}
                      </span>
                    </div>
                    <div className='min-w-0'>
                      <p className='text-sm font-semibold text-gray-900 truncate'>
                        {r.full_name ?? <span className='text-gray-400 italic'>Profile incomplete</span>}
                      </p>
                      <p className='text-[11px] text-gray-400 truncate'>{r.mobile ?? r.email}</p>
                      {r.force && (
                        <span className={`inline-flex items-center gap-1 text-[9px] font-semibold px-1.5 py-0.5 rounded-full mt-0.5
                          ${FORCE_COLOR[r.force] ?? 'bg-gray-100 text-gray-600'}`}>
                          <Shield className='w-2 h-2' />{r.force}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Application ID */}
                  <div className='flex items-center'>
                    <p className='text-xs font-mono text-gray-600 truncate'>{r.registration_ref ?? '—'}</p>
                  </div>

                  {/* Status */}
                  <div className='flex items-center gap-1.5 flex-wrap'>
                    <span className={`text-[10px] font-bold px-2 py-1 rounded-full
                      ${STATUS_CHIP[r.application_status ?? ''] ?? 'bg-gray-100 text-gray-500'}`}>
                      {STATUS_LABEL[r.application_status ?? ''] ?? 'Unknown'}
                    </span>
                    {r.next_followup_date && new Date(r.next_followup_date) <= new Date() && (
                      <span className='inline-flex items-center gap-0.5 text-[9px] font-bold px-1.5 py-0.5 bg-red-100 text-red-700 rounded-full'>
                        <Clock className='w-2 h-2' />Follow up
                      </span>
                    )}
                  </div>

                  {/* Documents */}
                  <div className='flex items-center'>
                    {Number(r.docs_total) > 0 ? (
                      <span className='inline-flex items-center gap-1 text-xs text-gray-600'>
                        {Number(r.docs_approved) === Number(r.docs_total)
                          ? <CheckCircle className='w-3 h-3 text-green-500' />
                          : <AlertCircle className='w-3 h-3 text-amber-500' />}
                        {r.docs_approved}/{r.docs_total}
                      </span>
                    ) : <span className='text-xs text-gray-300'>—</span>}
                  </div>

                  {/* Fee */}
                  {paymentsEnabled && (
                    <div className='flex items-center'>
                      <p className='text-sm font-bold text-gray-900'>₹{r.application_fee || 0}</p>
                    </div>
                  )}

                  {/* Last activity */}
                  <div className='flex items-center'>
                    <p className='text-[11px] text-gray-500'>{fmtDate(r.last_activity_at)}</p>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Pagination */}
      {data && totalPages > 1 && (
        <div className='flex items-center justify-between'>
          <p className='text-xs text-gray-500'>
            {((page - 1) * LIMIT) + 1}–{Math.min(page * LIMIT, data.total)} of {data.total}
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

      {openId !== null && (
        <DetailDrawer id={openId} onClose={() => setOpenId(null)} onChanged={load} />
      )}
    </div>
  );
}
