import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppStore } from '@/store/useAppStore'
import { getToken } from '@/lib/tokenStore'
import { refreshToken } from '@/lib/api'

interface AuthGuardProps {
  role: 'admin' | 'candidate' | 'employer'
  children: React.ReactNode
  redirectTo?: string
}

export function AuthGuard({ role, children, redirectTo }: AuthGuardProps) {
  const { user, logout } = useAppStore()
  const navigate = useNavigate()
  const [status, setStatus] = useState<'checking' | 'ok' | 'denied'>('checking')

  useEffect(() => {
    const token = getToken()

    if (token && user?.role === role) {
      setStatus('ok')
      return
    }

    // No in-memory token — try silent refresh via httpOnly cookie
    refreshToken()
      .then(() => setStatus('ok'))
      .catch(() => {
        logout()
        setStatus('denied')
      })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (status !== 'denied') return
    const path = redirectTo ?? (role === 'admin' ? '/admin/login' : '/')
    navigate(path, { replace: true })
  }, [status, navigate, redirectTo, role])

  if (status === 'checking') {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="w-8 h-8 border-2 border-[#F7A607] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (status === 'denied') return null

  return <>{children}</>
}
