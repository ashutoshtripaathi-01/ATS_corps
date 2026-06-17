import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  MapPin, Clock, Users, Shield, Bookmark, BookmarkCheck, ChevronLeft,
  Briefcase, IndianRupee, Building2, X, Send, CheckCircle2, RefreshCw,
  CalendarDays, Layers,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAppStore } from '@/store/useAppStore'
import { useCandidateStore } from '@/store/useAppStore'
import { getJob, applyToJob } from '@/lib/api'
import { toast } from '@/hooks/useToast'
import { timeAgo } from '@/lib/utils'

interface ApiJob {
  id: number
  manpower_type: string
  quantity: number
  salary_range: string
  salary_min: number
  salary_max: number
  location: string
  shift: string
  work_site: string
  min_rank: string
  min_service: string
  description: string
  status: string
  app_count: string
  company_name: string | null
  company_district: string | null
  company_state: string | null
  company_email: string | null
  created_at: string
  ref_no: string | null
  employer_id: number | null
}

const SALARY_LABEL: Record<string, string> = {
  '15k-20k': '₹15k – ₹20k/mo',
  '20k-30k': '₹20k – ₹30k/mo',
  '30k-50k': '₹30k – ₹50k/mo',
  '50k+':    '₹50k+/mo',
}

function fmtSalary(job: ApiJob): string {
  if (job.salary_min > 0) {
    const lo = `₹${(job.salary_min / 1000).toFixed(0)}k`
    const hi = job.salary_max > 0 ? ` – ₹${(job.salary_max / 1000).toFixed(0)}k` : '+'
    return `${lo}${hi}/mo`
  }
  return SALARY_LABEL[job.salary_range] ?? job.salary_range
}

/* ── Apply modal ──────────────────────────────────────────────────────── */
interface ApplyModalProps {
  jobTitle: string
  onClose: () => void
  onSubmit: (coverNote: string) => Promise<void>
  submitting: boolean
}

function ApplyModal({ jobTitle, onClose, onSubmit, submitting }: ApplyModalProps) {
  const [note, setNote] = useState('')

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center p-4 sm:p-6">
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 40 }}
        transition={{ duration: 0.2 }}
        className="w-full max-w-md bg-white dark:bg-[#1e2227] rounded-2xl shadow-2xl dark:shadow-black/40 p-6 border dark:border-white/10"
      >
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-base font-extrabold text-gray-900 dark:text-[#F0EFEA]" style={{ fontFamily: 'Plus Jakarta Sans' }}>
              Apply Now
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{jobTitle}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-white/10 transition-colors">
            <X className="w-4 h-4 text-gray-400" />
          </button>
        </div>

        <div className="mb-4">
          <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
            Cover Note <span className="font-normal text-gray-400">(optional)</span>
          </label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={500}
            rows={4}
            placeholder="Briefly introduce yourself — your service history, relevant skills, why you're a good fit…"
            className="w-full rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5 px-3.5 py-2.5 text-sm text-gray-800 dark:text-gray-200 placeholder:text-gray-400 dark:placeholder:text-gray-500 outline-none focus:border-[#F7A607] focus:ring-2 focus:ring-[#F7A607]/15 resize-none"
          />
          <p className="text-[10px] text-gray-400 dark:text-gray-500 text-right mt-1">{note.length}/500</p>
        </div>

        <div className="flex gap-3">
          <Button variant="outline" className="flex-1" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button className="flex-1 gap-2" onClick={() => onSubmit(note)} disabled={submitting}>
            {submitting ? (
              <><RefreshCw className="w-3.5 h-3.5 animate-spin" /> Submitting…</>
            ) : (
              <><Send className="w-3.5 h-3.5" /> Submit Application</>
            )}
          </Button>
        </div>
      </motion.div>
    </div>
  )
}

