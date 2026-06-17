import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Briefcase, Search, MapPin, Users, ChevronDown,
  CheckCircle, XCircle, Clock, X, Building2,
  IndianRupee, Shield, CalendarDays, Hash,
} from 'lucide-react'
import { getAdminJobs, getJobApplications, updateJobStatus } from '@/lib/api'
import { toast } from '@/hooks/useToast'

interface Job {
  id: number
  employer_id: number | null
  ref_no: string | null
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
  status: 'active' | 'closed' | 'draft'
  app_count: string
  company_name: string | null
  company_district: string | null
  created_at: string
}

interface Applicant {
  id: number
  full_name: string
  force: string
  rank: string
  mobile: string
  loc1: string
  status: string
  created_at: string
}

const STATUS_STYLE: Record<string, string> = {
  active: 'bg-green-100 text-green-700',
  closed: 'bg-gray-100 text-gray-500',
  draft:  'bg-amber-100 text-amber-700',
}
const STATUS_ICON: Record<string, React.ElementType> = {
  active: CheckCircle, closed: XCircle, draft: Clock,
}
const APP_STATUS_STYLE: Record<string, string> = {
  applied:      'bg-blue-50 text-blue-700',
  'under-review':'bg-purple-50 text-purple-700',
  shortlisted:  'bg-amber-50 text-amber-700',
  interview:    'bg-indigo-50 text-indigo-700',
  offer:        'bg-teal-50 text-teal-700',
  hired:        'bg-green-100 text-green-700',
  rejected:     'bg-red-50 text-red-600',
}

