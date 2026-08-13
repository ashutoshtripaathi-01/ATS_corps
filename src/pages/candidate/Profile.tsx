import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { User, Phone, Shield, Briefcase, MapPin, CalendarDays, FileText, CheckCircle, Clock, AlertCircle, Award } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import { getCandidateProfile, FILES_BASE } from '@/lib/api';

interface Candidate {
  id: number; full_name: string; mobile: string; force: string; rank: string;
  unit: string; retirement_date: string; post: string; other_post: string | null;
  gun_license: string | null; loc1: string; loc2: string | null; loc3: string | null;
  payment_status: string; verification_status: string; id_card_path: string | null;
  discharge_book_path: string | null; police_verification_path: string | null; created_at: string;
}

const STATUS_BADGE: Record<string, { style: string; icon: React.ElementType }> = {
  pending:  { style: 'bg-amber-50 text-amber-700 border-amber-200',  icon: Clock },
  verified: { style: 'bg-green-50 text-green-700 border-green-200',  icon: CheckCircle },
  rejected: { style: 'bg-red-50 text-red-700 border-red-200',        icon: AlertCircle },
};

const FORCE_COLOR: Record<string, string> = {
  Army: 'bg-green-500', Navy: 'bg-blue-500', 'Air Force': 'bg-sky-500', 'Para Military': 'bg-orange-500',
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
}

