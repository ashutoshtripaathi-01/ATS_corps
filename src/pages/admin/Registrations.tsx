import { useEffect, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  Search, Users, Clock, CheckCircle, ChevronLeft, ChevronRight,
  Shield, MapPin, CreditCard, X,
} from 'lucide-react';
import { getAdminRegistrations } from '@/lib/api';

interface Registration {
  id: number;
  email: string;
  full_name: string | null;
  mobile: string | null;
  force: string | null;
  rank: string | null;
  post: string | null;
  loc1: string | null;
  application_fee: number;
  payment_status: string;
  registration_status: string | null;
  created_at: string;
  razorpay_order_id: string | null;
  razorpay_payment_id: string | null;
  paid_at: string | null;
}

const TABS = [
  { key: '',        label: 'All',            icon: Users },
  { key: 'pending', label: 'Pending Payment', icon: Clock },
  { key: 'paid',    label: 'Paid',            icon: CheckCircle },
] as const

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

const FORCE_COLOR: Record<string, string> = {
  Army:            'bg-green-100 text-green-700',
  Navy:            'bg-blue-100 text-blue-700',
  'Air Force':     'bg-sky-100 text-sky-700',
  'Para Military': 'bg-orange-100 text-orange-700',
}

export default function AdminRegistrations() {
  const [tab,        setTab]        = useState<'' | 'pending' | 'paid'>('')
  const [search,     setSearch]     = useState('')
  const [query,      setQuery]      = useState('')
  const [page,       setPage]       = useState(1)
  const [data,       setData]       = useState<{ registrations: Registration[]; total: number } | null>(null)
  const [loading,    setLoading]    = useState(true)
  const [detail,     setDetail]     = useState<Registration | null>(null)

  const LIMIT = 20

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params: Record<string, string> = { page: String(page), limit: String(LIMIT) }
      if (tab)   params.status = tab
      if (query) params.search = query
      const res = await getAdminRegistrations(params)
      setData(res)
    } catch {
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [tab, query, page])

  useEffect(() => { load() }, [load])

  const totalPages = data ? Math.ceil(data.total / LIMIT) : 1

  const handleSearch = () => { setPage(1); setQuery(search) }
  const handleTab    = (t: '' | 'pending' | 'paid') => { setTab(t); setPage(1); setQuery(''); setSearch('') }

  return (
    <div className='p-4 md:p-6 space-y-5 max-w-6xl mx-auto'>
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
        className='bg-[#1a1d1f] rounded-2xl p-5 text-white'
      >
        <div className='flex items-start justify-between gap-4'>
          <div>
            <p className='text-xs text-gray-400 mb-0.5'>Admin</p>
            <h1 className='text-lg font-extrabold' style={{ fontFamily: 'Plus Jakarta Sans' }}>
              Registrations
            </h1>
            <p className='text-xs text-gray-400 mt-1'>
              All candidate registrations — search, filter, and review payment status.
            </p>
          </div>
          {data && (
            <div className='text-right shrink-0'>
              <p className='text-2xl font-extrabold text-[#F7A607]'>{data.total}</p>
              <p className='text-xs text-gray-400 mt-0.5'>
                {tab === 'pending' ? 'Pending Payment' : tab === 'paid' ? 'Paid' : 'Total'}
              </p>
            </div>
          )}
        </div>
      </motion.div>

      {/* Tabs + Search */}
      <div className='flex flex-col sm:flex-row items-start sm:items-center gap-3'>
        {/* Tab switcher */}
        <div className='flex gap-1 p-1 bg-gray-100 rounded-xl shrink-0'>
          {TABS.map(({ key, label, icon: Icon }) => (
            <button key={key} onClick={() => handleTab(key)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all
                ${tab === key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            >
              <Icon className='w-3.5 h-3.5' />{label}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className='flex gap-2 flex-1 w-full'>
          <div className='relative flex-1'>
            <Search className='absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none' />
            <input
              type='text'
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder='Search by name, email, mobile, force…'
              className='w-full h-9 pl-9 pr-4 text-sm border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-[#F7A607]/30 focus:border-[#F7A607]'
            />
            {search && (
              <button onClick={() => { setSearch(''); setQuery(''); setPage(1) }}
                className='absolute right-3 top-1/2 -translate-y-1/2'>
                <X className='w-3.5 h-3.5 text-gray-400' />
              </button>
            )}
          </div>
          <button onClick={handleSearch}
            className='px-4 py-1.5 bg-[#F7A607] hover:bg-[#e09500] text-white text-xs font-bold rounded-xl transition-colors'>
            Search
          </button>
        </div>
      </div>

      {/* Table */}
      <div className='bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden'>
        {loading ? (
          <div className='p-8 space-y-3'>
            {[1,2,3,4,5].map((i) => (
              <div key={i} className='h-12 bg-gray-100 rounded-xl animate-pulse' />
            ))}
          </div>
        ) : !data || data.registrations.length === 0 ? (
          <div className='py-16 text-center'>
            <Users className='w-10 h-10 text-gray-300 mx-auto mb-3' />
            <p className='text-sm font-semibold text-gray-500'>No registrations found</p>
            {query && <p className='text-xs text-gray-400 mt-1'>Try clearing the search filter</p>}
          </div>
        ) : (
          <>
            {/* Desktop table header */}
            <div className='hidden md:grid grid-cols-[2fr_1.5fr_1fr_1fr_1fr_1fr] gap-3 px-4 py-2.5 bg-gray-50 border-b border-gray-100'>
              {['Name / Email', 'Force & Rank', 'Post', 'Location', 'Fee', 'Status'].map((h) => (
                <p key={h} className='text-[10px] font-bold text-gray-500 uppercase tracking-wider'>{h}</p>
              ))}
            </div>

            <div className='divide-y divide-gray-50'>
              {data.registrations.map((r) => (
                <div key={r.id}
                  onClick={() => setDetail(r)}
                  className='grid grid-cols-1 md:grid-cols-[2fr_1.5fr_1fr_1fr_1fr_1fr] gap-2 md:gap-3 px-4 py-3.5
                    hover:bg-gray-50 transition-colors cursor-pointer'
                >
                  {/* Name / Email */}
                  <div className='flex items-center gap-3'>
                    <div className='w-8 h-8 rounded-full bg-[#292e31] flex items-center justify-center shrink-0'>
                      <span className='text-[10px] font-bold text-[#F7A607]'>
                        {r.full_name
                          ? r.full_name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()
                          : (r.email[0] ?? '?').toUpperCase()}
                      </span>
                    </div>
                    <div className='min-w-0'>
                      <p className='text-sm font-semibold text-gray-900 truncate'>
                        {r.full_name ?? <span className='text-gray-400 italic'>Profile incomplete</span>}
                      </p>
                      <p className='text-[11px] text-gray-400 truncate'>{r.email}</p>
                    </div>
                  </div>

                  {/* Force & Rank */}
                  <div className='flex items-center gap-2 md:block'>
                    {r.force
                      ? <>
                          <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full
                            ${FORCE_COLOR[r.force] ?? 'bg-gray-100 text-gray-600'}`}>
                            <Shield className='w-2.5 h-2.5' />{r.force}
                          </span>
                          <p className='text-xs text-gray-500 mt-0.5 md:mt-1 truncate'>{r.rank}</p>
                        </>
                      : <span className='text-xs text-gray-300'>—</span>
                    }
                  </div>

                  {/* Post */}
                  <div className='flex items-center'>
                    <p className='text-xs text-gray-700 truncate'>{r.post ?? '—'}</p>
                  </div>

                  {/* Location */}
                  <div className='flex items-center gap-1'>
                    {r.loc1 && <MapPin className='w-3 h-3 text-gray-400 shrink-0' />}
                    <p className='text-xs text-gray-700 truncate'>{r.loc1 ?? '—'}</p>
                  </div>

                  {/* Fee */}
                  <div className='flex items-center'>
                    <p className='text-sm font-bold text-gray-900'>₹{r.application_fee}</p>
                  </div>

                  {/* Status */}
                  <div className='flex items-center'>
                    {r.payment_status === 'paid'
                      ? <span className='inline-flex items-center gap-1 text-[10px] font-bold px-2 py-1 bg-green-100 text-green-700 rounded-full'>
                          <CheckCircle className='w-3 h-3' />Paid
                        </span>
                      : r.full_name
                        ? <span className='inline-flex items-center gap-1 text-[10px] font-bold px-2 py-1 bg-amber-100 text-amber-700 rounded-full'>
                            <Clock className='w-3 h-3' />Pending
                          </span>
                        : <span className='inline-flex items-center gap-1 text-[10px] font-bold px-2 py-1 bg-gray-100 text-gray-500 rounded-full'>
                            <CreditCard className='w-3 h-3' />Incomplete
                          </span>
                    }
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Pagination */}
      {data && totalPages > 1 && (
        <div className='flex items-center justify-between'>
          <p className='text-xs text-gray-500'>
            {((page - 1) * LIMIT) + 1}–{Math.min(page * LIMIT, data.total)} of {data.total}
          </p>
          <div className='flex gap-2'>
            <button onClick={() => setPage((p) => p - 1)} disabled={page === 1}
              className='p-2 rounded-lg border border-gray-200 disabled:opacity-40 hover:bg-gray-50 transition-colors'>
              <ChevronLeft className='w-4 h-4 text-gray-600' />
            </button>
            <span className='flex items-center text-xs font-semibold text-gray-700 px-3'>
              {page} / {totalPages}
            </span>
            <button onClick={() => setPage((p) => p + 1)} disabled={page >= totalPages}
              className='p-2 rounded-lg border border-gray-200 disabled:opacity-40 hover:bg-gray-50 transition-colors'>
              <ChevronRight className='w-4 h-4 text-gray-600' />
            </button>
          </div>
        </div>
      )}

      {/* Detail drawer */}
      {detail && (
        <div className='fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4'
          onClick={() => setDetail(null)}>
          <div className='absolute inset-0 bg-black/40' />
          <motion.div
            initial={{ opacity: 0, y: 32 }} animate={{ opacity: 1, y: 0 }}
            className='relative bg-white rounded-3xl shadow-2xl w-full max-w-md max-h-[85vh] overflow-y-auto'
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className='bg-[#1a1d1f] rounded-t-3xl p-5 flex items-start justify-between'>
              <div>
                <p className='text-xs text-gray-400'>Registration #{detail.id.toString().padStart(4, '0')}</p>
                <p className='text-base font-bold text-white mt-0.5'>{detail.full_name ?? 'Incomplete profile'}</p>
                <p className='text-xs text-gray-400 mt-0.5'>{detail.email}</p>
              </div>
              <button onClick={() => setDetail(null)} className='w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center hover:bg-white/20'>
                <X className='w-4 h-4 text-white' />
              </button>
            </div>

            {/* Body */}
            <div className='p-5 space-y-4'>
              {[
                { label: 'Mobile',         value: detail.mobile },
                { label: 'Force',          value: detail.force },
                { label: 'Rank',           value: detail.rank },
                { label: 'Post',           value: detail.post },
                { label: 'Priority 1',     value: detail.loc1 },
                { label: 'Application Fee',value: detail.application_fee ? `₹${detail.application_fee}` : null },
                { label: 'Payment Status', value: detail.payment_status },
                { label: 'Reg. Status',    value: detail.registration_status },
                { label: 'Registered On',  value: formatDate(detail.created_at) },
                { label: 'Razorpay Order', value: detail.razorpay_order_id },
                { label: 'Payment ID',     value: detail.razorpay_payment_id },
                { label: 'Paid At',        value: detail.paid_at ? formatDate(detail.paid_at) : null },
              ].map(({ label, value }) => value ? (
                <div key={label} className='flex justify-between items-start gap-4 py-2 border-b border-gray-50 last:border-0'>
                  <span className='text-xs text-gray-400 shrink-0'>{label}</span>
                  <span className='text-xs font-semibold text-gray-800 text-right break-all'>{value}</span>
                </div>
              ) : null)}
            </div>
          </motion.div>
        </div>
      )}
    </div>
  )
}
