import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  CreditCard,
  MapPin,
  Shield,
  CheckCircle,
  User,
  Briefcase,
  Lock,
  Smartphone,
  Building2,
  Wallet,
  ChevronRight,
  Zap,
  Award,
  Star,
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

type Screen = 'pay' | 'processing' | 'success';

const PAYMENT_METHODS = [
  {
    icon: Smartphone,
    label: 'UPI',
    desc: 'GPay · PhonePe · BHIM · Paytm',
    color: 'text-green-600',
    bg: 'bg-green-50',
    border: 'border-green-100',
  },
  {
    icon: CreditCard,
    label: 'Cards',
    desc: 'Visa · Mastercard · RuPay',
    color: 'text-blue-600',
    bg: 'bg-blue-50',
    border: 'border-blue-100',
  },
  {
    icon: Building2,
    label: 'Net Banking',
    desc: 'SBI · HDFC · ICICI · All banks',
    color: 'text-purple-600',
    bg: 'bg-purple-50',
    border: 'border-purple-100',
  },
  {
    icon: Wallet,
    label: 'Wallets',
    desc: 'Mobikwik · Airtel Money',
    color: 'text-orange-600',
    bg: 'bg-orange-50',
    border: 'border-orange-100',
  },
];

export default function CandidatePayment() {
  const navigate = useNavigate();
  const location = useLocation();
  const setUser = useAppStore((s) => s.setUser);

  const state = location.state as CandidatePaymentState | null;

  const [screen, setScreen] = useState<Screen>('pay');
  const [rzpReady, setRzpReady] = useState(false);

  useEffect(() => {
    if (!state) navigate('/candidate/register', { replace: true });
  }, [state, navigate]);

  useEffect(() => {
    if (document.getElementById('rzp-script')) { setRzpReady(true); return; }
    const s = document.createElement('script');
    s.id = 'rzp-script';
    s.src = 'https://checkout.razorpay.com/v1/checkout.js';
    s.async = true;
    s.onload = () => setRzpReady(true);
    document.head.appendChild(s);
  }, []);

  const handlePay = async () => {
    if (!state) return;
    setScreen('processing');
    try {
      const order = await createPaymentOrder();
      await new Promise<{
        razorpay_order_id: string;
        razorpay_payment_id: string;
        razorpay_signature: string;
      }>((resolve, reject) => {
        const rzp = new (window as any).Razorpay({
          key: import.meta.env.VITE_RAZORPAY_KEY_ID as string,
          amount: order.amount,
          currency: order.currency,
          order_id: order.orderId,
          name: 'Ex-Serviceman Jobs',
          description: 'Registration Application Fee',
          prefill: { name: state.fullName, contact: state.mobile },
          theme: { color: '#F7A607' },
          handler: (response: any) => resolve(response),
          modal: { ondismiss: () => { setScreen('pay'); reject(new Error('Payment cancelled')); } },
        });
        rzp.open();
      }).then(async (payment) => {
        setScreen('success');
        await finalizeRegistration(payment);
      });
    } catch (err: any) {
      if (err?.message !== 'Payment cancelled') {
        toast({ title: 'Payment failed', description: err.message, variant: 'error' });
        setScreen('pay');
      }
    }
  };

  const finalizeRegistration = async (payment: {
    razorpay_order_id: string;
    razorpay_payment_id: string;
    razorpay_signature: string;
  }) => {
    if (!state) return;
    try {
      const result = await verifyPayment(payment);
      if (result.accessToken) setToken(result.accessToken);
      setUser({
        id:        String(result.candidate.id),
        name:      state.fullName,
        email:     result.candidate.email || `${state.mobile}@candidate.ats`,
        role:      'candidate',
        avatar:    `https://api.dicebear.com/7.x/avataaars/svg?seed=${state.fullName}`,
        createdAt: new Date(),
      });
    } catch (err: any) {
      toast({ title: 'Registration failed', description: err.message, variant: 'error' });
    }
  };

  if (!state) return null;

  /* ══════════════════════════════════════════════════════════
      SUCCESS SCREEN
  ══════════════════════════════════════════════════════════ */
  if (screen === 'success') {
    return (
      <div className='min-h-screen bg-gradient-to-br from-[#f0fdf4] to-[#f8faff] flex items-center justify-center px-4 py-12'>
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4 }}
          className='w-full max-w-lg'
        >
          {/* Checkmark */}
          <div className='flex justify-center mb-8'>
            <div className='relative'>
              <motion.div
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.15, type: 'spring', stiffness: 220, damping: 15 }}
                className='w-28 h-28 bg-green-500 rounded-full flex items-center justify-center shadow-2xl shadow-green-500/30'
              >
                <CheckCircle className='w-14 h-14 text-white' />
              </motion.div>
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.4, type: 'spring' }}
                className='absolute -top-1 -right-1 w-7 h-7 bg-[#F7A607] rounded-full flex items-center justify-center shadow-lg'
              >
                <Star className='w-3.5 h-3.5 text-white fill-white' />
              </motion.div>
            </div>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className='text-center mb-6'
          >
            <h1 className='text-3xl font-extrabold text-gray-900 mb-2' style={{ fontFamily: 'Plus Jakarta Sans' }}>
              Payment Successful!
            </h1>
            <p className='text-gray-500 text-sm'>
              ₹{state.applicationFee.toLocaleString()} received · Registration confirmed
            </p>
          </motion.div>

          {/* Summary card */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className='bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden mb-5'
          >
            <div className='bg-[#1a1d1f] px-6 py-4 flex items-center justify-between'>
              <div>
                <p className='text-xs text-gray-400'>Registration ID</p>
                <p className='text-sm font-bold text-white mt-0.5'>ATS-{Date.now().toString().slice(-6)}</p>
              </div>
              <div className='text-right'>
                <p className='text-xs text-gray-400'>Amount Paid</p>
                <p className='text-xl font-extrabold text-[#F7A607]'>₹{state.applicationFee.toLocaleString()}</p>
              </div>
            </div>
            <div className='p-5 space-y-2.5'>
              {[
                { label: 'Applicant', value: state.fullName },
                { label: 'Rank & Force', value: `${state.rank}, ${state.force}` },
                { label: 'Post Applied For', value: state.post },
                { label: 'Priority 1 Location', value: state.loc1 },
                { label: 'Unit / Regiment', value: state.unit },
              ].map((r) => (
                <div key={r.label} className='flex justify-between items-center py-1.5 border-b border-gray-50 last:border-0'>
                  <span className='text-xs text-gray-400'>{r.label}</span>
                  <span className='text-xs font-semibold text-gray-800 text-right max-w-[55%]'>{r.value}</span>
                </div>
              ))}
            </div>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}>
            <Button size='lg' className='w-full rounded-2xl text-sm font-bold h-13 gap-2' onClick={() => navigate('/candidate/dashboard')}>
              Go to Dashboard <ChevronRight className='w-4 h-4' />
            </Button>
            <p className='text-center text-xs text-gray-400 mt-3'>
              A confirmation will be sent to your registered mobile number.
            </p>
          </motion.div>
        </motion.div>
      </div>
    );
  }

  /* ══════════════════════════════════════════════════════════
      PAY / PROCESSING SCREEN — split-screen on desktop
  ══════════════════════════════════════════════════════════ */
  return (
    <div className='min-h-screen lg:h-screen flex flex-col lg:flex-row overflow-hidden'>

      {/* ══════════════════════════════════════════════════════════
          LEFT PANEL — dark order summary (desktop) / top header (mobile)
      ══════════════════════════════════════════════════════════ */}
      <div className='bg-[#1a1d1f] lg:w-[400px] xl:w-[440px] shrink-0 flex flex-col lg:sticky lg:top-0 lg:h-screen lg:overflow-y-auto'>

        {/* Gold top accent bar */}
        <div className='h-1 w-full bg-gradient-to-r from-[#F7A607] via-[#ffcc55] to-[#F7A607] shrink-0' />

        {/* Logo + brand */}
        <div className='px-7 pt-6 pb-5 border-b border-white/8 flex items-center gap-3'>
          <img src={companyLogo} alt='Ex-Serviceman Jobs' className='w-9 h-9 object-contain' />
          <div>
            <p className='font-extrabold text-white text-sm leading-tight' style={{ fontFamily: 'Plus Jakarta Sans' }}>
              Ex-Serviceman Jobs
            </p>
            <p className='text-[10px] text-gray-500 mt-0.5'>Secure Checkout</p>
          </div>
          {/* Mobile: back button */}
          <button onClick={() => navigate(-1)} className='ml-auto w-8 h-8 rounded-xl bg-white/8 flex items-center justify-center hover:bg-white/12 transition-colors lg:hidden'>
            <ArrowLeft className='w-4 h-4 text-gray-400' />
          </button>
        </div>

        {/* Fee + order details */}
        <div className='px-7 py-7 flex-1'>
          {/* Amount */}
          <div className='mb-7'>
            <p className='text-xs text-gray-500 mb-1 uppercase tracking-wider font-medium'>Application Fee</p>
            <div className='flex items-baseline gap-2'>
              <span className='text-5xl font-black text-white'>
                ₹{state.applicationFee.toLocaleString()}
              </span>
              <span className='text-sm text-gray-500'>one-time</span>
            </div>
            <div className='inline-flex items-center gap-1.5 mt-3 bg-[#F7A607]/15 border border-[#F7A607]/25 text-[#F7A607] text-xs font-semibold px-3 py-1.5 rounded-full'>
              <Zap className='w-3 h-3' /> One-time registration fee · Non-refundable
            </div>
          </div>

          {/* Divider */}
          <div className='h-px bg-white/8 mb-6' />

          {/* Summary rows */}
          <p className='text-[10px] font-bold text-gray-600 uppercase tracking-widest mb-4'>Application Summary</p>
          <div className='space-y-3'>
            {[
              { icon: User,     label: 'Applicant',    value: state.fullName },
              { icon: Shield,   label: 'Rank & Force', value: `${state.rank}, ${state.force}` },
              { icon: Briefcase,label: 'Post Applied',  value: state.post },
              { icon: MapPin,   label: 'Priority 1',   value: state.loc1 },
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

        {/* Trust badges */}
        <div className='px-7 pb-7 pt-5 border-t border-white/8 space-y-2.5'>
          <div className='flex items-center gap-2'>
            <Lock className='w-3.5 h-3.5 text-green-400 shrink-0' />
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

      {/* ══════════════════════════════════════════════════════════
          RIGHT PANEL — payment action
      ══════════════════════════════════════════════════════════ */}
      <div className='flex-1 bg-gray-50 flex flex-col lg:overflow-y-auto'>

        {/* Desktop header with back button */}
        <div className='hidden lg:flex items-center gap-3 px-10 py-5 bg-white border-b border-gray-100'>
          <button onClick={() => navigate(-1)}
            className='w-9 h-9 rounded-xl border border-gray-200 flex items-center justify-center hover:bg-gray-50 transition-colors'
          >
            <ArrowLeft className='w-4 h-4 text-gray-600' />
          </button>
          <div>
            <p className='text-sm font-bold text-gray-900'>Complete Your Payment</p>
            <p className='text-xs text-gray-400 mt-0.5'>Step 4 of 4 · Registration</p>
          </div>
        </div>

        {/* Content */}
        <div className='flex-1 flex flex-col justify-center px-6 lg:px-12 xl:px-20 py-8 max-w-2xl lg:max-w-none mx-auto w-full'>
          <AnimatePresence mode='wait'>
            {screen === 'processing' ? (
              <motion.div key='processing'
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className='flex flex-col items-center justify-center text-center py-16 gap-5'
              >
                <div className='w-20 h-20 rounded-full bg-[#F7A607]/10 flex items-center justify-center'>
                  <div className='w-10 h-10 border-4 border-[#F7A607]/30 border-t-[#F7A607] rounded-full animate-spin' />
                </div>
                <div>
                  <p className='text-lg font-bold text-gray-900'>Opening Razorpay…</p>
                  <p className='text-sm text-gray-400 mt-1'>Complete the payment in the popup window</p>
                </div>
              </motion.div>
            ) : (
              <motion.div key='pay'
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -16 }}
                className='space-y-6'
              >
                {/* Section heading */}
                <div>
                  <h2 className='text-xl font-extrabold text-gray-900' style={{ fontFamily: 'Plus Jakarta Sans' }}>
                    Choose Payment Method
                  </h2>
                  <p className='text-sm text-gray-500 mt-1'>
                    Razorpay will open with all available options.
                  </p>
                </div>

                {/* Payment method cards */}
                <div className='grid grid-cols-2 gap-3'>
                  {PAYMENT_METHODS.map(({ icon: Icon, label, desc, color, bg, border }) => (
                    <div key={label}
                      className={`flex items-start gap-3 p-4 bg-white rounded-2xl border ${border} shadow-sm`}
                    >
                      <div className={`w-9 h-9 rounded-xl ${bg} flex items-center justify-center shrink-0`}>
                        <Icon className={`w-4 h-4 ${color}`} />
                      </div>
                      <div>
                        <p className='text-sm font-semibold text-gray-900'>{label}</p>
                        <p className='text-[11px] text-gray-400 mt-0.5 leading-snug'>{desc}</p>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Order recap (mobile only — desktop has left panel) */}
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
                  <button
                    onClick={handlePay}
                    disabled={!rzpReady}
                    className='w-full h-14 rounded-2xl bg-[#F7A607] hover:bg-[#e09500] active:scale-[0.99] disabled:opacity-60 disabled:cursor-not-allowed
                      transition-all text-white font-bold text-base flex items-center justify-center gap-3 shadow-xl shadow-[#F7A607]/25'
                  >
                    <CreditCard className='w-5 h-5' />
                    Pay ₹{state.applicationFee.toLocaleString()} Now
                    <ChevronRight className='w-5 h-5 ml-1' />
                  </button>

                  <div className='flex items-center justify-center gap-6 py-1'>
                    <div className='flex items-center gap-1.5 text-xs text-gray-400'>
                      <Lock className='w-3.5 h-3.5 text-green-500' /> SSL Encrypted
                    </div>
                    <div className='w-px h-4 bg-gray-200' />
                    <div className='flex items-center gap-1.5 text-xs text-gray-400'>
                      <Shield className='w-3.5 h-3.5 text-green-500' /> Secured by Razorpay
                    </div>
                    <div className='w-px h-4 bg-gray-200' />
                    <div className='flex items-center gap-1.5 text-xs text-gray-400'>
                      <CheckCircle className='w-3.5 h-3.5 text-green-500' /> PCI DSS Compliant
                    </div>
                  </div>

                </div>

                {/* Razorpay badge */}
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
