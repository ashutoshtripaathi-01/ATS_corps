import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  ArrowLeft, Mail, Lock, Eye, EyeOff, CheckCircle, RefreshCw,
  Shield, Star, X, Award, Building2, UserCheck,
} from 'lucide-react';
import companyLogo from '@/assets/company logo.png';
import heroImage from '@/assets/cover.png';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAppStore } from '@/store/useAppStore';
import { toast } from '@/hooks/useToast';
import { candidateLogin, candidateCreateAccount } from '@/lib/api';
import { setToken } from '@/lib/tokenStore';

type Step = 'auth' | 'success';

interface CandidateAuthModalProps {
  open: boolean;
  onClose: () => void;
  onBack: () => void;
  mode: 'login' | 'register';
}

const loginSchema = z.object({
  email:    z.string().email('Enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
});

const registerSchema = z.object({
  email:           z.string().email('Enter a valid email address'),
  password:        z.string().min(8, 'Password must be at least 8 characters'),
  confirmPassword: z.string(),
}).refine((d) => d.password === d.confirmPassword, {
  message: 'Passwords do not match',
  path:    ['confirmPassword'],
});

type LoginForm    = z.infer<typeof loginSchema>;
type RegisterForm = z.infer<typeof registerSchema>;

/* ─── Left panel stats ───────────────────────────────────────────────────── */
const STATS = [
  { value: '500+', label: 'Verified\nCandidates',  icon: UserCheck },
  { value: '12+',  label: 'Partner\nOrganisations', icon: Building2 },
  { value: '95%',  label: 'Placement\nSuccess',     icon: Award },
];

export function CandidateAuthModal({
  open,
  onClose,
  onBack,
  mode: initialMode,
}: CandidateAuthModalProps) {
  const navigate = useNavigate();
  const setUser  = useAppStore((s) => s.setUser);

  const [mode, setMode]             = useState<'login' | 'register'>(initialMode);
  const [step, setStep]             = useState<Step>('auth');
  const [showPass, setShowPass]     = useState(false);
  const [showConf, setShowConf]     = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => { setMode(initialMode); }, [initialMode]);

  const loginForm = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
  });
  const registerForm = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
  });

  const handleLogin = async (data: LoginForm) => {
    setSubmitting(true);
    try {
      const result = await candidateLogin(data.email, data.password);
      if (result.accessToken) setToken(result.accessToken);
      const c = result.candidate;
      setUser({
        id:        String(c.id),
        name:      c.full_name || data.email.split('@')[0],
        email:     c.email,
        role:      'candidate',
        avatar:    `https://api.dicebear.com/7.x/avataaars/svg?seed=${c.email}`,
        createdAt: new Date(c.created_at),
      });
      setStep('success');
      setTimeout(() => { onClose(); navigate('/candidate/dashboard'); }, 1400);
    } catch (err: any) {
      toast({ title: 'Login failed', description: err.message || 'Invalid email or password', variant: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleRegister = async (data: RegisterForm) => {
    setSubmitting(true);
    try {
      const result = await candidateCreateAccount(data.email, data.password);
      if (result.accessToken) setToken(result.accessToken);
      const c = result.candidate;
      setUser({
        id:        String(c.id),
        name:      c.email.split('@')[0],
        email:     c.email,
        role:      'candidate',
        avatar:    `https://api.dicebear.com/7.x/avataaars/svg?seed=${c.email}`,
        createdAt: new Date(c.created_at),
      });
      onClose();
      navigate('/candidate/register', { state: { email: data.email } });
    } catch (err: any) {
      toast({ title: 'Registration failed', description: err.message || 'Please try again', variant: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    setStep('auth');
    setMode(initialMode);
    loginForm.reset();
    registerForm.reset();
    setShowPass(false);
    setShowConf(false);
    onClose();
  };

  const switchMode = (next: 'login' | 'register') => {
    setMode(next);
    loginForm.reset();
    registerForm.reset();
    setShowPass(false);
    setShowConf(false);
  };

  const handleDevSkip = () => {
    setToken('dev-bypass-token');
    setUser({
      id:        'dev-001',
      name:      'Dev Candidate',
      email:     'dev@bypass.local',
      role:      'candidate',
      avatar:    `https://api.dicebear.com/7.x/avataaars/svg?seed=dev`,
      createdAt: new Date(),
    });
    onClose();
    navigate('/candidate/dashboard');
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      {/*
        Mobile  → max-w-[440px] single-column card
        Desktop → max-w-[940px] two-column split layout
      */}
      <DialogContent className='max-w-[440px] lg:max-w-[940px] w-full p-0 overflow-hidden border-0 shadow-2xl rounded-3xl [&>button:last-child]:hidden'>
        <div className='flex h-full'>

          {/* ══════════════════════════════════════════════════════════════
              LEFT PANEL — desktop only, military hero
          ══════════════════════════════════════════════════════════════ */}
          <div className='hidden lg:flex lg:w-[420px] shrink-0 relative flex-col overflow-hidden'>

            {/* Soldier photo background */}
            <div
              className='absolute inset-0 bg-cover bg-center bg-no-repeat scale-105'
              style={{ backgroundImage: `url(${heroImage})` }}
            />

            {/* Multi-layer overlay for legibility */}
            <div className='absolute inset-0 bg-gradient-to-br from-[#0b1020]/96 via-[#1a1d1f]/88 to-[#1a1d1f]/80' />
            <div className='absolute inset-0 bg-gradient-to-t from-[#0b1020]/70 via-transparent to-transparent' />

            {/* Dot-grid texture */}
            <div
              className='absolute inset-0 opacity-[0.06]'
              style={{
                backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)',
                backgroundSize: '22px 22px',
              }}
            />

            {/* Gold vertical accent bar */}
            <div className='absolute top-0 left-0 w-[3px] h-full bg-gradient-to-b from-[#F7A607] via-[#F7A607]/60 to-transparent' />

            {/* Decorative large shield watermark */}
            <div className='absolute -bottom-12 -right-12 opacity-[0.04]'>
              <Shield className='w-72 h-72 text-white' />
            </div>

            {/* ── Content ── */}
            <div className='relative z-10 flex flex-col h-full px-8 py-8'>

              {/* Logo + brand */}
              <div className='flex items-center gap-3 mb-8'>
                <img src={companyLogo} alt='Ex-Serviceman Jobs' className='w-10 h-10 object-contain drop-shadow-lg' />
                <div>
                  <p className='font-extrabold text-white text-sm leading-tight' style={{ fontFamily: 'Plus Jakarta Sans' }}>
                    Ex-Serviceman Jobs
                  </p>
                  <p className='text-[10px] text-gray-400 mt-0.5'>Assam &amp; Northeast India</p>
                </div>
              </div>

              {/* DGR badge */}
              <div className='inline-flex items-center gap-2 bg-[#F7A607]/15 border border-[#F7A607]/30 rounded-full px-3 py-1.5 mb-6 w-fit'>
                <Shield className='w-3.5 h-3.5 text-[#F7A607]' />
                <span className='text-[10px] font-bold text-[#F7A607] uppercase tracking-widest'>DGR Empanelled · Ministry of Defence</span>
              </div>

              {/* Main headline */}
              <h2
                className='text-[28px] font-extrabold text-white leading-[1.15] mb-3'
                style={{ fontFamily: 'Plus Jakarta Sans', letterSpacing: '-0.3px' }}
              >
                Serving Those<br />
                Who <span className='text-[#F7A607]'>Served</span><br />
                The Nation
              </h2>
              <p className='text-sm text-gray-300 leading-relaxed mb-8'>
                India's premier ex-servicemen placement platform — connecting Army, Navy, Air Force &amp; Para-Military veterans with verified employers.
              </p>

              {/* Stats */}
              <div className='grid grid-cols-3 gap-2.5 mb-8'>
                {STATS.map(({ value, label, icon: Icon }) => (
                  <div key={value} className='bg-white/[0.07] border border-white/[0.1] rounded-2xl p-3 text-center backdrop-blur-sm'>
                    <div className='w-7 h-7 rounded-lg bg-[#F7A607]/20 flex items-center justify-center mx-auto mb-2'>
                      <Icon className='w-3.5 h-3.5 text-[#F7A607]' />
                    </div>
                    <p className='text-lg font-extrabold text-[#F7A607] leading-none' style={{ fontFamily: 'Plus Jakarta Sans' }}>
                      {value}
                    </p>
                    <p className='text-[9px] text-gray-400 mt-1 leading-tight whitespace-pre-line'>{label}</p>
                  </div>
                ))}
              </div>

              {/* Testimonial */}
              <div className='bg-white/[0.06] border border-white/[0.1] rounded-2xl p-4 mb-6 backdrop-blur-sm'>
                <div className='flex gap-0.5 mb-2.5'>
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star key={i} className='w-3 h-3 text-[#F7A607] fill-[#F7A607]' />
                  ))}
                </div>
                <p className='text-xs text-gray-300 leading-relaxed mb-3 italic'>
                  "Ex-Serviceman Jobs handled my verification and placement professionally. The process was smooth, transparent, and faster than I expected."
                </p>
                <div className='flex items-center gap-2.5'>
                  <div className='w-8 h-8 rounded-full bg-[#F7A607]/25 border border-[#F7A607]/40 flex items-center justify-center shrink-0'>
                    <span className='text-[10px] font-extrabold text-[#F7A607]'>RB</span>
                  </div>
                  <div>
                    <p className='text-xs font-bold text-white'>Rajiv Borah</p>
                    <p className='text-[10px] text-gray-500'>Ex-Army Havildar · Placed at HPCL Assam</p>
                  </div>
                  <span className='ml-auto text-[9px] font-bold bg-green-500/20 text-green-400 border border-green-500/30 px-2 py-0.5 rounded-full shrink-0'>
                    Army
                  </span>
                </div>
              </div>

              {/* Trust row */}
              <div className='flex flex-wrap gap-1.5'>
                {['Govt. of India', 'DGR Partner', 'Ministry of Defence', 'Official Job Fairs'].map((tag) => (
                  <span key={tag} className='text-[9px] font-semibold text-gray-400 bg-white/5 border border-white/10 px-2 py-1 rounded-full'>
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* ══════════════════════════════════════════════════════════════
              RIGHT PANEL — form (all screen sizes)
          ══════════════════════════════════════════════════════════════ */}
          <div className='flex-1 min-w-0 bg-white flex flex-col'>

            {/* ── Mobile header (hidden on desktop) ── */}
            <div className='lg:hidden bg-[#292e31] px-5 py-4 flex items-center gap-3'>
              <button
                onClick={step === 'auth' ? onBack : () => setStep('auth')}
                className='p-1.5 rounded-full hover:bg-white/10 text-white/70 hover:text-white transition-colors'
              >
                <ArrowLeft className='w-4 h-4' />
              </button>
              <div className='flex items-center gap-2 flex-1'>
                <img src={companyLogo} alt='Ex-Serviceman Jobs' className='w-7 h-7 object-contain' />
                <div>
                  <p className='font-bold text-white text-sm' style={{ fontFamily: 'Plus Jakarta Sans' }}>
                    {mode === 'login' ? 'Candidate Login' : 'Candidate Registration'}
                  </p>
                  <p className='text-xs text-gray-400'>Job seeker portal</p>
                </div>
              </div>
              <span className='bg-[#F7A607]/20 text-[#F7A607] border border-[#F7A607]/30 text-[10px] font-bold px-2 py-0.5 rounded-full'>
                For Job Seekers
              </span>
            </div>

            {/* ── Desktop header (hidden on mobile) ── */}
            <div className='hidden lg:flex items-center gap-3 px-8 py-5 border-b border-gray-100'>
              <div className='flex items-center gap-2'>
                <div className='w-8 h-8 rounded-xl bg-[#F7A607]/10 flex items-center justify-center'>
                  <Shield className='w-4 h-4 text-[#F7A607]' />
                </div>
                <div>
                  <p className='text-sm font-bold text-[#1a1d1f]' style={{ fontFamily: 'Plus Jakarta Sans' }}>
                    Candidate Portal
                  </p>
                  <p className='text-[10px] text-gray-400'>Ex-Serviceman Jobs · Secure Login</p>
                </div>
              </div>
              <button
                onClick={handleClose}
                className='ml-auto p-1.5 rounded-xl hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors'
              >
                <X className='w-4 h-4' />
              </button>
            </div>

            {/* ── Form area ── */}
            <div className='flex-1 overflow-y-auto px-6 lg:px-8 py-6 lg:py-7'>

              <AnimatePresence mode='wait'>

                {/* ─ Success screen ─ */}
                {step === 'success' && (
                  <motion.div
                    key='success'
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.35, type: 'spring' }}
                    className='flex flex-col items-center justify-center h-full py-8'
                  >
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ delay: 0.1, type: 'spring', stiffness: 300 }}
                      className='w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mb-5'
                    >
                      <CheckCircle className='w-10 h-10 text-green-500' />
                    </motion.div>
                    <h3 className='text-2xl font-extrabold text-[#242424] mb-2' style={{ fontFamily: 'Plus Jakarta Sans' }}>
                      Welcome Back!
                    </h3>
                    <p className='text-gray-500 text-sm mb-2'>Signed in successfully</p>
                    <p className='text-xs text-gray-400'>Redirecting to your dashboard...</p>
                    <div className='mt-5 flex justify-center'>
                      <div className='w-8 h-1 bg-[#F7A607] rounded-full animate-pulse' />
                    </div>
                  </motion.div>
                )}

                {/* ─ Auth step ─ */}
                {step === 'auth' && (
                  <motion.div
                    key={`auth-${mode}`}
                    initial={{ opacity: 0, x: 16 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -16 }}
                    transition={{ duration: 0.18 }}
                  >
                    {/* Desktop: tab switcher */}
                    <div className='hidden lg:flex bg-gray-100 rounded-2xl p-1 mb-7'>
                      {(['login', 'register'] as const).map((m) => (
                        <button
                          key={m}
                          onClick={() => switchMode(m)}
                          className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all duration-200 ${
                            mode === m
                              ? 'bg-white text-[#1a1d1f] shadow-sm'
                              : 'text-gray-400 hover:text-gray-600'
                          }`}
                        >
                          {m === 'login' ? 'Sign In' : 'Create Account'}
                        </button>
                      ))}
                    </div>

                    {/* Mobile: icon */}
                    <div className='flex items-center justify-center w-14 h-14 bg-[#F7A607]/10 rounded-2xl mx-auto mb-4 lg:hidden'>
                      <Mail className='w-7 h-7 text-[#F7A607]' />
                    </div>

                    {/* Heading */}
                    <h3
                      className='text-xl lg:text-2xl font-extrabold text-center lg:text-left text-[#1a1d1f] mb-1'
                      style={{ fontFamily: 'Plus Jakarta Sans' }}
                    >
                      {mode === 'login' ? 'Welcome Back!' : 'Create Your Account'}
                    </h3>
                    <p className='text-sm text-gray-500 text-center lg:text-left mb-6'>
                      {mode === 'login'
                        ? 'Sign in to access your candidate portal'
                        : 'Join Ex-Serviceman Jobs and start your journey'}
                    </p>

                    {/* ── Login form ── */}
                    {mode === 'login' ? (
                      <form onSubmit={loginForm.handleSubmit(handleLogin)} className='space-y-4'>
                        <div>
                          <label className='text-xs font-semibold text-gray-700 mb-1.5 block'>
                            Email Address <span className='text-red-400'>*</span>
                          </label>
                          <div className='relative'>
                            <Mail className='absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400' />
                            <Input
                              type='email'
                              placeholder='you@example.com'
                              {...loginForm.register('email')}
                              className='pl-9 h-11 rounded-xl border-gray-200 focus:border-[#F7A607] focus:ring-[#F7A607]/20'
                              autoFocus
                            />
                          </div>
                          {loginForm.formState.errors.email && (
                            <p className='text-xs text-red-500 mt-1'>{loginForm.formState.errors.email.message}</p>
                          )}
                        </div>

                        <div>
                          <label className='text-xs font-semibold text-gray-700 mb-1.5 block'>
                            Password <span className='text-red-400'>*</span>
                          </label>
                          <div className='relative'>
                            <Lock className='absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400' />
                            <Input
                              type={showPass ? 'text' : 'password'}
                              placeholder='Your password'
                              {...loginForm.register('password')}
                              className='pl-9 pr-10 h-11 rounded-xl border-gray-200 focus:border-[#F7A607] focus:ring-[#F7A607]/20'
                            />
                            <button
                              type='button'
                              onClick={() => setShowPass((v) => !v)}
                              className='absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors'
                            >
                              {showPass ? <EyeOff className='w-4 h-4' /> : <Eye className='w-4 h-4' />}
                            </button>
                          </div>
                          {loginForm.formState.errors.password && (
                            <p className='text-xs text-red-500 mt-1'>{loginForm.formState.errors.password.message}</p>
                          )}
                        </div>

                        <Button
                          type='submit'
                          size='lg'
                          className='w-full h-11 rounded-xl text-sm font-bold gap-2 bg-[#1a1d1f] hover:bg-[#292e31] text-white mt-2'
                          disabled={submitting}
                        >
                          {submitting
                            ? <><RefreshCw className='w-4 h-4 animate-spin' /> Signing in...</>
                            : 'Sign In to Portal'}
                        </Button>
                      </form>
                    ) : (
                      /* ── Register form ── */
                      <form onSubmit={registerForm.handleSubmit(handleRegister)} className='space-y-4'>
                        <div>
                          <label className='text-xs font-semibold text-gray-700 mb-1.5 block'>
                            Email Address <span className='text-red-400'>*</span>
                          </label>
                          <div className='relative'>
                            <Mail className='absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400' />
                            <Input
                              type='email'
                              placeholder='you@example.com'
                              {...registerForm.register('email')}
                              className='pl-9 h-11 rounded-xl border-gray-200 focus:border-[#F7A607] focus:ring-[#F7A607]/20'
                              autoFocus
                            />
                          </div>
                          {registerForm.formState.errors.email && (
                            <p className='text-xs text-red-500 mt-1'>{registerForm.formState.errors.email.message}</p>
                          )}
                        </div>

                        <div>
                          <label className='text-xs font-semibold text-gray-700 mb-1.5 block'>
                            Password <span className='text-red-400'>*</span>
                          </label>
                          <div className='relative'>
                            <Lock className='absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400' />
                            <Input
                              type={showPass ? 'text' : 'password'}
                              placeholder='Min. 8 characters'
                              {...registerForm.register('password')}
                              className='pl-9 pr-10 h-11 rounded-xl border-gray-200 focus:border-[#F7A607] focus:ring-[#F7A607]/20'
                            />
                            <button
                              type='button'
                              onClick={() => setShowPass((v) => !v)}
                              className='absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors'
                            >
                              {showPass ? <EyeOff className='w-4 h-4' /> : <Eye className='w-4 h-4' />}
                            </button>
                          </div>
                          {registerForm.formState.errors.password && (
                            <p className='text-xs text-red-500 mt-1'>{registerForm.formState.errors.password.message}</p>
                          )}
                        </div>

                        <div>
                          <label className='text-xs font-semibold text-gray-700 mb-1.5 block'>
                            Confirm Password <span className='text-red-400'>*</span>
                          </label>
                          <div className='relative'>
                            <Lock className='absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400' />
                            <Input
                              type={showConf ? 'text' : 'password'}
                              placeholder='Repeat your password'
                              {...registerForm.register('confirmPassword')}
                              className='pl-9 pr-10 h-11 rounded-xl border-gray-200 focus:border-[#F7A607] focus:ring-[#F7A607]/20'
                            />
                            <button
                              type='button'
                              onClick={() => setShowConf((v) => !v)}
                              className='absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors'
                            >
                              {showConf ? <EyeOff className='w-4 h-4' /> : <Eye className='w-4 h-4' />}
                            </button>
                          </div>
                          {registerForm.formState.errors.confirmPassword && (
                            <p className='text-xs text-red-500 mt-1'>{registerForm.formState.errors.confirmPassword.message}</p>
                          )}
                        </div>

                        <Button
                          type='submit'
                          size='lg'
                          className='w-full h-11 rounded-xl text-sm font-bold gap-2 bg-[#F7A607] hover:bg-[#e09500] text-white mt-2 border-0'
                          disabled={submitting}
                        >
                          {submitting
                            ? <><RefreshCw className='w-4 h-4 animate-spin' /> Creating account...</>
                            : 'Create Account & Continue'}
                        </Button>
                      </form>
                    )}

                    {/* Mode switcher */}
                    <div className='mt-5 text-center text-xs text-gray-500'>
                      {mode === 'login' ? (
                        <>New to Ex-Serviceman Jobs?{' '}
                          <button type='button' onClick={() => switchMode('register')} className='text-[#F7A607] font-bold hover:underline'>
                            Register here
                          </button>
                        </>
                      ) : (
                        <>Already have an account?{' '}
                          <button type='button' onClick={() => switchMode('login')} className='text-[#F7A607] font-bold hover:underline'>
                            Sign in
                          </button>
                        </>
                      )}
                    </div>

                    {/* Dev bypass — only visible in development */}
                    {import.meta.env.DEV && (
                      <div className='mt-4 text-center'>
                        <button
                          type='button'
                          onClick={handleDevSkip}
                          className='text-xs text-gray-400 hover:text-[#F7A607] transition-colors underline underline-offset-2'
                        >
                          Skip for now (dev mode)
                        </button>
                      </div>
                    )}

                    {/* Desktop trust strip */}
                    <div className='hidden lg:flex items-center gap-2 mt-6 pt-5 border-t border-gray-100'>
                      <Shield className='w-3.5 h-3.5 text-gray-300 shrink-0' />
                      <p className='text-[10px] text-gray-400 leading-relaxed'>
                        Exclusively for Ex-Servicemen of Northeast India · Verified platform · DGR Empanelled
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
  );
}
