import { useState } from 'react';
import { motion } from 'framer-motion';
import { Settings, Bell, Shield, LogOut, ChevronRight, User, Moon, Sun, HelpCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '@/store/useAppStore';
import { toast } from '@/hooks/useToast';

const Toggle = ({ on, onToggle }: { on: boolean; onToggle: () => void }) => (
  <button onClick={onToggle}
    className={`w-11 h-6 rounded-full relative transition-colors shrink-0 ${on ? 'bg-[#F7A607]' : 'bg-gray-200 dark:bg-white/15'}`}
  >
    <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${on ? 'left-[22px]' : 'left-0.5'}`} />
  </button>
);

const SettingRow = ({ label, sub, action }: { label: string; sub?: string; action: React.ReactNode }) => (
  <div className="flex items-center justify-between px-5 py-4 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors gap-4">
    <div className="flex-1 min-w-0">
      <p className="text-sm font-medium text-gray-900 dark:text-[#F0EFEA]">{label}</p>
      {sub && <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{sub}</p>}
    </div>
    {action}
  </div>
);

const SectionCard = ({ title, icon: Icon, children }: { title: string; icon: React.ElementType; children: React.ReactNode }) => (
  <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
    className="bg-white dark:bg-[#1e2227] border border-gray-100 dark:border-white/8 rounded-2xl shadow-sm overflow-hidden"
  >
    <div className="flex items-center gap-2.5 px-5 py-4 border-b border-gray-50 dark:border-white/8">
      <div className="w-7 h-7 rounded-lg bg-[#F7A607]/10 flex items-center justify-center">
        <Icon className="w-3.5 h-3.5 text-[#F7A607]" />
      </div>
      <p className="text-sm font-bold text-gray-900 dark:text-[#F0EFEA]">{title}</p>
    </div>
    <div className="divide-y divide-gray-50 dark:divide-white/6">{children}</div>
  </motion.div>
);

export default function CandidateSettings() {
  const navigate = useNavigate();
  const { user, logout, theme, toggleTheme } = useAppStore();
  const [notifications, setNotifications] = useState({ jobAlerts: true, appUpdates: true, messages: true });

  const handleLogout = () => {
    logout();
    toast({ title: 'Logged out', description: 'You have been signed out.', variant: 'success' });
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#13161a]">
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-10 py-6 lg:py-8">

        <div className="mb-6">
          <h1 className="text-2xl font-extrabold text-gray-900 dark:text-[#F0EFEA]" style={{ fontFamily: 'Plus Jakarta Sans' }}>
            Settings
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Manage your account and preferences</p>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">

          {/* Left nav — desktop quick links */}
          <div className="hidden lg:block">
            <div className="bg-white dark:bg-[#1e2227] border border-gray-100 dark:border-white/8 rounded-2xl shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-50 dark:border-white/8">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[#F7A607] flex items-center justify-center font-extrabold text-white text-sm">
                    {user?.name?.split(' ').map(n => n[0]).join('').slice(0,2) ?? 'C'}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-gray-900 dark:text-[#F0EFEA] truncate">{user?.name}</p>
                    <p className="text-xs text-gray-400 mt-0.5">Registered Candidate</p>
                  </div>
                </div>
              </div>
              <div className="p-3">
                {[
                  { label: 'Account',          icon: Settings, href: '#account'  },
                  { label: 'Notifications',    icon: Bell,     href: '#notif'    },
                  { label: 'Privacy & Security', icon: Shield, href: '#privacy'  },
                  { label: 'My Profile',       icon: User,     path: '/candidate/profile' },
                  { label: 'Career Guide',     icon: HelpCircle, path: '/candidate/career-guide' },
                ].map(({ label, icon: Icon, path }) => (
                  <button key={label} onClick={() => path && navigate(path)}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-gray-50 dark:hover:bg-white/5 transition-colors text-left"
                  >
                    <Icon className="w-4 h-4 text-gray-400" />
                    <span className="text-sm text-gray-700 dark:text-gray-300">{label}</span>
                    <ChevronRight className="w-3.5 h-3.5 text-gray-300 ml-auto" />
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Settings content */}
          <div className="lg:col-span-2 space-y-4">

            {/* Account */}
            <SectionCard title="Account" icon={Settings}>
              <SettingRow
                label={user?.name ?? 'Candidate'}
                sub="Registered candidate"
                action={
                  <button onClick={() => navigate('/candidate/profile')}
                    className="text-xs font-semibold text-[#F7A607] hover:underline flex items-center gap-0.5"
                  >
                    View profile <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                }
              />
              <SettingRow
                label="Appearance"
                sub={theme === 'dark' ? 'Dark mode is on' : 'Light mode is on'}
                action={
                  <div className="flex items-center gap-2">
                    <Sun className="w-3.5 h-3.5 text-gray-400" />
                    <Toggle on={theme === 'dark'} onToggle={toggleTheme} />
                    <Moon className="w-3.5 h-3.5 text-gray-400" />
                  </div>
                }
              />
            </SectionCard>

            {/* Notifications */}
            <SectionCard title="Notifications" icon={Bell}>
              {[
                { key: 'jobAlerts',  label: 'New Job Alerts',       desc: 'When new jobs match your preference' },
                { key: 'appUpdates', label: 'Application Updates',  desc: 'Status changes on your applications' },
                { key: 'messages',   label: 'Messages',             desc: 'New messages from employers or coordinators' },
              ].map(({ key, label, desc }) => (
                <SettingRow key={key} label={label} sub={desc}
                  action={
                    <Toggle
                      on={notifications[key as keyof typeof notifications]}
                      onToggle={() => setNotifications(p => ({ ...p, [key]: !p[key as keyof typeof p] }))}
                    />
                  }
                />
              ))}
            </SectionCard>

            {/* Privacy */}
            <SectionCard title="Privacy & Security" icon={Shield}>
              <SettingRow label="Privacy Policy"   action={<ChevronRight className="w-4 h-4 text-gray-400" />} />
              <SettingRow label="Terms of Service" action={<ChevronRight className="w-4 h-4 text-gray-400" />} />
            </SectionCard>

            {/* Sign out */}
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
              <button onClick={handleLogout}
                className="w-full flex items-center justify-center gap-2 h-12 rounded-2xl border border-red-200 dark:border-red-900/40 bg-red-50 dark:bg-red-900/15 text-red-600 dark:text-red-400 text-sm font-semibold hover:bg-red-100 dark:hover:bg-red-900/25 transition-colors"
              >
                <LogOut className="w-4 h-4" /> Sign Out
              </button>
              <p className="text-center text-xs text-gray-400 dark:text-gray-600 mt-3">
                Ex-Serviceman Jobs v1.0 · Candidate Portal
              </p>
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
}
