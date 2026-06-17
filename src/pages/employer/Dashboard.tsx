import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  PlusCircle, Briefcase, Users, CheckCircle,
  ChevronRight, Building2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAppStore } from '@/store/useAppStore'

const STATUS_STYLE: Record<string, string> = {
  active: 'bg-green-100 text-green-700',
  closed: 'bg-gray-100 text-gray-500',
  draft:  'bg-amber-100 text-amber-700',
}

export default function EmployerDashboard() {
  const navigate = useNavigate()
  const { user } = useAppStore()

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto space-y-5">

      {/* Welcome banner */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
        className="bg-[#292e31] rounded-2xl p-5 text-white"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs text-gray-400 mb-0.5">Welcome back</p>
            <h1 className="text-lg font-extrabold" style={{ fontFamily: 'Plus Jakarta Sans' }}>
              {user?.name ?? 'Company'}
            </h1>
            <p className="text-xs text-gray-400 mt-1">Manage your job listings and applications from here.</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-[#F7A607] flex items-center justify-center shrink-0">
            <Building2 className="w-5 h-5 text-white" />
          </div>
        </div>
        <Button size="sm"
          className="mt-4 bg-[#F7A607] hover:bg-[#e09500] text-white text-xs font-bold gap-1.5 rounded-xl shadow-lg shadow-[#F7A607]/20"
          onClick={() => navigate('/employer/post-job')}
        >
          <PlusCircle className="w-3.5 h-3.5" /> Post a New Job
        </Button>
      </motion.div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Jobs Posted',  value: 0, icon: Briefcase,   bg: 'bg-blue-50',      text: 'text-blue-600' },
          { label: 'Active',       value: 0, icon: CheckCircle, bg: 'bg-green-50',     text: 'text-green-600' },
          { label: 'Applications', value: 0, icon: Users,       bg: 'bg-[#F7A607]/10', text: 'text-[#F7A607]' },
        ].map(({ label, value, icon: Icon, bg, text }, i) => (
          <motion.div key={label} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.06 }}
            className="bg-white border border-gray-100 rounded-2xl p-3 shadow-sm text-center"
          >
            <div className={`w-9 h-9 rounded-xl ${bg} flex items-center justify-center mx-auto mb-2`}>
              <Icon className={`w-4 h-4 ${text}`} />
            </div>
            <p className="text-xl font-extrabold text-gray-900">{value}</p>
            <p className="text-[10px] text-gray-500 mt-0.5 leading-tight">{label}</p>
          </motion.div>
        ))}
      </div>

      {/* Recent Jobs — empty state */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-bold text-gray-900">Recent Job Posts</h2>
          <button onClick={() => navigate('/employer/jobs')}
            className="text-xs font-semibold text-[#F7A607] flex items-center gap-0.5 hover:underline">
            View all <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
          className="bg-white border border-gray-100 rounded-2xl p-10 shadow-sm text-center"
        >
          <div className="w-14 h-14 rounded-2xl bg-[#F7A607]/10 flex items-center justify-center mx-auto mb-4">
            <Briefcase className="w-7 h-7 text-[#F7A607]" />
          </div>
          <p className="text-sm font-semibold text-gray-900 mb-1">No job posts yet</p>
          <p className="text-xs text-gray-500 mb-4">Post your first job to start receiving applications from verified ex-servicemen.</p>
          <Button size="sm" onClick={() => navigate('/employer/post-job')} className="gap-2">
            <PlusCircle className="w-3.5 h-3.5" /> Post a Job
          </Button>
        </motion.div>
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-2 gap-3 pb-4">
        {[
          { label: 'Post a Job', icon: PlusCircle, color: 'bg-[#F7A607]/10 text-[#F7A607]', href: '/employer/post-job', border: 'hover:border-[#F7A607]/30' },
          { label: 'My Jobs',    icon: Briefcase,  color: 'bg-gray-100 text-gray-600',       href: '/employer/jobs',     border: 'hover:border-gray-300' },
        ].map(({ label, icon: Icon, color, href, border }) => (
          <button key={label} onClick={() => navigate(href)}
            className={`flex items-center gap-3 p-4 bg-white border border-gray-100 rounded-2xl shadow-sm ${border} transition-all active:scale-[0.98] text-left`}>
            <div className={`w-9 h-9 rounded-xl ${color} flex items-center justify-center shrink-0`}>
              <Icon className="w-4 h-4" />
            </div>
            <span className="text-sm font-semibold text-gray-800">{label}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