export default function CandidateProfile() {
  const { user } = useAppStore();
  const [profile, setProfile] = useState<Candidate | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.id || user.id === 'skip-test') { setLoading(false); return; }
    getCandidateProfile(user.id).then(setProfile).catch(console.error).finally(() => setLoading(false));
  }, [user?.id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-[#13161a]">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-10 py-6 lg:py-8">
          <div className="grid lg:grid-cols-3 gap-5">
            {[1,2,3].map(i => <div key={i} className="h-40 bg-white border border-gray-100 rounded-2xl animate-pulse" />)}
          </div>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-[#13161a] flex items-center justify-center p-6">
        <div className="bg-white dark:bg-[#1e2227] border border-gray-100 dark:border-white/8 rounded-2xl p-10 text-center shadow-sm max-w-sm w-full">
          <div className="w-16 h-16 rounded-2xl bg-gray-100 dark:bg-white/10 flex items-center justify-center mx-auto mb-4">
            <User className="w-8 h-8 text-gray-300" />
          </div>
          <p className="text-base font-semibold text-gray-700 dark:text-gray-200 mb-1">Profile not found</p>
          <p className="text-xs text-gray-400">Complete your registration to view your profile.</p>
        </div>
      </div>
    );
  }

  const verifyBadge = STATUS_BADGE[profile.verification_status] ?? STATUS_BADGE.pending;
  const VerifyIcon  = verifyBadge.icon;
  const docItems    = [
    { label: 'ID Card',             path: profile.id_card_path },
    { label: 'Discharge Book',      path: profile.discharge_book_path },
    { label: 'Police Verification', path: profile.police_verification_path },
  ];
  const initials = profile.full_name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#13161a]">
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-10 py-6 lg:py-8">

        <div className="mb-6">
          <h1 className="text-2xl font-extrabold text-gray-900 dark:text-[#F0EFEA]" style={{ fontFamily: 'Plus Jakarta Sans' }}>
            My Profile
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Your registration details on file</p>
        </div>

        <div className="grid lg:grid-cols-3 gap-5">

          {/* LEFT: Identity card */}
          <div className="space-y-4">
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
              className="bg-[#1a1d1f] rounded-2xl overflow-hidden"
            >
              <div className={`h-1.5 w-full ${FORCE_COLOR[profile.force] ?? 'bg-[#F7A607]'}`} />
              <div className="p-6">
                <div className="flex items-start gap-4 mb-5">
                  <div className="w-16 h-16 rounded-2xl bg-[#F7A607] flex items-center justify-center text-xl font-extrabold text-white shrink-0">
                    {initials}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-lg font-extrabold text-white leading-tight" style={{ fontFamily: 'Plus Jakarta Sans' }}>
                      {profile.full_name}
                    </p>
                    <p className="text-sm text-gray-300 mt-0.5">{profile.rank} · {profile.force}</p>
                    <p className="text-xs text-gray-400 mt-1 flex items-center gap-1">
                      <Phone className="w-3 h-3" />+91 {profile.mobile}
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between mb-4">
                  <span className={`inline-flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1 rounded-full border ${verifyBadge.style}`}>
                    <VerifyIcon className="w-3 h-3" />
                    {profile.verification_status.charAt(0).toUpperCase() + profile.verification_status.slice(1)}
                  </span>
                  <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-full ${profile.payment_status === 'paid' ? 'bg-green-900/30 text-green-400' : 'bg-amber-900/30 text-amber-400'}`}>
                    {profile.payment_status === 'paid' ? '✓ Paid' : 'Pending Payment'}
                  </span>
                </div>

                <div className="pt-4 border-t border-white/8 space-y-2">
                  <div className="flex justify-between">
                    <span className="text-xs text-gray-500">Registration ID</span>
                    <span className="text-xs font-bold text-[#F7A607]">#{profile.id.toString().padStart(4, '0')}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-xs text-gray-500">Registered</span>
                    <span className="text-xs font-semibold text-gray-300">{formatDate(profile.created_at)}</span>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Documents */}
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
              className="bg-white dark:bg-[#1e2227] border border-gray-100 dark:border-white/8 rounded-2xl shadow-sm overflow-hidden"
            >
              <div className="flex items-center gap-2 px-5 py-4 border-b border-gray-50 dark:border-white/8">
                <FileText className="w-4 h-4 text-[#F7A607]" />
                <p className="text-sm font-bold text-gray-900 dark:text-[#F0EFEA]">Submitted Documents</p>
              </div>
              <div className="p-4 space-y-2.5">
                {docItems.map(({ label, path }) => (
                  <div key={label} className={`flex items-center justify-between gap-3 rounded-xl p-3 ${path ? 'bg-green-50 dark:bg-green-900/15' : 'bg-gray-50 dark:bg-white/4'}`}>
                    <div className="flex items-center gap-2.5">
                      <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${path ? 'bg-green-100 dark:bg-green-900/30' : 'bg-gray-200 dark:bg-white/10'}`}>
                        {path ? <CheckCircle className="w-3.5 h-3.5 text-green-600" /> : <AlertCircle className="w-3.5 h-3.5 text-gray-400" />}
                      </div>
                      <p className="text-xs font-medium text-gray-700 dark:text-gray-300">{label}</p>
                    </div>
                    {path ? (
                      <a href={`${FILES_BASE.replace('/candidates', '')}/${path.replace(/^.*uploads\//, '')}`}
                        target="_blank" rel="noopener noreferrer"
                        className="text-xs font-semibold text-[#F7A607] hover:underline"
                      >
                        View
                      </a>
                    ) : (
                      <span className="text-[10px] text-gray-400">Not uploaded</span>
                    )}
                  </div>
                ))}
              </div>
            </motion.div>
          </div>

          {/* RIGHT: Details — 2 sections */}
          <div className="lg:col-span-2 space-y-4">

            {/* Service Details */}
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
              className="bg-white dark:bg-[#1e2227] border border-gray-100 dark:border-white/8 rounded-2xl shadow-sm overflow-hidden"
            >
              <div className="flex items-center gap-2 px-5 py-4 border-b border-gray-50 dark:border-white/8">
                <Shield className="w-4 h-4 text-[#F7A607]" />
                <p className="text-sm font-bold text-gray-900 dark:text-[#F0EFEA]">Service Details</p>
              </div>
              <div className="p-5 grid grid-cols-2 lg:grid-cols-4 gap-3">
                {[
                  { label: 'Force',           value: profile.force,  icon: Shield },
                  { label: 'Rank',            value: profile.rank,   icon: Award },
                  { label: 'Unit / Regiment', value: profile.unit,   icon: Briefcase },
                  { label: 'Retirement Date', value: formatDate(profile.retirement_date), icon: CalendarDays },
                ].map(({ label, value, icon: Icon }) => (
                  <div key={label} className="bg-gray-50 dark:bg-white/4 rounded-xl p-4">
                    <div className="w-7 h-7 rounded-lg bg-[#F7A607]/10 flex items-center justify-center mb-2">
                      <Icon className="w-3.5 h-3.5 text-[#F7A607]" />
                    </div>
                    <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-0.5">{label}</p>
                    <p className="text-sm font-semibold text-gray-800 dark:text-[#F0EFEA]">{value}</p>
                  </div>
                ))}
              </div>
            </motion.div>

            {/* Job Preference */}
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
              className="bg-white dark:bg-[#1e2227] border border-gray-100 dark:border-white/8 rounded-2xl shadow-sm overflow-hidden"
            >
              <div className="flex items-center gap-2 px-5 py-4 border-b border-gray-50 dark:border-white/8">
                <Briefcase className="w-4 h-4 text-[#F7A607]" />
                <p className="text-sm font-bold text-gray-900 dark:text-[#F0EFEA]">Job Preference</p>
              </div>
              <div className="p-5 grid sm:grid-cols-2 gap-5">
                <div>
                  <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-2">Preferred Post</p>
                  <p className="text-sm font-semibold text-gray-800 dark:text-[#F0EFEA]">
                    {profile.post === 'Other' ? (profile.other_post ?? profile.post) : profile.post}
                  </p>
                  {profile.gun_license && (
                    <div className="mt-3">
                      <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">Gun License</p>
                      <p className="text-sm font-semibold text-gray-800 dark:text-[#F0EFEA]">{profile.gun_license}</p>
                    </div>
                  )}
                </div>
                <div>
                  <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-2">Preferred Locations</p>
                  <div className="flex flex-wrap gap-2">
                    {[profile.loc1, profile.loc2, profile.loc3].filter(Boolean).map((loc, idx) => (
                      <span key={loc} className="flex items-center gap-1 text-xs font-medium bg-[#F7A607]/10 text-[#F7A607] px-2.5 py-1.5 rounded-full border border-[#F7A607]/20">
                        <MapPin className="w-3 h-3" />
                        {idx + 1}. {loc}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>

            <p className="text-center text-xs text-gray-400 dark:text-gray-600 py-2">
              Registered on {formatDate(profile.created_at)} · Contact Ex-Serviceman Jobs admin to update your details.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
