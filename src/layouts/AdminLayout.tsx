import { useState } from 'react'
import { Link, useLocation, useNavigate, Outlet } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  LayoutDashboard, Building2, Users, Briefcase,
  LogOut, Shield, Menu, X, Bell, Settings, ChevronDown, ClipboardList,
} from 'lucide-react'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useAppStore } from '@/store/useAppStore'
import { getInitials } from '@/lib/utils'
import { BRAND } from '@/constants'

const NAV = [
  { label: 'Dashboard',     icon: LayoutDashboard, href: '/admin/dashboard' },
  { label: 'Registrations', icon: ClipboardList,   href: '/admin/registrations' },
  { label: 'Companies',     icon: Building2,        href: '/admin/companies' },
  { label: 'Candidates',    icon: Users,            href: '/admin/candidates' },
  { label: 'Job Posts',     icon: Briefcase,        href: '/admin/jobs' },
]

export function AdminLayout() {
  const location = useLocation()
  const navigate  = useNavigate()
  const { user, logout } = useAppStore()
  const [mobileOpen, setMobileOpen] = useState(false)

  const handleLogout = () => { logout(); navigate('/admin/login') }
  const currentLabel = NAV.find((n) => location.pathname.startsWith(n.href))?.label ?? 'Admin'

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">

      {/* ── Desktop Sidebar ── */}
      <aside className="hidden md:flex flex-col w-56 bg-[#1a1d1f] text-white h-screen sticky top-0 shrink-0">
        {/* Logo */}
        <div className="flex items-center gap-2.5 px-4 h-16 border-b border-white/10">
          <div className="w-8 h-8 rounded-lg bg-[#F7A607] flex items-center justify-center shrink-0">
            <Shield className="w-4 h-4 text-white" />
          </div>
          <div className="min-w-0">
            <p className="font-bold text-sm leading-tight">{BRAND.name}</p>
            <p className="text-[10px] text-amber-400 font-semibold">Admin Panel</p>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 py-3 px-2 space-y-0.5 overflow-y-auto">
          {NAV.map(({ label, icon: Icon, href }) => {
            const active = location.pathname.startsWith(href)
            return (
              <Link key={href} to={href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all
                  ${active
                    ? 'bg-[#F7A607] text-white shadow-md shadow-[#F7A607]/20'
                    : 'text-gray-400 hover:bg-white/8 hover:text-white'}`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                {label}
              </Link>
            )
          })}
        </nav>

        {/* User + Logout */}
        <div className="p-3 border-t border-white/10 space-y-1">
          <div className="flex items-center gap-2.5 px-3 py-2">
            <Avatar className="w-8 h-8 shrink-0">
              <AvatarFallback className="bg-[#F7A607] text-white text-xs font-bold">
                {getInitials(user?.name ?? 'A')}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-white truncate">{user?.name ?? 'Admin'}</p>
              <p className="text-[10px] text-amber-400 truncate">Administrator</p>
            </div>
          </div>
          <button onClick={handleLogout}
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-gray-400 hover:bg-red-500/10 hover:text-red-400 transition-colors w-full">
            <LogOut className="w-4 h-4" />
            Logout
          </button>
        </div>
      </aside>

      {/* ── Main area ── */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar */}
        <header className="h-14 bg-white border-b border-gray-100 flex items-center gap-3 px-4 sticky top-0 z-40 shadow-sm">
          <button className="md:hidden p-2 rounded-lg hover:bg-gray-100 transition-colors"
            onClick={() => setMobileOpen(true)}>
            <Menu className="w-5 h-5 text-gray-600" />
          </button>

          <div className="flex items-center gap-2 flex-1">
            <div className="w-6 h-6 rounded-md bg-[#1a1d1f] flex items-center justify-center md:hidden">
              <Shield className="w-3.5 h-3.5 text-[#F7A607]" />
            </div>
            <h1 className="text-sm font-semibold text-gray-800">{currentLabel}</h1>
          </div>

          <div className="flex items-center gap-1">
            <button className="p-2 rounded-xl hover:bg-gray-100 transition-colors">
              <Bell className="w-4 h-4 text-gray-500" />
            </button>
            {/* Profile dropdown — all breakpoints */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-2 px-2 py-1.5 rounded-xl hover:bg-gray-100 transition-colors">
                  <Avatar className="w-7 h-7">
                    <AvatarFallback className="bg-[#1a1d1f] text-[#F7A607] text-[10px] font-bold">
                      {getInitials(user?.name ?? 'A')}
                    </AvatarFallback>
                  </Avatar>
                  <span className="hidden sm:block text-xs font-semibold text-amber-700 max-w-[80px] truncate">Admin</span>
                  <ChevronDown className="w-3.5 h-3.5 text-gray-400 hidden sm:block" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="w-52 bg-[#1a1d1f] border border-white/10 text-white shadow-xl shadow-black/30 p-1 rounded-xl"
              >
                <DropdownMenuLabel className="text-amber-400 text-xs font-medium px-3 py-2">
                  {user?.name ?? 'Administrator'}
                </DropdownMenuLabel>
                <DropdownMenuSeparator className="bg-white/10 my-1" />
                <DropdownMenuItem
                  onClick={() => navigate('/admin/settings')}
                  className="text-white hover:bg-[#F7A607]/15 hover:text-[#F7A607] focus:bg-[#F7A607]/15 focus:text-[#F7A607] cursor-pointer rounded-lg px-3 py-2"
                >
                  <Settings className="w-4 h-4 mr-2 shrink-0" />
                  Settings
                </DropdownMenuItem>
                <DropdownMenuSeparator className="bg-white/10 my-1" />
                <DropdownMenuItem
                  onClick={handleLogout}
                  className="text-red-400 hover:bg-red-500/15 hover:text-red-400 focus:bg-red-500/15 focus:text-red-400 cursor-pointer rounded-lg px-3 py-2"
                >
                  <LogOut className="w-4 h-4 mr-2 shrink-0" />
                  Logout
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">
          <AnimatePresence mode="wait">
            <motion.div key={location.pathname}
              initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}>
              <Outlet />
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

      {/* ── Mobile Sidebar overlay ── */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 z-50 md:hidden"
              onClick={() => setMobileOpen(false)}
            />
            <motion.aside
              initial={{ x: -240 }} animate={{ x: 0 }} exit={{ x: -240 }}
              transition={{ duration: 0.25 }}
              className="fixed left-0 top-0 h-full w-56 bg-[#1a1d1f] text-white z-50 flex flex-col"
            >
              <div className="flex items-center justify-between px-4 h-14 border-b border-white/10">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-[#F7A607] flex items-center justify-center">
                    <Shield className="w-3.5 h-3.5 text-white" />
                  </div>
                  <div>
                    <span className="font-bold text-sm block leading-tight">{BRAND.name}</span>
                    <span className="text-[10px] text-amber-400">Admin Panel</span>
                  </div>
                </div>
                <button onClick={() => setMobileOpen(false)} className="p-1.5 rounded-lg hover:bg-white/10">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <nav className="flex-1 p-3 space-y-0.5">
                {NAV.map(({ label, icon: Icon, href }) => {
                  const active = location.pathname.startsWith(href)
                  return (
                    <Link key={href} to={href} onClick={() => setMobileOpen(false)}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all
                        ${active ? 'bg-[#F7A607] text-white' : 'text-gray-400 hover:bg-white/10 hover:text-white'}`}>
                      <Icon className="w-4 h-4 shrink-0" />
                      {label}
                    </Link>
                  )
                })}
              </nav>

              <div className="p-3 border-t border-white/10">
                <button onClick={handleLogout}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-gray-400 hover:bg-red-500/10 hover:text-red-400 transition-colors w-full">
                  <LogOut className="w-4 h-4" />
                  Logout
                </button>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}
