import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  ArrowLeft, Mail, Lock, Eye, EyeOff, CheckCircle, RefreshCw,
  Shield, X, Building2,
} from 'lucide-react'
import companyLogo from '@/assets/company logo.png'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useAppStore } from '@/store/useAppStore'
import { toast } from '@/hooks/useToast'
import { employerLogin, employerCreateAccount } from '@/lib/api'
import { setToken } from '@/lib/tokenStore'

type Step = 'auth' | 'success'

interface EmployerAuthModalProps {
  open: boolean
  onClose: () => void
  onBack: () => void
  mode: 'login' | 'register'
}

const loginSchema = z.object({
  email:    z.string().email('Enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
})

const registerSchema = z.object({
  email:           z.string().email('Enter a valid email address'),
  password:        z.string().min(8, 'Password must be at least 8 characters'),
  confirmPassword: z.string(),
}).refine((d) => d.password === d.confirmPassword, {
  message: 'Passwords do not match', path: ['confirmPassword'],
})

type LoginForm    = z.infer<typeof loginSchema>
type RegisterForm = z.infer<typeof registerSchema>

export function EmployerAuthModal({ open, onClose, onBack, mode: initialMode }: EmployerAuthModalProps) {
  const navigate = useNavigate()
  const setUser  = useAppStore((s) => s.setUser)

  const [mode,       setMode]       = useState<'login' | 'register'>(initialMode)
  const [step,       setStep]       = useState<Step>('auth')
  const [showPass,   setShowPass]   = useState(false)
  const [showConf,   setShowConf]   = useState(false)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => { setMode(initialMode) }, [initialMode])

  const loginForm    = useForm<LoginForm>({ resolver: zodResolver(loginSchema) })
  const registerForm = useForm<RegisterForm>({ resolver: zodResolver(registerSchema) })

  const handleLogin = async (data: LoginForm) => {
    setSubmitting(true)
    try {
      const result = await employerLogin(data.email, data.password)
      if (result.accessToken) setToken(result.accessToken)
      const e = result.employer
      setUser({
        id:        String(e.id),
        name:      e.company_name || data.email.split('@')[0],
        email:     e.email,
        role:      'employer',
        createdAt: new Date(e.created_at),
      })
      setStep('success')
      setTimeout(() => { handleClose(); navigate('/employer/dashboard') }, 1400)
    } catch (err: any) {
      toast({ title: 'Login failed', description: err.message || 'Invalid email or password', variant: 'error' })
    } finally {
      setSubmitting(false)
    }
  }

  const handleRegister = async (data: RegisterForm) => {
    setSubmitting(true)
    try {
      const result = await employerCreateAccount(data.email, data.password)
      if (result.accessToken) setToken(result.accessToken)
      const e = result.employer
      setUser({
        id:        String(e.id),
        name:      e.email.split('@')[0],
        email:     e.email,
        role:      'employer',
        createdAt: new Date(e.created_at),
      })
      onClose()
      navigate('/employer/register', { state: { email: data.email, password: data.password } })
    } catch (err: any) {
      toast({ title: 'Registration failed', description: err.message || 'Please try again', variant: 'error' })
    } finally {
      setSubmitting(false)
    }
  }

  const handleClose = () => {
    setStep('auth'); setMode(initialMode)
    loginForm.reset(); registerForm.reset()
    setShowPass(false); setShowConf(false)
    onClose()
  }

  const switchMode = (next: 'login' | 'register') => {
    setMode(next)
    loginForm.reset(); registerForm.reset()
    setShowPass(false); setShowConf(false)
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className='max-w-[440px] lg:max-w-[880px] w-full p-0 overflow-hidden border-0 shadow-2xl rounded-3xl [&>button:last-child]:hidden h-[min(640px,calc(100vh-2rem))]'>
        <div className='flex h-full'>

          {/* Left panel — desktop only */}
          <div className='hidden lg:flex lg:w-[380px] shrink-0 relative flex-col overflow-hidden bg-[#1a1d1f]'>
            <div className='h-1 w-full bg-gradient-to-r from-[#F7A607] via-[#ffcc55] to-[#F7A607] shrink-0' />
            <div className='absolute inset-0 opacity-[0.04]' style={{ backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)', backgroundSize: '22px 22px' }} />
            <div className='absolute top-0 left-0 w-[3px] h-full bg-gradient-to-b from-[#F7A607] via-[#F7A607]/60 to-transparent' />

            <div className='relative z-10 flex flex-col h-full px-8 py-7'>
              <div className='flex items-center gap-3 mb-7'>
                <img src={companyLogo} alt='Ex-Serviceman Jobs' className='w-10 h-10 object-contain' />
                <div>
                  <p className='font-extrabold text-white text-sm leading-tight' style={{ fontFamily: 'Plus Jakarta Sans' }}>Ex-Serviceman Jobs</p>
                  <p className='text-[10px] text-gray-400 mt-0.5'>Recruiter Portal</p>
                </div>
              </div>

              <div className='inline-flex items-center gap-2 bg-[#F7A607]/15 border border-[#F7A607]/30 rounded-full px-3 py-1.5 mb-5 w-fit'>
                <Shield className='w-3 h-3 text-[#F7A607]' />
                <span className='text-[9px] font-bold text-[#F7A607] uppercase tracking-widest'>DGR Empanelled · Ministry of Defence</span>
              </div>

              <h2 className='text-2xl font-extrabold text-white leading-snug mb-2' style={{ fontFamily: 'Plus Jakarta Sans' }}>
                Hire Verified<br /><span className='text-[#F7A607]'>Ex-Servicemen</span>
              </h2>
              <p className='text-xs text-gray-400 leading-relaxed mb-6'>
                Access India's most trusted database of Army, Navy, Air Force &amp; Para-Military veterans.
              </p>

              <div className='space-y-3'>
                {[
                  'Post jobs — fill positions in days',
                  '500+ verified veteran profiles',
                  'Pre-screened with service records',
                  'Govt. of India verified platform',
                ].map((t) => (
                  <div key={t} className='flex items-center gap-2.5'>
                    <CheckCircle className='w-3.5 h-3.5 text-[#F7A607] shrink-0' />
                    <span className='text-xs text-gray-400'>{t}</span>
                  </div>
                ))}
              </div>

              <div className='mt-auto pt-6 border-t border-white/8 flex flex-wrap gap-1.5'>
                {['Govt. of India', 'DGR Partner', 'Ministry of Defence'].map((tag) => (
                  <span key={tag} className='text-[9px] font-semibold text-gray-500 bg-white/5 border border-white/8 px-2 py-0.5 rounded-full'>{tag}</span>
                ))}
              </div>
            </div>
          </div>

          {/* Right panel — form */}
          <div className='flex-1 min-w-0 bg-white flex flex-col'>

            {/* Mobile header */}
            <div className='lg:hidden bg-[#292e31] px-5 py-4 flex items-center gap-3'>
              <button onClick={onBack} className='p-1.5 rounded-full hover:bg-white/10 text-white/70 hover:text-white transition-colors'>
                <ArrowLeft className='w-4 h-4' />
              </button>
              <div className='flex items-center gap-2 flex-1'>
                <img src={companyLogo} alt='Ex-Serviceman Jobs' className='w-7 h-7 object-contain' />
                <div>
                  <p className='font-bold text-white text-sm' style={{ fontFamily: 'Plus Jakarta Sans' }}>
                    {mode === 'login' ? 'Employer Login' : 'Employer Registration'}
                  </p>
                  <p className='text-xs text-gray-400'>Hiring portal</p>
                </div>
              </div>
              <span className='bg-[#F7A607]/20 text-[#F7A607] border border-[#F7A607]/30 text-[10px] font-bold px-2 py-0.5 rounded-full'>For Recruiters</span>
            </div>

            {/* Desktop header */}
            <div className='hidden lg:flex items-center gap-3 px-8 py-5 border-b border-gray-100'>
              <div className='flex items-center gap-2'>
                <div className='w-8 h-8 rounded-xl bg-[#F7A607]/10 flex items-center justify-center'>
                  <Building2 className='w-4 h-4 text-[#F7A607]' />
                </div>
                <div>
                  <p className='text-sm font-bold text-[#1a1d1f]' style={{ fontFamily: 'Plus Jakarta Sans' }}>Recruiter Portal</p>
                  <p className='text-[10px] text-gray-400'>Ex-Serviceman Jobs · Secure Login</p>
                </div>
              </div>
              <button onClick={handleClose} className='ml-auto p-1.5 rounded-xl hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors'>
                <X className='w-4 h-4' />
              </button>
            </div>

            {/* Form area */}
            <div className='flex-1 overflow-y-auto px-6 lg:px-8 py-6 lg:py-7'>
              <AnimatePresence mode='wait'>

                {step === 'success' && (
                  <motion.div key='success' initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.35, type: 'spring' }}
                    className='flex flex-col items-center justify-center h-full py-8'
                  >
                    <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.1, type: 'spring', stiffness: 300 }}
                      className='w-20 h-20 bg-[#F7A607]/10 rounded-full flex items-center justify-center mb-5'
                    >
                      <CheckCircle className='w-10 h-10 text-[#F7A607]' />
                    </motion.div>
                    <h3 className='text-2xl font-extrabold text-[#242424] mb-2' style={{ fontFamily: 'Plus Jakarta Sans' }}>Welcome Back!</h3>
                    <p className='text-gray-500 text-sm mb-2'>Signed in as Recruiter</p>
                    <p className='text-xs text-gray-400'>Redirecting to your dashboard...</p>
                    <div className='mt-5 flex justify-center'><div className='w-8 h-1 bg-[#F7A607] rounded-full animate-pulse' /></div>
                  </motion.div>
                )}

                {step === 'auth' && (
                  <motion.div key={`auth-${mode}`} initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }} transition={{ duration: 0.18 }}>

                    {/* Tab switcher — desktop */}
                    <div className='hidden lg:flex bg-gray-100 rounded-2xl p-1 mb-6'>
                      {(['login', 'register'] as const).map((m) => (
                        <button key={m} onClick={() => switchMode(m)}
                          className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all duration-200 ${
                            mode === m ? 'bg-white text-[#1a1d1f] shadow-sm' : 'text-gray-400 hover:text-gray-600'
                          }`}
                        >
                          {m === 'login' ? 'Sign In' : 'Create Account'}
                        </button>
                      ))}
                    </div>

                    {/* Mobile icon */}
                    <div className='flex items-center justify-center w-14 h-14 bg-[#F7A607]/10 rounded-2xl mx-auto mb-4 lg:hidden'>
                      <Mail className='w-7 h-7 text-[#F7A607]' />
                    </div>

                    <h3 className='text-xl lg:text-2xl font-extrabold text-center lg:text-left text-[#1a1d1f] mb-1' style={{ fontFamily: 'Plus Jakarta Sans' }}>
                      {mode === 'login' ? 'Welcome Back!' : 'Create Recruiter Account'}
                    </h3>
                    <p className='text-sm text-gray-500 text-center lg:text-left mb-6'>
                      {mode === 'login' ? 'Sign in to access your recruiter dashboard' : 'Start hiring ex-servicemen today'}
                    </p>

                    {mode === 'login' ? (
                      <form onSubmit={loginForm.handleSubmit(handleLogin)} className='space-y-4'>
                        <div>
                          <label className='text-xs font-semibold text-gray-700 mb-1.5 block'>Email Address <span className='text-red-400'>*</span></label>
                          <div className='relative'>
                            <Mail className='absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400' />
                            <Input type='email' placeholder='hr@yourcompany.com' {...loginForm.register('email')}
                              className='pl-9 h-11 rounded-xl border-gray-200 focus:border-[#F7A607] focus:ring-[#F7A607]/20' autoFocus />
                          </div>
                          {loginForm.formState.errors.email && <p className='text-xs text-red-500 mt-1'>{loginForm.formState.errors.email.message}</p>}
                        </div>
                        <div>
                          <label className='text-xs font-semibold text-gray-700 mb-1.5 block'>Password <span className='text-red-400'>*</span></label>
                          <div className='relative'>
                            <Lock className='absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400' />
                            <Input type={showPass ? 'text' : 'password'} placeholder='Your password' {...loginForm.register('password')}
                              className='pl-9 pr-10 h-11 rounded-xl border-gray-200 focus:border-[#F7A607] focus:ring-[#F7A607]/20' />
                            <button type='button' onClick={() => setShowPass((v) => !v)} className='absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors'>
                              {showPass ? <EyeOff className='w-4 h-4' /> : <Eye className='w-4 h-4' />}
                            </button>
                          </div>
                          {loginForm.formState.errors.password && <p className='text-xs text-red-500 mt-1'>{loginForm.formState.errors.password.message}</p>}
                        </div>
                        <Button type='submit' size='lg' className='w-full h-11 rounded-xl text-sm font-bold gap-2 bg-[#1a1d1f] hover:bg-[#292e31] text-white mt-2' disabled={submitting}>
                          {submitting ? <><RefreshCw className='w-4 h-4 animate-spin' /> Signing in...</> : 'Sign In to Portal'}
                        </Button>
                      </form>
                    ) : (
                      <form onSubmit={registerForm.handleSubmit(handleRegister)} className='space-y-4'>
                        <div>
                          <label className='text-xs font-semibold text-gray-700 mb-1.5 block'>Email Address <span className='text-red-400'>*</span></label>
                          <div className='relative'>
                            <Mail className='absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400' />
                            <Input type='email' placeholder='hr@yourcompany.com' {...registerForm.register('email')}
                              className='pl-9 h-11 rounded-xl border-gray-200 focus:border-[#F7A607] focus:ring-[#F7A607]/20' autoFocus />
                          </div>
                          {registerForm.formState.errors.email && <p className='text-xs text-red-500 mt-1'>{registerForm.formState.errors.email.message}</p>}
                        </div>
                        <div>
                          <label className='text-xs font-semibold text-gray-700 mb-1.5 block'>Password <span className='text-red-400'>*</span></label>
                          <div className='relative'>
                            <Lock className='absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400' />
                            <Input type={showPass ? 'text' : 'password'} placeholder='Min. 8 characters' {...registerForm.register('password')}
                              className='pl-9 pr-10 h-11 rounded-xl border-gray-200 focus:border-[#F7A607] focus:ring-[#F7A607]/20' />
                            <button type='button' onClick={() => setShowPass((v) => !v)} className='absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors'>
                              {showPass ? <EyeOff className='w-4 h-4' /> : <Eye className='w-4 h-4' />}
                            </button>
                          </div>
                          {registerForm.formState.errors.password && <p className='text-xs text-red-500 mt-1'>{registerForm.formState.errors.password.message}</p>}
                        </div>
                        <div>
                          <label className='text-xs font-semibold text-gray-700 mb-1.5 block'>Confirm Password <span className='text-red-400'>*</span></label>
                          <div className='relative'>
                            <Lock className='absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400' />
                            <Input type={showConf ? 'text' : 'password'} placeholder='Repeat your password' {...registerForm.register('confirmPassword')}
                              className='pl-9 pr-10 h-11 rounded-xl border-gray-200 focus:border-[#F7A607] focus:ring-[#F7A607]/20' />
                            <button type='button' onClick={() => setShowConf((v) => !v)} className='absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors'>
                              {showConf ? <EyeOff className='w-4 h-4' /> : <Eye className='w-4 h-4' />}
                            </button>
                          </div>
                          {registerForm.formState.errors.confirmPassword && <p className='text-xs text-red-500 mt-1'>{registerForm.formState.errors.confirmPassword.message}</p>}
                        </div>
                        <Button type='submit' size='lg' className='w-full h-11 rounded-xl text-sm font-bold gap-2 bg-[#F7A607] hover:bg-[#e09500] text-white mt-2 border-0' disabled={submitting}>
                          {submitting ? <><RefreshCw className='w-4 h-4 animate-spin' /> Creating account...</> : 'Continue to Company Details'}
                        </Button>
                      </form>
                    )}

                    <div className='mt-5 text-center text-xs text-gray-500'>
                      {mode === 'login' ? (
                        <>New recruiter?{' '}<button type='button' onClick={() => switchMode('register')} className='text-[#F7A607] font-bold hover:underline'>Register here</button></>
                      ) : (
                        <>Already have an account?{' '}<button type='button' onClick={() => switchMode('login')} className='text-[#F7A607] font-bold hover:underline'>Sign in</button></>
                      )}
                    </div>

                    <div className='hidden lg:flex items-center gap-2 mt-6 pt-5 border-t border-gray-100'>
                      <Shield className='w-3.5 h-3.5 text-gray-300 shrink-0' />
                      <p className='text-[10px] text-gray-400 leading-relaxed'>
                        For verified recruiters only · DGR Empanelled Platform · Ministry of Defence
                      </p>
                    </div>
                  </motion.div>
                )}

              </AnimatePresence>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
