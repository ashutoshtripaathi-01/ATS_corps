import { motion } from 'framer-motion';
import { Bell, CheckCircle, Briefcase, Shield, Info, Clock } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';

const ICON_MAP: Record<string, React.ElementType> = {
  application: Briefcase, interview: Briefcase, 'job-alert': Briefcase,
  message: Bell, system: Info,
};

export default function CandidateNotifications() {
  const { notifications, markAllRead, unreadCount } = useAppStore();

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#13161a]">
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-10 py-6 lg:py-8">

        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-extrabold text-gray-900 dark:text-[#F0EFEA]" style={{ fontFamily: 'Plus Jakarta Sans' }}>
              Notifications
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
              {unreadCount > 0 ? `${unreadCount} unread notification${unreadCount > 1 ? 's' : ''}` : 'All caught up'}
            </p>
          </div>
          {unreadCount > 0 && (
            <button onClick={markAllRead}
              className="flex items-center gap-1.5 text-sm font-semibold text-[#F7A607] hover:underline"
            >
              <CheckCircle className="w-4 h-4" /> Mark all read
            </button>
          )}
        </div>

        <div className="grid lg:grid-cols-3 gap-6">

          {/* Notification list */}
          <div className="lg:col-span-2">
            {notifications.length === 0 ? (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                className="bg-white dark:bg-[#1e2227] border border-gray-100 dark:border-white/8 rounded-2xl p-16 text-center shadow-sm"
              >
                <div className="w-14 h-14 rounded-2xl bg-gray-100 dark:bg-white/10 flex items-center justify-center mx-auto mb-4">
                  <Bell className="w-7 h-7 text-gray-400" />
                </div>
                <p className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-1">No notifications</p>
                <p className="text-xs text-gray-400 dark:text-gray-500 max-w-xs mx-auto leading-relaxed">
                  Application updates, interview invites, and announcements will appear here.
                </p>
              </motion.div>
            ) : (
              <div className="space-y-2">
                {notifications.map((n, i) => {
                  const Icon = ICON_MAP[n.type ?? 'system'] ?? Info;
                  return (
                    <motion.div key={n.id}
                      initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.04 * i }}
                      className={`flex items-start gap-3 p-4 rounded-2xl border transition-all ${
                        n.read
                          ? 'bg-white dark:bg-[#1e2227] border-gray-100 dark:border-white/8'
                          : 'bg-[#F7A607]/5 border-[#F7A607]/20'
                      }`}
                    >
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${n.read ? 'bg-gray-100 dark:bg-white/10' : 'bg-[#F7A607]/15'}`}>
                        <Icon className={`w-4 h-4 ${n.read ? 'text-gray-400' : 'text-[#F7A607]'}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-900 dark:text-[#F0EFEA]">{n.title}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{n.body}</p>
                      </div>
                      {!n.read && <span className="w-2 h-2 rounded-full bg-[#F7A607] shrink-0 mt-1.5" />}
                    </motion.div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Right sidebar */}
          <div className="space-y-4">
            {/* Stats */}
            <div className="bg-white dark:bg-[#1e2227] border border-gray-100 dark:border-white/8 rounded-2xl p-5 shadow-sm">
              <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-4">Summary</p>
              <div className="space-y-3">
                {[
                  { label: 'Total',   value: notifications.length, color: 'bg-gray-100 dark:bg-white/10 text-gray-600 dark:text-gray-300' },
                  { label: 'Unread',  value: unreadCount,          color: 'bg-[#F7A607]/10 text-[#F7A607]' },
                  { label: 'Read',    value: notifications.length - unreadCount, color: 'bg-green-50 dark:bg-green-900/20 text-green-600' },
                ].map(({ label, value, color }) => (
                  <div key={label} className="flex items-center justify-between">
                    <span className="text-sm text-gray-600 dark:text-gray-300">{label}</span>
                    <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${color}`}>{value}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Info */}
            <div className="bg-white dark:bg-[#1e2227] border border-gray-100 dark:border-white/8 rounded-2xl p-5 shadow-sm">
              <div className="flex items-center gap-2 mb-3">
                <Clock className="w-4 h-4 text-[#F7A607]" />
                <p className="text-sm font-bold text-gray-900 dark:text-[#F0EFEA]">You'll be notified for</p>
              </div>
              <ul className="space-y-2 text-xs text-gray-500 dark:text-gray-400">
                <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-[#F7A607] shrink-0" />Application status updates</li>
                <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-[#F7A607] shrink-0" />Interview invitations</li>
                <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-[#F7A607] shrink-0" />Employer messages</li>
                <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-[#F7A607] shrink-0" />Job fair announcements</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
