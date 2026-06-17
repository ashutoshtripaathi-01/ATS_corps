import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Users, Search, MapPin, Shield, ChevronDown, Eye } from 'lucide-react'
import { getAdminCandidates } from '@/lib/api'

interface Candidate {
  id: number
  full_name: string
  mobile: string
  force: string
  rank: string
  post: string
  loc1: string
  payment_status: string
  verification_status: string
  created_at: string
}

const FORCES = ['All Forces', 'Army', 'Navy', 'Air Force', 'Para Military']

const FORCE_COLOR: Record<string, string> = {
  Army:           'bg-green-100 text-green-700',
  Navy:           'bg-blue-100 text-blue-700',
  'Air Force':    'bg-sky-100 text-sky-700',
  'Para Military':'bg-orange-100 text-orange-700',
}

const STATUS_STYLE: Record<string, string> = {
  paid:    'bg-green-100 text-green-700',
  pending: 'bg-amber-100 text-amber-700',
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function AdminCandidates() {
  const [candidates, setCandidates] = useState<Candidate[]>([])
  const [loading, setLoading]       = useState(true)
  const [search, setSearch]         = useState('')
  const [forceFilter, setForceFilter] = useState('All Forces')

  useEffect(() => {
    getAdminCandidates()
      .then(setCandidates)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  const filtered = candidates.filter((c) => {
    const matchSearch = c.full_name.toLowerCase().includes(search.toLowerCase()) ||
      c.rank.toLowerCase().includes(search.toLowerCase()) ||
      c.mobile.includes(search)
    const matchForce = forceFilter === 'All Forces' || c.force === forceFilter
    return matchSearch && matchForce
  })

  const byForce = (f: string) => candidates.filter((c) => c.force === f).length

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-5xl mx-auto">

      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between"
      >
        <div>
          <h1 className="text-lg font-extrabold text-gray-900" style={{ fontFamily: 'Plus Jakarta Sans' }}>
            Registered Candidates
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {loading ? 'Loading…' : `${candidates.length} ex-servicemen registered`}
          </p>
        </div>
        <div className="w-10 h-10 rounded-xl bg-green-50 flex items-center justify-center">
          <Users className="w-5 h-5 text-green-600" />
        </div>
      </motion.div>

      {/* Force breakdown */}
      <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
        className="grid grid-cols-4 gap-2"
      >
        {['Army', 'Navy', 'Air Force', 'Para Military'].map((f) => (
          <div key={f} className="bg-white border border-gray-100 rounded-xl p-3 shadow-sm text-center">
            {loading ? (
              <div className="h-6 w-6 bg-gray-100 rounded animate-pulse mx-auto mb-1" />
            ) : (
              <p className="text-lg font-extrabold text-gray-900">{byForce(f)}</p>
            )}
            <p className="text-[10px] text-gray-500 mt-0.5 leading-tight">{f}</p>
          </div>
        ))}
      </motion.div>

      {/* Filters */}
      <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }}
        className="flex gap-2 flex-wrap"
      >
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          <input value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, rank or mobile…"
            className="w-full h-10 pl-9 pr-4 rounded-xl border border-gray-200 bg-white text-sm outline-none
              focus:border-[#F7A607] focus:ring-2 focus:ring-[#F7A607]/10 placeholder:text-gray-400"
          />
        </div>
        <div className="relative">
          <select value={forceFilter} onChange={(e) => setForceFilter(e.target.value)}
            className="h-10 pl-3 pr-8 rounded-xl border border-gray-200 bg-white text-sm appearance-none
              outline-none focus:border-[#F7A607] focus:ring-2 focus:ring-[#F7A607]/10 cursor-pointer text-gray-700"
          >
            {FORCES.map((f) => <option key={f}>{f}</option>)}
          </select>
          <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
        </div>
      </motion.div>

      {/* Desktop table */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }}
        className="hidden md:block bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden"
      >
        {loading ? (
          <div className="p-6 space-y-3">
            {[1,2,3,4].map(i => <div key={i} className="h-12 bg-gray-100 rounded-xl animate-pulse" />)}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left text-xs font-semibold text-gray-500 px-4 py-3">Candidate</th>
                <th className="text-left text-xs font-semibold text-gray-500 px-4 py-3">Force / Rank</th>
                <th className="text-left text-xs font-semibold text-gray-500 px-4 py-3">Post Applied</th>
                <th className="text-left text-xs font-semibold text-gray-500 px-4 py-3">Location Pref.</th>
                <th className="text-left text-xs font-semibold text-gray-500 px-4 py-3">Registered</th>
                <th className="text-left text-xs font-semibold text-gray-500 px-4 py-3">Payment</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map((c) => (
                <tr key={c.id} className="hover:bg-gray-50/60 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-[#292e31] flex items-center justify-center shrink-0">
                        <span className="text-[10px] font-bold text-[#F7A607]">
                          {c.full_name.split(' ').map((n) => n[0]).join('').slice(0, 2)}
                        </span>
                      </div>
                      <div>
                        <span className="font-semibold text-gray-900">{c.full_name}</span>
                        <p className="text-[10px] text-gray-400">{c.mobile}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full ${FORCE_COLOR[c.force] ?? 'bg-gray-100 text-gray-600'}`}>
                      <Shield className="w-2.5 h-2.5" />{c.force}
                    </span>
                    <p className="text-xs text-gray-500 mt-0.5">{c.rank}</p>
                  </td>
                  <td className="px-4 py-3 text-gray-700 text-xs">{c.post}</td>
                  <td className="px-4 py-3">
                    <span className="flex items-center gap-1 text-xs text-gray-600">
                      <MapPin className="w-3 h-3 text-gray-400" />{c.loc1}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500">{formatDate(c.created_at)}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex text-[10px] font-semibold px-2.5 py-1 rounded-full ${STATUS_STYLE[c.payment_status] ?? 'bg-gray-100 text-gray-500'}`}>
                      {c.payment_status.charAt(0).toUpperCase() + c.payment_status.slice(1)}
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
        )}
        {!loading && filtered.length === 0 && (
          <div className="py-12 text-center text-gray-400 text-sm">
            {candidates.length === 0 ? 'No candidates registered yet.' : 'No candidates match your search.'}
          </div>
        )}
      </motion.div>

      {/* Mobile cards */}
      <div className="md:hidden space-y-3">
        {loading ? (
          [1,2,3].map(i => <div key={i} className="h-28 bg-gray-100 rounded-2xl animate-pulse" />)
        ) : filtered.map((c, i) => (
          <motion.div key={c.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.04 * i }}
            className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm"
          >
            <div className="flex items-start gap-3 mb-3">
              <div className="w-10 h-10 rounded-full bg-[#292e31] flex items-center justify-center shrink-0">
                <span className="text-xs font-bold text-[#F7A607]">
                  {c.full_name.split(' ').map((n) => n[0]).join('').slice(0, 2)}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-gray-900 text-sm">{c.full_name}</p>
                <p className="text-xs text-gray-500">{c.rank} · {c.mobile}</p>
              </div>
              <span className={`inline-flex text-[10px] font-semibold px-2 py-0.5 rounded-full ${FORCE_COLOR[c.force] ?? 'bg-gray-100 text-gray-600'} shrink-0`}>
                {c.force}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2 pt-3 border-t border-gray-50 text-xs">
              <div><p className="text-[10px] text-gray-400">Post</p><p className="font-medium text-gray-700">{c.post}</p></div>
              <div><p className="text-[10px] text-gray-400">Location</p><p className="font-medium text-gray-700">{c.loc1}</p></div>
              <div>
                <p className="text-[10px] text-gray-400">Payment</p>
                <span className={`inline-flex text-[10px] font-semibold px-2 py-0.5 rounded-full ${STATUS_STYLE[c.payment_status] ?? 'bg-gray-100 text-gray-500'}`}>
                  {c.payment_status}
                </span>
              </div>
            </div>
          </motion.div>
        ))}
        {!loading && filtered.length === 0 && (
          <div className="py-12 text-center text-gray-400 text-sm">
            {candidates.length === 0 ? 'No candidates registered yet.' : 'No candidates match your search.'}
          </div>
        )}
      </div>
    </div>
  )
}
