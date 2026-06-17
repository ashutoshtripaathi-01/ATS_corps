import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import {
  Shield, MapPin, Briefcase, CheckCircle, Clock,
  FileText, User, Award, ChevronRight, Phone,
  AlertCircle, Loader2,
} from 'lucide-react'
import { useAppStore } from '@/store/useAppStore'
import { getCandidateProfile } from '@/lib/api'

interface CandidateProfile {
  id: number
  full_name: string
  mobile: string
  force: string
  rank: string
  unit: string
  retirement_date: string
  post: string
  other_post: string | null
  gun_license: string | null
  loc1: string
  loc2: string | null
  loc3: string | null
  application_fee: number
  payment_status: string
  verification_status: string
  id_card_path: string | null
  discharge_book_path: string | null
  police_verification_path: string | null
  created_at: string
}

const FORCE_COLOR: Record<string, string> = {
  Army:           'bg-green-100 text-green-700',
  Navy:           'bg-blue-100 text-blue-700',
  'Air Force':    'bg-sky-100 text-sky-700',
  'Para Military':'bg-orange-100 text-orange-700',
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })
}

const card = 'bg-white dark:bg-[#1e2227] border border-gray-100 dark:border-white/8 rounded-2xl shadow-sm'
const cardHeader = 'flex items-center justify-between px-4 py-3 border-b border-gray-50 dark:border-white/8'
const cardTitle = 'text-sm font-bold text-gray-900 dark:text-[#F0EFEA]'

