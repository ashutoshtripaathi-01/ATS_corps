import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Bookmark, Briefcase, MapPin, IndianRupee, Trash2, Search } from 'lucide-react'
import { useCandidateStore } from '@/store/useAppStore'
import { getJob } from '@/lib/api'

interface Job {
  id: number; manpower_type: string; salary_range: string;
  salary_min: number; salary_max: number; location: string;
  quantity: number; company_name: string | null; status: string;
}

export default function SavedJobs() {
  const navigate  = useNavigate()
  const { savedJobs, toggleSaveJob } = useCandidateStore()
  const [jobs,    setJobs]   = useState<Job[]>([])
  const [loading, setLoading]= useState(savedJobs.length > 0)
  const [search,  setSearch] = useState('')

  useEffect(() => {
    if (savedJobs.length === 0) { setLoading(false); return }
    Promise.all(savedJobs.map(id => getJob(id).catch(() => null)))
      .then(results => setJobs(results.filter(Boolean) as Job[]))
      .finally(() => setLoading(false))
  }, [])

  const filtered = jobs.filter(j => {
    if (!search.trim()) return true
    const q = search.toLowerCase()
    return j.manpower_type.toLowerCase().includes(q) || (j.company_name ?? '').toLowerCase().includes(q) || j.location.toLowerCase().includes(q)
  })

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#13161a]">
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-10 py-6 lg:py-8">

        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-extrabold text-gray-900 dark:text-[#F0EFEA]" style={{ fontFamily: 'Plus Jakarta Sans' }}>
              Saved Jobs
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
              {jobs.length} job{jobs.length !== 1 ? 's' : ''} bookmarked
            </p>
          </div>
          {jobs.length > 0 && (
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              <input value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Filter saved jobs…"
                className="w-full h-10 pl-9 pr-4 rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#1e2227] text-sm outline-none
                  focus:border-[#F7A607] focus:ring-2 focus:ring-[#F7A607]/10 placeholder:text-gray-400 shadow-sm"
              />
            </div>
          )}
        </div>

        {loading && (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            {[1,2].map(i => <div key={i} className="h-28 bg-white dark:bg-[#1e2227] border border-gray-100 dark:border-white/8 rounded-2xl animate-pulse" />)}
          </div>
        )}

        {!loading && jobs.length === 0 && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            className="bg-white dark:bg-[#1e2227] border border-gray-100 dark:border-white/8 rounded-2xl p-16 text-center shadow-sm max-w-lg mx-auto"
          >
            <div className="w-16 h-16 rounded-2xl bg-gray-100 dark:bg-white/10 flex items-center justify-center mx-auto mb-4">
              <Bookmark className="w-8 h-8 text-gray-400" />
            </div>
            <p className="text-base font-semibold text-gray-700 dark:text-gray-200 mb-1">No saved jobs yet</p>
            <p className="text-xs text-gray-400 dark:text-gray-500 max-w-xs mx-auto leading-relaxed mb-5">
              Bookmark jobs you are interested in and they will appear here for quick access.
            </p>
            <button onClick={() => navigate('/candidate/jobs')}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#F7A607] text-white text-sm font-bold rounded-xl hover:bg-[#e09500] transition-colors"
            >
              Browse Jobs
            </button>
          </motion.div>
        )}

        {!loading && filtered.length > 0 && (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            {filtered.map((job, i) => (
              <motion.div key={job.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 * i }}
                className="bg-white dark:bg-[#1e2227] border border-gray-100 dark:border-white/8 rounded-2xl p-5 shadow-sm flex items-start gap-3 hover:border-[#F7A607]/40 hover:shadow-md transition-all"
              >
                <div className="w-11 h-11 rounded-xl bg-[#292e31] flex items-center justify-center shrink-0">
                  <Briefcase className="w-5 h-5 text-[#F7A607]" />
                </div>
                <div className="flex-1 min-w-0 cursor-pointer" onClick={() => navigate(`/candidate/jobs/${job.id}`)}>
                  <p className="font-bold text-sm text-gray-900 dark:text-[#F0EFEA] truncate">{job.manpower_type}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{job.company_name ?? 'Government / PSU'}</p>
                  <div className="flex items-center gap-3 mt-2 text-xs text-gray-500 dark:text-gray-400 flex-wrap">
                    <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{job.location}</span>
                    <span className="flex items-center gap-1 text-[#F7A607] font-semibold">
                      <IndianRupee className="w-3 h-3" />
                      {job.salary_min > 0
                        ? `${(job.salary_min / 1000).toFixed(0)}k – ${job.salary_max > 0 ? (job.salary_max / 1000).toFixed(0) + 'k' : 'above'}/mo`
                        : job.salary_range}
                    </span>
                  </div>
                </div>
                <button onClick={() => toggleSaveJob(String(job.id))}
                  className="p-2 rounded-xl hover:bg-red-50 dark:hover:bg-red-900/20 text-gray-400 hover:text-red-500 transition-colors shrink-0"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </motion.div>
            ))}
          </div>
        )}

        {!loading && jobs.length > 0 && filtered.length === 0 && (
          <div className="text-center py-12 text-gray-400 text-sm">
            No saved jobs match "<span className="font-semibold">{search}</span>"
          </div>
        )}
      </div>
    </div>
  )
}
