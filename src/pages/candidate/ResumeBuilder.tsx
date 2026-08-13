import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { FileText, Download, Eye, User, Shield, Briefcase, MapPin, Phone, CheckCircle, Printer } from 'lucide-react'
import { useAppStore } from '@/store/useAppStore'
import { getCandidateProfile } from '@/lib/api'

interface Candidate {
  full_name: string; mobile: string; force: string; rank: string; unit: string;
  retirement_date: string; post: string; loc1: string; loc2: string | null;
  loc3: string | null; gun_license: string | null;
}

export default function ResumeBuilder() {
  const { user }    = useAppStore()
  const [profile,   setProfile]  = useState<Candidate | null>(null)
  const [loading,   setLoading]  = useState(true)

  useEffect(() => {
    if (!user?.id || user.id === 'skip-test') { setLoading(false); return }
    getCandidateProfile(user.id).then(setProfile).catch(console.error).finally(() => setLoading(false))
  }, [user?.id])

  const locations = profile ? [profile.loc1, profile.loc2, profile.loc3].filter(Boolean).join(' / ') : ''
  const yearsExp  = profile
    ? Math.floor((Date.now() - new Date(profile.retirement_date).getTime()) / (365.25 * 24 * 3600 * 1000)) + 15
    : 0

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#13161a]">
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-10 py-6 lg:py-8">

        <div className="mb-6">
          <h1 className="text-2xl font-extrabold text-gray-900 dark:text-[#F0EFEA]" style={{ fontFamily: 'Plus Jakarta Sans' }}>
            Resume Builder
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Generate a professional resume from your registration details</p>
        </div>

        {loading && (
          <div className="grid lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 h-[500px] bg-white dark:bg-[#1e2227] border border-gray-100 dark:border-white/8 rounded-2xl animate-pulse" />
            <div className="space-y-3">
              {[1,2].map(i => <div key={i} className="h-32 bg-white dark:bg-[#1e2227] border border-gray-100 dark:border-white/8 rounded-2xl animate-pulse" />)}
            </div>
          </div>
        )}

        {!loading && !profile && (
          <div className="bg-white dark:bg-[#1e2227] border border-gray-100 dark:border-white/8 rounded-2xl p-16 text-center shadow-sm max-w-lg mx-auto">
            <div className="w-14 h-14 rounded-2xl bg-gray-100 dark:bg-white/10 flex items-center justify-center mx-auto mb-4">
              <FileText className="w-7 h-7 text-gray-300" />
            </div>
            <p className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-1">Complete your registration first</p>
            <p className="text-xs text-gray-400">Your resume will be auto-generated from your profile details.</p>
          </div>
        )}

        {!loading && profile && (
          <div className="grid lg:grid-cols-3 gap-6">

            {/* Resume Preview — takes 2 cols */}
            <div className="lg:col-span-2">
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                className="bg-white border-2 border-gray-200 dark:border-white/12 rounded-2xl overflow-hidden shadow-sm"
              >
                {/* Resume Header */}
                <div className="bg-[#1a1d1f] p-7 text-white">
                  <div className="flex items-start gap-5">
                    <div className="w-20 h-20 rounded-2xl bg-[#F7A607] flex items-center justify-center text-2xl font-extrabold shrink-0">
                      {profile.full_name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                    </div>
                    <div className="flex-1">
                      <h2 className="text-2xl font-extrabold" style={{ fontFamily: 'Plus Jakarta Sans' }}>{profile.full_name}</h2>
                      <p className="text-[#F7A607] font-semibold text-sm mt-1">Ex-{profile.rank} · {profile.force}</p>
                      <div className="flex flex-wrap gap-x-5 gap-y-1.5 mt-2.5">
                        <span className="flex items-center gap-1 text-xs text-gray-300">
                          <Phone className="w-3 h-3" />+91 {profile.mobile}
                        </span>
                        <span className="flex items-center gap-1 text-xs text-gray-300">
                          <MapPin className="w-3 h-3" />{locations}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="p-6 space-y-6">
                  {/* Military Service */}
                  <div>
                    <h3 className="text-xs font-extrabold text-gray-400 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                      <Shield className="w-3.5 h-3.5 text-[#F7A607]" />Military Service
                    </h3>
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                      {[
                        { label: 'Force',        value: profile.force },
                        { label: 'Final Rank',   value: profile.rank },
                        { label: 'Unit / Corps', value: profile.unit },
                        { label: 'Service Until', value: new Date(profile.retirement_date).getFullYear() },
                      ].map(({ label, value }) => (
                        <div key={label} className="bg-gray-50 rounded-xl p-3">
                          <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wide">{label}</p>
                          <p className="text-sm font-semibold text-gray-800 mt-0.5">{value}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Skills */}
                  <div>
                    <h3 className="text-xs font-extrabold text-gray-400 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5 text-[#F7A607]" />Key Skills
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {[
                        'Discipline & Punctuality', 'Team Leadership', 'Physical Fitness',
                        'Security Operations', 'Crisis Management', 'Weapons Handling',
                        ...(profile.gun_license ? [`${profile.gun_license} License Holder`] : []),
                      ].map(skill => (
                        <span key={skill} className="text-xs font-medium bg-[#F7A607]/10 text-[#F7A607] px-2.5 py-1 rounded-full">{skill}</span>
                      ))}
                    </div>
                  </div>

                  {/* Objective */}
                  <div>
                    <h3 className="text-xs font-extrabold text-gray-400 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                      <Briefcase className="w-3.5 h-3.5 text-[#F7A607]" />Career Objective
                    </h3>
                    <p className="text-sm text-gray-700 leading-relaxed">
                      Seeking a position as <strong>{profile.post}</strong> where I can apply {yearsExp}+ years of military discipline, security expertise, and leadership skills to contribute effectively to the organization.
                    </p>
                  </div>

                  {/* Locations */}
                  <div>
                    <h3 className="text-xs font-extrabold text-gray-400 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-[#F7A607]" />Preferred Work Locations
                    </h3>
                    <p className="text-sm text-gray-700">{locations}</p>
                  </div>
                </div>
              </motion.div>
            </div>

            {/* Right: controls + tips */}
            <div className="space-y-4">
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
                className="bg-white dark:bg-[#1e2227] border border-gray-100 dark:border-white/8 rounded-2xl p-5 shadow-sm"
              >
                <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-4">Download Options</p>
                <div className="space-y-2.5">
                  <button onClick={() => window.print()}
                    className="w-full flex items-center gap-3 h-11 px-4 rounded-xl border border-gray-200 dark:border-white/10 text-sm font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors"
                  >
                    <Eye className="w-4 h-4 text-gray-400" /> Preview Resume
                  </button>
                  <button onClick={() => window.print()}
                    className="w-full flex items-center gap-3 h-11 px-4 rounded-xl bg-[#1a1d1f] dark:bg-[#F7A607] text-white text-sm font-semibold hover:bg-[#292e31] dark:hover:bg-[#e09500] transition-colors"
                  >
                    <Download className="w-4 h-4" /> Download PDF
                  </button>
                  <button onClick={() => window.print()}
                    className="w-full flex items-center gap-3 h-11 px-4 rounded-xl border border-gray-200 dark:border-white/10 text-sm font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors"
                  >
                    <Printer className="w-4 h-4 text-gray-400" /> Print
                  </button>
                </div>
                <p className="text-[10px] text-gray-400 mt-3 text-center">Use Print → Save as PDF to download</p>
              </motion.div>

              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
                className="bg-[#F7A607]/8 border border-[#F7A607]/20 rounded-2xl p-5"
              >
                <p className="text-xs font-bold text-gray-700 dark:text-gray-200 mb-3">Resume Tips</p>
                <ul className="space-y-2">
                  {[
                    'Keep it to 1 page for security roles',
                    'Highlight leadership experience prominently',
                    'Mention specific weapons/equipment training',
                    'Include any civilian certifications you have',
                  ].map(tip => (
                    <li key={tip} className="flex items-start gap-2">
                      <CheckCircle className="w-3.5 h-3.5 text-[#F7A607] mt-0.5 shrink-0" />
                      <span className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">{tip}</span>
                    </li>
                  ))}
                </ul>
              </motion.div>

              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
                className="bg-white dark:bg-[#1e2227] border border-gray-100 dark:border-white/8 rounded-2xl p-5 shadow-sm"
              >
                <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-3">Resume Stats</p>
                <div className="space-y-2.5">
                  {[
                    { label: 'Experience', value: `${yearsExp}+ years` },
                    { label: 'Force',      value: profile.force },
                    { label: 'Post',       value: profile.post },
                  ].map(({ label, value }) => (
                    <div key={label} className="flex justify-between items-center">
                      <span className="text-xs text-gray-500 dark:text-gray-400">{label}</span>
                      <span className="text-xs font-semibold text-gray-900 dark:text-[#F0EFEA]">{value}</span>
                    </div>
                  ))}
                </div>
              </motion.div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
