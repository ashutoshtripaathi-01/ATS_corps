import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Shield, Eye, EyeOff, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAppStore } from '@/store/useAppStore'
import { adminLogin } from '@/lib/api'
import { setToken } from '@/lib/tokenStore'
import { BRAND } from '@/constants'

export default function AdminLogin() {
  const navigate = useNavigate()
  const setUser  = useAppStore((s) => s.setUser)

  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [error,    setError]    = useState('')
  const [loading,  setLoading]  = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!email || !password) { setError('Please enter email and password'); return }
    setLoading(true)
    try {
      const data = await adminLogin(email, password)
      setToken(data.accessToken)
      setUser({ id: data.user.id, name: data.user.name, email: data.user.email, role: 'admin', createdAt: new Date() })
      navigate('/admin/dashboard')
    } catch (err: any) {
      setError(err.message || 'Login failed. Check your credentials.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="w-full max-w-sm"
      >
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-[#292e31] flex items-center justify-center mb-3 shadow-lg">
            <Shield className="w-7 h-7 text-[#F7A607]" />
          </div>
          <h1 className="text-xl font-extrabold text-gray-900" style={{ fontFamily: 'Plus Jakarta Sans' }}>
            Admin Portal
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">{BRAND.name} — Internal Access</p>
        </div>

        {/* Form card */}
        <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm space-y-4">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Email Address</label>
              <input
                type="email"
                value={email}
                onChange={(e) => { setEmail(e.target.value); setError('') }}
                placeholder="admin@atscorps.com"
                autoFocus
                className="w-full h-11 rounded-xl border border-gray-200 bg-white text-sm px-4 outline-none
                  transition-all focus:border-[#F7A607] focus:ring-2 focus:ring-[#F7A607]/10 placeholder:text-gray-400"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Password</label>
              <div className="relative">
                <input
                  type={showPass ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setError('') }}
                  placeholder="••••••••"
                  className="w-full h-11 rounded-xl border border-gray-200 bg-white text-sm pl-4 pr-10 outline-none
                    transition-all focus:border-[#F7A607] focus:ring-2 focus:ring-[#F7A607]/10"
                />
                <button type="button" onClick={() => setShowPass(!showPass)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-100 rounded-xl">
                <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
                <p className="text-xs text-red-600">{error}</p>
              </div>
            )}

            <Button type="submit" size="lg" variant="dark" className="w-full rounded-xl font-bold" disabled={loading}>
              {loading ? (
                <span className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Signing in...
                </span>
              ) : 'Sign in to Admin Panel'}
            </Button>
          </form>
        </div>

        <p className="text-center mt-6">
          <a href="/" className="text-xs text-gray-400 hover:text-[#F7A607] transition-colors">
            ← Back to {BRAND.name}
          </a>
        </p>
      </motion.div>
    </div>
  )
}
