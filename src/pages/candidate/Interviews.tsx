import { motion } from 'framer-motion'
import { CalendarDays, Video, Phone, MapPin, Clock } from 'lucide-react'

export default function CandidateInterviews() {
  return (
    <div className="p-4 sm:p-6 max-w-2xl mx-auto">
      <div className="mb-5">
        <h1 className="text-xl font-extrabold text-gray-900 mb-0.5" style={{ fontFamily: 'Plus Jakarta Sans' }}>
          Interview Schedule
        </h1>
        <p className="text-sm text-gray-500">Upcoming and past interview appointments</p>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-6">
        {[
          { label: 'Scheduled', value: 0, color: 'bg-blue-50 text-blue-600' },
          { label: 'Completed', value: 0, color: 'bg-green-50 text-green-600' },
          { label: 'Cancelled', value: 0, color: 'bg-red-50 text-red-600' },
        ].map(({ label, value, color }) => (
          <div key={label} className={`rounded-2xl p-4 ${color}`}>
            <p className="text-2xl font-extrabold">{value}</p>
            <p className="text-xs font-medium opacity-80">{label}</p>
          </div>
        ))}
      </div>

      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
        className="bg-white border border-gray-100 rounded-2xl p-12 text-center shadow-sm"
      >
        <div className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-4">
          <CalendarDays className="w-7 h-7 text-gray-400" />
        </div>
        <p className="text-sm font-semibold text-gray-700 mb-1">No interviews scheduled</p>
        <p className="text-xs text-gray-400 max-w-xs mx-auto leading-relaxed mb-6">
          When an employer shortlists you, your interview details will appear here.
        </p>
        <div className="flex items-center justify-center gap-6">
          {[
            { icon: Video,  label: 'Video Call' },
            { icon: Phone,  label: 'Phone' },
            { icon: MapPin, label: 'In Person' },
          ].map(({ icon: Icon, label }) => (
            <div key={label} className="flex flex-col items-center gap-1.5">
              <div className="w-10 h-10 rounded-xl bg-gray-50 border border-gray-100 flex items-center justify-center">
                <Icon className="w-4 h-4 text-gray-400" />
              </div>
              <span className="text-[10px] text-gray-500">{label}</span>
            </div>
          ))}
        </div>
      </motion.div>

      <div className="mt-4 bg-[#F7A607]/5 border border-[#F7A607]/20 rounded-2xl p-4">
        <div className="flex items-start gap-3">
          <Clock className="w-4 h-4 text-[#F7A607] shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-bold text-gray-900 mb-0.5">Interview Tips</p>
            <ul className="text-xs text-gray-600 space-y-1">
              <li>• Carry all original documents and two sets of photocopies</li>
              <li>• Arrive 15 minutes before the scheduled time</li>
              <li>• Wear formal attire — preferred: service uniform (civilian formal is fine too)</li>
              <li>• Keep your service number and pension details ready</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}