function JobDetailPanel({ job, onClose }: { job: Job; onClose: () => void }) {
  const [applicants, setApplicants] = useState<Applicant[]>([])
  const [loadingApps, setLoadingApps] = useState(true)
  const [updatingStatus, setUpdatingStatus] = useState(false)
  const StatusIcon = STATUS_ICON[job.status]

  useEffect(() => {
    getJobApplications(String(job.id))
      .then(setApplicants)
      .catch(console.error)
      .finally(() => setLoadingApps(false))
  }, [job.id])

  const handleStatusChange = async (newStatus: string) => {
    setUpdatingStatus(true)
    try {
      await updateJobStatus(String(job.id), newStatus)
      toast({ title: 'Status updated', description: `Job marked as ${newStatus}`, variant: 'success' })
    } catch (e: any) {
      toast({ title: 'Update failed', description: e.message, variant: 'error' })
    } finally {
      setUpdatingStatus(false)
    }
  }

  return (
    <motion.div
      key={job.id}
      initial={{ opacity: 0, x: 24 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 24 }}
      transition={{ duration: 0.22 }}
      className="flex flex-col h-full overflow-hidden"
    >
      <div className="flex items-start justify-between gap-3 p-5 border-b border-gray-100 shrink-0">
        <div className="flex items-start gap-3">
          <div className="w-11 h-11 rounded-xl bg-[#292e31] flex items-center justify-center shrink-0 mt-0.5">
            <Briefcase className="w-5 h-5 text-[#F7A607]" />
          </div>
          <div>
            <h2 className="text-base font-extrabold text-gray-900 leading-tight" style={{ fontFamily: 'Plus Jakarta Sans' }}>
              {job.manpower_type}
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">{job.company_name ?? 'Direct listing'}</p>
          </div>
        </div>
        <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors shrink-0 mt-0.5">
          <X className="w-4 h-4 text-gray-400" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-5 space-y-5">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-full ${STATUS_STYLE[job.status]}`}>
            <StatusIcon className="w-3.5 h-3.5" />
            {job.status.charAt(0).toUpperCase() + job.status.slice(1)}
          </span>
          {job.ref_no && (
            <span className="flex items-center gap-1 text-xs text-gray-400 font-mono">
              <Hash className="w-3 h-3" />{job.ref_no}
            </span>
          )}

          <div className="flex gap-1.5 ml-auto">
            {(['active','closed','draft'] as const).filter(s => s !== job.status).map((s) => (
              <button key={s} disabled={updatingStatus}
                onClick={() => handleStatusChange(s)}
                className={`text-[10px] px-2.5 py-1 rounded-full border font-semibold transition-all
                  ${s === 'active' ? 'border-green-200 text-green-700 hover:bg-green-50'
                    : s === 'closed' ? 'border-gray-200 text-gray-600 hover:bg-gray-50'
                    : 'border-amber-200 text-amber-700 hover:bg-amber-50'}`}
              >
                Mark {s}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          {[
            { icon: MapPin,       label: 'Location',   value: job.location },
            { icon: Building2,    label: 'Company HQ', value: job.company_district ?? '—' },
            { icon: Clock,        label: 'Shift',      value: job.shift },
            { icon: CalendarDays, label: 'Posted On',  value: new Date(job.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) },
            { icon: Users,        label: 'Vacancies',  value: `${job.quantity} open slot${job.quantity !== 1 ? 's' : ''}` },
            { icon: Building2,    label: 'Work Site',  value: job.work_site },
          ].map(({ icon: Icon, label, value }) => (
            <div key={label} className="bg-gray-50 rounded-xl p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <Icon className="w-3.5 h-3.5 text-gray-400" />
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">{label}</p>
              </div>
              <p className="text-xs font-semibold text-gray-800">{value}</p>
            </div>
          ))}
        </div>

        <div className="bg-[#F7A607]/8 border border-[#F7A607]/20 rounded-xl p-4">
          <div className="flex items-center gap-1.5 mb-1">
            <IndianRupee className="w-3.5 h-3.5 text-[#F7A607]" />
            <p className="text-[10px] font-semibold text-[#F7A607] uppercase tracking-wide">Monthly Salary</p>
          </div>
          <p className="text-lg font-extrabold text-gray-900">
            {job.salary_min > 0
              ? `₹${job.salary_min.toLocaleString('en-IN')} – ₹${job.salary_max > 0 ? job.salary_max.toLocaleString('en-IN') : 'above'}`
              : job.salary_range}
          </p>
        </div>

        <div className="bg-white border border-gray-100 rounded-xl p-4 space-y-2">
          <p className="text-xs font-bold text-gray-900 flex items-center gap-1.5">
            <Shield className="w-3.5 h-3.5 text-[#F7A607]" />Eligibility
          </p>
          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-500">Minimum Rank</span>
            <span className="font-semibold text-gray-800">{job.min_rank}</span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-500">Minimum Service</span>
            <span className="font-semibold text-gray-800">{job.min_service}</span>
          </div>
        </div>

        <div>
          <p className="text-xs font-bold text-gray-900 mb-2">Job Description</p>
          <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-line">{job.description}</p>
        </div>

        <div>
          <p className="text-xs font-bold text-gray-900 flex items-center gap-1.5 mb-3">
            <Users className="w-3.5 h-3.5 text-[#F7A607]" />
            Applicants ({loadingApps ? '…' : applicants.length})
          </p>
          {loadingApps ? (
            <div className="space-y-2">
              {[1,2].map(i => <div key={i} className="h-12 bg-gray-100 rounded-xl animate-pulse" />)}
            </div>
          ) : applicants.length === 0 ? (
            <div className="py-6 text-center text-sm text-gray-400 bg-gray-50 rounded-xl">
              No applications received yet.
            </div>
          ) : (
            <div className="space-y-2">
              {applicants.map((a) => (
                <div key={a.id} className="flex items-center gap-3 bg-gray-50 rounded-xl px-3 py-2.5 border border-gray-100">
                  <div className="w-8 h-8 rounded-full bg-[#292e31] flex items-center justify-center shrink-0">
                    <span className="text-[10px] font-bold text-[#F7A607]">
                      {a.full_name.split(' ').map((n) => n[0]).join('').slice(0, 2)}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900">{a.full_name}</p>
                    <p className="text-xs text-gray-500">{a.force} · {a.rank}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <span className={`inline-flex text-[10px] font-semibold px-2 py-0.5 rounded-full ${APP_STATUS_STYLE[a.status] ?? 'bg-gray-100 text-gray-600'}`}>
                      {a.status.charAt(0).toUpperCase() + a.status.slice(1)}
                    </span>
                    <p className="text-[10px] text-gray-400 mt-0.5">
                      {new Date(a.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  )
}

export default function AdminJobs() {
  const [jobs, setJobs] = useState<Job[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [selected, setSelected] = useState<Job | null>(null)

  useEffect(() => {
    getAdminJobs()
      .then(setJobs)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  const filtered = jobs.filter((j) => {
    const matchSearch =
      j.manpower_type.toLowerCase().includes(search.toLowerCase()) ||
      (j.company_name ?? '').toLowerCase().includes(search.toLowerCase())
    const matchStatus = statusFilter === 'all' || j.status === statusFilter
    return matchSearch && matchStatus
  })

  return (
    <div className="flex h-[calc(100vh-56px)] overflow-hidden">

      {/* Left: card list */}
      <div className={`flex flex-col shrink-0 overflow-hidden transition-all duration-300
        ${selected ? 'w-full md:w-80 lg:w-96' : 'w-full'}
        ${selected ? 'hidden md:flex' : 'flex'}`}
      >
        <div className="p-4 md:p-5 space-y-3 border-b border-gray-100 bg-white shrink-0">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-base font-extrabold text-gray-900" style={{ fontFamily: 'Plus Jakarta Sans' }}>Job Posts</h1>
              <p className="text-xs text-gray-500 mt-0.5">
                {loading ? 'Loading…' : `${jobs.length} total · ${jobs.filter(j => j.status === 'active').length} active`}
              </p>
            </div>
            <div className="w-9 h-9 rounded-xl bg-[#F7A607]/10 flex items-center justify-center">
              <Briefcase className="w-4 h-4 text-[#F7A607]" />
            </div>
          </div>

          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
              <input value={search} onChange={(e) => setSearch(e.target.value)}
                placeholder="Search jobs or company…"
                className="w-full h-9 pl-8 pr-3 rounded-xl border border-gray-200 bg-white text-xs outline-none
                  focus:border-[#F7A607] focus:ring-2 focus:ring-[#F7A607]/10 placeholder:text-gray-400"
              />
            </div>
            <div className="relative">
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
                className="h-9 pl-3 pr-7 rounded-xl border border-gray-200 bg-white text-xs appearance-none
                  outline-none focus:border-[#F7A607] cursor-pointer text-gray-700"
              >
                <option value="all">All</option>
                <option value="active">Active</option>
                <option value="closed">Closed</option>
                <option value="draft">Draft</option>
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400 pointer-events-none" />
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
          {loading && (
            <div className="space-y-2.5 p-1">
              {[1,2,3].map(i => <div key={i} className="h-24 bg-white rounded-2xl border border-gray-100 animate-pulse" />)}
            </div>
          )}

          {!loading && filtered.map((job, i) => {
            const StatusIcon = STATUS_ICON[job.status]
            const isSelected = selected?.id === job.id

            return (
              <motion.button
                key={job.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.04 * i }}
                onClick={() => setSelected(isSelected ? null : job)}
                className={`w-full text-left rounded-2xl border p-4 transition-all duration-200
                  ${isSelected
                    ? 'bg-[#292e31] border-[#292e31] shadow-lg'
                    : 'bg-white border-gray-100 hover:border-[#F7A607]/40 hover:shadow-sm shadow-sm'}`}
              >
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="flex items-start gap-2.5">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0
                      ${isSelected ? 'bg-[#F7A607]' : 'bg-[#292e31]'}`}>
                      <Briefcase className={`w-4 h-4 ${isSelected ? 'text-white' : 'text-[#F7A607]'}`} />
                    </div>
                    <div className="min-w-0">
                      <p className={`text-sm font-bold leading-tight truncate ${isSelected ? 'text-white' : 'text-gray-900'}`}>
                        {job.manpower_type}
                      </p>
                      <p className={`text-[11px] mt-0.5 truncate ${isSelected ? 'text-gray-300' : 'text-gray-500'}`}>
                        {job.company_name ?? 'Direct listing'}
                      </p>
                    </div>
                  </div>
                  <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0
                    ${isSelected ? 'bg-white/15 text-white' : STATUS_STYLE[job.status]}`}>
                    <StatusIcon className="w-3 h-3" />
                    {job.status}
                  </span>
                </div>

                <div className={`flex items-center gap-3 text-[11px] flex-wrap ${isSelected ? 'text-gray-300' : 'text-gray-500'}`}>
                  <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{job.location}</span>
                  <span className="flex items-center gap-1"><CalendarDays className="w-3 h-3" />
                    {new Date(job.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                  </span>
                </div>

                <div className={`flex items-center justify-between mt-3 pt-3 border-t
                  ${isSelected ? 'border-white/10' : 'border-gray-50'}`}>
                  <span className={`flex items-center gap-1 text-[11px] font-semibold
                    ${isSelected ? 'text-gray-200' : 'text-gray-600'}`}>
                    <Users className="w-3.5 h-3.5" />
                    {job.app_count} applicant{Number(job.app_count) !== 1 ? 's' : ''}
                  </span>
                  <span className={`text-[11px] font-semibold ${isSelected ? 'text-[#F7A607]' : 'text-gray-500'}`}>
                    {job.quantity} slot{job.quantity !== 1 ? 's' : ''}
                  </span>
                </div>
              </motion.button>
            )
          })}

          {!loading && filtered.length === 0 && (
            <div className="py-16 text-center">
              <Briefcase className="w-8 h-8 text-gray-300 mx-auto mb-2" />
              <p className="text-sm text-gray-400">No jobs found.</p>
            </div>
          )}
        </div>
      </div>

      {/* Right: detail panel */}
      <AnimatePresence>
        {selected && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/40 z-40 md:hidden"
              onClick={() => setSelected(null)}
            />
            <motion.div
              initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ duration: 0.3 }}
              className="fixed bottom-0 left-0 right-0 h-[92%] bg-white rounded-t-2xl z-50 md:hidden overflow-hidden flex flex-col"
            >
              <JobDetailPanel job={selected} onClose={() => setSelected(null)} />
            </motion.div>

            <div className="hidden md:flex flex-col flex-1 min-w-0 border-l border-gray-100 bg-white overflow-hidden">
              <JobDetailPanel job={selected} onClose={() => setSelected(null)} />
            </div>
          </>
        )}
      </AnimatePresence>

      {!selected && (
        <div className="hidden md:flex flex-1 items-center justify-center border-l border-gray-100 bg-gray-50/40">
          <div className="text-center">
            <div className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-3">
              <Briefcase className="w-6 h-6 text-gray-400" />
            </div>
            <p className="text-sm font-semibold text-gray-500">Select a job post</p>
            <p className="text-xs text-gray-400 mt-0.5">Click any card to view details & applicants</p>
          </div>
        </div>
      )}
    </div>
  )
}
