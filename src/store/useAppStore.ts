import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { User, Notification } from '@/types'
import { setToken } from '@/lib/tokenStore'
import { API_BASE } from '@/lib/api'

interface AppState {
  user: User | null
  theme: 'light' | 'dark'
  sidebarOpen: boolean
  notifications: Notification[]
  unreadCount: number

  setUser: (user: User | null) => void
  setTheme: (theme: 'light' | 'dark') => void
  toggleTheme: () => void
  setSidebarOpen: (open: boolean) => void
  toggleSidebar: () => void
  addNotification: (n: Notification) => void
  markAllRead: () => void
  logout: () => void
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      user: null,
      theme: 'light',
      sidebarOpen: true,
      notifications: [],
      unreadCount: 0,

      setUser: (user) => set({ user }),
      setTheme: (theme) => {
        set({ theme })
        document.documentElement.classList.toggle('dark', theme === 'dark')
      },
      toggleTheme: () =>
        set((state) => {
          const next = state.theme === 'light' ? 'dark' : 'light'
          document.documentElement.classList.toggle('dark', next === 'dark')
          return { theme: next }
        }),
      setSidebarOpen: (sidebarOpen) => set({ sidebarOpen }),
      toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
      addNotification: (n) =>
        set((s) => ({
          notifications: [n, ...s.notifications],
          unreadCount: s.unreadCount + 1,
        })),
      markAllRead: () =>
        set((s) => ({
          notifications: s.notifications.map((n) => ({ ...n, read: true })),
          unreadCount: 0,
        })),
      logout: () => {
        // Clear in-memory access token immediately
        setToken(null)
        // Fire-and-forget: revoke refresh token cookie on server
        fetch(`${API_BASE}/auth/logout`, { method: 'POST', credentials: 'include' }).catch(() => {})
        set({ user: null, notifications: [], unreadCount: 0 })
      },
    }),
    { name: 'ats-corps-store', partialize: (s) => ({ user: s.user, theme: s.theme }) },
  ),
)

interface CandidateStore {
  savedJobs: string[]
  appliedJobs: string[]
  toggleSaveJob: (jobId: string) => void
  applyJob: (jobId: string) => void
}

export const useCandidateStore = create<CandidateStore>()(
  persist(
    (set) => ({
      savedJobs: [],
      appliedJobs: [],
      toggleSaveJob: (jobId) =>
        set((s) => ({
          savedJobs: s.savedJobs.includes(jobId)
            ? s.savedJobs.filter((id) => id !== jobId)
            : [...s.savedJobs, jobId],
        })),
      applyJob: (jobId) =>
        set((s) => ({
          appliedJobs: s.appliedJobs.includes(jobId) ? s.appliedJobs : [...s.appliedJobs, jobId],
        })),
    }),
    { name: 'ats-candidate-store' },
  ),
)
