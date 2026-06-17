import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { BarChart3, Users, Briefcase, TrendingUp, CheckCircle } from 'lucide-react'
import { useAppStore } from '@/store/useAppStore'
import { getEmployerJobs, getEmployerApplications } from '@/lib/api'

interface Stats {
  totalJobs: number
  activeJobs: number
  totalApps: number
  shortlisted: number
  hired: number
  fillRate: number
}

export default function Analytics() {
  const { user } = useAppStore()
  const [stats, setStats] = useState<Stats>({ totalJobs: 0, activeJobs: 0, totalApps: 0, shortlisted: 0, hired: 0, fillRate: 0 })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user?.id) return
    Promise.all([
      getEmployerJobs(user.id),
      getEmployerApplications(user.id),
    ]).then(([jobs, apps]) => {
      const totalJobs = jobs.length
      const activeJobs = jobs.filter((j: any) => j.status === 'active').length
      const totalApps = apps.length
      const shortlisted = apps.filter((a: any) => ['shortlisted', 'interview', 'offer', 'hired'].includes(a.status)).length
      const hired = apps.filter((a: any) => a.status === 'hired').length
      const fillRate = totalApps > 0 ? Math.round((hired / totalApps) * 100) : 0
      setStats({ totalJobs, activeJobs, totalApps, shortlisted, hired, fillRate })
    }).catch(console.error).finally(() => setLoading(false))
  }, [user?.id])

  const cards = [
    { label: 'Total Job Posts', value: stats.totalJobs,  icon: Briefcase, color: 'text-[#F7A607]', bg: 'bg-[#F7A607]/10' },
    { label: 'Active Jobs',     value: stats.activeJobs,  icon: TrendingUp, color: 'text-green-600', bg: 'bg-green-50' },
    { label: 'Total Applicants',value: stats.totalApps,   icon: Users,      color: 'text-blue-600',  bg: 'bg-blue-50' },
    { label: 'Shortlisted',     value: stats.shortlisted, icon: CheckCircle,color: 'text-purple-600',bg: 'bg-purple-50' },
    { label: 'Hired',           value: stats.hired,       icon: CheckCircle,color: 'text-green-700', bg: 'bg-green-100' },
    { label: 'Hire Rate',       value: `${stats.fillRate}%`, icon: BarChart3,color: 'text-[#F7A607]', bg: 'bg-[#F7A607]/10' },
  ]

  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto">
      <div className="mb-5">
        <h1 className="text-xl font-extrabold text-gray-900 mb-0.5" style={{ fontFamily: 'Plus Jakarta Sans' }}>Analytics</h1>
        <p className="text-sm text-gray-500">Recruitment performance overview</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
        {cards.map(({ label, value, icon: Icon, color, bg }, i) => (
          <motion.div key={label}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.06 * i }}
            className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm"
          >
            <div className={`w-9 h-9 rounded-xl ${bg} flex items-center justify-center mb-3`}>
              <Icon className={`w-4 h-4 ${color}`} />
            </div>
            {loading ? (
              <div className="h-7 w-12 bg-gray-100 rounded animate-pulse mb-1" />
            ) : (
              <p className="text-2xl font-extrabold text-gray-900">{value}</p>
            )}
            <p className="text-xs font-semibold text-gray-600 mt-0.5">{label}</p>
          </motion.div>
        ))}
      </div>

      {!loading && stats.totalApps === 0 && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
          className="bg-white border border-gray-100 rounded-2xl p-10 text-center shadow-sm"
        >
          <BarChart3 className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-sm font-semibold text-gray-700 mb-1">Not enough data yet</p>
          <p className="text-xs text-gray-400 max-w-xs mx-auto leading-relaxed">
            Publish jobs and receive applications to see detailed recruitment analytics here.
          </p>
        </motion.div>
      )}

      {!loading && stats.totalApps > 0 && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
          className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm"
        >
          <p className="text-sm font-bold text-gray-900 mb-4">Application Funnel</p>
          {[
            { label: 'Applied',     value: stats.totalApps,   color: 'bg-blue-400' },
            { label: 'Shortlisted', value: stats.shortlisted, color: 'bg-amber-400' },
            { label: 'Hired',       value: stats.hired,       color: 'bg-green-500' },
          ].map(({ label, value, color }) => (
            <div key={label} className="mb-3">
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="font-semibold text-gray-700">{label}</span>
                <span className="font-bold text-gray-900">{value}</span>
              </div>
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className={`h-full ${color} rounded-full transition-all`}
                  style={{ width: stats.totalApps > 0 ? `${Math.round((value / stats.totalApps) * 100)}%` : '0%' }}
                />
              </div>
            </div>
          ))}
        </motion.div>
      )}
    </div>
  )
}
