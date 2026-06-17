import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Building2, Search, MapPin, Briefcase, ChevronDown, Eye, RefreshCw } from 'lucide-react'
import { getAdminCompanies } from '@/lib/api'

interface Company {
  id: number
  company_name: string
  gst: string
  pan: string
  email: string
  mobile: string | null
  state: string
  district: string
  address: string
  pincode: string
  status: string
  job_count: string
  created_at: string
}

const STATUS_STYLE: Record<string, string> = {
  active:  'bg-green-100 text-green-700',
  pending: 'bg-amber-100 text-amber-700',
  blocked: 'bg-red-100 text-red-600',
}

export default function AdminCompanies() {
  const [companies, setCompanies] = useState<Company[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')

  useEffect(() => {
    getAdminCompanies()
      .then(setCompanies)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  const filtered = companies.filter((c) => {
    const matchSearch =
      c.company_name.toLowerCase().includes(search.toLowerCase()) ||
      c.district.toLowerCase().includes(search.toLowerCase()) ||
      c.state.toLowerCase().includes(search.toLowerCase())
    const matchFilter = filter === 'all' || c.status === filter
    return matchSearch && matchFilter
  })

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-5xl mx-auto">

      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between"
      >
        <div>
          <h1 className="text-lg font-extrabold text-gray-900" style={{ fontFamily: 'Plus Jakarta Sans' }}>
            Registered Companies
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {loading ? 'Loading…' : `${companies.length} companies registered`}
          </p>
        </div>
        <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
          <Building2 className="w-5 h-5 text-blue-600" />
        </div>
      </motion.div>

      {/* Filters */}
      <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
        className="flex gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          <input value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by company name, district or state…"
            className="w-full h-10 pl-9 pr-4 rounded-xl border border-gray-200 bg-white text-sm outline-none
              focus:border-[#F7A607] focus:ring-2 focus:ring-[#F7A607]/10 placeholder:text-gray-400"
          />
        </div>
        <div className="relative">
          <select value={filter} onChange={(e) => setFilter(e.target.value)}
            className="h-10 pl-3 pr-8 rounded-xl border border-gray-200 bg-white text-sm appearance-none
              outline-none focus:border-[#F7A607] focus:ring-2 focus:ring-[#F7A607]/10 cursor-pointer text-gray-700"
          >
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="pending">Pending</option>
            <option value="blocked">Blocked</option>
          </select>
          <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
        </div>
      </motion.div>

      {/* Loading */}
      {loading && (
        <div className="space-y-3">
          {[1,2,3].map(i => (
            <div key={i} className="h-16 bg-white border border-gray-100 rounded-2xl animate-pulse" />
          ))}
        </div>
      )}

      {/* Desktop table */}
      {!loading && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
          className="hidden md:block bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden"
        >
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left text-xs font-semibold text-gray-500 px-4 py-3">Company</th>
                <th className="text-left text-xs font-semibold text-gray-500 px-4 py-3">GST / PAN</th>
                <th className="text-left text-xs font-semibold text-gray-500 px-4 py-3">Location</th>
                <th className="text-center text-xs font-semibold text-gray-500 px-4 py-3">Jobs</th>
                <th className="text-left text-xs font-semibold text-gray-500 px-4 py-3">Registered</th>
                <th className="text-left text-xs font-semibold text-gray-500 px-4 py-3">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map((c) => (
                <tr key={c.id} className="hover:bg-gray-50/60 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-[#292e31] flex items-center justify-center shrink-0">
                        <Building2 className="w-3.5 h-3.5 text-[#F7A607]" />
                      </div>
                      <div>
                        <p className="font-semibold text-gray-900 truncate max-w-[180px]">{c.company_name}</p>
                        {c.email && <p className="text-[10px] text-gray-400 truncate max-w-[180px]">{c.email}</p>}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-600">
                    <div title={c.gst}>{c.gst.slice(0, 8)}…</div>
                    <div className="text-gray-400">{c.pan}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1 text-gray-600">
                      <MapPin className="w-3 h-3 text-gray-400 shrink-0" />
                      <span>{c.district}, {c.state}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className="inline-flex items-center gap-1 font-semibold text-gray-900">
                      <Briefcase className="w-3.5 h-3.5 text-[#F7A607]" />{c.job_count}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs">
                    {new Date(c.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center text-[10px] font-semibold px-2.5 py-1 rounded-full ${STATUS_STYLE[c.status] ?? 'bg-gray-100 text-gray-600'}`}>
                      {c.status.charAt(0).toUpperCase() + c.status.slice(1)}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <button className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
                      <Eye className="w-4 h-4 text-gray-400" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <div className="py-14 text-center">
              <Building2 className="w-8 h-8 text-gray-300 mx-auto mb-2" />
              <p className="text-sm text-gray-400">No companies found.</p>
            </div>
          )}
        </motion.div>
      )}

      {/* Mobile cards */}
      {!loading && (
        <div className="md:hidden space-y-3">
          {filtered.map((c, i) => (
            <motion.div key={c.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 * i }}
              className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm"
            >
              <div className="flex items-start gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl bg-[#292e31] flex items-center justify-center shrink-0">
                  <Building2 className="w-4 h-4 text-[#F7A607]" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900 text-sm">{c.company_name}</p>
                  <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                    <MapPin className="w-3 h-3" />{c.district}, {c.state}
                  </p>
                </div>
                <span className={`inline-flex items-center text-[10px] font-semibold px-2 py-0.5 rounded-full ${STATUS_STYLE[c.status] ?? 'bg-gray-100 text-gray-600'} shrink-0`}>
                  {c.status}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2 pt-3 border-t border-gray-50 text-xs text-gray-500">
                <div><p className="text-[10px] text-gray-400">GST</p><p className="font-mono font-medium text-gray-700">{c.gst.slice(0, 8)}…</p></div>
                <div><p className="text-[10px] text-gray-400">Jobs</p><p className="font-semibold text-gray-900">{c.job_count}</p></div>
                <div>
                  <p className="text-[10px] text-gray-400">Since</p>
                  <p className="text-gray-700">{new Date(c.created_at).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}</p>
                </div>
              </div>
            </motion.div>
          ))}
          {filtered.length === 0 && (
            <div className="py-14 text-center">
              <Building2 className="w-8 h-8 text-gray-300 mx-auto mb-2" />
              <p className="text-sm text-gray-400">No companies found.</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
