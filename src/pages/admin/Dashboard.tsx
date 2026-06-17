import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import {
  Building2, Users, Briefcase, FileCheck,
  TrendingUp, ChevronRight, Shield, MapPin,
} from 'lucide-react'
import { getAdminStats } from '@/lib/api'

interface Stats {
  totalCandidates: number
  totalCompanies: number
  totalJobs: number
  byForce: { force: string; count: string }[]
  recentCandidates: {
    id: number; full_name: string; force: string; rank: string; post: string; created_at: string; loc1: string
  }[]
}

const FORCE_COLOR: Record<string, string> = {
  Army:           'bg-green-100 text-green-700',
  Navy:           'bg-blue-100 text-blue-700',
  'Air Force':    'bg-sky-100 text-sky-700',
  'Para Military':'bg-orange-100 text-orange-700',
}

export default function AdminDashboard() {
  const navigate = useNavigate()
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getAdminStats()
      .then(setStats)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  const statCards = [
    { label: 'Companies',    value: stats?.totalCompanies ?? 0,  icon: Building2, bg: 'bg-blue-50',         color: 'text-blue-600' },
    { label: 'Candidates',   value: stats?.totalCandidates ?? 0, icon: Users,     bg: 'bg-green-50',        color: 'text-green-600' },
    { label: 'Job Posts',    value: stats?.totalJobs ?? 0,       icon: Briefcase,  bg: 'bg-[#F7A607]/10',   color: 'text-[#F7A607]' },
    { label: 'Applications', value: 0,                           icon: FileCheck,  bg: 'bg-purple-50',       color: 'text-purple-600' },
  ]

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-5xl mx-auto">

      {/* Welcome banner */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
        className="bg-[#1a1d1f] rounded-2xl p-5 text-white"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs text-gray-400 mb-0.5">Admin Overview</p>
            <h1 className="text-lg font-extrabold" style={{ fontFamily: 'Plus Jakarta Sans' }}>
              ATS Corps Control Panel
            </h1>
            <p className="text-xs text-gray-400 mt-1">Monitor all companies, candidates, and job activity.</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-[#F7A607] flex items-center justify-center shrink-0">
            <TrendingUp className="w-5 h-5 text-white" />
          </div>
        </div>
      </motion.div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {statCards.map(({ label, value, icon: Icon, bg, color }, i) => (
          <motion.div key={label} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.06 }}
            className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm"
          >
            <div className={`w-10 h-10 rounded-xl ${bg} flex items-center justify-center mb-3`}>
              <Icon className={`w-5 h-5 ${color}`} />
            </div>
            {loading ? (
              <div className="h-7 w-10 bg-gray-100 rounded animate-pulse mb-1" />
            ) : (
              <p className="text-2xl font-extrabold text-gray-900">{value}</p>
            )}
            <p className="text-xs font-semibold text-gray-700 mt-0.5">{label}</p>
          </motion.div>
        ))}
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {/* Force Breakdown */}
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
          className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden"
        >
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-50">
            <h2 className="text-sm font-bold text-gray-900">Candidates by Force</h2>
            <Shield className="w-4 h-4 text-gray-400" />
          </div>
          <div className="p-4">
            {loading ? (
              <div className="space-y-3">
                {[1,2,3,4].map(i => <div key={i} className="h-8 bg-gray-100 rounded-xl animate-pulse" />)}
              </div>
            ) : stats?.byForce && stats.byForce.length > 0 ? (
              <div className="space-y-2.5">
                {stats.byForce.map((f) => (
                  <div key={f.force} className="flex items-center justify-between">
                    <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full ${FORCE_COLOR[f.force] ?? 'bg-gray-100 text-gray-600'}`}>
                      <Shield className="w-3 h-3" />{f.force}
                    </span>
                    <span className="text-sm font-extrabold text-gray-900">{f.count}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-400 text-center py-6">No candidates registered yet</p>
            )}
          </div>
        </motion.div>

        {/* Recent Candidates */}
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}
          className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden"
        >
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-50">
            <h2 className="text-sm font-bold text-gray-900">Recent Registrations</h2>
            <button onClick={() => navigate('/admin/candidates')}
              className="text-xs font-semibold text-[#F7A607] flex items-center gap-0.5 hover:underline">
              View all <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="divide-y divide-gray-50">
            {loading ? (
              <div className="p-4 space-y-3">
                {[1,2,3].map(i => <div key={i} className="h-10 bg-gray-100 rounded-xl animate-pulse" />)}
              </div>
            ) : stats?.recentCandidates && stats.recentCandidates.length > 0 ? (
              stats.recentCandidates.map((c) => (
                <div key={c.id} className="px-4 py-3 hover:bg-gray-50 transition-colors cursor-pointer"
                  onClick={() => navigate('/admin/candidates')}>
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-[#292e31] flex items-center justify-center shrink-0">
                      <span className="text-[10px] font-bold text-[#F7A607]">
                        {c.full_name.split(' ').map((n: string) => n[0]).join('').slice(0, 2)}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900">{c.full_name}</p>
                      <p className="text-xs text-gray-500">{c.force} · {c.rank}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-[10px] font-semibold text-gray-700">{c.post}</p>
                      <p className="text-[10px] text-gray-400 flex items-center gap-0.5 justify-end">
                        <MapPin className="w-2.5 h-2.5" />{c.loc1}
                      </p>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="py-10 text-center text-gray-400 text-sm">No registrations yet</div>
            )}
          </div>
        </motion.div>
      </div>

      {/* Quick links */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pb-2">
        {[
          { label: 'Companies',   icon: Building2, href: '/admin/companies',  bg: 'bg-blue-50',      color: 'text-blue-600' },
          { label: 'Candidates',  icon: Users,     href: '/admin/candidates', bg: 'bg-green-50',     color: 'text-green-600' },
          { label: 'Job Posts',   icon: Briefcase, href: '/admin/jobs',       bg: 'bg-[#F7A607]/10', color: 'text-[#F7A607]' },
          { label: 'Applications',icon: FileCheck, href: '/admin/jobs',       bg: 'bg-purple-50',    color: 'text-purple-600' },
        ].map(({ label, icon: Icon, href, bg, color }) => (
          <button key={label} onClick={() => navigate(href)}
            className="flex items-center gap-3 p-3.5 bg-white border border-gray-100 rounded-2xl shadow-sm hover:border-gray-200 transition-all active:scale-[0.98] text-left">
            <div className={`w-8 h-8 rounded-xl ${bg} flex items-center justify-center shrink-0`}>
              <Icon className={`w-4 h-4 ${color}`} />
            </div>
            <span className="text-xs font-semibold text-gray-800">{label}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
