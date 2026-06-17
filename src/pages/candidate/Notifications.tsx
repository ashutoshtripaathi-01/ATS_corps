import { motion } from 'framer-motion'
import { Bell, CheckCircle, Briefcase, Shield, Info } from 'lucide-react'
import { useAppStore } from '@/store/useAppStore'

const ICON_MAP: Record<string, React.ElementType> = {
  application:  Briefcase,
  interview:    Briefcase,
  'job-alert':  Briefcase,
  message:      Bell,
  system:       Info,
}

export default function CandidateNotifications() {
  const { notifications, markAllRead, unreadCount } = useAppStore()

  return (
    <div className="p-4 sm:p-6 max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-extrabold text-gray-900 mb-0.5" style={{ fontFamily: 'Plus Jakarta Sans' }}>
            Notifications
          </h1>
          <p className="text-sm text-gray-500">{unreadCount > 0 ? `${unreadCount} unread` : 'All caught up'}</p>
        </div>
        {unreadCount > 0 && (
          <button
            onClick={markAllRead}
            className="flex items-center gap-1.5 text-xs font-semibold text-[#F7A607] hover:underline"
          >
            <CheckCircle className="w-3.5 h-3.5" />
            Mark all read
          </button>
        )}
      </div>

      {notifications.length === 0 ? (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
          className="bg-white border border-gray-100 rounded-2xl p-12 text-center shadow-sm"
        >
          <div className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-4">
            <Bell className="w-7 h-7 text-gray-400" />
          </div>
          <p className="text-sm font-semibold text-gray-700 mb-1">No notifications</p>
          <p className="text-xs text-gray-400 max-w-xs mx-auto leading-relaxed">
            Application updates, interview invites, and ATS Corps announcements will appear here.
          </p>
        </motion.div>
      ) : (
        <div className="space-y-2">
          {notifications.map((n, i) => {
            const Icon = ICON_MAP[n.type ?? 'system'] ?? Info
            return (
              <motion.div key={n.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.04 * i }}
                className={`flex items-start gap-3 p-4 rounded-2xl border transition-all ${
                  n.read ? 'bg-white border-gray-100' : 'bg-[#F7A607]/5 border-[#F7A607]/20'
                }`}
              >
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                  n.read ? 'bg-gray-100' : 'bg-[#F7A607]/15'
                }`}>
                  <Icon className={`w-4 h-4 ${n.read ? 'text-gray-400' : 'text-[#F7A607]'}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900">{n.title}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{n.body}</p>
                </div>
                {!n.read && (
                  <span className="w-2 h-2 rounded-full bg-[#F7A607] shrink-0 mt-1.5" />
                )}
              </motion.div>
            )
          })}
        </div>
      )}
    </div>
  )
}
