import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  ArrowLeft, Phone, Shield, CheckCircle, Building2,
  ChevronRight, RefreshCw,
} from 'lucide-react'
import companyLogo from '@/assets/company logo.png'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { useAppStore } from '@/store/useAppStore'
import { toast } from '@/hooks/useToast'

type Step = 'mobile' | 'otp' | 'success'

interface EmployerAuthModalProps {
  open: boolean
  onClose: () => void
  onBack: () => void
  mode: 'login' | 'register'
}

const mobileSchema = z.object({
  mobile: z.string().regex(/^[6-9]\d{9}$/, 'Enter a valid 10-digit mobile number'),
})

type MobileForm = z.infer<typeof mobileSchema>

const DEMO_OTP = '123456'

export function EmployerAuthModal({ open, onClose, onBack, mode: initialMode }: EmployerAuthModalProps) {
  const navigate = useNavigate()
  const setUser = useAppStore((s) => s.setUser)

  const [mode, setMode] = useState<'login' | 'register'>(initialMode)
  const [step, setStep] = useState<Step>('mobile')
  const [mobile, setMobile] = useState('')
  const [otp, setOtp] = useState(['', '', '', '', '', ''])
  const [otpError, setOtpError] = useState('')
  const [resendTimer, setResendTimer] = useState(30)
  const [canResend, setCanResend] = useState(false)
  const [verifying, setVerifying] = useState(false)
  const [sendingOtp, setSendingOtp] = useState(false)
  const otpRefs = useRef<(HTMLInputElement | null)[]>([])

  useEffect(() => { setMode(initialMode) }, [initialMode])

  const mobileForm = useForm<MobileForm>({ resolver: zodResolver(mobileSchema) })

  useEffect(() => {
    if (step === 'otp' && resendTimer > 0) {
      const t = setTimeout(() => setResendTimer((v) => v - 1), 1000)
      return () => clearTimeout(t)
    }
    if (resendTimer === 0) setCanResend(true)
  }, [step, resendTimer])

  const handleSendOtp = async (data: MobileForm) => {
    setSendingOtp(true)
    await new Promise((r) => setTimeout(r, 900))
    setMobile(data.mobile)
    setResendTimer(30)
    setCanResend(false)
    setSendingOtp(false)
    setStep('otp')
    toast({ title: 'OTP Sent!', description: `Sent to +91 ${data.mobile}. Use 123456 for demo.`, variant: 'success' })
  }

  const handleOtpChange = (index: number, value: string) => {
    if (value.length > 1) {
      const digits = value.replace(/\D/g, '').slice(0, 6).split('')
      const newOtp = [...otp]
      digits.forEach((d, i) => { if (index + i < 6) newOtp[index + i] = d })
      setOtp(newOtp)
      const nextEmpty = newOtp.findIndex((d) => !d)
      otpRefs.current[nextEmpty !== -1 ? nextEmpty : 5]?.focus()
      return
    }
    if (!/^\d*$/.test(value)) return
    const newOtp = [...otp]
    newOtp[index] = value
    setOtp(newOtp)
    setOtpError('')
    if (value && index < 5) otpRefs.current[index + 1]?.focus()
  }

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) otpRefs.current[index - 1]?.focus()
  }

  const handleVerifyOtp = async () => {
    const entered = otp.join('')
    if (entered.length < 6) { setOtpError('Enter the complete 6-digit OTP'); return }
    setVerifying(true)
    await new Promise((r) => setTimeout(r, 1000))
    if (entered !== DEMO_OTP) {
      setOtpError('Incorrect OTP. Try 123456 for demo.')
      setVerifying(false)
      return
    }
    setVerifying(false)
    if (mode === 'login') {
      setUser({ id: 'emp1', name: 'Employer Admin', email: 'admin@company.com', role: 'employer', createdAt: new Date() })
      setStep('success')
      setTimeout(() => { handleClose(); navigate('/employer/dashboard') }, 1200)
    } else {
      onClose()
      navigate('/employer/register', { state: { mobile } })
    }
  }

  const handleClose = () => {
    setStep('mobile')
    setMode(initialMode)
    setOtp(['', '', '', '', '', ''])
    setOtpError('')
    mobileForm.reset()
    onClose()
  }

  const stepLabels = mode === 'register' ? ['Mobile', 'OTP', 'Details'] : ['Mobile', 'OTP']

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-[480px] p-0 overflow-hidden border-0 shadow-2xl rounded-3xl">
        {/* Header */}
        <div className="bg-[#292e31] px-5 py-4 flex items-center gap-3">
          <button
            onClick={step === 'mobile' ? onBack : () => setStep('mobile')}
            className="p-1.5 rounded-full hover:bg-white/10 text-white/70 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="flex items-center gap-2 flex-1">
            <img src={companyLogo} alt='Ex-Serviceman Jobs' className='w-7 h-7 object-contain' />
            <div>
              <p className="font-bold text-white text-sm" style={{ fontFamily: 'Plus Jakarta Sans' }}>
                {mode === 'login' ? 'Employer Login' : 'Employer Registration'}
              </p>
              <p className="text-xs text-gray-400">Hiring portal</p>
            </div>
          </div>
          <Badge className="bg-[#F7A607]/20 text-[#F7A607] border-[#F7A607]/30 text-xs">
            For Recruiters
          </Badge>
        </div>

        <div className="bg-white">
          {/* Step Indicator */}
          <div className="px-5 pt-4 pb-2">
            <div className="flex items-center gap-2">
              {stepLabels.map((s, i) => {
                const stepIndex = ['mobile', 'otp', 'company', 'success'].indexOf(step)
                const isActive = i === stepIndex
                const isDone = i < stepIndex
                return (
                  <div key={s} className="flex items-center gap-2 flex-1">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-all shrink-0 ${
                      isDone ? 'bg-green-500 text-white' : isActive ? 'bg-[#F7A607] text-white' : 'bg-gray-100 text-gray-400'
                    }`}>
                      {isDone ? <CheckCircle className="w-3.5 h-3.5" /> : i + 1}
                    </div>
                    <span className={`text-xs font-medium ${isActive ? 'text-[#F7A607]' : isDone ? 'text-green-600' : 'text-gray-400'}`}>{s}</span>
                    {i < stepLabels.length - 1 && <div className={`flex-1 h-0.5 rounded-full ${isDone ? 'bg-green-400' : 'bg-gray-100'}`} />}
                  </div>
                )
              })}
            </div>
          </div>

          <AnimatePresence mode="wait">
            {/* STEP: Mobile */}
            {step === 'mobile' && (
              <motion.div key="mobile" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.2 }} className="px-6 pt-4 pb-7">
                <div className="flex items-center justify-center w-14 h-14 bg-[#292e31]/10 rounded-2xl mx-auto mb-4">
                  <Building2 className="w-7 h-7 text-[#292e31]" />
                </div>
                <h3 className="text-xl font-extrabold text-center text-[#242424] mb-1" style={{ fontFamily: 'Plus Jakarta Sans' }}>
                  {mode === 'login' ? 'Employer Sign In' : 'Start Hiring Today'}
                </h3>
                <p className="text-sm text-gray-500 text-center mb-6">
                  Enter your mobile number to receive an OTP
                </p>

                <form onSubmit={mobileForm.handleSubmit(handleSendOtp)} className="space-y-4">
                  <div>
                    <label className="text-xs font-semibold text-gray-700 mb-1.5 block">Mobile Number *</label>
                    <div className="flex gap-2">
                      <div className="flex items-center gap-2 px-3 h-10 bg-gray-50 border border-gray-200 rounded-xl shrink-0">
                        <span className="text-base">🇮🇳</span>
                        <span className="text-sm font-semibold text-gray-700">+91</span>
                      </div>
                      <Input type="tel" maxLength={10} placeholder="9876543210" {...mobileForm.register('mobile')} className="flex-1" autoFocus />
                    </div>
                    {mobileForm.formState.errors.mobile && (
                      <p className="text-xs text-red-500 mt-1">{mobileForm.formState.errors.mobile.message}</p>
                    )}
                  </div>

                  <Button type="submit" size="lg" variant="dark" className="w-full gap-2" disabled={sendingOtp}>
                    {sendingOtp
                      ? <span className="flex items-center gap-2"><RefreshCw className="w-4 h-4 animate-spin" /> Sending OTP...</span>
                      : <span className="flex items-center gap-2">Get OTP <ChevronRight className="w-4 h-4" /></span>
                    }
                  </Button>
                  {/* DEV: remove before launch */}
                  <button
                    type="button"
                    onClick={() => { setMobile('9999999999'); setResendTimer(30); setCanResend(false); setStep('otp') }}
                    className="w-full mt-1 py-2.5 rounded-xl border-2 border-dashed border-orange-300 text-orange-500 text-sm font-bold bg-orange-50 hover:bg-orange-100 transition-all"
                  >
                    ⚡ Skip to OTP (Test Only)
                  </button>
                  {/* DEV: remove before launch */}
                </form>

                {mode === 'login' && (
                  <p className="text-center text-xs text-gray-500 mt-4">
                    New recruiter?{' '}
                    <button type="button" onClick={() => { setMode('register'); setStep('mobile'); mobileForm.reset() }}
                      className="text-[#F7A607] font-semibold hover:underline">Register here</button>
                  </p>
                )}
                {mode === 'register' && (
                  <p className="text-center text-xs text-gray-500 mt-4">
                    Already registered?{' '}
                    <button type="button" onClick={() => { setMode('login'); setStep('mobile'); mobileForm.reset() }}
                      className="text-[#F7A607] font-semibold hover:underline">Login here</button>
                  </p>
                )}

                {/* Stats strip */}
                <div className="mt-6 grid grid-cols-3 gap-3 text-center">
                  {[
                    { value: '38L+', label: 'Employers' },
                    { value: '3.5Cr', label: 'Job Seekers' },
                    { value: '48hr', label: 'Avg Match' },
                  ].map((s) => (
                    <div key={s.label} className="bg-gray-50 rounded-xl p-2.5">
                      <p className="font-extrabold text-sm text-[#292e31]">{s.value}</p>
                      <p className="text-[10px] text-gray-500 mt-0.5">{s.label}</p>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}

            {/* STEP: OTP */}
            {step === 'otp' && (
              <motion.div key="otp" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.2 }} className="px-6 pt-4 pb-7">
                <div className="flex items-center justify-center w-14 h-14 bg-[#F7A607]/10 rounded-2xl mx-auto mb-4">
                  <Shield className="w-7 h-7 text-[#F7A607]" />
                </div>
                <h3 className="text-xl font-extrabold text-center text-[#242424] mb-1" style={{ fontFamily: 'Plus Jakarta Sans' }}>
                  Verify Your Number
                </h3>
                <p className="text-sm text-gray-500 text-center mb-1">
                  OTP sent to <span className="font-semibold text-gray-800">+91 {mobile}</span>
                </p>
                <button onClick={() => setStep('mobile')} className="block text-xs text-[#F7A607] hover:underline text-center w-full mb-6">
                  Change number
                </button>

                <div className="flex gap-2.5 justify-center mb-4">
                  {otp.map((digit, i) => (
                    <input
                      key={i}
                      ref={(el) => { otpRefs.current[i] = el }}
                      type="text"
                      inputMode="numeric"
                      maxLength={6}
                      value={digit}
                      onChange={(e) => handleOtpChange(i, e.target.value)}
                      onKeyDown={(e) => handleOtpKeyDown(i, e)}
                      className={`w-11 h-12 text-center text-lg font-bold rounded-xl border-2 outline-none transition-all
                        ${digit ? 'border-[#F7A607] bg-[#F7A607]/5 text-[#292e31]' : 'border-gray-200 bg-gray-50 text-gray-900'}
                        focus:border-[#F7A607] focus:bg-[#F7A607]/5
                        ${otpError ? 'border-red-400 bg-red-50' : ''}
                      `}
                    />
                  ))}
                </div>

                {otpError && <p className="text-xs text-red-500 text-center mb-3">{otpError}</p>}

                <div className="flex items-center justify-center gap-1.5 bg-blue-50 rounded-xl px-3 py-2 mb-4">
                  <span className="text-blue-600 text-xs font-medium">Demo OTP: <strong>1 2 3 4 5 6</strong></span>
                </div>

                <Button size="lg" variant="dark" className="w-full gap-2 mb-2" onClick={handleVerifyOtp} disabled={verifying || otp.join('').length < 6}>
                  {verifying
                    ? <span className="flex items-center gap-2"><RefreshCw className="w-4 h-4 animate-spin" /> Verifying...</span>
                    : <span className="flex items-center gap-2"><CheckCircle className="w-4 h-4" /> Verify OTP</span>
                  }
                </Button>
                {/* DEV: remove before launch */}
                <button
                  type="button"
                  onClick={() => {
                    if (mode === 'register') { onClose(); navigate('/employer/register', { state: { mobile: mobile || '9999999999' } }) }
                    else { setUser({ id: 'emp1', name: 'Employer Admin', email: 'admin@company.com', role: 'employer', createdAt: new Date() }); setStep('success'); setTimeout(() => { handleClose(); navigate('/employer/dashboard') }, 1200) }
                  }}
                  className="w-full mb-4 py-2.5 rounded-xl border-2 border-dashed border-orange-300 text-orange-500 text-sm font-bold bg-orange-50 hover:bg-orange-100 transition-all"
                >
                  ⚡ Skip OTP Verify (Test Only)
                </button>
                {/* DEV: remove before launch */}

                <div className="flex items-center justify-center gap-1.5">
                  {canResend
                    ? <button onClick={() => { setCanResend(false); setResendTimer(30); setOtp(['','','','','','']); setOtpError('') }} className="text-sm text-[#F7A607] font-semibold hover:underline flex items-center gap-1"><RefreshCw className="w-3.5 h-3.5" /> Resend OTP</button>
                    : <p className="text-xs text-gray-400">Resend in <span className="font-semibold text-gray-600">{resendTimer}s</span></p>
                  }
                </div>
              </motion.div>
            )}

            {/* STEP: Success */}
            {step === 'success' && (
              <motion.div key="success" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.35, type: 'spring' }} className="px-6 pt-6 pb-8 text-center">
                <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.1, type: 'spring', stiffness: 300 }}
                  className="w-20 h-20 bg-[#F7A607]/10 rounded-full flex items-center justify-center mx-auto mb-4"
                >
                  <CheckCircle className="w-10 h-10 text-[#F7A607]" />
                </motion.div>
                <h3 className="text-2xl font-extrabold text-[#242424] mb-2" style={{ fontFamily: 'Plus Jakarta Sans' }}>
                  {mode === 'login' ? 'Welcome Back!' : 'Account Ready!'}
                </h3>
                <p className="text-gray-500 text-sm mb-2">
                  {mode === 'login' ? 'Signed in as Employer' : 'Your employer account is active'}
                </p>
                <p className="text-xs text-gray-400">Redirecting to your dashboard...</p>
                <div className="mt-4 flex justify-center">
                  <div className="w-8 h-1 bg-[#F7A607] rounded-full animate-pulse" />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </DialogContent>
    </Dialog>
  )
}
