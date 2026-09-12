import { useEffect, useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, CreditCard, MapPin, Shield, CheckCircle, User, Briefcase,
  Lock, ChevronRight, Zap, Award, Star, AlertCircle, XCircle, RefreshCw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAppStore } from '@/store/useAppStore';
import { toast } from '@/hooks/useToast';
import { createPaymentOrder, verifyPayment } from '@/lib/api';
import { setToken } from '@/lib/tokenStore';
import companyLogo from '@/assets/company logo.png';

export interface CandidatePaymentState {
  mobile: string;
  fullName: string;
  rank: string;
  force: string;
  post: string;
  loc1: string;
  loc2?: string;
  loc3?: string;
  applicationFee: number;
  unit: string;
  retirementDate: string;
  otherPost?: string;
  gunLicense?: string;
}

type Screen = 'pay' | 'processing' | 'success' | 'failed' | 'cancelled';

interface VerifyResult {
  candidate: {
    id: number;
    email?: string;
    registration_ref?: string;
    payment_status: string;
  };
  accessToken: string;
}

/* ─────────────────────────────────────────────────────────────────── */

export default function CandidatePayment() {
  const navigate = useNavigate();
  const location = useLocation();
  const { setUser } = useAppStore();

  const state = location.state as CandidatePaymentState | null;

  const [screen,       setScreen]       = useState<Screen>('pay');
  const [rzpReady,     setRzpReady]     = useState(false);
  const [paying,       setPaying]       = useState(false);
  const [paymentError, setPaymentError] = useState('');
  const [verifyResult, setVerifyResult] = useState<VerifyResult | null>(null);

  /**
   * Set to true when the user actually submits payment inside the Razorpay
   * modal (handler fires).  Lets us distinguish:
   *   false + ondismiss  →  user cancelled before paying  →  'cancelled'
   *   true  + ondismiss  →  modal closed after payment    →  wait for handler
   *   true  + error      →  payment sent but verify failed  →  'failed' w/ warning
   */
  const paymentSubmittedRef = useRef(false);

  /* redirect if no registration state was passed */
  useEffect(() => {
    if (!state) navigate('/candidate/register', { replace: true });
  }, [state, navigate]);

  /* load Razorpay checkout.js */
  useEffect(() => {
    if (document.getElementById('rzp-script')) { setRzpReady(true); return; }
    const s = document.createElement('script');
    s.id    = 'rzp-script';
    s.src   = 'https://checkout.razorpay.com/v1/checkout.js';
    s.async = true;
    s.onload  = () => setRzpReady(true);
    s.onerror = () => {
      toast({ title: 'Could not load payment SDK', description: 'Check your internet connection and try again.', variant: 'error' });
    };
    document.head.appendChild(s);
  }, []);

  /* ── verify payment + update store ── */
  const finalizeRegistration = async (payment: {
    razorpay_order_id: string;
    razorpay_payment_id: string;
    razorpay_signature: string;
  }): Promise<VerifyResult | null> => {
    if (!state) return null;
    try {
      const result = (await verifyPayment(payment)) as VerifyResult & { success: boolean };
      if (result.accessToken) setToken(result.accessToken);
      setUser({
        id:        String(result.candidate.id),
        name:      state.fullName,
        email:     result.candidate.email || `${state.mobile}@candidate.ats`,
        role:      'candidate',
        avatar:    `https://api.dicebear.com/7.x/avataaars/svg?seed=${state.fullName}`,
        createdAt: new Date(),
      });
      return result;
    } catch (err: any) {
      console.error('[Payment] verify failed:', err.message);
      return null;
    }
  };

  /* ── open Razorpay checkout ── */
  const handlePay = async () => {
    if (!state || paying) return;

    // Dev-time guard: log the key prefix so you can verify it's rzp_live_*
    if (import.meta.env.DEV) {
      const keyId = import.meta.env.VITE_RAZORPAY_KEY_ID as string | undefined;
      console.log('[Razorpay] key prefix:', keyId ? keyId.slice(0, 12) + '…' : '⚠️  VITE_RAZORPAY_KEY_ID is missing');
    }

    setPaying(true);
    paymentSubmittedRef.current = false;
    setScreen('processing');
    setPaymentError('');

    // Step 1: create order on backend
    let order: { orderId: string; amount: number; currency: string };
    try {
      order = await createPaymentOrder();
    } catch (err: any) {
      setPaymentError(err.message || 'Failed to create payment order. Please try again.');
      setScreen('failed');
      setPaying(false);
      return;
    }

    // Step 2: open Razorpay checkout with direct callbacks (no Promise wrapping)
    const rzp = new (window as any).Razorpay({
      key:         import.meta.env.VITE_RAZORPAY_KEY_ID as string,
      amount:      order.amount,
      currency:    order.currency,
      order_id:    order.orderId,
      name:        'Ex-Serviceman Jobs',
      description: 'One-time Registration Fee',
      prefill:     { name: state.fullName, contact: state.mobile },
      theme:       { color: '#F7A607' },

      /* Fires when the user successfully completes payment inside Razorpay */
      handler: async (response: {
        razorpay_order_id: string;
        razorpay_payment_id: string;
        razorpay_signature: string;
      }) => {
        paymentSubmittedRef.current = true;
        try {
          const result = await finalizeRegistration(response);
          if (result) {
            setVerifyResult(result);
            setScreen('success');
          } else {
            setPaymentError(
              'Your payment was received but we could not confirm registration. ' +
              'Please do not pay again — contact support with your registered mobile number.',
            );
            setScreen('failed');
          }
        } catch {
          setPaymentError(
            'Payment confirmed by Razorpay but our server could not verify it. ' +
            'Do not retry — contact support.',
          );
          setScreen('failed');
        } finally {
          setPaying(false);
        }
      },

      modal: {
        /**
         * ondismiss fires when:
         * (a) user manually closes the checkout popup, OR
         * (b) Razorpay closes it automatically (after success, or on certain errors)
         *
         * We use paymentSubmittedRef to tell these cases apart.
         */
        ondismiss: () => {
          if (!paymentSubmittedRef.current) {
            // User closed without paying — show the non-alarming cancelled screen
            setScreen('cancelled');
            setPaying(false);
          }
          // If paymentSubmittedRef is true, the async handler above is running
          // and will set the correct screen (success / failed) — don't interfere.
        },
        backdropclose: false, // prevent accidental close by clicking outside
        escape:        false, // prevent escape-key close
        animation:     true,
      },
    });

    /* Payment failure within Razorpay (card declined, bank error, etc.)
       Razorpay shows a retry UI inside the modal — we just log this.
       ondismiss will fire when the user eventually closes the modal. */
    rzp.on('payment.failed', (response: any) => {
      console.warn('[Razorpay] payment.failed:', response?.error?.description ?? response);
    });

    rzp.open();
  };

  const resetToPay = () => {
    setScreen('pay');
    setPaying(false);
    paymentSubmittedRef.current = false;
    setPaymentError('');
  };

  if (!state) return null;

  /* ══════════════════════════════════════════════════════════
      SUCCESS SCREEN
  ══════════════════════════════════════════════════════════ */
  if (screen === 'success') {
    const candidateId = verifyResult?.candidate?.id;
    const regRef =
      verifyResult?.candidate?.registration_ref ??
      (candidateId ? `ATS-${String(candidateId).padStart(5, '0')}` : '—');

    return (
      <div className='min-h-screen bg-gradient-to-br from-[#f0fdf4] to-[#f8faff] flex items-center justify-center px-4 py-12'>
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4 }} className='w-full max-w-lg'>

          <div className='flex justify-center mb-8'>
            <div className='relative'>
              <motion.div initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.15, type: 'spring', stiffness: 220, damping: 15 }}
                className='w-28 h-28 bg-green-500 rounded-full flex items-center justify-center shadow-2xl shadow-green-500/30'>
                <CheckCircle className='w-14 h-14 text-white' />
              </motion.div>
              <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}
                transition={{ delay: 0.4, type: 'spring' }}
                className='absolute -top-1 -right-1 w-7 h-7 bg-[#F7A607] rounded-full flex items-center justify-center shadow-lg'>
                <Star className='w-3.5 h-3.5 text-white fill-white' />
              </motion.div>
            </div>
          </div>

          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }} className='text-center mb-6'>
            <h1 className='text-3xl font-extrabold text-gray-900 mb-2' style={{ fontFamily: 'Plus Jakarta Sans' }}>
              Registration Complete!
            </h1>
            <p className='text-gray-500 text-sm'>
              ₹{state.applicationFee.toLocaleString()} received · Welcome to ATS Corps
            </p>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className='bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden mb-5'>

            <div className='bg-[#1a1d1f] px-6 py-4 flex items-center justify-between'>
              <div>
                <p className='text-xs text-gray-400'>Registration Reference</p>
                <p className='text-sm font-bold text-[#F7A607] mt-0.5 tracking-wider'>{regRef}</p>
              </div>
              <div className='text-right'>
                <p className='text-xs text-gray-400'>Amount Paid</p>
                <p className='text-xl font-extrabold text-white'>₹{state.applicationFee.toLocaleString()}</p>
              </div>
            </div>

            <div className='p-5 space-y-3'>
              {[
                { label: 'Account created',                done: true },
                { label: 'Profile & service details saved', done: true },
                { label: 'Documents uploaded',              done: true },
                { label: 'Registration fee paid',           done: true },
                { label: 'Document verification',           done: false, pending: true },
              ].map(({ label, done, pending }) => (
                <div key={label} className='flex items-center gap-3'>
                  {done
                    ? <CheckCircle className='w-4 h-4 text-green-500 shrink-0' />
                    : <div className='w-4 h-4 rounded-full border-2 border-dashed border-amber-400 shrink-0' />
                  }
                  <span className={`text-sm flex-1 leading-tight ${done ? 'text-gray-800 font-medium' : 'text-gray-400'}`}>
                    {label}
                  </span>
                  {pending && <span className='text-xs text-amber-500 font-semibold shrink-0'>Pending</span>}
                </div>
              ))}
            </div>

            <div className='px-5 pb-5'>
              <div className='bg-amber-50 border border-amber-100 rounded-2xl p-4 space-y-2'>
                <p className='text-xs font-bold text-amber-700 uppercase tracking-wide'>What happens next?</p>
                <p className='text-xs text-gray-600 leading-relaxed'>
                  Our verification team will review your service documents (typically within 2–3 business days).
                  Once verified, your profile will be visible to employers matching your preferences.
                </p>
              </div>
            </div>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}>
            <Button size='lg' className='w-full rounded-2xl text-sm font-bold h-13 gap-2'
              onClick={() => navigate('/candidate/dashboard', { replace: true })}>
              Go to Dashboard <ChevronRight className='w-4 h-4' />
            </Button>
            <p className='text-center text-xs text-gray-400 mt-3'>
              Confirmation will be sent to your registered mobile number.
            </p>
          </motion.div>
        </motion.div>
      </div>
    );
  }

  /* ══════════════════════════════════════════════════════════
      CANCELLED SCREEN
  ══════════════════════════════════════════════════════════ */
  if (screen === 'cancelled') {
    return (
      <div className='min-h-screen bg-gray-50 flex items-center justify-center px-4 py-12'>
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.35 }} className='w-full max-w-md text-center'>
          <div className='w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6'>
            <XCircle className='w-10 h-10 text-gray-400' />
          </div>
          <h2 className='text-2xl font-extrabold text-gray-900 mb-2' style={{ fontFamily: 'Plus Jakarta Sans' }}>
            Payment not completed
          </h2>
          <p className='text-sm text-gray-500 mb-2'>You closed the payment window before completing.</p>
          <p className='text-sm text-gray-500 mb-8'>
            Your registration details are saved — you can complete payment whenever you're ready.
          </p>
          <div className='space-y-3'>
            <Button size='lg' className='w-full rounded-xl text-sm font-bold gap-2' onClick={resetToPay}>
              <CreditCard className='w-4 h-4' /> Complete Payment
            </Button>
            <button type='button' onClick={() => navigate('/candidate/register', { replace: true })}
              className='w-full h-11 rounded-xl border border-gray-200 bg-white text-sm font-semibold text-gray-600
                hover:bg-gray-50 transition-colors flex items-center justify-center gap-2'>
              <ArrowLeft className='w-4 h-4' /> Back to Registration
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  /* ══════════════════════════════════════════════════════════
      FAILED SCREEN
  ══════════════════════════════════════════════════════════ */
  if (screen === 'failed') {
    const possiblyCharged = paymentSubmittedRef.current;
    return (
      <div className='min-h-screen bg-gray-50 flex items-center justify-center px-4 py-12'>
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.35 }} className='w-full max-w-md text-center'>
          <div className='w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-6'>
            <AlertCircle className='w-10 h-10 text-red-400' />
          </div>
          <h2 className='text-2xl font-extrabold text-gray-900 mb-2' style={{ fontFamily: 'Plus Jakarta Sans' }}>
            Payment wasn't completed
          </h2>

          {possiblyCharged ? (
            <div className='bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-6 text-left'>
              <p className='text-sm font-semibold text-amber-800 mb-1'>⚠️ Your payment may have been deducted</p>
              <p className='text-xs text-amber-700 leading-relaxed'>
                {paymentError || 'We received your payment but could not confirm registration.'}
              </p>
              <p className='text-xs text-amber-600 mt-2 font-medium'>
                Please do not pay again. Contact support with your registered mobile number.
              </p>
            </div>
          ) : (
            <p className='text-sm text-gray-500 mb-6 leading-relaxed'>
              {paymentError || 'Something went wrong. No amount was charged. Please try again.'}
            </p>
          )}

          <div className='space-y-3'>
            {!possiblyCharged && (
              <Button size='lg' className='w-full rounded-xl text-sm font-bold gap-2' onClick={resetToPay}>
                <RefreshCw className='w-4 h-4' /> Try Payment Again
              </Button>
            )}
            <button type='button' onClick={() => navigate('/candidate/register', { replace: true })}
              className='w-full h-11 rounded-xl border border-gray-200 bg-white text-sm font-semibold text-gray-600
                hover:bg-gray-50 transition-colors flex items-center justify-center gap-2'>
              <ArrowLeft className='w-4 h-4' /> Return to Review
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  /* ══════════════════════════════════════════════════════════
      PAY / PROCESSING SCREEN — split layout on desktop
  ══════════════════════════════════════════════════════════ */
  return (
    <div className='min-h-screen lg:h-screen flex flex-col lg:flex-row overflow-hidden'>

      {/* ── LEFT PANEL: dark order summary ── */}
      <div className='bg-[#1a1d1f] lg:w-[400px] xl:w-[440px] shrink-0 flex flex-col lg:sticky lg:top-0 lg:h-screen lg:overflow-y-auto'>
        <div className='h-1 w-full bg-gradient-to-r from-[#F7A607] via-[#ffcc55] to-[#F7A607] shrink-0' />

        <div className='px-7 pt-6 pb-5 border-b border-white/8 flex items-center gap-3'>
          <img src={companyLogo} alt='Ex-Serviceman Jobs' className='w-9 h-9 object-contain' />
          <div>
            <p className='font-extrabold text-white text-sm leading-tight' style={{ fontFamily: 'Plus Jakarta Sans' }}>
              Ex-Serviceman Jobs
            </p>
            <p className='text-[10px] text-gray-500 mt-0.5'>Secure Checkout</p>
          </div>
          <button onClick={() => navigate(-1)} aria-label='Go back'
            className='ml-auto w-8 h-8 rounded-xl bg-white/8 flex items-center justify-center hover:bg-white/12 transition-colors lg:hidden'>
            <ArrowLeft className='w-4 h-4 text-gray-400' />
          </button>
        </div>

        <div className='px-7 py-7 flex-1'>
          <div className='mb-7'>
            <p className='text-xs text-gray-500 mb-1 uppercase tracking-wider font-medium'>Registration Fee</p>
            <div className='flex items-baseline gap-2'>
              <span className='text-5xl font-black text-white'>₹{state.applicationFee.toLocaleString()}</span>
              <span className='text-sm text-gray-500'>one-time</span>
            </div>
            <div className='inline-flex items-center gap-1.5 mt-3 bg-[#F7A607]/15 border border-[#F7A607]/25 text-[#F7A607] text-xs font-semibold px-3 py-1.5 rounded-full'>
              <Zap className='w-3 h-3' /> One-time registration fee · Non-refundable
            </div>
          </div>

          <div className='h-px bg-white/8 mb-6' />

          <p className='text-[10px] font-bold text-gray-600 uppercase tracking-widest mb-4'>Application Summary</p>
          <div className='space-y-3'>
            {[
              { icon: User,      label: 'Applicant',    value: state.fullName },
              { icon: Shield,    label: 'Rank & Force', value: `${state.rank}, ${state.force}` },
              { icon: Briefcase, label: 'Post Applied',  value: state.post },
              { icon: MapPin,    label: 'Priority 1',   value: state.loc1 },
              ...(state.loc2 ? [{ icon: MapPin, label: 'Priority 2', value: state.loc2 }] : []),
              ...(state.loc3 ? [{ icon: MapPin, label: 'Priority 3', value: state.loc3 }] : []),
            ].map(({ icon: Icon, label, value }) => (
              <div key={label} className='flex items-start gap-3'>
                <div className='w-7 h-7 rounded-lg bg-white/6 flex items-center justify-center shrink-0 mt-0.5'>
                  <Icon className='w-3.5 h-3.5 text-gray-400' />
                </div>
                <div className='flex-1 min-w-0 flex justify-between items-start gap-2'>
                  <span className='text-xs text-gray-500 shrink-0'>{label}</span>
                  <span className='text-xs font-semibold text-white text-right truncate max-w-[55%]'>{value}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className='px-7 pb-7 pt-5 border-t border-white/8 space-y-2.5'>
          <div className='flex items-center gap-2'>
            <Lock  className='w-3.5 h-3.5 text-green-400 shrink-0' />
            <span className='text-xs text-gray-500'>256-bit SSL · Secured by Razorpay</span>
          </div>
          <div className='flex items-center gap-2'>
            <Shield className='w-3.5 h-3.5 text-[#F7A607] shrink-0' />
            <span className='text-xs text-gray-500'>DGR Empanelled Partner</span>
          </div>
          <div className='flex items-center gap-2'>
            <Award className='w-3.5 h-3.5 text-blue-400 shrink-0' />
            <span className='text-xs text-gray-500'>Ministry of Defence, Govt. of India</span>
          </div>
        </div>
      </div>

      {/* ── RIGHT PANEL: pay action ── */}
      <div className='flex-1 bg-gray-50 flex flex-col lg:overflow-y-auto'>

        <div className='hidden lg:flex items-center gap-3 px-10 py-5 bg-white border-b border-gray-100'>
          <button onClick={() => navigate(-1)} aria-label='Go back'
            className='w-9 h-9 rounded-xl border border-gray-200 flex items-center justify-center hover:bg-gray-50 transition-colors'>
            <ArrowLeft className='w-4 h-4 text-gray-600' />
          </button>
          <div>
            <p className='text-sm font-bold text-gray-900'>Complete Your Payment</p>
            <p className='text-xs text-gray-400 mt-0.5'>Step 4 of 4 · Registration</p>
          </div>
        </div>

        <div className='flex-1 flex flex-col justify-center px-6 lg:px-12 xl:px-20 py-8 max-w-2xl lg:max-w-none mx-auto w-full'>
          <AnimatePresence mode='wait'>
            {screen === 'processing' ? (
              <motion.div key='processing'
                initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
                className='flex flex-col items-center justify-center text-center py-16 gap-5'>
                <div className='w-20 h-20 rounded-full bg-[#F7A607]/10 flex items-center justify-center'>
                  <div className='w-10 h-10 border-4 border-[#F7A607]/30 border-t-[#F7A607] rounded-full animate-spin' />
                </div>
                <div>
                  <p className='text-lg font-bold text-gray-900'>Opening Razorpay…</p>
                  <p className='text-sm text-gray-400 mt-1'>Complete the payment in the popup window</p>
                  <button type='button' onClick={resetToPay}
                    className='mt-4 text-xs text-gray-400 underline hover:text-gray-600'>
                    Popup didn't open? Click here to retry
                  </button>
                </div>
              </motion.div>
            ) : (
              <motion.div key='pay'
                initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }}
                className='space-y-6'>

                <div>
                  <h2 className='text-xl font-extrabold text-gray-900' style={{ fontFamily: 'Plus Jakarta Sans' }}>
                    Almost there!
                  </h2>
                  <p className='text-sm text-gray-500 mt-1'>
                    Review your details on the left, then click below to open the secure payment window.
                    You can pay via UPI, card, net banking, or wallet.
                  </p>
                </div>

                {/* Mobile order recap */}
                <div className='lg:hidden bg-white rounded-2xl border border-gray-100 p-4 flex items-center justify-between'>
                  <div>
                    <p className='text-xs text-gray-400'>You are paying</p>
                    <p className='text-2xl font-black text-gray-900'>₹{state.applicationFee.toLocaleString()}</p>
                  </div>
                  <div className='text-right'>
                    <p className='text-xs text-gray-400'>{state.fullName}</p>
                    <p className='text-xs font-semibold text-gray-700 mt-0.5'>{state.loc1}</p>
                  </div>
                </div>

                {/* Pay button */}
                <div className='space-y-3'>
                  <button onClick={handlePay} disabled={!rzpReady || paying}
                    aria-label={`Pay ₹${state.applicationFee} and complete registration`}
                    className='w-full h-14 rounded-2xl bg-[#F7A607] hover:bg-[#e09500] active:scale-[0.99]
                      disabled:opacity-60 disabled:cursor-not-allowed transition-all text-white font-bold text-base
                      flex items-center justify-center gap-3 shadow-xl shadow-[#F7A607]/25
                      focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F7A607]/60'>
                    {paying ? (
                      <>
                        <div className='w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin' />
                        Opening payment…
                      </>
                    ) : (
                      <>
                        <CreditCard className='w-5 h-5' />
                        Confirm Details & Pay ₹{state.applicationFee.toLocaleString()}
                        <ChevronRight className='w-5 h-5 ml-1' />
                      </>
                    )}
                  </button>

                  <div className='flex items-center justify-center gap-6 py-1 flex-wrap'>
                    <div className='flex items-center gap-1.5 text-xs text-gray-400'>
                      <Lock className='w-3.5 h-3.5 text-green-500' /> SSL Encrypted
                    </div>
                    <div className='w-px h-4 bg-gray-200 hidden sm:block' />
                    <div className='flex items-center gap-1.5 text-xs text-gray-400'>
                      <Shield className='w-3.5 h-3.5 text-green-500' /> Secured by Razorpay
                    </div>
                    <div className='w-px h-4 bg-gray-200 hidden sm:block' />
                    <div className='flex items-center gap-1.5 text-xs text-gray-400'>
                      <CheckCircle className='w-3.5 h-3.5 text-green-500' /> PCI DSS Compliant
                    </div>
                  </div>
                </div>

                <div className='flex items-center justify-center gap-2 py-2'>
                  <p className='text-xs text-gray-400'>Powered by</p>
                  <div className='flex items-center gap-1 bg-white border border-gray-100 rounded-lg px-2.5 py-1 shadow-sm'>
                    <span className='text-xs font-bold text-[#072654]'>razor</span>
                    <span className='text-xs font-bold text-[#3395FF]'>pay</span>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