export default function CandidateDashboard() {
  const navigate = useNavigate()
  const { user } = useAppStore()

  const [profile, setProfile] = useState<CandidateProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(false)

  const firstName = user?.name?.split(' ')[0] || 'Candidate'

  useEffect(() => {
    if (!user?.id) { setLoading(false); return }
    getCandidateProfile(user.id)
      .then(setProfile)
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }, [user?.id])

  const postLabel = profile
    ? profile.post === 'Other' && profile.other_post
      ? profile.other_post
      : profile.post
    : '—'

  const docCount = profile
    ? [profile.id_card_path, profile.discharge_book_path, profile.police_verification_path].filter(Boolean).length
    : 0

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto space-y-5">

      {/* Welcome Hero */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
        className="relative bg-gradient-to-r from-[#292e31] to-[#1a1e20] rounded-3xl p-5 sm:p-6 overflow-hidden"
      >
        <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full bg-[#F7A607]/10 blur-2xl pointer-events-none" />
        <div className="relative flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold
                ${loading ? 'bg-gray-600 text-gray-300' : profile ? (FORCE_COLOR[profile.force] ?? 'bg-gray-600 text-gray-200') : 'bg-gray-600 text-gray-300'}`}>
                <Shield className="w-3 h-3" />
                {loading ? '…' : profile?.force ?? 'Ex-Serviceman'}
              </div>
            </div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-white mb-1" style={{ fontFamily: 'Plus Jakarta Sans' }}>
              Welcome, {firstName}!
            </h1>
            <p className="text-gray-400 text-sm">
              {loading ? 'Loading your profile…' : profile
                ? `${profile.rank} · ${profile.unit}`
                : 'Your profile is being set up.'}
            </p>
          </div>
          {profile && (
            <div className="shrink-0 sm:text-right">
              <p className="text-[10px] text-gray-500 uppercase tracking-widest">Registration ID</p>
              <p className="text-lg font-extrabold text-[#F7A607]">#{profile.id.toString().padStart(4, '0')}</p>
              <p className="text-[10px] text-gray-500 mt-0.5">Registered {formatDate(profile.created_at)}</p>
            </div>
          )}
        </div>
      </motion.div>

      {loading && (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 text-[#F7A607] animate-spin" />
        </div>
      )}

      {!loading && error && (
        <div className="flex items-center gap-3 p-4 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800/30 rounded-2xl">
          <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />
          <p className="text-sm text-red-700 dark:text-red-400">Could not load your profile. Please check your connection or contact support.</p>
        </div>
      )}

      {!loading && !error && profile && (
        <>
          {/* Status Cards — 1 col mobile → 3 col sm+ */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[
              {
                label: 'Payment',
                value: profile.payment_status === 'paid' ? 'Paid' : 'Pending',
                icon: profile.payment_status === 'paid' ? CheckCircle : Clock,
                bg: profile.payment_status === 'paid' ? 'bg-green-50 dark:bg-green-900/20' : 'bg-amber-50 dark:bg-amber-900/20',
                color: profile.payment_status === 'paid' ? 'text-green-600' : 'text-amber-600',
                sub: profile.payment_status === 'paid' ? `₹${profile.application_fee.toLocaleString()} paid` : 'Action required',
              },
              {
                label: 'Verification',
                value: profile.verification_status === 'verified' ? 'Verified' : 'Pending',
                icon: profile.verification_status === 'verified' ? CheckCircle : Clock,
                bg: profile.verification_status === 'verified' ? 'bg-green-50 dark:bg-green-900/20' : 'bg-blue-50 dark:bg-blue-900/20',
                color: profile.verification_status === 'verified' ? 'text-green-600' : 'text-blue-600',
                sub: profile.verification_status === 'verified' ? 'Background clear' : '2–5 working days',
              },
              {
                label: 'Documents',
                value: `${docCount}/3`,
                icon: FileText,
                bg: docCount === 3 ? 'bg-green-50 dark:bg-green-900/20' : 'bg-amber-50 dark:bg-amber-900/20',
                color: docCount === 3 ? 'text-green-600' : 'text-amber-600',
                sub: docCount === 3 ? 'All submitted' : `${3 - docCount} pending`,
              },
            ].map(({ label, value, icon: Icon, bg, color, sub }, i) => (
              <motion.div key={label} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.06 }}
                className={`${card} p-4 flex sm:block items-center sm:items-start gap-4 sm:gap-0`}
              >
                <div className={`w-9 h-9 rounded-xl ${bg} flex items-center justify-center mb-0 sm:mb-3 shrink-0`}>
                  <Icon className={`w-4 h-4 ${color}`} />
                </div>
                <div>
                  <p className="text-sm font-extrabold text-gray-900 dark:text-[#F0EFEA]">{value}</p>
                  <p className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 mt-0.5">{label}</p>
                  <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5">{sub}</p>
                </div>
              </motion.div>
            ))}
          </div>

          <div className="grid md:grid-cols-5 gap-4">
            {/* Profile Summary */}
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
              className={`md:col-span-3 ${card} overflow-hidden`}
            >
              <div className={cardHeader}>
                <h2 className={cardTitle}>Profile Summary</h2>
                <User className="w-4 h-4 text-gray-400 dark:text-gray-500" />
              </div>
              <div className="p-4 space-y-3">
                {[
                  { icon: Shield,    label: 'Force',           value: profile.force },
                  { icon: Award,     label: 'Rank',            value: profile.rank },
                  { icon: Briefcase, label: 'Unit / Regiment', value: profile.unit },
                  { icon: Briefcase, label: 'Post Applied',    value: postLabel },
                  { icon: MapPin,    label: '1st Priority',    value: profile.loc1 },
                  ...(profile.loc2 ? [{ icon: MapPin, label: '2nd Priority', value: profile.loc2 }] : []),
                  ...(profile.loc3 ? [{ icon: MapPin, label: '3rd Priority', value: profile.loc3 }] : []),
                  { icon: Phone,     label: 'Mobile',          value: profile.mobile },
                ].map(({ icon: Icon, label, value }) => (
                  <div key={label} className="flex items-start gap-3">
                    <div className="w-7 h-7 rounded-lg bg-[#F7A607]/10 flex items-center justify-center shrink-0 mt-0.5">
                      <Icon className="w-3.5 h-3.5 text-[#F7A607]" />
                    </div>
                    <div>
                      <p className="text-[10px] text-gray-400 dark:text-gray-500 font-medium">{label}</p>
                      <p className="text-sm font-semibold text-gray-900 dark:text-[#F0EFEA]">{value}</p>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>

            {/* Right column */}
            <div className="md:col-span-2 space-y-4">
              {/* Documents */}
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
                className={`${card} overflow-hidden`}
              >
                <div className={cardHeader}>
                  <h2 className={cardTitle}>Documents</h2>
                  <FileText className="w-4 h-4 text-gray-400 dark:text-gray-500" />
                </div>
                <div className="p-4 space-y-2.5">
                  {[
                    { label: 'Ex-SM ID Card',             uploaded: !!profile.id_card_path },
                    { label: 'Discharge Book',            uploaded: !!profile.discharge_book_path },
                    { label: 'Police Verification Cert.', uploaded: !!profile.police_verification_path },
                  ].map(({ label, uploaded }) => (
                    <div key={label} className="flex items-center gap-2.5">
                      <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0
                        ${uploaded ? 'bg-green-100 dark:bg-green-900/30' : 'bg-gray-100 dark:bg-white/10'}`}>
                        {uploaded
                          ? <CheckCircle className="w-3.5 h-3.5 text-green-600" />
                          : <Clock className="w-3 h-3 text-gray-400" />}
                      </div>
                      <span className={`text-xs ${uploaded ? 'text-gray-700 dark:text-gray-200' : 'text-gray-400 dark:text-gray-500'}`}>{label}</span>
                    </div>
                  ))}
                </div>
              </motion.div>

              {/* What happens next */}
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}
                className={`${card} overflow-hidden`}
              >
                <div className={cardHeader}>
                  <h2 className={cardTitle}>What Happens Next?</h2>
                </div>
                <div className="p-4 space-y-3">
                  {[
                    { n: 1, label: 'Registration submitted',  done: true },
                    { n: 2, label: 'Document verification',    done: profile.verification_status === 'verified' },
                    { n: 3, label: 'Employer matching',        done: false },
                    { n: 4, label: 'Placement & joining',      done: false },
                  ].map(({ n, label, done }) => (
                    <div key={n} className="flex items-center gap-2.5">
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-xs font-bold
                        ${done ? 'bg-[#F7A607] text-white' : 'bg-gray-100 dark:bg-white/10 text-gray-400 dark:text-gray-500'}`}>
                        {done ? <CheckCircle className="w-3.5 h-3.5" /> : n}
                      </div>
                      <span className={`text-xs font-medium ${done ? 'text-gray-900 dark:text-[#F0EFEA]' : 'text-gray-400 dark:text-gray-500'}`}>{label}</span>
                    </div>
                  ))}
                </div>
              </motion.div>
            </div>
          </div>

          {/* Applications */}
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
            className={`${card} overflow-hidden`}
          >
            <div className={cardHeader}>
              <h2 className={cardTitle}>My Applications</h2>
              <button onClick={() => navigate('/candidate/applications')}
                className="text-xs font-semibold text-[#F7A607] flex items-center gap-0.5 hover:underline">
                View all <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="py-12 text-center">
              <div className="w-12 h-12 rounded-2xl bg-gray-100 dark:bg-white/10 flex items-center justify-center mx-auto mb-3">
                <Briefcase className="w-6 h-6 text-gray-400" />
              </div>
              <p className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-1">No applications yet</p>
              <p className="text-xs text-gray-400 dark:text-gray-500 max-w-xs mx-auto">
                Once your profile is verified, ATS Corps will match you with relevant employers and notify you here.
              </p>
            </div>
          </motion.div>
        </>
      )}

      {/* No profile state */}
      {!loading && !error && !profile && (
        <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
          className={`${card} p-8 text-center`}
        >
          <div className="w-14 h-14 rounded-2xl bg-[#F7A607]/10 flex items-center justify-center mx-auto mb-4">
            <User className="w-7 h-7 text-[#F7A607]" />
          </div>
          <p className="text-sm font-semibold text-gray-900 dark:text-[#F0EFEA] mb-1">Complete your registration</p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">Fill in your profile details to get matched with employers.</p>
          <button onClick={() => navigate('/candidate/register')}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#F7A607] text-white text-sm font-bold rounded-xl hover:bg-[#e09500] transition-colors">
            Complete Registration <ChevronRight className="w-4 h-4" />
          </button>
        </motion.div>
      )}
    </div>
  )
}
