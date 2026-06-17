import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  Briefcase, Plus, MapPin, Users, CheckCircle, XCircle,
  Clock, IndianRupee, ChevronRight, RefreshCw,
} from 'lucide-react'
import { useAppStore } from '@/store/useAppStore'
import { getEmployerJobs, updateJobStatus, deleteJob } from '@/lib/api'
import { toast } from '@/hooks/useToast'

interface Job {
  id: number
  manpower_type: string
  quantity: number
  salary_range: string
  location: string
  shift: string
  status: 'active' | 'closed' | 'draft'
  app_count: string
  ref_no: string | null
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

export default function ManageJobs() {
  const navigate = useNavigate()
  const { user } = useAppStore()
  const [jobs, setJobs] = useState<Job[]>([])
  const [loading, setLoading] = useState(true)
  const [actionId, setActionId] = useState<number | null>(null)

  const load = () => {
    if (!user?.id) return
    setLoading(true)
    getEmployerJobs(user.id)
      .then(setJobs)
      .catch(console.error)
      .finally(() => setLoading(false))
  }

  useEffect(load, [user?.id])

  const handleStatusToggle = async (job: Job) => {
    const next = job.status === 'active' ? 'closed' : 'active'
    setActionId(job.id)
    try {
      await updateJobStatus(String(job.id), next)
      setJobs(p => p.map(j => j.id === job.id ? { ...j, status: next as any } : j))
      toast({ title: `Job ${next}`, description: `"${job.manpower_type}" is now ${next}.`, variant: 'success' })
    } catch (e: any) {
      toast({ title: 'Update failed', description: e.message, variant: 'error' })
    } finally {
      setActionId(null)
    }
  }

  const handleDelete = async (job: Job) => {
    if (!confirm(`Delete "${job.manpower_type}"? This cannot be undone.`)) return
    setActionId(job.id)
    try {
      await deleteJob(String(job.id))
      setJobs(p => p.filter(j => j.id !== job.id))
      toast({ title: 'Job deleted', variant: 'success' })
    } catch (e: any) {
      toast({ title: 'Delete failed', description: e.message, variant: 'error' })
    } finally {
      setActionId(null)
    }
  }

  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-extrabold text-gray-900 mb-0.5" style={{ fontFamily: 'Plus Jakarta Sans' }}>
            My Job Posts
          </h1>
          <p className="text-sm text-gray-500">
            {loading ? 'Loading…' : `${jobs.length} post${jobs.length !== 1 ? 's' : ''} · ${jobs.filter(j => j.status === 'active').length} active`}
          </p>
        </div>
        <button
          onClick={() => navigate('/employer/post-job')}
          className="flex items-center gap-2 h-10 px-4 rounded-xl bg-[#292e31] text-white text-sm font-semibold hover:bg-[#1a1d1f] transition-colors"
        >
          <Plus className="w-4 h-4" /> New Job
        </button>
      </div>

      {loading && (
        <div className="space-y-3">
          {[1,2,3].map(i => <div key={i} className="h-28 bg-white border border-gray-100 rounded-2xl animate-pulse" />)}
        </div>
      )}

      {!loading && jobs.length === 0 && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
          className="bg-white border border-gray-100 rounded-2xl p-12 text-center shadow-sm"
        >
          <div className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-4">
            <Briefcase className="w-7 h-7 text-gray-400" />
          </div>
          <p className="text-sm font-semibold text-gray-700 mb-1">No job posts yet</p>
          <p className="text-xs text-gray-400 max-w-xs mx-auto leading-relaxed mb-5">
            Post your first job to start receiving applications from verified ex-servicemen.
          </p>
          <button
            onClick={() => navigate('/employer/post-job')}
            className="flex items-center gap-2 h-10 px-5 rounded-xl bg-[#292e31] text-white text-sm font-semibold hover:bg-[#1a1d1f] transition-colors mx-auto"
          >
            <Plus className="w-4 h-4" /> Post a Job
          </button>
        </motion.div>
      )}

      {!loading && jobs.length > 0 && (
        <div className="space-y-3">
          {jobs.map((job, i) => {
            const StatusIcon = STATUS_ICON[job.status]
            return (
              <motion.div key={job.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.05 * i }}
                className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm"
              >
                <div className="flex items-start gap-3 mb-3">
                  <div className="w-10 h-10 rounded-xl bg-[#292e31] flex items-center justify-center shrink-0">
                    <Briefcase className="w-4 h-4 text-[#F7A607]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-sm text-gray-900">{job.manpower_type}</p>
                    {job.ref_no && <p className="text-[10px] text-gray-400 font-mono mt-0.5">{job.ref_no}</p>}
                  </div>
                  <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2.5 py-1 rounded-full ${STATUS_STYLE[job.status]}`}>
                    <StatusIcon className="w-3 h-3" />{job.status}
                  </span>
                </div>

                <div className="flex flex-wrap gap-x-3 gap-y-1 mb-3 text-xs text-gray-500">
                  <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{job.location}</span>
                  <span className="flex items-center gap-1"><IndianRupee className="w-3 h-3 text-[#F7A607]" />{job.salary_range}</span>
                  <span className="flex items-center gap-1"><Users className="w-3 h-3" />{job.quantity} opening{job.quantity !== 1 ? 's' : ''}</span>
                  <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{job.shift}</span>
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-gray-50">
                  <span className="text-xs text-gray-500">
                    <span className="font-bold text-gray-900">{job.app_count}</span> applicant{Number(job.app_count) !== 1 ? 's' : ''}
                    · {new Date(job.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      disabled={actionId === job.id}
                      onClick={() => handleStatusToggle(job)}
                      className={`text-xs font-semibold px-2.5 py-1 rounded-lg border transition-all disabled:opacity-50
                        ${job.status === 'active'
                          ? 'border-gray-200 text-gray-600 hover:border-red-200 hover:text-red-600'
                          : 'border-green-200 text-green-700 hover:bg-green-50'}`}
                    >
                      {actionId === job.id ? <RefreshCw className="w-3 h-3 animate-spin" /> : job.status === 'active' ? 'Close' : 'Reopen'}
                    </button>
                    <button
                      disabled={actionId === job.id}
                      onClick={() => handleDelete(job)}
                      className="text-xs font-semibold px-2.5 py-1 rounded-lg border border-red-100 text-red-500 hover:bg-red-50 transition-all disabled:opacity-50"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </motion.div>
            )
          })}
        </div>
      )}
    </div>
  )
}
