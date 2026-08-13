import { useEffect, useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  Search, MapPin, Briefcase, IndianRupee, Clock,
  Shield, Users, ChevronDown, RefreshCw, SlidersHorizontal, X, Bookmark,
} from 'lucide-react'
import { getJobs } from '@/lib/api'
import { useCandidateStore } from '@/store/useAppStore'

interface Job {
  id: number; manpower_type: string; quantity: number; salary_range: string;
  salary_min: number; salary_max: number; location: string; shift: string;
  work_site: string; min_rank: string; min_service: string; description: string;
  status: string; app_count: string; company_name: string | null;
  company_district: string | null; created_at: string; ref_no: string | null;
}

const LOCATIONS    = ['All Locations', 'Guwahati & Around', 'Upper Assam', 'Lower Assam']
const SALARY_RANGES = ['All Ranges', '15k-20k', '20k-30k', '30k-50k', '50k+']
const SALARY_LABEL: Record<string, string> = {
  '15k-20k': '₹15k – ₹20k/mo', '20k-30k': '₹20k – ₹30k/mo',
  '30k-50k': '₹30k – ₹50k/mo', '50k+': '₹50k+/mo',
}

function JobCard({ job, onClick }: { job: Job; onClick: () => void }) {
  const { savedJobs, toggleSaveJob } = useCandidateStore()
  const isSaved   = savedJobs.includes(String(job.id))
  const daysAgo   = Math.floor((Date.now() - new Date(job.created_at).getTime()) / 86400000)
  const postedLabel = daysAgo === 0 ? 'Today' : daysAgo === 1 ? 'Yesterday' : `${daysAgo}d ago`

  return (
    <div className="bg-white dark:bg-[#1e2227] border border-gray-100 dark:border-white/8 rounded-2xl p-5 shadow-sm hover:border-[#F7A607]/40 hover:shadow-md transition-all duration-200">
      <div className="flex items-start gap-3 mb-3">
        <div className="w-11 h-11 rounded-xl bg-[#292e31] flex items-center justify-center shrink-0">
          <Briefcase className="w-5 h-5 text-[#F7A607]" />
        </div>
        <div className="flex-1 min-w-0 cursor-pointer" onClick={onClick}>
          <h3 className="font-bold text-gray-900 dark:text-[#F0EFEA] text-sm leading-tight" style={{ fontFamily: 'Plus Jakarta Sans' }}>
            {job.manpower_type}
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 truncate">
            {job.company_name ?? 'Government / PSU'} · {job.company_district ?? job.location}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          <button onClick={(e) => { e.stopPropagation(); toggleSaveJob(String(job.id)) }}
            className={`p-1.5 rounded-lg transition-all ${isSaved ? 'text-[#F7A607] bg-[#F7A607]/10' : 'text-gray-300 hover:text-gray-500 hover:bg-gray-50 dark:hover:bg-white/10'}`}
          >
            <Bookmark className={`w-4 h-4 ${isSaved ? 'fill-[#F7A607]' : ''}`} />
          </button>
          <span className="text-[10px] text-gray-400 dark:text-gray-500">{postedLabel}</span>
        </div>
      </div>

      <div className="flex flex-wrap gap-x-3 gap-y-1.5 mb-3 cursor-pointer" onClick={onClick}>
        <span className="flex items-center gap-1 text-xs text-gray-600 dark:text-gray-400">
          <MapPin className="w-3 h-3 text-gray-400" />{job.location}
        </span>
        <span className="flex items-center gap-1 text-xs text-[#F7A607] font-semibold">
          <IndianRupee className="w-3 h-3" />
          {job.salary_min > 0
            ? `${(job.salary_min / 1000).toFixed(0)}k – ${job.salary_max > 0 ? (job.salary_max / 1000).toFixed(0) + 'k' : 'above'}/mo`
            : SALARY_LABEL[job.salary_range] ?? job.salary_range}
        </span>
        <span className="flex items-center gap-1 text-xs text-gray-600 dark:text-gray-400">
          <Clock className="w-3 h-3 text-gray-400" />{job.shift}
        </span>
      </div>

      <div className="flex items-center justify-between pt-3 border-t border-gray-50 dark:border-white/6 cursor-pointer" onClick={onClick}>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="flex items-center gap-1 text-[10px] font-semibold bg-gray-100 dark:bg-white/10 text-gray-600 dark:text-gray-300 px-2 py-0.5 rounded-full">
            <Shield className="w-3 h-3" />{job.min_rank}
          </span>
          <span className="flex items-center gap-1 text-[10px] font-semibold bg-[#F7A607]/10 text-[#F7A607] px-2 py-0.5 rounded-full">
            <Users className="w-3 h-3" />{job.quantity} opening{job.quantity !== 1 ? 's' : ''}
          </span>
        </div>
        <span className="text-xs font-bold text-[#292e31] dark:text-gray-300 hover:text-[#F7A607] transition-colors">View →</span>
      </div>
    </div>
  )
}

