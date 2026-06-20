import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  User,
  Phone,
  Shield,
  Briefcase,
  MapPin,
  CalendarDays,
  FileText,
  CheckCircle,
  Clock,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import { getCandidateProfile, FILES_BASE } from '@/lib/api';

interface Candidate {
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
  payment_status: string;
  verification_status: string;
  id_card_path: string | null;
  discharge_book_path: string | null;
  police_verification_path: string | null;
  created_at: string;
}

const STATUS_BADGE: Record<string, { style: string; icon: React.ElementType }> =
  {
    pending: {
      style: 'bg-amber-50 text-amber-700 border-amber-200',
      icon: Clock,
    },
    verified: {
      style: 'bg-green-50 text-green-700 border-green-200',
      icon: CheckCircle,
    },
    rejected: {
      style: 'bg-red-50 text-red-700 border-red-200',
      icon: AlertCircle,
    },
  };

export default function CandidateProfile() {
  const { user } = useAppStore();
  const [profile, setProfile] = useState<Candidate | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.id || user.id === 'skip-test') {
      setLoading(false);
      return;
    }
    getCandidateProfile(user.id)
      .then(setProfile)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [user?.id]);

  if (loading) {
    return (
      <div className='p-6 max-w-2xl mx-auto space-y-4'>
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className='h-32 bg-white border border-gray-100 rounded-2xl animate-pulse'
          />
        ))}
      </div>
    );
  }

  if (!profile) {
    return (
      <div className='p-6 max-w-2xl mx-auto'>
        <div className='bg-white border border-gray-100 rounded-2xl p-10 text-center shadow-sm'>
          <User className='w-10 h-10 text-gray-300 mx-auto mb-3' />
          <p className='text-sm font-semibold text-gray-700 mb-1'>
            Profile not found
          </p>
          <p className='text-xs text-gray-400'>
            Complete your registration to view your profile.
          </p>
        </div>
      </div>
    );
  }

  const verifyBadge =
    STATUS_BADGE[profile.verification_status] ?? STATUS_BADGE.pending;
  const VerifyIcon = verifyBadge.icon;

  const docItems = [
    { label: 'ID Card', path: profile.id_card_path },
    { label: 'Discharge Book', path: profile.discharge_book_path },
    { label: 'Police Verification', path: profile.police_verification_path },
  ];

  return (
    <div className='p-4 sm:p-6 max-w-2xl mx-auto space-y-4'>
      <div className='mb-1'>
        <h1
          className='text-xl font-extrabold text-gray-900'
          style={{ fontFamily: 'Plus Jakarta Sans' }}
        >
          My Profile
        </h1>
        <p className='text-sm text-gray-500 mt-0.5'>
          Your registration details on file with Ex-Serviceman Jobs
        </p>
      </div>

      {/* Identity card */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className='bg-[#292e31] rounded-2xl p-5 text-white'
      >
        <div className='flex items-start gap-4'>
          <div className='w-14 h-14 rounded-xl bg-[#F7A607] flex items-center justify-center shrink-0 text-xl font-extrabold text-white'>
            {profile.full_name
              .split(' ')
              .map((n) => n[0])
              .join('')
              .slice(0, 2)}
          </div>
          <div className='flex-1 min-w-0'>
            <p
              className='text-lg font-extrabold leading-tight'
              style={{ fontFamily: 'Plus Jakarta Sans' }}
            >
              {profile.full_name}
            </p>
            <p className='text-sm text-gray-300 mt-0.5'>
              {profile.rank} · {profile.force}
            </p>
            <p className='text-xs text-gray-400 mt-1 flex items-center gap-1'>
              <Phone className='w-3 h-3' />
              +91 {profile.mobile}
            </p>
          </div>
          <span
            className={`inline-flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1 rounded-full border ${verifyBadge.style} shrink-0`}
          >
            <VerifyIcon className='w-3 h-3' />
            {profile.verification_status.charAt(0).toUpperCase() +
              profile.verification_status.slice(1)}
          </span>
        </div>
      </motion.div>

      {/* Service details */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className='bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden'
      >
        <div className='flex items-center gap-2 px-4 py-3 border-b border-gray-50'>
          <Shield className='w-4 h-4 text-[#F7A607]' />
          <p className='text-sm font-bold text-gray-900'>Service Details</p>
        </div>
        <div className='p-4 grid grid-cols-2 gap-3'>
          {[
            { label: 'Force', value: profile.force },
            { label: 'Rank', value: profile.rank },
            { label: 'Unit / Regiment', value: profile.unit },
            {
              label: 'Retirement Date',
              value: new Date(profile.retirement_date).toLocaleDateString(
                'en-IN',
                { day: 'numeric', month: 'long', year: 'numeric' },
              ),
            },
          ].map(({ label, value }) => (
            <div key={label} className='bg-gray-50 rounded-xl p-3'>
              <p className='text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-0.5'>
                {label}
              </p>
              <p className='text-sm font-semibold text-gray-800'>{value}</p>
            </div>
          ))}
        </div>
      </motion.div>

      {/* Job preference */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className='bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden'
      >
        <div className='flex items-center gap-2 px-4 py-3 border-b border-gray-50'>
          <Briefcase className='w-4 h-4 text-[#F7A607]' />
          <p className='text-sm font-bold text-gray-900'>Job Preference</p>
        </div>
        <div className='p-4 space-y-3'>
          <div>
            <p className='text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1'>
              Preferred Post
            </p>
            <p className='text-sm font-semibold text-gray-800'>
              {profile.post === 'Other'
                ? (profile.other_post ?? profile.post)
                : profile.post}
            </p>
          </div>
          {profile.gun_license && (
            <div>
              <p className='text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1'>
                Gun License
              </p>
              <p className='text-sm font-semibold text-gray-800'>
                {profile.gun_license}
              </p>
            </div>
          )}
          <div>
            <p className='text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1.5'>
              Preferred Locations
            </p>
            <div className='flex flex-wrap gap-2'>
              {[profile.loc1, profile.loc2, profile.loc3]
                .filter(Boolean)
                .map((loc) => (
                  <span
                    key={loc}
                    className='flex items-center gap-1 text-xs font-medium bg-[#F7A607]/10 text-[#F7A607] px-2.5 py-1 rounded-full'
                  >
                    <MapPin className='w-3 h-3' />
                    {loc}
                  </span>
                ))}
            </div>
          </div>
        </div>
      </motion.div>

      {/* Documents */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className='bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden'
      >
        <div className='flex items-center gap-2 px-4 py-3 border-b border-gray-50'>
          <FileText className='w-4 h-4 text-[#F7A607]' />
          <p className='text-sm font-bold text-gray-900'>Submitted Documents</p>
        </div>
        <div className='p-4 space-y-2.5'>
          {docItems.map(({ label, path }) => (
            <div
              key={label}
              className='flex items-center justify-between gap-3 bg-gray-50 rounded-xl p-3'
            >
              <div className='flex items-center gap-2.5'>
                <div
                  className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0
                  ${path ? 'bg-green-100' : 'bg-gray-200'}`}
                >
                  {path ? (
                    <CheckCircle className='w-4 h-4 text-green-600' />
                  ) : (
                    <AlertCircle className='w-4 h-4 text-gray-400' />
                  )}
                </div>
                <p className='text-sm font-medium text-gray-700'>{label}</p>
              </div>
              {path ? (
                <a
                  href={`${FILES_BASE.replace('/candidates', '')}/${path.replace(/^.*uploads\//, '')}`}
                  target='_blank'
                  rel='noopener noreferrer'
                  className='text-xs font-semibold text-[#F7A607] hover:underline'
                >
                  View
                </a>
              ) : (
                <span className='text-[10px] text-gray-400'>Not uploaded</span>
              )}
            </div>
          ))}
        </div>
      </motion.div>

      <p className='text-center text-xs text-gray-400 pb-2'>
        Registered on{' '}
        {new Date(profile.created_at).toLocaleDateString('en-IN', {
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        })}
        <br />
        Contact Ex-Serviceman Jobs admin to update your details.
      </p>
    </div>
  );
}
