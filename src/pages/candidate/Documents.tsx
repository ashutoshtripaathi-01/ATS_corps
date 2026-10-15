import { useEffect, useState, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  Upload, CheckCircle, AlertCircle, Clock, Lock, Loader2,
  FileText, RefreshCw, ShieldCheck,
} from 'lucide-react'
import {
  getMyDocuments, uploadDocument, type DocumentSlot,
} from '@/lib/api'
import { DOC_META, DOC_STATUS_CHIP, STATUS_LABEL } from '@/constants/applicationStatus'
import { SecureDocLink } from '@/components/shared/SecureDocLink'
import { toast } from '@/hooks/useToast'

const STATUS_ICON: Record<string, React.ElementType> = {
  PENDING:      Clock,
  UPLOADED:     CheckCircle,
  UNDER_REVIEW: Clock,
  APPROVED:     CheckCircle,
  REJECTED:     AlertCircle,
}

function DocRow({
  slot, onUploaded,
}: {
  slot: DocumentSlot
  onUploaded: (docs: DocumentSlot[]) => void
}) {
  const [busy, setBusy] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const meta     = DOC_META[slot.docType] ?? { label: slot.docType, hint: '', required: false }
  const Icon     = STATUS_ICON[slot.status] ?? Clock
  const rejected = slot.status === 'REJECTED'
  const approved = slot.status === 'APPROVED'
  const filled   = slot.status !== 'PENDING'

  const pick = (file: File) => {
    if (file.size > 10 * 1024 * 1024) {
      toast({ title: 'File too large', description: 'Maximum size is 10 MB.', variant: 'error' })
      return
    }
    setBusy(true)
    uploadDocument(slot.docType, file)
      .then((r) => {
        onUploaded(r.documents)
        toast({ title: `${meta.label} uploaded` })
      })
      .catch((e: Error) =>
        toast({ title: 'Upload failed', description: (e as Error).message, variant: 'error' }))
      .finally(() => {
        setBusy(false)
        if (inputRef.current) inputRef.current.value = ''
      })
  }

  return (
    <div className={`rounded-2xl border p-4 transition-colors
      ${rejected ? 'border-red-200 bg-red-50/50'
        : approved ? 'border-green-200 bg-green-50/40'
        : filled   ? 'border-blue-200 bg-blue-50/30'
        : 'border-gray-200 bg-white'}`}
    >
      <div className='flex items-start gap-3'>
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0
          ${rejected ? 'bg-red-100' : approved ? 'bg-green-100' : filled ? 'bg-blue-100' : 'bg-gray-100'}`}>
          <Icon className={`w-4 h-4
            ${rejected ? 'text-red-600' : approved ? 'text-green-600' : filled ? 'text-blue-600' : 'text-gray-400'}`} />
        </div>

        <div className='flex-1 min-w-0'>
          <div className='flex items-center gap-2 flex-wrap'>
            <p className='text-sm font-bold text-gray-900'>{meta.label}</p>
            {meta.required
              ? <span className='text-[9px] font-bold text-red-500 uppercase tracking-wide'>Required</span>
              : <span className='text-[9px] font-bold text-gray-400 uppercase tracking-wide'>Optional</span>}
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${DOC_STATUS_CHIP[slot.status]}`}>
              {slot.status.replace(/_/g, ' ')}
            </span>
          </div>

          <p className='text-xs text-gray-500 mt-0.5'>{meta.hint}</p>

          {slot.originalName && (
            <p className='text-[11px] text-gray-400 mt-1 truncate'>{slot.originalName}</p>
          )}

          {rejected && slot.rejectionReason && (
            <div className='mt-2 rounded-xl bg-red-100/70 border border-red-200 px-3 py-2'>
              <p className='text-[10px] font-bold text-red-700 uppercase tracking-wide mb-0.5'>Reason for rejection</p>
              <p className='text-xs text-red-700'>{slot.rejectionReason}</p>
            </div>
          )}
        </div>

        <div className='flex flex-col items-end gap-1.5 shrink-0'>
          <input
            ref={inputRef}
            type='file'
            accept='.jpg,.jpeg,.png,.pdf,.doc,.docx'
            className='hidden'
            onChange={(e) => { const f = e.target.files?.[0]; if (f) pick(f) }}
          />
          <button
            onClick={() => inputRef.current?.click()}
            disabled={busy || approved}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-colors
              disabled:opacity-50 disabled:cursor-not-allowed
              ${rejected ? 'bg-red-600 hover:bg-red-700 text-white'
                : filled ? 'border border-gray-200 text-gray-600 hover:bg-gray-50'
                : 'bg-[#F7A607] hover:bg-[#e09500] text-white'}`}
          >
            {busy
              ? <><Loader2 className='w-3 h-3 animate-spin' />Uploading…</>
              : approved
                ? <><CheckCircle className='w-3 h-3' />Approved</>
                : rejected
                  ? <><RefreshCw className='w-3 h-3' />Upload Again</>
                  : filled
                    ? <><RefreshCw className='w-3 h-3' />Replace</>
                    : <><Upload className='w-3 h-3' />Upload</>}
          </button>

          {slot.id && <SecureDocLink docId={slot.id} />}
        </div>
      </div>
    </div>
  )
}

export default function CandidateDocuments() {
  const navigate = useNavigate()
  const [loading, setLoading]   = useState(true)
  const [unlocked, setUnlocked] = useState(false)
  const [status, setStatus]     = useState<string | null>(null)
  const [docs, setDocs]         = useState<DocumentSlot[]>([])

  const load = useCallback(() => {
    setLoading(true)
    getMyDocuments()
      .then((r) => { setUnlocked(r.unlocked); setStatus(r.applicationStatus); setDocs(r.documents) })
      .catch((e: Error) => toast({ title: 'Could not load documents', description: (e as Error).message, variant: 'error' }))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { load() }, [load])

  const required = docs.filter((d) => d.required)
  const done     = required.filter((d) => d.status !== 'PENDING').length
  const approved = required.filter((d) => d.status === 'APPROVED').length

  if (loading) {
    return (
      <div className='p-4 md:p-6 max-w-3xl mx-auto space-y-3'>
        {[1, 2, 3, 4].map((i) => <div key={i} className='h-20 bg-gray-100 rounded-2xl animate-pulse' />)}
      </div>
    )
  }

  /* ── Locked: payment not yet confirmed ── */
  if (!unlocked) {
    return (
      <div className='p-4 md:p-6 max-w-lg mx-auto'>
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
          className='bg-white border border-gray-100 rounded-3xl shadow-sm p-8 text-center'>
          <div className='w-14 h-14 rounded-2xl bg-amber-50 flex items-center justify-center mx-auto mb-4'>
            <Lock className='w-6 h-6 text-amber-500' />
          </div>
          <h1 className='text-lg font-extrabold text-gray-900 mb-1.5' style={{ fontFamily: 'Plus Jakarta Sans' }}>
            Documents are locked
          </h1>
          <p className='text-sm text-gray-500 leading-relaxed mb-5'>
            Your application is saved. Document upload opens as soon as your
            registration payment is confirmed.
          </p>
          {status && (
            <p className='text-xs text-gray-400 mb-5'>
              Current status: <span className='font-semibold text-gray-600'>{STATUS_LABEL[status] ?? status}</span>
            </p>
          )}
          <button
            onClick={() => navigate('/candidate/dashboard')}
            className='w-full h-11 rounded-xl bg-[#F7A607] hover:bg-[#e09500] text-white text-sm font-bold transition-colors'
          >
            Go to Dashboard
          </button>
        </motion.div>
      </div>
    )
  }

  return (
    <div className='p-4 md:p-6 max-w-3xl mx-auto space-y-5'>
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
        className='bg-[#1a1d1f] rounded-2xl p-5 text-white'>
        <div className='flex items-start justify-between gap-4'>
          <div>
            <p className='text-xs text-gray-400 mb-0.5'>Complete Your Profile</p>
            <h1 className='text-lg font-extrabold' style={{ fontFamily: 'Plus Jakarta Sans' }}>
              Upload Required Documents
            </h1>
            <p className='text-xs text-gray-400 mt-1'>
              Our team verifies each document before your office visit is scheduled.
            </p>
          </div>
          <div className='text-right shrink-0'>
            <p className='text-2xl font-extrabold text-[#F7A607]'>{done}/{required.length}</p>
            <p className='text-xs text-gray-400 mt-0.5'>Uploaded</p>
          </div>
        </div>

        <div className='mt-4 h-1.5 bg-white/10 rounded-full overflow-hidden'>
          <div className='h-full bg-[#F7A607] rounded-full transition-all duration-500'
            style={{ width: `${(done / Math.max(required.length, 1)) * 100}%` }} />
        </div>
      </motion.div>

      {approved === required.length && required.length > 0 && (
        <div className='flex items-center gap-2.5 bg-green-50 border border-green-200 rounded-2xl px-4 py-3'>
          <ShieldCheck className='w-4 h-4 text-green-600 shrink-0' />
          <p className='text-xs font-semibold text-green-800'>
            All documents verified. Our team will contact you to schedule your office visit.
          </p>
        </div>
      )}

      {docs.some((d) => d.status === 'REJECTED') && (
        <div className='flex items-center gap-2.5 bg-red-50 border border-red-200 rounded-2xl px-4 py-3'>
          <AlertCircle className='w-4 h-4 text-red-600 shrink-0' />
          <p className='text-xs font-semibold text-red-800'>
            Some documents need to be re-uploaded. See the reason under each one below.
          </p>
        </div>
      )}

      {/* Required */}
      <div className='space-y-2.5'>
        <p className='text-[10px] font-bold text-gray-400 uppercase tracking-widest px-1'>Required Documents</p>
        {docs.filter((d) => d.required).map((d) => (
          <DocRow key={d.docType} slot={d} onUploaded={setDocs} />
        ))}
      </div>

      {/* Optional */}
      <div className='space-y-2.5'>
        <p className='text-[10px] font-bold text-gray-400 uppercase tracking-widest px-1'>Supporting Documents</p>
        {docs.filter((d) => !d.required).map((d) => (
          <DocRow key={d.docType} slot={d} onUploaded={setDocs} />
        ))}
      </div>

      <p className='flex items-center justify-center gap-1.5 text-[11px] text-gray-400 pt-1'>
        <FileText className='w-3 h-3' />
        JPG, PNG, PDF, DOC or DOCX · up to 10 MB each
      </p>
    </div>
  )
}
