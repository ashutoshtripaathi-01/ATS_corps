import { useState } from 'react'
import { Link, useLocation, useNavigate, Outlet } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  LayoutDashboard, PlusCircle, Briefcase, Building2,
  Settings, LogOut, Zap, Menu, X, ChevronDown, Bell,
  Users, BarChart3,
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
  { label: 'Home',            icon: LayoutDashboard, href: '/employer/dashboard'   },
  { label: 'Post a Job',      icon: PlusCircle,      href: '/employer/post-job'    },
  { label: 'My Jobs',         icon: Briefcase,       href: '/employer/jobs'        },
  { label: 'Applications',    icon: Users,           href: '/employer/applications'},
  { label: 'Analytics',       icon: BarChart3,       href: '/employer/analytics'   },
  { label: 'Company Profile', icon: Building2,       href: '/employer/company'     },
  { label: 'Settings',        icon: Settings,        href: '/employer/settings'    },
]

export function EmployerLayout() {
  const location = useLocation()
  const navigate  = useNavigate()
  const { user, logout } = useAppStore()
  const [mobileOpen, setMobileOpen] = useState(false)

  const handleLogout = () => { logout(); navigate('/') }

  const currentLabel = NAV.find((n) => n.href === location.pathname)?.label ?? 'Dashboard'

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">

      {/* ── Desktop Sidebar ── */}
      <aside className="hidden md:flex flex-col w-56 bg-[#292e31] text-white h-screen sticky top-0 shrink-0">
        {/* Logo */}
        <div className="flex items-center gap-2.5 px-4 h-16 border-b border-white/10">
          <div className="w-8 h-8 rounded-lg bg-[#F7A607] flex items-center justify-center shrink-0">
            <Zap className="w-4 h-4 text-white" />
          </div>
          <div className="min-w-0">
            <p className="font-bold text-sm leading-tight">{BRAND.name}</p>
            <p className="text-[10px] text-gray-400">Recruiter Portal</p>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 py-3 px-2 space-y-0.5 overflow-y-auto">
          {NAV.map(({ label, icon: Icon, href }) => {
            const active = location.pathname === href
            return (
              <Link
                key={href}
                to={href}
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
                {getInitials(user?.name ?? 'E')}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-white truncate">{user?.name}</p>
              <p className="text-[10px] text-gray-400 truncate">{user?.email}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-gray-400 hover:bg-red-500/10 hover:text-red-400 transition-colors w-full"
          >
            <LogOut className="w-4 h-4" />
            Logout
          </button>
        </div>
      </aside>

      {/* ── Main area ── */}
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* Top bar */}
        <header className="h-14 bg-white border-b border-gray-100 flex items-center gap-3 px-4 sticky top-0 z-40 shadow-sm">
          <button
            className="md:hidden p-2 rounded-lg hover:bg-gray-100 transition-colors"
            onClick={() => setMobileOpen(true)}
          >
            <Menu className="w-5 h-5 text-gray-600" />
          </button>

          <h1 className="text-sm font-semibold text-gray-800 flex-1">{currentLabel}</h1>

          <div className="flex items-center gap-1">
            <button className="p-2 rounded-xl hover:bg-gray-100 transition-colors">
              <Bell className="w-4 h-4 text-gray-500" />
            </button>

            {/* Profile dropdown — all breakpoints */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-2 px-2 py-1.5 rounded-xl hover:bg-gray-100 transition-colors">
                  <Avatar className="w-7 h-7">
                    <AvatarFallback className="bg-[#292e31] text-white text-[10px] font-bold">
                      {getInitials(user?.name ?? 'E')}
                    </AvatarFallback>
                  </Avatar>
                  <span className="hidden sm:block text-xs font-medium text-gray-700 max-w-[100px] truncate">{user?.name}</span>
                  <ChevronDown className="w-3.5 h-3.5 text-gray-400 hidden sm:block" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="w-52 bg-[#292e31] border border-white/10 text-white shadow-xl shadow-black/30 p-1 rounded-xl"
              >
                <DropdownMenuLabel className="text-gray-400 text-xs font-medium px-3 py-2">
                  {user?.name || 'My Account'}
                </DropdownMenuLabel>
                <DropdownMenuSeparator className="bg-white/10 my-1" />
                <DropdownMenuItem
                  onClick={() => navigate('/employer/company')}
                  className="text-white hover:bg-[#F7A607]/15 hover:text-[#F7A607] focus:bg-[#F7A607]/15 focus:text-[#F7A607] cursor-pointer rounded-lg px-3 py-2"
                >
                  <Building2 className="w-4 h-4 mr-2 shrink-0" />
                  Company Profile
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => navigate('/employer/settings')}
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
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
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
              className="fixed left-0 top-0 h-full w-56 bg-[#292e31] text-white z-50 flex flex-col"
            >
              <div className="flex items-center justify-between px-4 h-14 border-b border-white/10">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-[#F7A607] flex items-center justify-center">
                    <Zap className="w-3.5 h-3.5 text-white" />
                  </div>
                  <span className="font-bold text-sm">{BRAND.name}</span>
                </div>
                <button onClick={() => setMobileOpen(false)} className="p-1.5 rounded-lg hover:bg-white/10">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <nav className="flex-1 p-3 space-y-0.5">
                {NAV.map(({ label, icon: Icon, href }) => {
                  const active = location.pathname === href
                  return (
                    <Link
                      key={href}
                      to={href}
                      onClick={() => setMobileOpen(false)}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all
                        ${active ? 'bg-[#F7A607] text-white' : 'text-gray-400 hover:bg-white/10 hover:text-white'}`}
                    >
                      <Icon className="w-4 h-4 shrink-0" />
                      {label}
                    </Link>
                  )
                })}
              </nav>

              <div className="p-3 border-t border-white/10">
                <button
                  onClick={handleLogout}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-gray-400 hover:bg-red-500/10 hover:text-red-400 transition-colors w-full"
                >
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
