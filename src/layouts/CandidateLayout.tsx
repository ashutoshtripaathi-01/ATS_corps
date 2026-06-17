import { useState, useRef, useEffect } from 'react';
import { Link, useLocation, useNavigate, Outlet } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard, FileText, Bookmark, Bell, Settings,
  ChevronLeft, ChevronRight, Search, Moon, Sun, LogOut,
  User, ChevronDown, Zap, X, Menu, Briefcase, Calendar, MessageSquare,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Progress } from '@/components/ui/progress';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useAppStore } from '@/store/useAppStore';
import { getInitials } from '@/lib/utils';
import { BRAND } from '@/constants';
import type { Notification } from '@/types';

const navItems = [
  { label: 'Home',         icon: LayoutDashboard, href: '/candidate/dashboard' },
  { label: 'Jobs',         icon: Briefcase,        href: '/candidate/jobs' },
  { label: 'Applications', icon: FileText,         href: '/candidate/applications' },
  { label: 'Saved Jobs',   icon: Bookmark,         href: '/candidate/saved' },
  { label: 'Settings',     icon: Settings,         href: '/candidate/settings' },
];

/* ── Notification helpers ──────────────────────────────────────────────── */
function getNotifIcon(type: string) {
  switch (type) {
    case 'job-alert':   return Briefcase;
    case 'application': return FileText;
    case 'interview':   return Calendar;
    case 'message':     return MessageSquare;
    default:            return Bell;
  }
}
function getNotifColor(type: string): string {
  switch (type) {
    case 'job-alert':   return 'bg-[#F7A607]/15 text-[#F7A607]';
    case 'application': return 'bg-blue-100 text-blue-600';
    case 'interview':   return 'bg-purple-100 text-purple-600';
    case 'message':     return 'bg-green-100 text-green-600';
    default:            return 'bg-gray-100 text-gray-500';
  }
}
function timeAgo(date: Date): string {
  const s = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (s < 60) return 'Just now';
  const m = Math.floor(s / 60); if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60); if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24); if (d === 1) return 'Yesterday';
  if (d < 7) return `${d}d ago`;
  return new Date(date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}
