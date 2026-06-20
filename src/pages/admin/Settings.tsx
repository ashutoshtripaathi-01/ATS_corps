import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Settings,
  Shield,
  Bell,
  LogOut,
  ChevronRight,
  Key,
  Database,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '@/store/useAppStore';
import { toast } from '@/hooks/useToast';
import { API_BASE } from '@/lib/api';

export default function AdminSettings() {
  const navigate = useNavigate();
  const { user, logout, theme, toggleTheme } = useAppStore();
  const [checking, setChecking] = useState(false);
  const [dbStatus, setDbStatus] = useState<'ok' | 'error' | null>(null);

  const handleLogout = () => {
    logout();
    toast({ title: 'Logged out', variant: 'success' });
    navigate('/admin/login');
  };

  const checkHealth = async () => {
    setChecking(true);
    try {
      const res = await fetch(`${API_BASE.replace('/api', '')}/api/health`);
      const data = await res.json();
      setDbStatus(data.status === 'ok' ? 'ok' : 'error');
      toast({
        title: data.status === 'ok' ? 'API is healthy' : 'API issue detected',
        variant: data.status === 'ok' ? 'success' : 'error',
      });
    } catch {
      setDbStatus('error');
      toast({
        title: 'Cannot reach API server',
        description: 'Make sure the backend is running on port 4000.',
        variant: 'error',
      });
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className='p-4 sm:p-6 max-w-lg mx-auto'>
      <div className='mb-5'>
        <h1
          className='text-xl font-extrabold text-gray-900 mb-0.5'
          style={{ fontFamily: 'Plus Jakarta Sans' }}
        >
          Admin Settings
        </h1>
        <p className='text-sm text-gray-500'>
          System configuration and account management
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
          <p className='text-sm font-bold text-gray-900'>Admin Account</p>
        </div>
        <div className='divide-y divide-gray-50'>
          <div className='flex items-center justify-between px-4 py-3.5'>
            <div>
              <p className='text-sm font-semibold text-gray-900'>
                {user?.name ?? 'Ex-Serviceman Jobs Admin'}
              </p>
              <p className='text-xs text-gray-400 mt-0.5'>
                {user?.email ?? 'admin@atscorps.in'}
              </p>
            </div>
            <span className='text-[10px] font-bold bg-[#F7A607]/10 text-[#F7A607] px-2.5 py-1 rounded-full'>
              Super Admin
            </span>
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

      {/* System */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className='bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden mb-4'
      >
        <div className='flex items-center gap-2 px-4 py-3 border-b border-gray-50'>
          <Database className='w-4 h-4 text-[#F7A607]' />
          <p className='text-sm font-bold text-gray-900'>System</p>
        </div>
        <div className='divide-y divide-gray-50'>
          <div className='flex items-center justify-between px-4 py-3.5'>
            <div>
              <p className='text-sm font-medium text-gray-900'>
                API Health Check
              </p>
              <p className='text-xs text-gray-400 mt-0.5'>
                {dbStatus === 'ok'
                  ? '✅ API is running normally'
                  : dbStatus === 'error'
                    ? '❌ API unreachable'
                    : 'Check if backend API is online'}
              </p>
            </div>
            <button
              onClick={checkHealth}
              disabled={checking}
              className='text-xs font-semibold text-[#F7A607] hover:underline disabled:opacity-50 flex items-center gap-1'
            >
              {checking ? 'Checking…' : 'Check'}
            </button>
          </div>
          <div className='flex items-center justify-between px-4 py-3.5'>
            <p className='text-sm font-medium text-gray-900'>API Base URL</p>
            <p className='text-xs font-mono text-gray-500'>{API_BASE}</p>
          </div>
          <div className='flex items-center justify-between px-4 py-3.5'>
            <p className='text-sm font-medium text-gray-900'>
              Platform Version
            </p>
            <p className='text-xs text-gray-500'>v1.0.0</p>
          </div>
        </div>
      </motion.div>

      {/* Security */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className='bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden mb-4'
      >
        <div className='flex items-center gap-2 px-4 py-3 border-b border-gray-50'>
          <Shield className='w-4 h-4 text-[#F7A607]' />
          <p className='text-sm font-bold text-gray-900'>Security</p>
        </div>
        <div className='divide-y divide-gray-50'>
          <button className='w-full flex items-center justify-between px-4 py-3.5 hover:bg-gray-50 transition-colors text-left'>
            <div className='flex items-center gap-2.5'>
              <Key className='w-4 h-4 text-gray-400' />
              <p className='text-sm text-gray-700'>Change Admin Password</p>
            </div>
            <ChevronRight className='w-4 h-4 text-gray-400' />
          </button>
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
        Ex-Serviceman Jobs Admin Panel v1.0
      </p>
    </div>
  );
}
