import { useState } from 'react';
import { motion } from 'framer-motion';
import { Settings, Bell, Shield, LogOut, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '@/store/useAppStore';
import { toast } from '@/hooks/useToast';

export default function EmployerSettings() {
  const navigate = useNavigate();
  const { user, logout, theme, toggleTheme } = useAppStore();
  const [notifications, setNotifications] = useState({
    newApplications: true,
    candidateMessages: true,
    systemAlerts: true,
  });

  const handleLogout = () => {
    logout();
    toast({ title: 'Logged out', variant: 'success' });
    navigate('/');
  };

  return (
    <div className='p-4 sm:p-6 max-w-lg mx-auto'>
      <div className='mb-5'>
        <h1
          className='text-xl font-extrabold text-gray-900 mb-0.5'
          style={{ fontFamily: 'Plus Jakarta Sans' }}
        >
          Settings
        </h1>
        <p className='text-sm text-gray-500'>
          Manage your account and preferences
        </p>
      </div>

      {/* Account */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className='bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden mb-4'
      >
        <div className='flex items-center gap-2 px-4 py-3 border-b border-gray-50'>
          <Settings className='w-4 h-4 text-[#F7A607]' />
          <p className='text-sm font-bold text-gray-900'>Account</p>
        </div>
        <div className='divide-y divide-gray-50'>
          <div className='flex items-center justify-between px-4 py-3.5'>
            <div>
              <p className='text-sm font-semibold text-gray-900'>
                {user?.name}
              </p>
              <p className='text-xs text-gray-400 mt-0.5'>{user?.email}</p>
            </div>
            <button
              onClick={() => navigate('/employer/company')}
              className='text-xs font-semibold text-[#F7A607] hover:underline flex items-center gap-0.5'
            >
              Company Profile <ChevronRight className='w-3.5 h-3.5' />
            </button>
          </div>
          <div className='flex items-center justify-between px-4 py-3.5'>
            <p className='text-sm text-gray-700'>Dark Mode</p>
            <button
              onClick={toggleTheme}
              className={`w-11 h-6 rounded-full relative transition-colors ${theme === 'dark' ? 'bg-[#F7A607]' : 'bg-gray-200'}`}
            >
              <span
                className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${theme === 'dark' ? 'left-5' : 'left-0.5'}`}
              />
            </button>
          </div>
        </div>
      </motion.div>

      {/* Notifications */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className='bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden mb-4'
      >
        <div className='flex items-center gap-2 px-4 py-3 border-b border-gray-50'>
          <Bell className='w-4 h-4 text-[#F7A607]' />
          <p className='text-sm font-bold text-gray-900'>Notifications</p>
        </div>
        <div className='divide-y divide-gray-50'>
          {[
            {
              key: 'newApplications',
              label: 'New Applications',
              desc: 'Alert when a candidate applies',
            },
            {
              key: 'candidateMessages',
              label: 'Candidate Messages',
              desc: 'New messages from candidates',
            },
            {
              key: 'systemAlerts',
              label: 'System Alerts',
              desc: 'Platform updates and announcements',
            },
          ].map(({ key, label, desc }) => (
            <div
              key={key}
              className='flex items-center justify-between px-4 py-3.5 gap-3'
            >
              <div className='flex-1 min-w-0'>
                <p className='text-sm font-medium text-gray-900'>{label}</p>
                <p className='text-xs text-gray-400 mt-0.5'>{desc}</p>
              </div>
              <button
                onClick={() =>
                  setNotifications((p) => ({
                    ...p,
                    [key]: !p[key as keyof typeof p],
                  }))
                }
                className={`w-11 h-6 rounded-full relative transition-colors shrink-0 ${notifications[key as keyof typeof notifications] ? 'bg-[#F7A607]' : 'bg-gray-200'}`}
              >
                <span
                  className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${notifications[key as keyof typeof notifications] ? 'left-5' : 'left-0.5'}`}
                />
              </button>
            </div>
          ))}
        </div>
      </motion.div>

      {/* Privacy */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className='bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden mb-4'
      >
        <div className='flex items-center gap-2 px-4 py-3 border-b border-gray-50'>
          <Shield className='w-4 h-4 text-[#F7A607]' />
          <p className='text-sm font-bold text-gray-900'>Privacy & Legal</p>
        </div>
        <div className='divide-y divide-gray-50'>
          {['Privacy Policy', 'Terms of Service', 'Refund Policy'].map(
            (label) => (
              <button
                key={label}
                className='w-full flex items-center justify-between px-4 py-3.5 hover:bg-gray-50 transition-colors text-left'
              >
                <p className='text-sm text-gray-700'>{label}</p>
                <ChevronRight className='w-4 h-4 text-gray-400' />
              </button>
            ),
          )}
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
      >
        <button
          onClick={handleLogout}
          className='w-full flex items-center justify-center gap-2 h-12 rounded-2xl border border-red-200 bg-red-50 text-red-600 text-sm font-semibold hover:bg-red-100 transition-colors'
        >
          <LogOut className='w-4 h-4' /> Sign Out
        </button>
      </motion.div>
      <p className='text-center text-xs text-gray-400 mt-4'>
        Ex-Serviceman Jobs v1.0 · Recruiter Portal
      </p>
    </div>
  );
}