function NotifItem({ notif }: { notif: Notification }) {
  const Icon = getNotifIcon(notif.type);
  return (
    <div className={`flex items-start gap-3 px-4 py-3 cursor-pointer border-b border-gray-50 dark:border-white/5 last:border-0 transition-colors hover:bg-gray-50 dark:hover:bg-white/5 ${
      !notif.read ? 'bg-[#F7A607]/5 dark:bg-[#F7A607]/8' : ''
    }`}>
      <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${getNotifColor(notif.type)}`}>
        <Icon className="w-4 h-4" />
      </div>
      <div className="flex-1 min-w-0">
        <p className={`text-sm leading-snug mb-0.5 ${!notif.read ? 'font-semibold text-gray-900 dark:text-[#F0EFEA]' : 'font-medium text-gray-700 dark:text-gray-200'}`}>
          {notif.title}
        </p>
        <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed line-clamp-2">{notif.body}</p>
        <p className="text-[11px] text-[#F7A607] font-semibold mt-1">{timeAgo(new Date(notif.createdAt))}</p>
      </div>
      {!notif.read && <div className="w-2.5 h-2.5 rounded-full bg-[#F7A607] shrink-0 mt-1.5" />}
    </div>
  );
}

const SEED_NOTIFICATIONS: Notification[] = [
  { id: 'seed-1', type: 'job-alert',   title: 'New job match: Security Guard',  body: 'A new position matching your profile is open in Guwahati · ₹18k/month, night shift available.', read: false, createdAt: new Date(Date.now() - 2 * 3600000), link: '/candidate/jobs' },
  { id: 'seed-2', type: 'application', title: 'Application under review',        body: 'Your application for Armed Guard at Assam Security Pvt Ltd is currently being reviewed by the employer.', read: false, createdAt: new Date(Date.now() - 18 * 3600000) },
  { id: 'seed-3', type: 'system',      title: 'Welcome to ATS Corps!',           body: 'Your account has been verified. Complete your profile to get hired faster by top security companies.', read: false, createdAt: new Date(Date.now() - 3 * 86400000) },
];

/* ── Pill theme toggle ─────────────────────────────────────────────────── */
function ThemeToggle({ theme, onToggle }: { theme: 'light' | 'dark'; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
      className="relative flex items-center h-8 w-[60px] rounded-full p-0.5 transition-all duration-300 border border-gray-200 dark:border-white/15 bg-gray-100 dark:bg-[#292e31] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#F7A607]"
    >
      {/* Sliding knob */}
      <motion.span
        layout
        transition={{ type: 'spring', stiffness: 500, damping: 35 }}
        className={`absolute flex items-center justify-center w-7 h-7 rounded-full shadow-md transition-colors duration-300 ${
          theme === 'dark'
            ? 'left-[28px] bg-[#1e2227] border border-[#F7A607]/30'
            : 'left-0.5 bg-white border border-gray-100'
        }`}
      >
        {theme === 'dark'
          ? <Moon className="w-3.5 h-3.5 text-[#F7A607]" />
          : <Sun className="w-3.5 h-3.5 text-amber-400" />
        }
      </motion.span>
      {/* Ghost icons in track */}
      <Sun className="w-3 h-3 text-amber-300 dark:text-gray-600 ml-1.5 shrink-0" />
      <Moon className="w-3 h-3 text-gray-400 dark:text-[#F7A607]/50 ml-auto mr-1.5 shrink-0" />
    </button>
  );
}

export function CandidateLayout() {
  const location  = useLocation();
  const navigate  = useNavigate();
  const { user, theme, toggleTheme, sidebarOpen, setSidebarOpen, logout,
          notifications, unreadCount, markAllRead, addNotification } = useAppStore();

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [notifOpen, setNotifOpen]           = useState(false);
  const notifRef  = useRef<HTMLDivElement>(null);
  const seededRef = useRef(false);

  /* Sync dark class on every theme change (also covers initial hydration) */
  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);

  useEffect(() => {
    if (!seededRef.current) {
      seededRef.current = true;
      SEED_NOTIFICATIONS.forEach(addNotification);
    }
  }, [addNotification]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setNotifOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleLogout = () => { logout(); navigate('/'); };
  const profileStrength = 78;

  return (
    <div className="flex h-screen overflow-hidden bg-[#f8f8f8] dark:bg-[#111418]">
      {/* ── Desktop Sidebar ─────────────────────────────────────────────── */}
      <motion.aside
        initial={false}
        animate={{ width: sidebarOpen ? 260 : 72 }}
        transition={{ duration: 0.3, ease: 'easeInOut' }}
        className="hidden md:flex flex-col bg-[#292e31] text-white h-screen sticky top-0 overflow-hidden shrink-0"
      >
        {/* Logo */}
        <div className="flex items-center gap-3 p-4 h-16 border-b border-white/10">
          <div className="w-8 h-8 rounded-lg bg-[#F7A607] flex items-center justify-center shrink-0">
            <Zap className="w-5 h-5 text-white" />
          </div>
          <AnimatePresence>
            {sidebarOpen && (
              <motion.span initial={{ opacity: 0, width: 0 }} animate={{ opacity: 1, width: 'auto' }}
                exit={{ opacity: 0, width: 0 }}
                className="font-bold text-lg whitespace-nowrap overflow-hidden" style={{ fontFamily: 'Plus Jakarta Sans' }}>
                {BRAND.name}
              </motion.span>
            )}
          </AnimatePresence>
          <button onClick={() => setSidebarOpen(!sidebarOpen)}
            className="ml-auto p-1 rounded-lg hover:bg-white/10 transition-colors">
            {sidebarOpen ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </button>
        </div>

        {/* Profile card */}
        {sidebarOpen && (
          <div className="p-4 border-b border-white/10">
            <div className="flex flex-col items-center gap-2">
              <div className="relative">
                <Avatar className="w-14 h-14 border-2 border-[#F7A607]">
                  <AvatarImage src={user?.avatar} />
                  <AvatarFallback className="text-sm">{getInitials(user?.name || 'User')}</AvatarFallback>
                </Avatar>
                <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-green-400 border-2 border-[#292e31]" />
              </div>
              <div className="text-center">
                <p className="font-bold text-sm">{user?.name || 'Candidate'}</p>
                <p className="text-xs text-gray-400">Ex-Serviceman</p>
              </div>
              <div className="w-full">
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-gray-400">Profile Strength</span>
                  <span className="text-[#F7A607] font-semibold">{profileStrength}%</span>
                </div>
                <Progress value={profileStrength} className="h-1.5" />
              </div>
              <Button size="sm" className="w-full text-xs h-7">Complete Profile</Button>
            </div>
          </div>
        )}
        {!sidebarOpen && (
          <div className="p-3 border-b border-white/10 flex justify-center">
            <Avatar className="w-10 h-10 border-2 border-[#F7A607]">
              <AvatarImage src={user?.avatar} />
              <AvatarFallback className="text-xs">{getInitials(user?.name || 'U')}</AvatarFallback>
            </Avatar>
          </div>
        )}

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-2 px-2 space-y-0.5">
          {navItems.map(({ label, icon: Icon, href }) => {
            const active = location.pathname === href || (href !== '/candidate/dashboard' && location.pathname.startsWith(href));
            return (
              <Link key={href} to={href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all relative ${
                  active ? 'bg-[#F7A607] text-white shadow-lg shadow-[#F7A607]/25'
                         : 'text-gray-300 hover:bg-white/10 hover:text-white'
                }`}>
                <Icon className="w-5 h-5 shrink-0" />
                <AnimatePresence>
                  {sidebarOpen && (
                    <motion.span initial={{ opacity: 0, width: 0 }} animate={{ opacity: 1, width: 'auto' }}
                      exit={{ opacity: 0, width: 0 }}
                      className="text-sm font-medium whitespace-nowrap overflow-hidden flex-1">
                      {label}
                    </motion.span>
                  )}
                </AnimatePresence>
              </Link>
            );
          })}
        </nav>

        {/* Logout */}
        <div className="p-3 border-t border-white/10">
          <button onClick={handleLogout}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-gray-400 hover:bg-red-500/10 hover:text-red-400 transition-colors w-full ${!sidebarOpen ? 'justify-center' : ''}`}>
            <LogOut className="w-5 h-5 shrink-0" />
            <AnimatePresence>
              {sidebarOpen && (
                <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  className="text-sm font-medium">Logout</motion.span>
              )}
            </AnimatePresence>
          </button>
        </div>
      </motion.aside>

      {/* ── Main content ────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* Header */}
        <header className="h-16 bg-white dark:bg-[#1e2227] border-b border-gray-100 dark:border-white/8 flex items-center gap-3 px-3 sm:px-5 sticky top-0 z-40 shadow-sm dark:shadow-black/20">
          {/* Mobile hamburger */}
          <button
            onClick={() => setMobileMenuOpen(true)}
            className="md:hidden p-2 rounded-lg bg-[#F5F4EE] dark:bg-white/10 hover:bg-[#EDE9DF] dark:hover:bg-white/20 transition-colors shrink-0"
          >
            <Menu className="w-5 h-5 text-gray-700 dark:text-[#F0EFEA]" />
          </button>

          {/* Mobile logo */}
          <Link to="/" className="md:hidden flex items-center gap-2 shrink-0">
            <div className="w-7 h-7 rounded-lg bg-[#F7A607] flex items-center justify-center">
              <Zap className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-base text-gray-900 dark:text-[#F0EFEA]">{BRAND.name}</span>
          </Link>

          {/* Search */}
          <div className="flex-1 max-w-sm hidden sm:flex items-center gap-2 bg-gray-50 dark:bg-white/5 rounded-xl px-3 py-2 border border-gray-100 dark:border-white/10">
            <Search className="w-4 h-4 text-gray-400 shrink-0" />
            <input type="text" placeholder="Search jobs, companies…"
              className="bg-transparent flex-1 text-sm outline-none text-gray-700 dark:text-gray-200 placeholder:text-gray-400 dark:placeholder:text-gray-500 min-w-0" />
          </div>

          <div className="ml-auto flex items-center gap-2">
            {/* Theme toggle pill */}
            <ThemeToggle theme={theme} onToggle={toggleTheme} />

            {/* Notification bell */}
            <div className="relative" ref={notifRef}>
              <button onClick={() => setNotifOpen(o => !o)}
                className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-white/8 relative transition-colors">
                <Bell className={`w-5 h-5 transition-colors ${notifOpen ? 'text-[#F7A607]' : 'text-gray-600 dark:text-gray-300'}`} />
                {unreadCount > 0 && (
                  <span className="absolute top-1 right-1 min-w-[16px] h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-0.5">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>

              <AnimatePresence>
                {notifOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: 8, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 8, scale: 0.97 }}
                    transition={{ duration: 0.15, ease: 'easeOut' }}
                    className="absolute right-0 top-full mt-2 w-[320px] sm:w-[360px] bg-white dark:bg-[#1e2227] border border-gray-100 dark:border-white/10 rounded-2xl shadow-2xl shadow-black/15 dark:shadow-black/40 overflow-hidden z-50"
                  >
                    <div className="flex items-center justify-between px-4 py-3.5 border-b border-gray-100 dark:border-white/8">
                      <h3 className="text-base font-extrabold text-gray-900 dark:text-[#F0EFEA]" style={{ fontFamily: 'Plus Jakarta Sans' }}>
                        Notifications
                      </h3>
                      {unreadCount > 0 && (
                        <button onClick={markAllRead} className="text-xs font-semibold text-[#F7A607] hover:text-[#d99400] transition-colors">
                          Mark all as read
                        </button>
                      )}
                    </div>
                    <div className="max-h-[420px] overflow-y-auto divide-y divide-gray-50 dark:divide-white/5">
                      {notifications.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-12 px-4">
                          <div className="w-12 h-12 rounded-full bg-gray-100 dark:bg-white/10 flex items-center justify-center mb-3">
                            <Bell className="w-6 h-6 text-gray-400 dark:text-gray-300" />
                          </div>
                          <p className="text-sm font-semibold text-gray-700 dark:text-[#F0EFEA]">No notifications yet</p>
                          <p className="text-xs text-gray-400 dark:text-gray-500 text-center mt-1">Job alerts and updates will appear here</p>
                        </div>
                      ) : (
                        notifications.map(n => <NotifItem key={n.id} notif={n} />)
                      )}
                    </div>
                    {notifications.length > 0 && (
                      <div className="border-t border-gray-100 dark:border-white/8 px-4 py-3 text-center bg-gray-50/50 dark:bg-white/3">
                        <button onClick={() => setNotifOpen(false)} className="text-xs font-semibold text-[#F7A607] hover:underline">
                          See all notifications
                        </button>
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Profile dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-2 rounded-xl px-2 py-1 hover:bg-gray-100 dark:hover:bg-white/8 transition-colors">
                  <Avatar className="w-8 h-8">
                    <AvatarImage src={user?.avatar} />
                    <AvatarFallback className="text-xs">{getInitials(user?.name || 'U')}</AvatarFallback>
                  </Avatar>
                  <span className="hidden sm:block text-sm font-medium text-gray-700 dark:text-gray-200">
                    {user?.name?.split(' ')[0]}
                  </span>
                  <ChevronDown className="w-4 h-4 text-gray-400 hidden sm:block" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end"
                className="w-52 bg-[#292e31] border border-white/10 text-white shadow-xl shadow-black/30 p-1 rounded-xl">
                <DropdownMenuLabel className="text-gray-400 text-xs font-medium px-3 py-2">
                  {user?.name || 'My Account'}
                </DropdownMenuLabel>
                <DropdownMenuSeparator className="bg-white/10 my-1" />
                <DropdownMenuItem onClick={() => navigate('/candidate/profile')}
                  className="text-white hover:bg-[#F7A607]/15 hover:text-[#F7A607] focus:bg-[#F7A607]/15 focus:text-[#F7A607] cursor-pointer rounded-lg px-3 py-2">
                  <User className="w-4 h-4 mr-2 shrink-0" /> My Profile
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate('/candidate/settings')}
                  className="text-white hover:bg-[#F7A607]/15 hover:text-[#F7A607] focus:bg-[#F7A607]/15 focus:text-[#F7A607] cursor-pointer rounded-lg px-3 py-2">
                  <Settings className="w-4 h-4 mr-2 shrink-0" /> Settings
                </DropdownMenuItem>
                <DropdownMenuSeparator className="bg-white/10 my-1" />
                <DropdownMenuItem onClick={handleLogout}
                  className="text-red-400 hover:bg-red-500/15 focus:bg-red-500/15 cursor-pointer rounded-lg px-3 py-2">
                  <LogOut className="w-4 h-4 mr-2 shrink-0" /> Logout
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">
          <AnimatePresence mode="wait">
            <motion.div key={location.pathname}
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }}
              className="h-full">
              <Outlet />
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

      {/* ── Mobile sidebar overlay ──────────────────────────────────────── */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 z-50 md:hidden"
              onClick={() => setMobileMenuOpen(false)} />
            <motion.aside initial={{ x: -280 }} animate={{ x: 0 }} exit={{ x: -280 }}
              transition={{ duration: 0.28, ease: 'easeOut' }}
              className="fixed left-0 top-0 h-full w-64 bg-[#292e31] text-white z-50 md:hidden overflow-y-auto flex flex-col">
              <div className="flex items-center justify-between p-4 border-b border-white/10">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-[#F7A607] flex items-center justify-center">
                    <Zap className="w-5 h-5 text-white" />
                  </div>
                  <span className="font-bold text-lg text-white">{BRAND.name}</span>
                </div>
                <button onClick={() => setMobileMenuOpen(false)} className="p-1.5 rounded-lg hover:bg-white/10">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Profile in mobile sidebar */}
              <div className="px-4 py-3 border-b border-white/10 flex items-center gap-3">
                <Avatar className="w-10 h-10 border-2 border-[#F7A607] shrink-0">
                  <AvatarImage src={user?.avatar} />
                  <AvatarFallback className="text-xs">{getInitials(user?.name || 'U')}</AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="font-bold text-sm truncate">{user?.name || 'Candidate'}</p>
                  <p className="text-xs text-gray-400">Ex-Serviceman</p>
                </div>
              </div>

              <nav className="flex-1 p-3 space-y-0.5">
                {navItems.map(({ label, icon: Icon, href }) => {
                  const active = location.pathname === href || (href !== '/candidate/dashboard' && location.pathname.startsWith(href));
                  return (
                    <Link key={href} to={href} onClick={() => setMobileMenuOpen(false)}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all ${
                        active ? 'bg-[#F7A607] text-white' : 'text-gray-300 hover:bg-white/10 hover:text-white'
                      }`}>
                      <Icon className="w-5 h-5 shrink-0" />
                      <span className="text-sm font-medium">{label}</span>
                    </Link>
                  );
                })}
              </nav>

              <div className="p-3 border-t border-white/10">
                <button onClick={() => { setMobileMenuOpen(false); handleLogout(); }}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-gray-400 hover:bg-red-500/10 hover:text-red-400 transition-colors w-full">
                  <LogOut className="w-5 h-5 shrink-0" />
                  <span className="text-sm font-medium">Logout</span>
                </button>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
