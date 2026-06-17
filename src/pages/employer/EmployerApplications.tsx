import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import {
  Users, Search, ChevronDown, Shield, MapPin, Briefcase, RefreshCw,
} from 'lucide-react'
import { useAppStore } from '@/store/useAppStore'
import { getEmployerApplications, updateApplicationStatus } from '@/lib/api'
import { toast } from '@/hooks/useToast'

interface Application {
  id: number
  full_name: string
  force: string
  rank: string
  mobile: string
  loc1: string
  manpower_type: string
  location: string
  job_id: number
  status: string
  created_at: string
}

const STATUS_STYLE: Record<string, string> = {
  applied:      'bg-blue-50 text-blue-700',
  'under-review':'bg-purple-50 text-purple-700',
  shortlisted:  'bg-amber-50 text-amber-700',
  interview:    'bg-indigo-50 text-indigo-700',
  offer:        'bg-teal-50 text-teal-700',
  hired:        'bg-green-100 text-green-700',
  rejected:     'bg-red-50 text-red-600',
}

const STATUSES = ['applied', 'under-review', 'shortlisted', 'interview', 'offer', 'hired', 'rejected']

export default function EmployerApplications() {
  const { user } = useAppStore()
  const [apps, setApps] = useState<Application[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [updatingId, setUpdatingId] = useState<number | null>(null)

  useEffect(() => {
    if (!user?.id) return
    getEmployerApplications(user.id)
      .then(setApps)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [user?.id])

  const handleStatusChange = async (id: number, status: string) => {
    setUpdatingId(id)
    try {
      await updateApplicationStatus(String(id), status)
      setApps(p => p.map(a => a.id === id ? { ...a, status } : a))
      toast({ title: 'Status updated', variant: 'success' })
    } catch (e: any) {
      toast({ title: 'Update failed', description: e.message, variant: 'error' })
    } finally {
      setUpdatingId(null)
    }
  }

  const filtered = apps.filter(a => {
    const q = search.toLowerCase()
    const matchSearch = !q || a.full_name.toLowerCase().includes(q) || a.manpower_type.toLowerCase().includes(q)
    const matchStatus = statusFilter === 'all' || a.status === statusFilter
    return matchSearch && matchStatus
  })

  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto">
      <div className="mb-5">
        <h1 className="text-xl font-extrabold text-gray-900 mb-0.5" style={{ fontFamily: 'Plus Jakarta Sans' }}>Applications</h1>
        <p className="text-sm text-gray-500">{loading ? 'Loading…' : `${apps.length} total applications`}</p>
      </div>

      {/* Summary */}
      {!loading && (
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-3 mb-5">
          {[
            { label: 'Total',       value: apps.length,                              color: 'bg-gray-50 text-gray-700' },
            { label: 'Shortlisted', value: apps.filter(a => a.status === 'shortlisted').length, color: 'bg-amber-50 text-amber-700' },
            { label: 'Interview',   value: apps.filter(a => a.status === 'interview').length,   color: 'bg-indigo-50 text-indigo-700' },
            { label: 'Hired',       value: apps.filter(a => a.status === 'hired').length,       color: 'bg-green-50 text-green-700' },
          ].map(({ label, value, color }) => (
            <div key={label} className={`rounded-2xl p-3 text-center ${color}`}>
              <p className="text-xl font-extrabold">{value}</p>
              <p className="text-[10px] font-medium opacity-70">{label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-2 mb-4 flex-wrap">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
          <input value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or role…"
            className="w-full h-9 pl-8 pr-3 rounded-xl border border-gray-200 bg-white text-xs outline-none
              focus:border-[#F7A607] focus:ring-2 focus:ring-[#F7A607]/10 placeholder:text-gray-400"
          />
        </div>
        <div className="relative">
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
            className="h-9 pl-3 pr-7 rounded-xl border border-gray-200 bg-white text-xs appearance-none outline-none focus:border-[#F7A607] cursor-pointer text-gray-700"
          >
            <option value="all">All Status</option>
            {STATUSES.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
          </select>
          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400 pointer-events-none" />
        </div>
      </div>

      {loading && (
        <div className="space-y-3">
          {[1,2,3].map(i => <div key={i} className="h-24 bg-white border border-gray-100 rounded-2xl animate-pulse" />)}
        </div>
      )}

      {!loading && filtered.length === 0 && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          className="bg-white border border-gray-100 rounded-2xl p-12 text-center shadow-sm"
        >
          <Users className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-sm font-semibold text-gray-700 mb-1">No applications yet</p>
          <p className="text-xs text-gray-400">Applications from candidates will appear here once you post jobs.</p>
        </motion.div>
      )}

      {!loading && filtered.length > 0 && (
        <div className="space-y-3">
          {filtered.map((app, i) => (
            <motion.div key={app.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.04 * i }}
              className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm"
            >
              <div className="flex items-start gap-3 mb-3">
                <div className="w-10 h-10 rounded-full bg-[#292e31] flex items-center justify-center shrink-0">
                  <span className="text-[11px] font-bold text-[#F7A607]">
                    {app.full_name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-sm text-gray-900">{app.full_name}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{app.force} · {app.rank}</p>
                </div>
                <span className={`inline-flex text-[10px] font-semibold px-2.5 py-1 rounded-full shrink-0 ${STATUS_STYLE[app.status] ?? 'bg-gray-100 text-gray-600'}`}>
                  {app.status.charAt(0).toUpperCase() + app.status.slice(1)}
                </span>
              </div>

              <div className="flex flex-wrap gap-x-3 gap-y-1 mb-3 text-xs text-gray-500">
                <span className="flex items-center gap-1"><Briefcase className="w-3 h-3" />{app.manpower_type}</span>
                <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{app.loc1}</span>
                <span className="flex items-center gap-1"><Shield className="w-3 h-3 text-[#F7A607]" />{app.rank}</span>
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-gray-50">
                <span className="text-[10px] text-gray-400">
                  Applied {new Date(app.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                </span>
                <div className="relative">
                  <select
                    value={app.status}
                    disabled={updatingId === app.id}
                    onChange={(e) => handleStatusChange(app.id, e.target.value)}
                    className="h-7 pl-2.5 pr-7 rounded-lg border border-gray-200 bg-white text-xs appearance-none outline-none focus:border-[#F7A607] cursor-pointer text-gray-700 disabled:opacity-50"
                  >
                    {STATUSES.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
                  </select>
                  {updatingId === app.id
                    ? <RefreshCw className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400 animate-spin pointer-events-none" />
                    : <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400 pointer-events-none" />
                  }
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  )
}
