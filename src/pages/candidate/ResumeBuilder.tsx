import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { FileText, Download, Eye, User, Shield, Briefcase, MapPin, Phone } from 'lucide-react'
import { useAppStore } from '@/store/useAppStore'
import { getCandidateProfile } from '@/lib/api'

interface Candidate {
  full_name: string
  mobile: string
  force: string
  rank: string
  unit: string
  retirement_date: string
  post: string
  loc1: string
  loc2: string | null
  loc3: string | null
  gun_license: string | null
}

export default function ResumeBuilder() {
  const { user } = useAppStore()
  const [profile, setProfile] = useState<Candidate | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user?.id || user.id === 'skip-test') { setLoading(false); return }
    getCandidateProfile(user.id)
      .then(setProfile)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [user?.id])

  const locations = profile
    ? [profile.loc1, profile.loc2, profile.loc3].filter(Boolean).join(' / ')
    : ''

  return (
    <div className="p-4 sm:p-6 max-w-2xl mx-auto">
      <div className="mb-5">
        <h1 className="text-xl font-extrabold text-gray-900 mb-0.5" style={{ fontFamily: 'Plus Jakarta Sans' }}>
          Resume Builder
        </h1>
        <p className="text-sm text-gray-500">Generate a professional resume from your registration details</p>
      </div>

      {loading && (
        <div className="h-64 bg-white border border-gray-100 rounded-2xl animate-pulse" />
      )}

      {!loading && !profile && (
        <div className="bg-white border border-gray-100 rounded-2xl p-10 text-center shadow-sm">
          <FileText className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-sm font-semibold text-gray-700 mb-1">Complete your registration first</p>
          <p className="text-xs text-gray-400">Your resume will be auto-generated from your profile details.</p>
        </div>
      )}

      {!loading && profile && (
        <>
          {/* Resume Preview */}
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            className="bg-white border-2 border-gray-200 rounded-2xl overflow-hidden shadow-sm mb-4"
          >
            {/* Resume Header */}
            <div className="bg-[#292e31] p-6 text-white">
              <div className="flex items-start gap-4">
                <div className="w-16 h-16 rounded-xl bg-[#F7A607] flex items-center justify-center text-xl font-extrabold shrink-0">
                  {profile.full_name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                </div>
                <div>
                  <h2 className="text-xl font-extrabold" style={{ fontFamily: 'Plus Jakarta Sans' }}>
                    {profile.full_name}
                  </h2>
                  <p className="text-[#F7A607] font-semibold text-sm mt-0.5">
                    Ex-{profile.rank} · {profile.force}
                  </p>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2">
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

            <div className="p-5 space-y-5">
              {/* Service Summary */}
              <div>
                <h3 className="text-xs font-extrabold text-gray-400 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                  <Shield className="w-3.5 h-3.5 text-[#F7A607]" />Military Service
                </h3>
                <div className="grid grid-cols-2 gap-2">
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
                  ].map((skill) => (
                    <span key={skill} className="text-xs font-medium bg-[#F7A607]/10 text-[#F7A607] px-2.5 py-1 rounded-full">
                      {skill}
                    </span>
                  ))}
                </div>
              </div>

              {/* Objective */}
              <div>
                <h3 className="text-xs font-extrabold text-gray-400 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                  <Briefcase className="w-3.5 h-3.5 text-[#F7A607]" />Career Objective
                </h3>
                <p className="text-sm text-gray-700 leading-relaxed">
                  Seeking a position as <strong>{profile.post}</strong> where I can apply {Math.floor((Date.now() - new Date(profile.retirement_date).getTime()) / (365.25 * 24 * 3600 * 1000)) + 15}+ years of military discipline, security expertise, and leadership skills to contribute effectively to the organization.
                </p>
              </div>

              {/* Preferred Locations */}
              <div>
                <h3 className="text-xs font-extrabold text-gray-400 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-[#F7A607]" />Preferred Work Locations
                </h3>
                <p className="text-sm text-gray-700">{locations}</p>
              </div>
            </div>
          </motion.div>

          <div className="flex gap-3">
            <button
              className="flex-1 flex items-center justify-center gap-2 h-11 rounded-xl border border-gray-200 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
              onClick={() => window.print()}
            >
              <Eye className="w-4 h-4" /> Preview
            </button>
            <button
              className="flex-1 flex items-center justify-center gap-2 h-11 rounded-xl bg-[#292e31] text-white text-sm font-semibold hover:bg-[#1a1d1f] transition-colors"
              onClick={() => window.print()}
            >
              <Download className="w-4 h-4" /> Download PDF
            </button>
          </div>

          <p className="text-center text-xs text-gray-400 mt-3">
            Use your browser's Print → Save as PDF to download.
          </p>
        </>
      )}
    </div>
  )
}
