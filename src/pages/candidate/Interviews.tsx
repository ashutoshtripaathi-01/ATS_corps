import { motion } from 'framer-motion'
import { CalendarDays, Video, Phone, MapPin, Clock, CheckCircle, X } from 'lucide-react'

export default function CandidateInterviews() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#13161a]">
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-10 py-6 lg:py-8">

        <div className="mb-6">
          <h1 className="text-2xl font-extrabold text-gray-900 dark:text-[#F0EFEA]" style={{ fontFamily: 'Plus Jakarta Sans' }}>
            Interview Schedule
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Upcoming and past interview appointments</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          {[
            { label: 'Scheduled', value: 0, light: 'bg-blue-50 text-blue-700',  dark: 'dark:bg-blue-900/25 dark:text-blue-300' },
            { label: 'Completed', value: 0, light: 'bg-green-50 text-green-700',dark: 'dark:bg-green-900/25 dark:text-green-300' },
            { label: 'Cancelled', value: 0, light: 'bg-red-50 text-red-600',    dark: 'dark:bg-red-900/25 dark:text-red-400' },
          ].map(({ label, value, light, dark }) => (
            <div key={label} className={`rounded-2xl p-5 ${light} ${dark}`}>
              <p className="text-3xl font-extrabold">{value}</p>
              <p className="text-xs font-medium opacity-80 mt-0.5">{label}</p>
            </div>
          ))}
        </div>

        <div className="grid lg:grid-cols-3 gap-6">

          {/* Empty state */}
          <div className="lg:col-span-2">
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              className="bg-white dark:bg-[#1e2227] border border-gray-100 dark:border-white/8 rounded-2xl p-16 text-center shadow-sm"
            >
              <div className="w-16 h-16 rounded-2xl bg-gray-100 dark:bg-white/10 flex items-center justify-center mx-auto mb-4">
                <CalendarDays className="w-8 h-8 text-gray-400" />
              </div>
              <p className="text-base font-semibold text-gray-700 dark:text-gray-200 mb-2">No interviews scheduled</p>
              <p className="text-xs text-gray-400 dark:text-gray-500 max-w-xs mx-auto leading-relaxed mb-8">
                When an employer shortlists you, your interview details will appear here.
              </p>
              <div className="flex items-center justify-center gap-8">
                {[
                  { icon: Video,  label: 'Video Call' },
                  { icon: Phone,  label: 'Phone' },
                  { icon: MapPin, label: 'In Person' },
                ].map(({ icon: Icon, label }) => (
                  <div key={label} className="flex flex-col items-center gap-2">
                    <div className="w-12 h-12 rounded-xl bg-gray-50 dark:bg-white/5 border border-gray-100 dark:border-white/8 flex items-center justify-center">
                      <Icon className="w-5 h-5 text-gray-400" />
                    </div>
                    <span className="text-[11px] text-gray-500">{label}</span>
                  </div>
                ))}
              </div>
            </motion.div>
          </div>

          {/* Sidebar: Interview Tips */}
          <div className="space-y-4">
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
              className="bg-[#F7A607]/5 border border-[#F7A607]/20 rounded-2xl p-5"
            >
              <div className="flex items-center gap-2 mb-4">
                <Clock className="w-4 h-4 text-[#F7A607]" />
                <p className="text-sm font-bold text-gray-900 dark:text-[#F0EFEA]">Interview Tips</p>
              </div>
              <ul className="space-y-2.5">
                {[
                  'Carry all original documents and 2 sets of photocopies',
                  'Arrive 15 minutes before scheduled time',
                  'Wear formal attire — service uniform creates a strong impression',
                  'Keep your service number and pension details ready',
                  'Bring a pen and notebook — shows professionalism',
                ].map((tip) => (
                  <li key={tip} className="flex items-start gap-2">
                    <CheckCircle className="w-3.5 h-3.5 text-[#F7A607] mt-0.5 shrink-0" />
                    <span className="text-xs text-gray-700 dark:text-gray-300 leading-relaxed">{tip}</span>
                  </li>
                ))}
              </ul>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
              className="bg-white dark:bg-[#1e2227] border border-gray-100 dark:border-white/8 rounded-2xl p-5 shadow-sm"
            >
              <div className="flex items-center gap-2 mb-3">
                <X className="w-4 h-4 text-red-500" />
                <p className="text-sm font-bold text-gray-900 dark:text-[#F0EFEA]">What to Avoid</p>
              </div>
              <ul className="space-y-2">
                {[
                  'Being late or rushing in at the last moment',
                  'Leaving documents at home',
                  'Using casual language with the interviewer',
                ].map(tip => (
                  <li key={tip} className="flex items-start gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-400 mt-1.5 shrink-0" />
                    <span className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">{tip}</span>
                  </li>
                ))}
              </ul>
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  )
}