/* ── Main component ───────────────────────────────────────────────────── */
export default function JobDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useAppStore()
  const { savedJobs, appliedJobs, toggleSaveJob, applyJob } = useCandidateStore()

  const [job,         setJob]         = useState<ApiJob | null>(null)
  const [loading,     setLoading]     = useState(true)
  const [showApply,   setShowApply]   = useState(false)
  const [submitting,  setSubmitting]  = useState(false)
  const [justApplied, setJustApplied] = useState(false)

  useEffect(() => {
    if (!id) return
    setLoading(true)
    getJob(id)
      .then(setJob)
      .catch(() => setJob(null))
      .finally(() => setLoading(false))
  }, [id])

  const isSaved   = job ? savedJobs.includes(String(job.id))   : false
  const isApplied = job ? appliedJobs.includes(String(job.id)) || justApplied : false

  const handleApply = async (coverNote: string) => {
    if (!user?.id) { navigate('/candidate/register'); return }
    setSubmitting(true)
    try {
      await applyToJob(String(job!.id), coverNote || undefined)
      applyJob(String(job!.id))
      setJustApplied(true)
      setShowApply(false)
      toast({ title: 'Application submitted!', description: `Your application for ${job!.manpower_type} has been sent.`, variant: 'success' })
    } catch (err: any) {
      const msg: string = err.message ?? 'Failed to apply'
      if (msg.toLowerCase().includes('already applied')) {
        applyJob(String(job!.id))
        setJustApplied(true)
        setShowApply(false)
        toast({ title: 'Already applied', description: 'You have already applied to this job.', variant: 'default' })
      } else {
        toast({ title: 'Apply failed', description: msg, variant: 'error' })
      }
    } finally {
      setSubmitting(false)
    }
  }

  /* ── Loading ───────────────────────────────────────────────────────── */
  if (loading) {
    return (
      <div className="p-4 sm:p-6 max-w-5xl mx-auto">
        <div className="h-8 w-28 bg-gray-100 dark:bg-white/10 rounded-xl animate-pulse mb-6" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-5">
            <div className="h-64 bg-white dark:bg-[#1e2227] border border-gray-100 dark:border-white/8 rounded-2xl animate-pulse" />
            <div className="h-48 bg-white dark:bg-[#1e2227] border border-gray-100 dark:border-white/8 rounded-2xl animate-pulse" />
          </div>
          <div className="space-y-5">
            <div className="h-52 bg-white dark:bg-[#1e2227] border border-gray-100 dark:border-white/8 rounded-2xl animate-pulse" />
          </div>
        </div>
      </div>
    )
  }

  /* ── 404 ───────────────────────────────────────────────────────────── */
  if (!job) {
    return (
      <div className="flex flex-col items-center justify-center py-24 px-6 text-center">
        <div className="w-16 h-16 rounded-2xl bg-gray-100 dark:bg-white/10 flex items-center justify-center mb-4">
          <Briefcase className="w-8 h-8 text-gray-400" />
        </div>
        <h2 className="text-lg font-bold text-gray-900 dark:text-[#F0EFEA] mb-1">Job not found</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">This listing may have been removed or filled.</p>
        <Button onClick={() => navigate('/candidate/jobs')}>Browse All Jobs</Button>
      </div>
    )
  }

  const postedLabel = timeAgo(job.created_at)
  const salary      = fmtSalary(job)
  const companyName = job.company_name ?? 'Government / PSU'
  const companyLoc  = [job.company_district, job.company_state].filter(Boolean).join(', ') || job.location

  return (
    <>
      <AnimatePresence>
        {showApply && (
          <ApplyModal
            jobTitle={job.manpower_type}
            onClose={() => setShowApply(false)}
            onSubmit={handleApply}
            submitting={submitting}
          />
        )}
      </AnimatePresence>

      <div className="p-4 sm:p-6 max-w-5xl mx-auto">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-[#F0EFEA] mb-5 transition-colors"
        >
          <ChevronLeft className="w-4 h-4" /> Back to Jobs
        </button>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* ── Left column ──────────────────────────────────────────── */}
          <div className="lg:col-span-2 space-y-5">

            {/* Job header card */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white dark:bg-[#1e2227] border border-gray-100 dark:border-white/8 rounded-2xl shadow-sm p-5 sm:p-6"
            >
              <div className="flex items-start gap-4 mb-5">
                <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-[#292e31] flex items-center justify-center shrink-0">
                  <Briefcase className="w-5 h-5 sm:w-6 sm:h-6 text-[#F7A607]" />
                </div>
                <div className="flex-1 min-w-0">
                  <h1 className="text-lg sm:text-xl font-extrabold text-gray-900 dark:text-[#F0EFEA] leading-tight mb-1" style={{ fontFamily: 'Plus Jakarta Sans' }}>
                    {job.manpower_type}
                  </h1>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {companyName}
                    {companyLoc && <> · <span>{companyLoc}</span></>}
                  </p>
                  <div className="flex flex-wrap items-center gap-2 mt-1.5">
                    {job.ref_no && (
                      <span className="text-[10px] font-mono bg-gray-100 dark:bg-white/10 text-gray-500 dark:text-gray-400 px-2 py-0.5 rounded-md">
                        {job.ref_no}
                      </span>
                    )}
                    <span className="text-[10px] text-gray-400 dark:text-gray-500 flex items-center gap-1">
                      <Clock className="w-3 h-3" /> Posted {postedLabel}
                    </span>
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                      job.status === 'active'
                        ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
                        : 'bg-gray-100 dark:bg-white/10 text-gray-500 dark:text-gray-400'
                    }`}>
                      {job.status.charAt(0).toUpperCase() + job.status.slice(1)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Stats grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
                {[
                  { icon: MapPin,      label: 'Location',  value: job.location },
                  { icon: IndianRupee, label: 'Salary',    value: salary },
                  { icon: Clock,       label: 'Shift',     value: job.shift },
                  { icon: Building2,   label: 'Work Site', value: job.work_site },
                ].map(({ icon: Icon, label, value }) => (
                  <div key={label} className="bg-gray-50 dark:bg-white/5 rounded-xl p-3">
                    <div className="flex items-center gap-1.5 mb-1">
                      <Icon className="w-3.5 h-3.5 text-[#F7A607]" />
                      <p className="text-[10px] font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wide">{label}</p>
                    </div>
                    <p className="text-xs font-bold text-gray-800 dark:text-gray-200 leading-snug">{value}</p>
                  </div>
                ))}
              </div>

              {/* Badges */}
              <div className="flex flex-wrap gap-2 mb-5">
                <span className="flex items-center gap-1.5 text-xs font-semibold bg-[#292e31]/10 dark:bg-white/8 text-[#292e31] dark:text-gray-200 px-3 py-1.5 rounded-full">
                  <Shield className="w-3.5 h-3.5" /> Min Rank: {job.min_rank}
                </span>
                <span className="flex items-center gap-1.5 text-xs font-semibold bg-[#F7A607]/10 text-[#F7A607] px-3 py-1.5 rounded-full">
                  <CalendarDays className="w-3.5 h-3.5" /> Min Service: {job.min_service}
                </span>
                <span className="flex items-center gap-1.5 text-xs font-semibold bg-blue-50 dark:bg-blue-900/25 text-blue-700 dark:text-blue-300 px-3 py-1.5 rounded-full">
                  <Users className="w-3.5 h-3.5" /> {job.quantity} Opening{job.quantity !== 1 ? 's' : ''}
                </span>
                <span className="flex items-center gap-1.5 text-xs font-semibold bg-gray-100 dark:bg-white/8 text-gray-600 dark:text-gray-300 px-3 py-1.5 rounded-full">
                  <Layers className="w-3.5 h-3.5" /> {job.app_count} Applied
                </span>
              </div>

              {/* Action buttons */}
              <div className="flex gap-3">
                <Button
                  size="lg"
                  className={`flex-1 gap-2 ${isApplied ? 'bg-green-600 hover:bg-green-700' : ''}`}
                  onClick={() => { if (!isApplied) setShowApply(true) }}
                  disabled={isApplied || job.status !== 'active'}
                >
                  {isApplied ? (
                    <><CheckCircle2 className="w-4 h-4" /> Applied</>
                  ) : job.status !== 'active' ? (
                    'Position Closed'
                  ) : (
                    <><Send className="w-4 h-4" /> Apply Now</>
                  )}
                </Button>
                <button
                  onClick={() => toggleSaveJob(String(job.id))}
                  className={`flex items-center justify-center w-12 h-12 rounded-xl border-2 transition-all ${
                    isSaved
                      ? 'border-[#F7A607] text-[#F7A607] bg-[#F7A607]/5'
                      : 'border-gray-200 dark:border-white/15 text-gray-400 dark:text-gray-500 hover:border-gray-300 dark:hover:border-white/25'
                  }`}
                  title={isSaved ? 'Remove from saved' : 'Save job'}
                >
                  {isSaved ? <BookmarkCheck className="w-5 h-5" /> : <Bookmark className="w-5 h-5" />}
                </button>
              </div>
            </motion.div>

            {/* Description */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.08 }}
              className="bg-white dark:bg-[#1e2227] border border-gray-100 dark:border-white/8 rounded-2xl shadow-sm p-5 sm:p-6"
            >
              <h2 className="text-base font-extrabold text-gray-900 dark:text-[#F0EFEA] mb-4" style={{ fontFamily: 'Plus Jakarta Sans' }}>
                Job Description
              </h2>
              <div className="prose prose-sm max-w-none text-gray-600 dark:text-gray-300 leading-relaxed whitespace-pre-line">
                {job.description}
              </div>
            </motion.div>
          </div>

          {/* ── Right column ─────────────────────────────────────────── */}
          <div className="space-y-5">

            {/* Quick apply card */}
            <motion.div
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 }}
              className="bg-[#292e31] rounded-2xl p-5 text-white border border-white/5"
            >
              <p className="text-xs text-gray-400 mb-1">Position</p>
              <h3 className="font-extrabold text-base mb-0.5" style={{ fontFamily: 'Plus Jakarta Sans' }}>
                {job.manpower_type}
              </h3>
              <p className="text-xs text-[#F7A607] font-semibold mb-4">{salary}</p>

              <div className="space-y-2 mb-5">
                {[
                  { label: 'Location',    value: job.location },
                  { label: 'Shift',       value: job.shift },
                  { label: 'Work Site',   value: job.work_site },
                  { label: 'Openings',    value: String(job.quantity) },
                  { label: 'Min Rank',    value: job.min_rank },
                  { label: 'Min Service', value: job.min_service },
                ].map(({ label, value }) => (
                  <div key={label} className="flex justify-between text-xs">
                    <span className="text-gray-400">{label}</span>
                    <span className="text-white font-semibold text-right max-w-[55%]">{value}</span>
                  </div>
                ))}
              </div>

              <Button
                className={`w-full gap-2 ${isApplied ? 'bg-green-600 hover:bg-green-700' : ''}`}
                onClick={() => { if (!isApplied) setShowApply(true) }}
                disabled={isApplied || job.status !== 'active'}
              >
                {isApplied ? (
                  <><CheckCircle2 className="w-4 h-4" /> Applied</>
                ) : job.status !== 'active' ? (
                  'Position Closed'
                ) : (
                  <><Send className="w-4 h-4" /> Apply Now</>
                )}
              </Button>
            </motion.div>

            {/* Company card */}
            {job.company_name && (
              <motion.div
                initial={{ opacity: 0, x: 12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.15 }}
                className="bg-white dark:bg-[#1e2227] border border-gray-100 dark:border-white/8 rounded-2xl shadow-sm p-5"
              >
                <h3 className="font-bold text-gray-900 dark:text-[#F0EFEA] text-sm mb-3">About the Company</h3>
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-xl bg-[#292e31] flex items-center justify-center shrink-0">
                    <Building2 className="w-5 h-5 text-[#F7A607]" />
                  </div>
                  <div>
                    <p className="font-semibold text-sm text-gray-900 dark:text-[#F0EFEA]">{job.company_name}</p>
                    {companyLoc && <p className="text-xs text-gray-500 dark:text-gray-400">{companyLoc}</p>}
                  </div>
                </div>
                {job.company_email && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1.5">
                    <span className="text-gray-400 dark:text-gray-500">Email:</span>
                    <a href={`mailto:${job.company_email}`} className="text-[#F7A607] hover:underline">
                      {job.company_email}
                    </a>
                  </p>
                )}
              </motion.div>
            )}

            {/* Tips card */}
            <motion.div
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 }}
              className="bg-[#F7A607]/5 dark:bg-[#F7A607]/8 border border-[#F7A607]/20 dark:border-[#F7A607]/15 rounded-2xl p-5"
            >
              <h3 className="font-bold text-gray-900 dark:text-[#F0EFEA] text-sm mb-2">Application Tips</h3>
              <ul className="space-y-2">
                {[
                  'Keep your profile updated with latest service records',
                  'Mention relevant security or guard experience',
                  'Apply early — positions fill quickly',
                ].map((tip) => (
                  <li key={tip} className="flex items-start gap-2 text-xs text-gray-600 dark:text-gray-300">
                    <CheckCircle2 className="w-3.5 h-3.5 text-[#F7A607] mt-0.5 shrink-0" />
                    {tip}
                  </li>
                ))}
              </ul>
            </motion.div>
          </div>
        </div>
      </div>
    </>
  )
}