export default function CandidateJobs() {
  const navigate    = useNavigate()
  const [jobs,        setJobs]       = useState<Job[]>([])
  const [loading,     setLoading]    = useState(true)
  const [search,      setSearch]     = useState('')
  const [location,    setLocation]   = useState('All Locations')
  const [salaryRange, setSalaryRange]= useState('All Ranges')

  useEffect(() => {
    const params: Record<string, string> = {}
    if (location !== 'All Locations') params.location = location
    if (salaryRange !== 'All Ranges')  params.salaryRange = salaryRange
    setLoading(true)
    getJobs(params).then(setJobs).catch(console.error).finally(() => setLoading(false))
  }, [location, salaryRange])

  const filtered = useMemo(() => {
    if (!search.trim()) return jobs
    const q = search.toLowerCase()
    return jobs.filter(j =>
      j.manpower_type.toLowerCase().includes(q) ||
      (j.company_name ?? '').toLowerCase().includes(q) ||
      j.location.toLowerCase().includes(q) ||
      j.description.toLowerCase().includes(q),
    )
  }, [jobs, search])

  const activeFilters = (location !== 'All Locations' ? 1 : 0) + (salaryRange !== 'All Ranges' ? 1 : 0)
  const clearFilters  = () => { setSearch(''); setLocation('All Locations'); setSalaryRange('All Ranges') }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#13161a]">
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-10 py-6 lg:py-8">

        {/* Page header */}
        <div className="mb-6">
          <h1 className="text-2xl font-extrabold text-gray-900 dark:text-[#F0EFEA]" style={{ fontFamily: 'Plus Jakarta Sans' }}>
            Find Employment
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            Security &amp; guard jobs for ex-servicemen across Assam
          </p>
        </div>

        <div className="flex flex-col lg:flex-row gap-6">

          {/* ── LEFT: Filters sidebar (desktop sticky) ── */}
          <aside className="lg:w-64 xl:w-72 shrink-0">
            <div className="lg:sticky lg:top-6 space-y-4">

              {/* Search */}
              <div className="bg-white dark:bg-[#1e2227] border border-gray-100 dark:border-white/8 rounded-2xl p-4 shadow-sm">
                <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-3">Search</p>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                  <input value={search} onChange={(e) => setSearch(e.target.value)}
                    placeholder="Role, company, location…"
                    className="w-full h-10 pl-9 pr-4 rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5 text-sm outline-none
                      focus:border-[#F7A607] focus:ring-2 focus:ring-[#F7A607]/10 placeholder:text-gray-400 text-gray-900 dark:text-[#F0EFEA]"
                  />
                </div>
              </div>

              {/* Filters */}
              <div className="bg-white dark:bg-[#1e2227] border border-gray-100 dark:border-white/8 rounded-2xl p-4 shadow-sm space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest flex items-center gap-1.5">
                    <SlidersHorizontal className="w-3.5 h-3.5" />Filters
                  </p>
                  {activeFilters > 0 && (
                    <button onClick={clearFilters} className="text-xs text-red-500 hover:text-red-700 flex items-center gap-1">
                      <X className="w-3 h-3" />Clear
                    </button>
                  )}
                </div>

                <div>
                  <p className="text-xs font-semibold text-gray-600 dark:text-gray-300 mb-2">Location</p>
                  <div className="space-y-1.5">
                    {LOCATIONS.map(l => (
                      <button key={l} onClick={() => setLocation(l)}
                        className={`w-full text-left text-xs px-3 py-2 rounded-lg transition-all ${location === l
                          ? 'bg-[#F7A607]/10 text-[#F7A607] font-semibold border border-[#F7A607]/20'
                          : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-white/5'}`}
                      >
                        {l}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="text-xs font-semibold text-gray-600 dark:text-gray-300 mb-2">Salary Range</p>
                  <div className="space-y-1.5">
                    {SALARY_RANGES.map(r => (
                      <button key={r} onClick={() => setSalaryRange(r)}
                        className={`w-full text-left text-xs px-3 py-2 rounded-lg transition-all ${salaryRange === r
                          ? 'bg-[#F7A607]/10 text-[#F7A607] font-semibold border border-[#F7A607]/20'
                          : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-white/5'}`}
                      >
                        {r === 'All Ranges' ? r : SALARY_LABEL[r]}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </aside>

          {/* ── RIGHT: Job list ── */}
          <div className="flex-1 min-w-0">
            {/* Mobile search bar */}
            <div className="lg:hidden mb-4">
              <div className="flex gap-2">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                  <input value={search} onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search jobs…"
                    className="w-full h-10 pl-9 pr-4 rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#1e2227] text-sm outline-none focus:border-[#F7A607] placeholder:text-gray-400 shadow-sm"
                  />
                </div>
              </div>
            </div>

            {/* Results bar */}
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm font-semibold text-gray-700 dark:text-gray-200">
                {loading ? 'Loading jobs…' : `${filtered.length} job${filtered.length !== 1 ? 's' : ''} found`}
              </p>
              {!loading && (
                <button onClick={() => {
                  setLoading(true)
                  getJobs({}).then(setJobs).finally(() => setLoading(false))
                }} className="text-xs text-gray-400 hover:text-gray-700 flex items-center gap-1">
                  <RefreshCw className="w-3 h-3" /> Refresh
                </button>
              )}
            </div>

            {/* Loading */}
            {loading && (
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                {[1,2,3,4].map(i => (
                  <div key={i} className="h-36 bg-white dark:bg-[#1e2227] border border-gray-100 dark:border-white/8 rounded-2xl animate-pulse" />
                ))}
              </div>
            )}

            {/* Job cards — 2-col on xl */}
            {!loading && filtered.length > 0 && (
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                {filtered.map((job, i) => (
                  <motion.div key={job.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.04 * i }}>
                    <JobCard job={job} onClick={() => navigate(`/candidate/jobs/${job.id}`)} />
                  </motion.div>
                ))}
              </div>
            )}

            {/* Empty */}
            {!loading && filtered.length === 0 && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                className="bg-white dark:bg-[#1e2227] border border-gray-100 dark:border-white/8 rounded-2xl p-16 text-center shadow-sm"
              >
                <div className="w-14 h-14 rounded-2xl bg-gray-100 dark:bg-white/10 flex items-center justify-center mx-auto mb-4">
                  <Briefcase className="w-7 h-7 text-gray-400" />
                </div>
                <p className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-1">No jobs available right now</p>
                <p className="text-xs text-gray-400 dark:text-gray-500 max-w-xs mx-auto leading-relaxed mb-4">
                  New job postings from employers will appear here. Check back soon or clear your filters.
                </p>
                {(search || activeFilters > 0) && (
                  <button onClick={clearFilters} className="text-xs font-semibold text-[#F7A607] hover:underline">
                    Clear all filters
                  </button>
                )}
              </motion.div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
