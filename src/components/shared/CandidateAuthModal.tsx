import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  ArrowLeft,
  Phone,
  Shield,
  CheckCircle,
  User,
  MapPin,
  Briefcase,
  ChevronRight,
  RefreshCw,
} from 'lucide-react';
import companyLogo from '@/assets/company logo.png';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useAppStore } from '@/store/useAppStore';
import { toast } from '@/hooks/useToast';
import { sendOtp, verifyOtp } from '@/lib/api';
import { setToken } from '@/lib/tokenStore';

type Step = 'mobile' | 'otp' | 'profile' | 'success';

interface CandidateAuthModalProps {
  open: boolean;
  onClose: () => void;
  onBack: () => void;
  mode: 'login' | 'register';
}

const mobileSchema = z.object({
  mobile: z
    .string()
    .regex(/^[6-9]\d{9}$/, 'Enter a valid 10-digit Indian mobile number'),
});

const profileSchema = z.object({
  name: z.string().min(2, 'Name is required'),
  location: z.string().min(2, 'City is required'),
  jobTitle: z.string().min(2, 'Job title / role is required'),
  experience: z.string().min(1, 'Select experience'),
});

type MobileForm = z.infer<typeof mobileSchema>;
type ProfileForm = z.infer<typeof profileSchema>;

