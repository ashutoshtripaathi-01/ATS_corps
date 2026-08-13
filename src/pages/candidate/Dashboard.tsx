import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  Shield,
  MapPin,
  Briefcase,
  CheckCircle,
  Clock,
  FileText,
  User,
  Award,
  ChevronRight,
  Phone,
  AlertCircle,
  Loader2,
  Star,
  TrendingUp,
  Search,
  Bell,
  Calendar,
  Building2,
  Lock,
} from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import { getCandidateProfile } from '@/lib/api';
import companyLogo from '@/assets/company logo.png';

interface CandidateProfile {
  id: number;
  full_name: string;
  mobile: string;
  force: string;
  rank: string;
  unit: string;
  retirement_date: string;
  post: string;
  other_post: string | null;
  gun_license: string | null;
  loc1: string;
  loc2: string | null;
  loc3: string | null;
  application_fee: number;
  payment_status: string;
  verification_status: string;
  id_card_path: string | null;
  discharge_book_path: string | null;
  police_verification_path: string | null;
  created_at: string;
}

const FORCE_COLOR: Record<string, { pill: string; bar: string }> = {
  Army:           { pill: 'bg-green-100 text-green-700 border-green-200',  bar: 'bg-green-500' },
  Navy:           { pill: 'bg-blue-100 text-blue-700 border-blue-200',    bar: 'bg-blue-500' },
  'Air Force':    { pill: 'bg-sky-100 text-sky-700 border-sky-200',       bar: 'bg-sky-500' },
  'Para Military':{ pill: 'bg-orange-100 text-orange-700 border-orange-200', bar: 'bg-orange-500' },
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

/* ─── Micro atoms ─────────────────────────────────────────────────────────── */
const Card = ({ children, className = '' }: { children: React.ReactNode; className?: string }) => (
  <div className={`bg-white dark:bg-[#1e2227] border border-gray-100 dark:border-white/8 rounded-2xl shadow-sm ${className}`}>
    {children}
  </div>
);

const CardHead = ({ title, icon: Icon, action }: { title: string; icon?: React.ElementType; action?: React.ReactNode }) => (
  <div className='flex items-center justify-between px-5 py-4 border-b border-gray-50 dark:border-white/8'>
    <div className='flex items-center gap-2'>
      {Icon && <Icon className='w-4 h-4 text-[#F7A607]' />}
      <h2 className='text-sm font-bold text-gray-900 dark:text-[#F0EFEA]'>{title}</h2>
    </div>
    {action}
  </div>
);

/* ─── Page ────────────────────────────────────────────────────────────────── */
export default function CandidateDashboard() {
  const navigate = useNavigate();
  const { user } = useAppStore();

  const [profile, setProfile] = useState<CandidateProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const firstName = user?.name?.split(' ')[0] || 'Candidate';

  useEffect(() => {
    if (!user?.id) { setLoading(false); return; }
    getCandidateProfile(user.id)
      .then(setProfile)
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [user?.id]);

  const postLabel = profile
    ? (profile.post === 'Other' && profile.other_post ? profile.other_post : profile.post)
    : '—';

  const docCount = profile
    ? [profile.id_card_path, profile.discharge_book_path, profile.police_verification_path].filter(Boolean).length
    : 0;

  const forceStyle = profile ? (FORCE_COLOR[profile.force] ?? FORCE_COLOR['Army']) : null;

  return (
    <div className='min-h-screen bg-gray-50 dark:bg-[#13161a]'>
      <div className='max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-10 py-6 lg:py-8 space-y-6'>

        {/* ════════════════════════════════════════
            HERO BANNER
        ════════════════════════════════════════ */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className='relative bg-[#1a1d1f] rounded-3xl overflow-hidden'
        >
          {/* Background accents */}
          <div className='absolute inset-0 pointer-events-none'>
            <div className='absolute -top-20 -right-20 w-80 h-80 rounded-full bg-[#F7A607]/8 blur-3xl' />
            <div className='absolute bottom-0 left-1/3 w-96 h-32 rounded-full bg-[#F7A607]/4 blur-3xl' />
          </div>
          {/* Gold top bar */}
          <div className='h-1 w-full bg-gradient-to-r from-[#F7A607] via-[#ffcc55] to-[#F7A607]' />

          <div className='relative z-10 p-6 lg:p-8'>
            <div className='flex flex-col lg:flex-row lg:items-center gap-6'>

              {/* Avatar + Identity */}
              <div className='flex items-center gap-5 flex-1 min-w-0'>
                <div className='relative shrink-0'>
                  <div className='w-16 h-16 lg:w-20 lg:h-20 rounded-2xl bg-[#F7A607]/15 border-2 border-[#F7A607]/30 flex items-center justify-center overflow-hidden'>
                    {user?.avatar
                      ? <img src={user.avatar} alt={user.name} className='w-full h-full object-cover' />
                      : <User className='w-8 h-8 lg:w-10 lg:h-10 text-[#F7A607]' />
                    }
                  </div>
                  <div className='absolute -bottom-1 -right-1 w-5 h-5 bg-green-500 border-2 border-[#1a1d1f] rounded-full' />
                </div>

                <div className='min-w-0'>
                  {/* Force badge */}
                  {profile && forceStyle && (
                    <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border mb-2 ${forceStyle.pill}`}>
                      <Shield className='w-3 h-3' />{profile.force}
                    </div>
                  )}
                  {loading && (
                    <div className='inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-white/10 text-gray-400 mb-2'>
                      <Shield className='w-3 h-3' />Ex-Serviceman
                    </div>
                  )}
                  <h1 className='text-2xl lg:text-3xl font-extrabold text-white leading-tight truncate' style={{ fontFamily: 'Plus Jakarta Sans' }}>
                    Welcome, {firstName}!
                  </h1>
                  <p className='text-gray-400 text-sm mt-0.5 truncate'>
                    {loading
                      ? 'Loading your profile…'
                      : profile
                        ? `${profile.rank} · ${profile.unit}`
                        : 'Complete your registration to get started'}
                  </p>
                </div>
              </div>

              {/* Right: ID + date + quick stats — hidden on mobile */}
              <div className='hidden lg:flex items-center gap-6 shrink-0'>
                {profile && (
                  <>
                    <div className='text-right border-r border-white/10 pr-6'>
                      <p className='text-[10px] text-gray-500 uppercase tracking-widest'>Registration ID</p>
                      <p className='text-2xl font-extrabold text-[#F7A607]'>#{profile.id.toString().padStart(4, '0')}</p>
                      <p className='text-[10px] text-gray-500 mt-0.5'>{formatDate(profile.created_at)}</p>
                    </div>
                    <div className='flex gap-3'>
                      {[
                        { label: 'Payment',  value: profile.payment_status === 'paid' ? 'Paid' : 'Pending',
                          ok: profile.payment_status === 'paid' },
                        { label: 'Docs',     value: `${docCount}/3`,
                          ok: docCount === 3 },
                        { label: 'Verified', value: profile.verification_status === 'verified' ? 'Yes' : 'Pending',
                          ok: profile.verification_status === 'verified' },
                      ].map(({ label, value, ok }) => (
                        <div key={label} className='flex flex-col items-center bg-white/6 border border-white/10 rounded-xl px-4 py-3 min-w-[72px]'>
                          <div className={`w-2 h-2 rounded-full mb-1.5 ${ok ? 'bg-green-400' : 'bg-amber-400'}`} />
                          <p className='text-sm font-bold text-white'>{value}</p>
                          <p className='text-[10px] text-gray-500 mt-0.5'>{label}</p>
                        </div>
                      ))}
                    </div>
                  </>
                )}
                {!profile && !loading && (
                  <button onClick={() => navigate('/candidate/register')}
                    className='flex items-center gap-2 px-5 py-2.5 bg-[#F7A607] hover:bg-[#e09500] text-white text-sm font-bold rounded-xl transition-colors'
                  >
                    Complete Registration <ChevronRight className='w-4 h-4' />
                  </button>
                )}
              </div>
            </div>

            {/* Mobile: inline stats */}
            {profile && (
              <div className='flex gap-3 mt-5 lg:hidden'>
                {[
                  { label: 'Payment',  value: profile.payment_status === 'paid' ? 'Paid' : 'Pending', ok: profile.payment_status === 'paid' },
                  { label: 'Docs',     value: `${docCount}/3`, ok: docCount === 3 },
                  { label: 'Verified', value: profile.verification_status === 'verified' ? 'Yes' : 'Pending', ok: profile.verification_status === 'verified' },
                ].map(({ label, value, ok }) => (
                  <div key={label} className='flex-1 flex flex-col items-center bg-white/6 border border-white/10 rounded-xl py-2.5'>
                    <div className={`w-2 h-2 rounded-full mb-1 ${ok ? 'bg-green-400' : 'bg-amber-400'}`} />
                    <p className='text-xs font-bold text-white'>{value}</p>
                    <p className='text-[10px] text-gray-500 mt-0.5'>{label}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </motion.div>

        {/* ════════════════════════════════════════
            LOADING
        ════════════════════════════════════════ */}
        {loading && (
          <div className='flex items-center justify-center py-24'>
            <div className='flex flex-col items-center gap-3'>
              <Loader2 className='w-8 h-8 text-[#F7A607] animate-spin' />
              <p className='text-sm text-gray-400'>Loading your profile…</p>
            </div>
          </div>
        )}

        {/* ════════════════════════════════════════
            ERROR STATE
        ════════════════════════════════════════ */}
        {!loading && error && (
          <div className='grid lg:grid-cols-3 gap-5'>
            {/* Error card */}
            <div className='lg:col-span-2'>
              <Card className='p-8 flex flex-col items-center text-center'>
                <div className='w-16 h-16 rounded-2xl bg-red-50 dark:bg-red-900/20 flex items-center justify-center mb-4'>
                  <AlertCircle className='w-8 h-8 text-red-400' />
                </div>
                <h3 className='text-base font-bold text-gray-900 dark:text-[#F0EFEA] mb-2'>Could not load your profile</h3>
                <p className='text-sm text-gray-500 dark:text-gray-400 max-w-sm mb-5'>
                  We couldn't reach the server right now. If this keeps happening, please contact support.
                </p>
                <div className='flex flex-wrap gap-3 justify-center'>
                  <button onClick={() => window.location.reload()}
                    className='px-4 py-2 bg-[#1a1d1f] text-white text-sm font-semibold rounded-xl hover:bg-[#292e31] transition-colors'
                  >
                    Try Again
                  </button>
                  <a href='mailto:support@exservicemanjobs.com'
                    className='px-4 py-2 border border-gray-200 dark:border-white/10 text-sm font-semibold text-gray-700 dark:text-gray-300 rounded-xl hover:bg-gray-50 dark:hover:bg-white/5 transition-colors'
                  >
                    Contact Support
                  </a>
                </div>
              </Card>
            </div>

            {/* Help sidebar */}
            <div className='space-y-4'>
              <Card className='p-5'>
                <div className='flex items-center gap-2.5 mb-4'>
                  <div className='w-8 h-8 rounded-xl bg-[#F7A607]/10 flex items-center justify-center'>
                    <Bell className='w-4 h-4 text-[#F7A607]' />
                  </div>
                  <p className='text-sm font-bold text-gray-900 dark:text-[#F0EFEA]'>What's happening?</p>
                </div>
                <div className='space-y-2.5 text-xs text-gray-500 dark:text-gray-400'>
                  <p>• Your registration details are saved safely.</p>
                  <p>• Our team reviews applications within 2–5 working days.</p>
                  <p>• You'll receive an SMS on {user?.email ? user.email.split('@')[0] : 'your mobile'} once verified.</p>
                </div>
              </Card>
              <Card className='p-5'>
                <p className='text-xs font-bold text-gray-500 uppercase tracking-widest mb-3'>Quick Actions</p>
                {[
                  { label: 'Browse Jobs', icon: Search, path: '/candidate/jobs' },
                  { label: 'My Applications', icon: Briefcase, path: '/candidate/applications' },
                  { label: 'Profile Settings', icon: User, path: '/candidate/settings' },
                ].map(({ label, icon: Icon, path }) => (
                  <button key={label} onClick={() => navigate(path)}
                    className='w-full flex items-center gap-3 py-2.5 border-b border-gray-50 dark:border-white/5 last:border-0 hover:text-[#F7A607] transition-colors text-left'
                  >
                    <Icon className='w-4 h-4 text-gray-400' />
                    <span className='text-sm text-gray-700 dark:text-gray-300'>{label}</span>
                    <ChevronRight className='w-3.5 h-3.5 text-gray-300 ml-auto' />
                  </button>
                ))}
              </Card>
            </div>
          </div>
        )}

        {/* ════════════════════════════════════════
            MAIN CONTENT — profile loaded
        ════════════════════════════════════════ */}
        {!loading && !error && profile && (
          <>
            {/* ── Status row (mobile: 2 col, desktop: 4 col) ── */}
            <div className='grid grid-cols-2 lg:grid-cols-4 gap-4'>
              {[
                {
                  label: 'Payment Status', icon: CheckCircle,
                  value: profile.payment_status === 'paid' ? 'Paid' : 'Pending',
                  sub: profile.payment_status === 'paid' ? `₹${profile.application_fee.toLocaleString()} received` : 'Action required',
                  ok: profile.payment_status === 'paid', okColor: 'text-green-500', pendingColor: 'text-amber-500',
                },
                {
                  label: 'Verification', icon: Shield,
                  value: profile.verification_status === 'verified' ? 'Verified' : 'Under Review',
                  sub: profile.verification_status === 'verified' ? 'Background clear' : '2–5 working days',
                  ok: profile.verification_status === 'verified', okColor: 'text-green-500', pendingColor: 'text-blue-500',
                },
                {
                  label: 'Documents', icon: FileText,
                  value: `${docCount} / 3 Uploaded`,
                  sub: docCount === 3 ? 'All submitted' : `${3 - docCount} pending`,
                  ok: docCount === 3, okColor: 'text-green-500', pendingColor: 'text-amber-500',
                },
                {
                  label: 'Placement Stage', icon: TrendingUp,
                  value: 'Awaiting Match',
                  sub: 'Employer matching soon',
                  ok: false, okColor: 'text-green-500', pendingColor: 'text-purple-500',
                },
              ].map(({ label, icon: Icon, value, sub, ok, okColor, pendingColor }, i) => (
                <motion.div key={label}
                  initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.07 }}
                >
                  <Card className='p-5 h-full'>
                    <div className='flex items-start justify-between mb-3'>
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${ok ? 'bg-green-50 dark:bg-green-900/20' : 'bg-gray-50 dark:bg-white/5'}`}>
                        <Icon className={`w-4 h-4 ${ok ? okColor : pendingColor}`} />
                      </div>
                      <div className={`w-2 h-2 rounded-full mt-1.5 ${ok ? 'bg-green-400' : 'bg-amber-400'}`} />
                    </div>
                    <p className='text-base font-extrabold text-gray-900 dark:text-[#F0EFEA] leading-tight'>{value}</p>
                    <p className='text-xs font-semibold text-gray-400 dark:text-gray-500 mt-0.5'>{label}</p>
                    <p className='text-[11px] text-gray-400 dark:text-gray-600 mt-1'>{sub}</p>
                  </Card>
                </motion.div>
              ))}
            </div>

            {/* ── Main 2-col grid ── */}
            <div className='grid lg:grid-cols-3 gap-5'>

              {/* Profile Summary — takes 2 columns */}
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
                className='lg:col-span-2'
              >
                <Card className='h-full overflow-hidden'>
                  <CardHead title='Profile Summary' icon={User}
                    action={
                      <button onClick={() => navigate('/candidate/settings')}
                        className='text-xs font-semibold text-[#F7A607] flex items-center gap-0.5 hover:underline'
                      >
                        Edit <ChevronRight className='w-3.5 h-3.5' />
                      </button>
                    }
                  />
                  <div className='p-5'>
                    {/* 2-column grid for fields on desktop */}
                    <div className='grid grid-cols-1 sm:grid-cols-2 gap-4'>
                      {[
                        { icon: Shield,    label: 'Armed Force',     value: profile.force },
                        { icon: Award,     label: 'Rank',            value: profile.rank },
                        { icon: Briefcase, label: 'Unit / Regiment', value: profile.unit },
                        { icon: Briefcase, label: 'Post Applied',    value: postLabel },
                        { icon: MapPin,    label: '1st Priority',    value: profile.loc1 },
                        { icon: MapPin,    label: '2nd Priority',    value: profile.loc2 || 'Not set' },
                        { icon: MapPin,    label: '3rd Priority',    value: profile.loc3 || 'Not set' },
                        { icon: Phone,     label: 'Mobile',          value: profile.mobile },
                        { icon: Calendar,  label: 'Retirement Date', value: formatDate(profile.retirement_date) },
                        { icon: Star,      label: 'Reg. Date',       value: formatDate(profile.created_at) },
                      ].map(({ icon: Icon, label, value }) => (
                        <div key={label} className='flex items-start gap-3 p-3 rounded-xl bg-gray-50 dark:bg-white/4 hover:bg-gray-100 dark:hover:bg-white/6 transition-colors'>
                          <div className='w-8 h-8 rounded-lg bg-[#F7A607]/10 dark:bg-[#F7A607]/15 flex items-center justify-center shrink-0'>
                            <Icon className='w-3.5 h-3.5 text-[#F7A607]' />
                          </div>
                          <div className='min-w-0'>
                            <p className='text-[10px] text-gray-400 dark:text-gray-500 font-medium uppercase tracking-wide'>{label}</p>
                            <p className='text-sm font-semibold text-gray-900 dark:text-[#F0EFEA] truncate mt-0.5'>{value}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </Card>
              </motion.div>

              {/* Right column */}
              <div className='space-y-5'>

                {/* Documents */}
                <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
                  <Card className='overflow-hidden'>
                    <CardHead title='Documents' icon={FileText} />
                    <div className='p-5 space-y-3'>
                      {[
                        { label: 'Ex-SM Identity Card',        icon: Shield,   uploaded: !!profile.id_card_path },
                        { label: 'Discharge Book',              icon: FileText, uploaded: !!profile.discharge_book_path },
                        { label: 'Police Verification Cert.',   icon: Lock,     uploaded: !!profile.police_verification_path },
                      ].map(({ label, icon: Icon, uploaded }) => (
                        <div key={label} className={`flex items-center gap-3 p-3 rounded-xl border transition-colors
                          ${uploaded
                            ? 'bg-green-50 dark:bg-green-900/15 border-green-100 dark:border-green-800/30'
                            : 'bg-gray-50 dark:bg-white/4 border-gray-100 dark:border-white/8'}`}
                        >
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0
                            ${uploaded ? 'bg-green-100 dark:bg-green-900/30' : 'bg-gray-100 dark:bg-white/10'}`}
                          >
                            <Icon className={`w-3.5 h-3.5 ${uploaded ? 'text-green-600' : 'text-gray-400'}`} />
                          </div>
                          <span className={`text-xs font-medium flex-1 ${uploaded ? 'text-green-700 dark:text-green-400' : 'text-gray-400 dark:text-gray-500'}`}>
                            {label}
                          </span>
                          {uploaded
                            ? <CheckCircle className='w-4 h-4 text-green-500 shrink-0' />
                            : <div className='w-4 h-4 rounded-full border-2 border-dashed border-gray-300 dark:border-gray-600 shrink-0' />
                          }
                        </div>
                      ))}
                      <p className='text-[10px] text-gray-400 text-center pt-1'>
                        {docCount}/3 documents submitted
                      </p>
                    </div>
                  </Card>
                </motion.div>

                {/* What happens next */}
                <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
                  <Card className='overflow-hidden'>
                    <CardHead title='What Happens Next?' icon={TrendingUp} />
                    <div className='p-5'>
                      <div className='space-y-1'>
                        {[
                          { n: 1, label: 'Registration submitted', sub: 'Done', done: true },
                          { n: 2, label: 'Document verification', sub: '2–5 working days', done: profile.verification_status === 'verified' },
                          { n: 3, label: 'Employer matching', sub: 'Post verification', done: false },
                          { n: 4, label: 'Placement & joining', sub: 'Final step', done: false },
                        ].map(({ n, label, sub, done }, i) => (
                          <div key={n} className='flex gap-3'>
                            <div className='flex flex-col items-center'>
                              <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-xs font-bold
                                ${done ? 'bg-[#F7A607] text-white' : 'bg-gray-100 dark:bg-white/10 text-gray-400 dark:text-gray-500'}`}
                              >
                                {done ? <CheckCircle className='w-3.5 h-3.5' /> : n}
                              </div>
                              {i < 3 && <div className={`w-0.5 h-5 my-0.5 rounded-full ${done ? 'bg-[#F7A607]/40' : 'bg-gray-100 dark:bg-white/8'}`} />}
                            </div>
                            <div className='pb-4'>
                              <p className={`text-xs font-semibold ${done ? 'text-gray-900 dark:text-[#F0EFEA]' : 'text-gray-400 dark:text-gray-500'}`}>
                                {label}
                              </p>
                              <p className='text-[10px] text-gray-400 mt-0.5'>{sub}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </Card>
                </motion.div>

                {/* Quick links */}
                <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}>
                  <Card className='overflow-hidden'>
                    <CardHead title='Quick Actions' />
                    <div className='p-3'>
                      {[
                        { label: 'Browse Jobs', icon: Search, path: '/candidate/jobs', color: 'text-blue-500', bg: 'bg-blue-50 dark:bg-blue-900/20' },
                        { label: 'My Applications', icon: Briefcase, path: '/candidate/applications', color: 'text-purple-500', bg: 'bg-purple-50 dark:bg-purple-900/20' },
                        { label: 'Browse Companies', icon: Building2, path: '/candidate/companies', color: 'text-green-500', bg: 'bg-green-50 dark:bg-green-900/20' },
                      ].map(({ label, icon: Icon, path, color, bg }) => (
                        <button key={label} onClick={() => navigate(path)}
                          className='w-full flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-gray-50 dark:hover:bg-white/5 transition-colors text-left group'
                        >
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${bg}`}>
                            <Icon className={`w-4 h-4 ${color}`} />
                          </div>
                          <span className='text-sm font-medium text-gray-700 dark:text-gray-300 flex-1'>{label}</span>
                          <ChevronRight className='w-3.5 h-3.5 text-gray-300 group-hover:text-gray-500 transition-colors' />
                        </button>
                      ))}
                    </div>
                  </Card>
                </motion.div>
              </div>
            </div>

            {/* ── Applications / Activity ── */}
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
              <Card className='overflow-hidden'>
                <CardHead title='My Applications' icon={Briefcase}
                  action={
                    <button onClick={() => navigate('/candidate/applications')}
                      className='text-xs font-semibold text-[#F7A607] flex items-center gap-0.5 hover:underline'
                    >
                      View all <ChevronRight className='w-3.5 h-3.5' />
                    </button>
                  }
                />
                <div className='flex flex-col lg:flex-row items-center justify-between gap-6 px-8 py-12'>
                  <div className='flex items-center gap-6'>
                    <div className='w-16 h-16 rounded-2xl bg-gray-100 dark:bg-white/8 flex items-center justify-center shrink-0'>
                      <Briefcase className='w-8 h-8 text-gray-300 dark:text-gray-600' />
                    </div>
                    <div>
                      <p className='text-base font-bold text-gray-900 dark:text-[#F0EFEA]'>No applications yet</p>
                      <p className='text-sm text-gray-400 mt-1 max-w-sm'>
                        Once your profile is verified, Ex-Serviceman Jobs will match you with relevant employers and notify you here.
                      </p>
                    </div>
                  </div>
                  <div className='flex gap-3 shrink-0'>
                    <button onClick={() => navigate('/candidate/jobs')}
                      className='flex items-center gap-2 px-5 py-2.5 bg-[#1a1d1f] dark:bg-white/10 text-white text-sm font-bold rounded-xl hover:bg-[#292e31] transition-colors'
                    >
                      <Search className='w-4 h-4' /> Browse Jobs
                    </button>
                  </div>
                </div>
              </Card>
            </motion.div>
          </>
        )}

        {/* ════════════════════════════════════════
            NO PROFILE STATE
        ════════════════════════════════════════ */}
        {!loading && !error && !profile && (
          <div className='grid lg:grid-cols-3 gap-5'>
            <div className='lg:col-span-2'>
              <Card className='p-10 flex flex-col items-center text-center'>
                <div className='w-20 h-20 rounded-3xl bg-[#F7A607]/10 flex items-center justify-center mb-5'>
                  <img src={companyLogo} alt='Ex-Serviceman Jobs' className='w-10 h-10 object-contain' />
                </div>
                <h3 className='text-xl font-extrabold text-gray-900 dark:text-[#F0EFEA] mb-2' style={{ fontFamily: 'Plus Jakarta Sans' }}>
                  Complete Your Registration
                </h3>
                <p className='text-sm text-gray-500 dark:text-gray-400 max-w-sm mb-6'>
                  Fill in your service details, upload documents, and pay the registration fee to get matched with verified employers.
                </p>
                <button onClick={() => navigate('/candidate/register')}
                  className='flex items-center gap-2 px-6 py-3 bg-[#F7A607] hover:bg-[#e09500] text-white text-sm font-bold rounded-xl transition-colors'
                >
                  Start Registration <ChevronRight className='w-4 h-4' />
                </button>
              </Card>
            </div>
            <div className='space-y-4'>
              <Card className='p-5'>
                <p className='text-xs font-bold text-gray-500 uppercase tracking-widest mb-3'>Quick Actions</p>
                {[
                  { label: 'Browse Jobs', icon: Search, path: '/candidate/jobs' },
                  { label: 'Browse Companies', icon: Building2, path: '/candidate/companies' },
                  { label: 'Profile Settings', icon: User, path: '/candidate/settings' },
                ].map(({ label, icon: Icon, path }) => (
                  <button key={label} onClick={() => navigate(path)}
                    className='w-full flex items-center gap-3 py-3 border-b border-gray-50 dark:border-white/5 last:border-0 hover:text-[#F7A607] transition-colors text-left'
                  >
                    <Icon className='w-4 h-4 text-gray-400' />
                    <span className='text-sm text-gray-700 dark:text-gray-300'>{label}</span>
                    <ChevronRight className='w-3.5 h-3.5 text-gray-300 ml-auto' />
                  </button>
                ))}
              </Card>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
