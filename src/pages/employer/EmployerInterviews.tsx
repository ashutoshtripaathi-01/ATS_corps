import { motion } from 'framer-motion'
import { CalendarDays, Video, Phone, MapPin } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

export default function EmployerInterviews() {
  const navigate = useNavigate()
  return (
    <div className="p-4 sm:p-6 max-w-2xl mx-auto">
      <div className="mb-5">
        <h1 className="text-xl font-extrabold text-gray-900 mb-0.5" style={{ fontFamily: 'Plus Jakarta Sans' }}>
          Interview Management
        </h1>
        <p className="text-sm text-gray-500">Schedule and track interviews with shortlisted candidates</p>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-6">
        {[
          { label: 'Scheduled', value: 0, color: 'bg-blue-50 text-blue-600' },
          { label: 'Completed', value: 0, color: 'bg-green-50 text-green-600' },
          { label: 'Cancelled', value: 0, color: 'bg-red-50 text-red-600' },
        ].map(({ label, value, color }) => (
          <div key={label} className={`rounded-2xl p-4 text-center ${color}`}>
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
        <p className="text-xs text-gray-400 max-w-xs mx-auto leading-relaxed mb-5">
          Shortlist candidates from your applications to schedule interviews. You can conduct them via video call, phone, or in person.
        </p>
        <button onClick={() => navigate('/employer/applications')}
          className="text-sm font-bold text-[#F7A607] hover:underline">
          View Applications →
        </button>
      </motion.div>

      <div className="mt-4 grid grid-cols-3 gap-3">
        {[{ icon: Video, label: 'Video Call' }, { icon: Phone, label: 'Phone Interview' }, { icon: MapPin, label: 'Walk-in' }].map(({ icon: Icon, label }) => (
          <div key={label} className="bg-white border border-gray-100 rounded-2xl p-3 text-center shadow-sm">
            <div className="w-10 h-10 rounded-xl bg-gray-50 flex items-center justify-center mx-auto mb-2">
              <Icon className="w-4 h-4 text-gray-400" />
            </div>
            <p className="text-xs font-semibold text-gray-700">{label}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
