import { useState } from 'react'
import { motion } from 'framer-motion'
import { Settings, Bell, Shield, LogOut, ChevronRight } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAppStore } from '@/store/useAppStore'
import { toast } from '@/hooks/useToast'

const card = 'bg-white dark:bg-[#1e2227] border border-gray-100 dark:border-white/8 rounded-2xl shadow-sm overflow-hidden'
const cardHeader = 'flex items-center gap-2 px-4 py-3 border-b border-gray-50 dark:border-white/8'
const cardTitle = 'text-sm font-bold text-gray-900 dark:text-[#F0EFEA]'
const rowText = 'text-sm text-gray-700 dark:text-gray-200'
const rowSub = 'text-xs text-gray-400 dark:text-gray-500 mt-0.5'
const divider = 'divide-y divide-gray-50 dark:divide-white/6'
const rowHover = 'hover:bg-gray-50 dark:hover:bg-white/5 transition-colors'

export default function CandidateSettings() {
  const navigate = useNavigate()
  const { user, logout, theme, toggleTheme } = useAppStore()
  const [notifications, setNotifications] = useState({
    jobAlerts:  true,
    appUpdates: true,
    messages:   true,
  })

  const handleLogout = () => {
    logout()
    toast({ title: 'Logged out', description: 'You have been signed out.', variant: 'success' })
    navigate('/')
  }

  return (
    <div className="p-4 sm:p-6 max-w-lg mx-auto">
      <div className="mb-5">
        <h1 className="text-xl font-extrabold text-gray-900 dark:text-[#F0EFEA] mb-0.5" style={{ fontFamily: 'Plus Jakarta Sans' }}>
          Settings
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">Manage your account and preferences</p>
      </div>

      {/* Account */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
        className={`${card} mb-4`}
      >
        <div className={cardHeader}>
          <Settings className="w-4 h-4 text-[#F7A607]" />
          <p className={cardTitle}>Account</p>
        </div>
        <div className={divider}>
          <div className={`flex items-center justify-between px-4 py-3.5 ${rowHover}`}>
            <div>
              <p className={`text-sm font-semibold text-gray-900 dark:text-[#F0EFEA]`}>{user?.name}</p>
              <p className={rowSub}>Registered candidate</p>
            </div>
            <button onClick={() => navigate('/candidate/profile')}
              className="text-xs font-semibold text-[#F7A607] hover:underline flex items-center gap-0.5">
              View profile <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className={`flex items-center justify-between px-4 py-3.5 ${rowHover}`}>
            <div>
              <p className={rowText}>Appearance</p>
              <p className={rowSub}>{theme === 'dark' ? 'Dark mode is on' : 'Light mode is on'}</p>
            </div>
            <button onClick={toggleTheme}
              className={`w-11 h-6 rounded-full relative transition-colors ${theme === 'dark' ? 'bg-[#F7A607]' : 'bg-gray-200 dark:bg-white/20'}`}
            >
              <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${theme === 'dark' ? 'left-[22px]' : 'left-0.5'}`} />
            </button>
          </div>
        </div>
      </motion.div>

      {/* Notifications */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
        className={`${card} mb-4`}
      >
        <div className={cardHeader}>
          <Bell className="w-4 h-4 text-[#F7A607]" />
          <p className={cardTitle}>Notifications</p>
        </div>
        <div className={divider}>
          {[
            { key: 'jobAlerts',  label: 'New Job Alerts',        desc: 'Get notified when new jobs match your preference' },
            { key: 'appUpdates', label: 'Application Updates',   desc: 'Status changes on your applications' },
            { key: 'messages',   label: 'Messages',              desc: 'New messages from employers or ATS Corps' },
          ].map(({ key, label, desc }) => (
            <div key={key} className={`flex items-center justify-between px-4 py-3.5 gap-3 ${rowHover}`}>
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-medium text-gray-900 dark:text-[#F0EFEA]`}>{label}</p>
                <p className={rowSub}>{desc}</p>
              </div>
              <button
                onClick={() => setNotifications(p => ({ ...p, [key]: !p[key as keyof typeof p] }))}
                className={`w-11 h-6 rounded-full relative transition-colors shrink-0 ${notifications[key as keyof typeof notifications] ? 'bg-[#F7A607]' : 'bg-gray-200 dark:bg-white/15'}`}
              >
                <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${notifications[key as keyof typeof notifications] ? 'left-[22px]' : 'left-0.5'}`} />
              </button>
            </div>
          ))}
        </div>
      </motion.div>

      {/* Privacy */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
        className={`${card} mb-4`}
      >
        <div className={cardHeader}>
          <Shield className="w-4 h-4 text-[#F7A607]" />
          <p className={cardTitle}>Privacy &amp; Security</p>
        </div>
        <div className={divider}>
          <button className={`w-full flex items-center justify-between px-4 py-3.5 ${rowHover} text-left`}>
            <p className={rowText}>Privacy Policy</p>
            <ChevronRight className="w-4 h-4 text-gray-400 dark:text-gray-500" />
          </button>
          <button className={`w-full flex items-center justify-between px-4 py-3.5 ${rowHover} text-left`}>
            <p className={rowText}>Terms of Service</p>
            <ChevronRight className="w-4 h-4 text-gray-400 dark:text-gray-500" />
          </button>
        </div>
      </motion.div>

      {/* Logout */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
        <button
          onClick={handleLogout}
          className="w-full flex items-center justify-center gap-2 h-12 rounded-2xl border border-red-200 dark:border-red-900/40 bg-red-50 dark:bg-red-900/15 text-red-600 dark:text-red-400 text-sm font-semibold hover:bg-red-100 dark:hover:bg-red-900/25 transition-colors"
        >
          <LogOut className="w-4 h-4" />
          Sign Out
        </button>
      </motion.div>

      <p className="text-center text-xs text-gray-400 dark:text-gray-600 mt-4">ATS Corps v1.0 · Candidate Portal</p>
    </div>
  )
}