export function CandidateAuthModal({
  open,
  onClose,
  onBack,
  mode: initialMode,
}: CandidateAuthModalProps) {
  const navigate = useNavigate();
  const setUser = useAppStore((s) => s.setUser);

  const [mode, setMode] = useState<'login' | 'register'>(initialMode);
  const [step, setStep] = useState<Step>('mobile');

  // Sync when parent re-opens with a different mode
  useEffect(() => {
    setMode(initialMode);
  }, [initialMode]);
  const [mobile, setMobile] = useState('');
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [otpError, setOtpError] = useState('');
  const [resendTimer, setResendTimer] = useState(30);
  const [canResend, setCanResend] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [sendingOtp, setSendingOtp] = useState(false);
  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);

  const mobileForm = useForm<MobileForm>({
    resolver: zodResolver(mobileSchema),
  });
  const profileForm = useForm<ProfileForm>({
    resolver: zodResolver(profileSchema),
  });

  // Countdown timer for resend
  useEffect(() => {
    if (step === 'otp' && resendTimer > 0) {
      const timer = setTimeout(() => setResendTimer((t) => t - 1), 1000);
      return () => clearTimeout(timer);
    }
    if (resendTimer === 0) setCanResend(true);
  }, [step, resendTimer]);

  const handleSendOtp = async (formData: MobileForm) => {
    setSendingOtp(true);
    try {
      await sendOtp(formData.mobile);
      setMobile(formData.mobile);
      setResendTimer(30);
      setCanResend(false);
      setStep('otp');
      toast({
        title: 'OTP Sent!',
        description: `OTP sent to +91 ${formData.mobile}.`,
        variant: 'success',
      });
    } catch (err: any) {
      toast({
        title: 'Failed to send OTP',
        description: err.message || 'Please try again.',
        variant: 'error',
      });
    } finally {
      setSendingOtp(false);
    }
  };

  const handleOtpChange = (index: number, value: string) => {
    if (value.length > 1) {
      // Handle paste
      const digits = value.replace(/\D/g, '').slice(0, 6).split('');
      const newOtp = [...otp];
      digits.forEach((d, i) => {
        if (index + i < 6) newOtp[index + i] = d;
      });
      setOtp(newOtp);
      const nextEmpty = newOtp.findIndex((d) => !d);
      otpRefs.current[nextEmpty !== -1 ? nextEmpty : 5]?.focus();
      return;
    }
    if (!/^\d*$/.test(value)) return;
    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);
    setOtpError('');
    if (value && index < 5) otpRefs.current[index + 1]?.focus();
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
  };

  const handleVerifyOtp = async () => {
    const entered = otp.join('');
    if (entered.length < 6) {
      setOtpError('Enter the complete 6-digit OTP');
      return;
    }
    setVerifying(true);
    try {
      const result = await verifyOtp(mobile, entered);
      setVerifying(false);
      if (mode === 'register') {
        onClose();
        navigate('/candidate/register', { state: { mobile } });
      } else {
        if (result.exists && result.candidate) {
          const c = result.candidate;
          if (result.accessToken) setToken(result.accessToken);
          setUser({
            id: String(c.id),
            name: c.full_name,
            email: `${mobile}@candidate.ats`,
            role: 'candidate',
            avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${c.full_name}`,
            createdAt: new Date(c.created_at),
          });
          setStep('success');
          setTimeout(() => {
            onClose();
            navigate('/candidate/dashboard');
          }, 1200);
        } else {
          // No account found — send to register
          onClose();
          navigate('/candidate/register', { state: { mobile } });
        }
      }
    } catch (err: any) {
      setOtpError(err.message || 'Invalid OTP. Please try again.');
      setVerifying(false);
    }
  };

  const handleProfileSubmit = async (data: ProfileForm) => {
    await new Promise((r) => setTimeout(r, 700));
    setUser({
      id: 'c1',
      name: data.name,
      email: `${mobile}@candidate.ats`,
      role: 'candidate',
      avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${data.name}`,
      createdAt: new Date(),
    });
    setStep('success');
    setTimeout(() => {
      onClose();
      navigate('/candidate/dashboard');
    }, 1400);
  };

  const handleResend = async () => {
    if (!canResend) return;
    setCanResend(false);
    setResendTimer(30);
    setOtp(['', '', '', '', '', '']);
    setOtpError('');
    try {
      await sendOtp(mobile);
      toast({
        title: 'OTP Resent',
        description: `New OTP sent to +91 ${mobile}.`,
      });
    } catch (err: any) {
      toast({
        title: 'Failed to resend OTP',
        description: err.message || 'Please try again.',
        variant: 'error',
      });
    }
  };

  const handleClose = () => {
    setStep('mobile');
    setMode(initialMode);
    setOtp(['', '', '', '', '', '']);
    setOtpError('');
    mobileForm.reset();
    profileForm.reset();
    onClose();
  };

  const experienceLevels = [
    'Fresher',
    '0–1 yr',
    '1–3 yrs',
    '3–5 yrs',
    '5–10 yrs',
    '10+ yrs',
  ];

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className='max-w-[480px] p-0 overflow-hidden border-0 shadow-2xl rounded-3xl'>
        {/* Header */}
        <div className='bg-[#292e31] px-5 py-4 flex items-center gap-3'>
          <button
            onClick={step === 'mobile' ? onBack : () => setStep('mobile')}
            className='p-1.5 rounded-full hover:bg-white/10 text-white/70 hover:text-white transition-colors'
          >
            <ArrowLeft className='w-4 h-4' />
          </button>
          <div className='flex items-center gap-2 flex-1'>
            <img src={companyLogo} alt='Ex-Serviceman Jobs' className='w-7 h-7 object-contain' />
            <div>
              <p
                className='font-bold text-white text-sm'
                style={{ fontFamily: 'Plus Jakarta Sans' }}
              >
                {mode === 'login'
                  ? 'Candidate Login'
                  : 'Candidate Registration'}
              </p>
              <p className='text-xs text-gray-400'>Job seeker portal</p>
            </div>
          </div>
          <Badge className='bg-[#F7A607]/20 text-[#F7A607] border-[#F7A607]/30 text-xs'>
            For Job Seekers
          </Badge>
        </div>

        <div className='bg-white'>
          {/* Step indicator */}
          <div className='px-5 pt-4 pb-2'>
            <div className='flex items-center gap-2'>
              {(mode === 'register'
                ? ['Mobile', 'OTP', 'Details']
                : ['Mobile', 'OTP']
              ).map((s, i) => {
                const stepIndex = [
                  'mobile',
                  'otp',
                  'profile',
                  'success',
                ].indexOf(step);
                const isActive = i === stepIndex;
                const isDone = i < stepIndex;
                return (
                  <div key={s} className='flex items-center gap-2 flex-1'>
                    <div
                      className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-all shrink-0 ${
                        isDone
                          ? 'bg-green-500 text-white'
                          : isActive
                            ? 'bg-[#F7A607] text-white'
                            : 'bg-gray-100 text-gray-400'
                      }`}
                    >
                      {isDone ? <CheckCircle className='w-3.5 h-3.5' /> : i + 1}
                    </div>
                    <span
                      className={`text-xs font-medium ${isActive ? 'text-[#F7A607]' : isDone ? 'text-green-600' : 'text-gray-400'}`}
                    >
                      {s}
                    </span>
                    {i < (mode === 'register' ? 2 : 1) && (
                      <div
                        className={`flex-1 h-0.5 rounded-full ${isDone ? 'bg-green-400' : 'bg-gray-100'}`}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <AnimatePresence mode='wait'>
            {/* STEP: Mobile */}
            {step === 'mobile' && (
              <motion.div
                key='mobile'
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
                className='px-6 pt-4 pb-7'
              >
                <div className='flex items-center justify-center w-14 h-14 bg-[#F7A607]/10 rounded-2xl mx-auto mb-4'>
                  <Phone className='w-7 h-7 text-[#F7A607]' />
                </div>
                <h3
                  className='text-xl font-extrabold text-center text-[#242424] mb-1'
                  style={{ fontFamily: 'Plus Jakarta Sans' }}
                >
                  {mode === 'login' ? 'Welcome Back!' : 'Create Your Account'}
                </h3>
                <p className='text-sm text-gray-500 text-center mb-6'>
                  Enter your mobile number to receive an OTP
                </p>

                <form
                  onSubmit={mobileForm.handleSubmit(handleSendOtp)}
                  className='space-y-4'
                >
                  <div>
                    <label className='text-xs font-semibold text-gray-700 mb-1.5 block'>
                      Mobile Number *
                    </label>
                    <div className='flex gap-2'>
                      <div className='flex items-center gap-2 px-3 h-10 bg-gray-50 border border-gray-200 rounded-xl shrink-0'>
                        <span className='text-base'>🇮🇳</span>
                        <span className='text-sm font-semibold text-gray-700'>
                          +91
                        </span>
                      </div>
                      <Input
                        type='tel'
                        maxLength={10}
                        placeholder='9876543210'
                        {...mobileForm.register('mobile')}
                        className='flex-1'
                        autoFocus
                      />
                    </div>
                    {mobileForm.formState.errors.mobile && (
                      <p className='text-xs text-red-500 mt-1'>
                        {mobileForm.formState.errors.mobile.message}
                      </p>
                    )}
                  </div>

                  <Button
                    type='submit'
                    size='lg'
                    className='w-full gap-2'
                    disabled={sendingOtp}
                  >
                    {sendingOtp ? (
                      <span className='flex items-center gap-2'>
                        <RefreshCw className='w-4 h-4 animate-spin' /> Sending
                        OTP...
                      </span>
                    ) : (
                      <span className='flex items-center gap-2'>
                        Get OTP <ChevronRight className='w-4 h-4' />
                      </span>
                    )}
                  </Button>
                </form>

                {/* Skip button — for testing flow only */}
                <button
                  type='button'
                  onClick={() => {
                    onClose();
                    if (mode === 'register') {
                      navigate('/candidate/register', {
                        state: { mobile: '9999999999' },
                      });
                    } else {
                      const tempMobile = '9999999999';
                      setUser({
                        id: 'skip-test',
                        name: 'Test Candidate',
                        email: `${tempMobile}@candidate.ats`,
                        role: 'candidate',
                        avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=TestCandidate`,
                        createdAt: new Date(),
                      });
                      navigate('/candidate/dashboard');
                    }
                  }}
                  className='mt-4 w-full text-center text-xs text-gray-400 hover:text-gray-600 underline underline-offset-2 transition-colors'
                >
                  Skip for now (test mode)
                </button>

                {/* <div className='flex items-center gap-3 mt-4'>
                  <div className='flex-1 h-px bg-gray-100' />
                  <span className='text-xs text-gray-400'>
                    or continue with
                  </span>
                  <div className='flex-1 h-px bg-gray-100' />
                </div>

                <div className='grid grid-cols-2 gap-3 mt-4'>
                  <button className='flex items-center justify-center gap-2 h-10 rounded-xl border border-gray-200 hover:bg-gray-50 transition-colors text-sm text-gray-600 font-medium'>
                    <svg className='w-4 h-4' viewBox='0 0 24 24'>
                      <path
                        d='M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z'
                        fill='#4285F4'
                      />
                      <path
                        d='M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z'
                        fill='#34A853'
                      />
                      <path
                        d='M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z'
                        fill='#FBBC05'
                      />
                      <path
                        d='M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z'
                        fill='#EA4335'
                      />
                    </svg>
                    Google
                  </button>
                  <button className='flex items-center justify-center gap-2 h-10 rounded-xl border border-gray-200 hover:bg-gray-50 transition-colors text-sm text-gray-600 font-medium'>
                    <svg
                      className='w-4 h-4 text-[#0077B5]'
                      fill='currentColor'
                      viewBox='0 0 24 24'
                    >
                      <path d='M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z' />
                    </svg>
                    LinkedIn
                  </button>
                </div> */}

                {mode === 'login' && (
                  <p className='text-center text-xs text-gray-500 mt-4'>
                    New to Ex-Serviceman Jobs?{' '}
                    <button
                      type='button'
                      onClick={() => {
                        setMode('register');
                        setStep('mobile');
                        mobileForm.reset();
                      }}
                      className='text-[#F7A607] font-semibold hover:underline'
                    >
                      Register here
                    </button>
                  </p>
                )}

                {mode === 'register' && (
                  <p className='text-center text-xs text-gray-500 mt-4'>
                    Already have an account?{' '}
                    <button
                      type='button'
                      onClick={() => {
                        setMode('login');
                        setStep('mobile');
                        mobileForm.reset();
                      }}
                      className='text-[#F7A607] font-semibold hover:underline'
                    >
                      Login here
                    </button>
                  </p>
                )}
              </motion.div>
            )}

            {/* STEP: OTP */}
            {step === 'otp' && (
              <motion.div
                key='otp'
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
                className='px-6 pt-4 pb-7'
              >
                <div className='flex items-center justify-center w-14 h-14 bg-[#F7A607]/10 rounded-2xl mx-auto mb-4'>
                  <Shield className='w-7 h-7 text-[#F7A607]' />
                </div>
                <h3
                  className='text-xl font-extrabold text-center text-[#242424] mb-1'
                  style={{ fontFamily: 'Plus Jakarta Sans' }}
                >
                  Verify Your Number
                </h3>
                <p className='text-sm text-gray-500 text-center mb-1'>
                  OTP sent to{' '}
                  <span className='font-semibold text-gray-800'>
                    +91 {mobile}
                  </span>
                </p>
                <button
                  onClick={() => setStep('mobile')}
                  className='block text-xs text-[#F7A607] hover:underline text-center w-full mb-6'
                >
                  Change number
                </button>

                {/* OTP Inputs */}
                <div className='flex gap-2.5 justify-center mb-4'>
                  {otp.map((digit, i) => (
                    <input
                      key={i}
                      ref={(el) => {
                        otpRefs.current[i] = el;
                      }}
                      type='text'
                      inputMode='numeric'
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

                {otpError && (
                  <p className='text-xs text-red-500 text-center mb-3'>
                    {otpError}
                  </p>
                )}

                <Button
                  size='lg'
                  className='w-full gap-2 mb-4'
                  onClick={handleVerifyOtp}
                  disabled={verifying || otp.join('').length < 6}
                >
                  {verifying ? (
                    <span className='flex items-center gap-2'>
                      <RefreshCw className='w-4 h-4 animate-spin' />{' '}
                      Verifying...
                    </span>
                  ) : (
                    <span className='flex items-center gap-2'>
                      <CheckCircle className='w-4 h-4' /> Verify OTP
                    </span>
                  )}
                </Button>
                <div className='flex items-center justify-center gap-1.5'>
                  {canResend ? (
                    <button
                      onClick={handleResend}
                      className='text-sm text-[#F7A607] font-semibold hover:underline flex items-center gap-1'
                    >
                      <RefreshCw className='w-3.5 h-3.5' /> Resend OTP
                    </button>
                  ) : (
                    <p className='text-xs text-gray-400'>
                      Resend in{' '}
                      <span className='font-semibold text-gray-600'>
                        {resendTimer}s
                      </span>
                    </p>
                  )}
                </div>
              </motion.div>
            )}

            {/* STEP: Profile (register only) */}
            {step === 'profile' && (
              <motion.div
                key='profile'
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
                className='px-6 pt-4 pb-7'
              >
                <h3
                  className='text-xl font-extrabold text-[#242424] mb-1'
                  style={{ fontFamily: 'Plus Jakarta Sans' }}
                >
                  Complete Your Profile
                </h3>
                <p className='text-sm text-gray-500 mb-5'>
                  Just a few details to get started
                </p>

                <form
                  onSubmit={profileForm.handleSubmit(handleProfileSubmit)}
                  className='space-y-4'
                >
                  <div>
                    <label className='text-xs font-semibold text-gray-700 mb-1 block'>
                      Full Name *
                    </label>
                    <div className='relative'>
                      <User className='absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400' />
                      <Input
                        placeholder='Harshit Sharma'
                        {...profileForm.register('name')}
                        className='pl-9'
                        autoFocus
                      />
                    </div>
                    {profileForm.formState.errors.name && (
                      <p className='text-xs text-red-500 mt-1'>
                        {profileForm.formState.errors.name.message}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className='text-xs font-semibold text-gray-700 mb-1 block'>
                      Current City *
                    </label>
                    <div className='relative'>
                      <MapPin className='absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400' />
                      <Input
                        placeholder='Bangalore'
                        {...profileForm.register('location')}
                        className='pl-9'
                      />
                    </div>
                    {profileForm.formState.errors.location && (
                      <p className='text-xs text-red-500 mt-1'>
                        {profileForm.formState.errors.location.message}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className='text-xs font-semibold text-gray-700 mb-1 block'>
                      Job Title / Role *
                    </label>
                    <div className='relative'>
                      <Briefcase className='absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400' />
                      <Input
                        placeholder='Frontend Developer'
                        {...profileForm.register('jobTitle')}
                        className='pl-9'
                      />
                    </div>
                    {profileForm.formState.errors.jobTitle && (
                      <p className='text-xs text-red-500 mt-1'>
                        {profileForm.formState.errors.jobTitle.message}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className='text-xs font-semibold text-gray-700 mb-2 block'>
                      Experience *
                    </label>
                    <div className='flex flex-wrap gap-2'>
                      {experienceLevels.map((level) => {
                        const selected =
                          profileForm.watch('experience') === level;
                        return (
                          <button
                            key={level}
                            type='button'
                            onClick={() =>
                              profileForm.setValue('experience', level, {
                                shouldValidate: true,
                              })
                            }
                            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                              selected
                                ? 'bg-[#F7A607] border-[#F7A607] text-white shadow-sm'
                                : 'border-gray-200 text-gray-600 hover:border-[#F7A607] hover:text-[#F7A607]'
                            }`}
                          >
                            {level}
                          </button>
                        );
                      })}
                    </div>
                    {profileForm.formState.errors.experience && (
                      <p className='text-xs text-red-500 mt-1'>
                        {profileForm.formState.errors.experience.message}
                      </p>
                    )}
                  </div>

                  <Button
                    type='submit'
                    size='lg'
                    className='w-full gap-2 mt-2'
                    disabled={profileForm.formState.isSubmitting}
                  >
                    {profileForm.formState.isSubmitting ? (
                      <span className='flex items-center gap-2'>
                        <RefreshCw className='w-4 h-4 animate-spin' /> Creating
                        Account...
                      </span>
                    ) : (
                      <span className='flex items-center gap-2'>
                        Start Job Hunting! 🚀
                      </span>
                    )}
                  </Button>
                </form>
              </motion.div>
            )}

            {/* STEP: Success */}
            {step === 'success' && (
              <motion.div
                key='success'
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.35, type: 'spring' }}
                className='px-6 pt-6 pb-8 text-center'
              >
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.1, type: 'spring', stiffness: 300 }}
                  className='w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4'
                >
                  <CheckCircle className='w-10 h-10 text-green-500' />
                </motion.div>
                <h3
                  className='text-2xl font-extrabold text-[#242424] mb-2'
                  style={{ fontFamily: 'Plus Jakarta Sans' }}
                >
                  {mode === 'login' ? 'Welcome Back!' : 'Account Created!'}
                </h3>
                <p className='text-gray-500 text-sm mb-2'>
                  {mode === 'login'
                    ? 'Signed in successfully'
                    : 'Your candidate account is ready'}
                </p>
                <p className='text-xs text-gray-400'>
                  Redirecting to your dashboard...
                </p>
                <div className='mt-4 flex justify-center'>
                  <div className='w-8 h-1 bg-[#F7A607] rounded-full animate-pulse' />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </DialogContent>
    </Dialog>
  );
}
