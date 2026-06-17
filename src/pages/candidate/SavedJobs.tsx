import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Bookmark, Briefcase, MapPin, IndianRupee, Trash2 } from 'lucide-react'
import { useCandidateStore } from '@/store/useAppStore'
import { getJob } from '@/lib/api'

interface Job {
  id: number
  manpower_type: string
  salary_range: string
  salary_min: number
  salary_max: number
  location: string
  quantity: number
  company_name: string | null
  status: string
}

export default function SavedJobs() {
  const navigate = useNavigate()
  const { savedJobs, toggleSaveJob } = useCandidateStore()
  const [jobs, setJobs] = useState<Job[]>([])
  const [loading, setLoading] = useState(savedJobs.length > 0)

  useEffect(() => {
    if (savedJobs.length === 0) { setLoading(false); return }
    Promise.all(savedJobs.map(id => getJob(id).catch(() => null)))
      .then(results => setJobs(results.filter(Boolean) as Job[]))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="p-4 sm:p-6 max-w-2xl mx-auto">
      <div className="mb-5">
        <h1 className="text-xl font-extrabold text-gray-900 dark:text-[#F0EFEA] mb-0.5" style={{ fontFamily: 'Plus Jakarta Sans' }}>
          Saved Jobs
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">{jobs.length} job{jobs.length !== 1 ? 's' : ''} saved</p>
      </div>

      {loading && (
        <div className="space-y-3">
          {[1,2].map(i => <div key={i} className="h-24 bg-white dark:bg-[#1e2227] border border-gray-100 dark:border-white/8 rounded-2xl animate-pulse" />)}
        </div>
      )}

      {!loading && jobs.length === 0 && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
          className="bg-white dark:bg-[#1e2227] border border-gray-100 dark:border-white/8 rounded-2xl p-12 text-center shadow-sm"
        >
          <div className="w-14 h-14 rounded-2xl bg-gray-100 dark:bg-white/10 flex items-center justify-center mx-auto mb-4">
            <Bookmark className="w-7 h-7 text-gray-400" />
          </div>
          <p className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-1">No saved jobs yet</p>
          <p className="text-xs text-gray-400 dark:text-gray-500 max-w-xs mx-auto leading-relaxed mb-5">
            Bookmark jobs you are interested in and they will appear here for quick access.
          </p>
          <button
            onClick={() => navigate('/candidate/jobs')}
            className="text-sm font-bold text-[#F7A607] hover:underline"
          >
            Browse available jobs →
          </button>
        </motion.div>
      )}

      {!loading && jobs.length > 0 && (
        <div className="space-y-3">
          {jobs.map((job, i) => (
            <motion.div key={job.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 * i }}
              className="bg-white dark:bg-[#1e2227] border border-gray-100 dark:border-white/8 rounded-2xl p-4 shadow-sm flex items-start gap-3 hover:border-[#F7A607]/40 dark:hover:border-[#F7A607]/30 transition-all"
            >
              <div className="w-10 h-10 rounded-xl bg-[#292e31] flex items-center justify-center shrink-0">
                <Briefcase className="w-4 h-4 text-[#F7A607]" />
              </div>
              <div className="flex-1 min-w-0 cursor-pointer" onClick={() => navigate(`/candidate/jobs/${job.id}`)} role="button">
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
              <button
                onClick={() => toggleSaveJob(String(job.id))}
                className="p-2 rounded-xl hover:bg-red-50 dark:hover:bg-red-900/20 text-gray-400 hover:text-red-500 transition-colors shrink-0"
                title="Remove from saved"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  )
}
