import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import {
  Users, Search, ChevronDown, Shield, MapPin, Phone, Briefcase,
} from 'lucide-react'
import { getAdminCandidates } from '@/lib/api'

interface Candidate {
  id: number
  full_name: string
  force: string
  rank: string
  unit: string
  mobile: string
  post: string
  loc1: string
  loc2: string | null
  verification_status: string
  created_at: string
}

const FORCE_COLOR: Record<string, string> = {
  Army:           'bg-green-100 text-green-700',
  Navy:           'bg-blue-100 text-blue-700',
  'Air Force':    'bg-sky-100 text-sky-700',
  'Para Military':'bg-orange-100 text-orange-700',
}

export default function CandidateDB() {
  const [candidates, setCandidates] = useState<Candidate[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [forceFilter, setForceFilter] = useState('all')

  useEffect(() => {
    getAdminCandidates()
      .then((data) => setCandidates(data.filter((c: Candidate) => c.verification_status === 'verified')))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  const forces = ['all', ...Array.from(new Set(candidates.map(c => c.force)))]

  const filtered = candidates.filter(c => {
    const q = search.toLowerCase()
    const matchSearch = !q ||
      c.full_name.toLowerCase().includes(q) ||
      c.rank.toLowerCase().includes(q) ||
      c.post.toLowerCase().includes(q) ||
      c.loc1.toLowerCase().includes(q)
    const matchForce = forceFilter === 'all' || c.force === forceFilter
    return matchSearch && matchForce
  })

  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto">
      <div className="mb-5">
        <h1 className="text-xl font-extrabold text-gray-900 mb-0.5" style={{ fontFamily: 'Plus Jakarta Sans' }}>
          Candidate Database
        </h1>
        <p className="text-sm text-gray-500">
          {loading ? 'Loading…' : `${filtered.length} verified ex-servicemen available`}
        </p>
      </div>

      <div className="flex gap-2 mb-4 flex-wrap">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
          <input value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, rank, post, or location…"
            className="w-full h-9 pl-8 pr-3 rounded-xl border border-gray-200 bg-white text-xs outline-none
              focus:border-[#F7A607] focus:ring-2 focus:ring-[#F7A607]/10 placeholder:text-gray-400"
          />
        </div>
        <div className="relative">
          <select value={forceFilter} onChange={(e) => setForceFilter(e.target.value)}
            className="h-9 pl-3 pr-7 rounded-xl border border-gray-200 bg-white text-xs appearance-none outline-none focus:border-[#F7A607] cursor-pointer text-gray-700"
          >
            {forces.map(f => <option key={f} value={f}>{f === 'all' ? 'All Forces' : f}</option>)}
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
          <p className="text-sm font-semibold text-gray-700 mb-1">No verified candidates yet</p>
          <p className="text-xs text-gray-400 max-w-xs mx-auto">
            Once ATS Corps verifies candidate registrations, they will appear in this database for you to browse.
          </p>
        </motion.div>
      )}

      {!loading && filtered.length > 0 && (
        <div className="space-y-3">
          {filtered.map((c, i) => (
            <motion.div key={c.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.04 * i }}
              className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm hover:border-[#F7A607]/30 transition-all"
            >
              <div className="flex items-start gap-3 mb-3">
                <div className="w-10 h-10 rounded-full bg-[#292e31] flex items-center justify-center shrink-0">
                  <span className="text-[11px] font-bold text-[#F7A607]">
                    {c.full_name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-sm text-gray-900">{c.full_name}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{c.rank} · {c.unit}</p>
                </div>
                <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2.5 py-1 rounded-full shrink-0 ${FORCE_COLOR[c.force] ?? 'bg-gray-100 text-gray-600'}`}>
                  <Shield className="w-3 h-3" />{c.force}
                </span>
              </div>

              <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-gray-500">
                <span className="flex items-center gap-1"><Briefcase className="w-3 h-3" />{c.post}</span>
                <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{c.loc1}{c.loc2 ? ` / ${c.loc2}` : ''}</span>
                <span className="flex items-center gap-1"><Phone className="w-3 h-3" />+91 {c.mobile}</span>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  )
}
