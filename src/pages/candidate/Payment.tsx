import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  CreditCard,
  MapPin,
  Shield,
  CheckCircle,
  User,
  Briefcase,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAppStore } from '@/store/useAppStore';
import { toast } from '@/hooks/useToast';
import { createPaymentOrder, registerCandidate, devBypass } from '@/lib/api';
import { setToken } from '@/lib/tokenStore';

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
  idCard?: File;
  dischargeBook?: File;
  policeVerification?: File;
}

type Screen = 'pay' | 'processing' | 'success';

export default function CandidatePayment() {
  const navigate = useNavigate();
  const location = useLocation();
  const setUser = useAppStore((s) => s.setUser);

  const state = location.state as CandidatePaymentState | null;

  const [screen, setScreen] = useState<Screen>('pay');
  const [rzpReady, setRzpReady] = useState(false);

  // Redirect back if no state (e.g. direct navigation)
  useEffect(() => {
    if (!state) navigate('/candidate/register', { replace: true });
  }, [state, navigate]);

  // Load Razorpay checkout.js
  useEffect(() => {
    if (document.getElementById('rzp-script')) {
      setRzpReady(true);
      return;
    }
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
          prefill: {
            name: state.fullName,
            contact: state.mobile,
          },
          theme: { color: '#F7A607' },
          handler: (response: any) => resolve(response),
          modal: {
            ondismiss: () => {
              setScreen('pay');
              reject(new Error('Payment cancelled'));
            },
          },
        });
        rzp.open();
      }).then(async (payment) => {
        setScreen('success');
        // Register candidate with verified payment
        await completeRegistration(state, {
          razorpay_order_id: payment.razorpay_order_id,
          razorpay_payment_id: payment.razorpay_payment_id,
          razorpay_signature: payment.razorpay_signature,
        });
      });
    } catch (err: any) {
      if (err?.message !== 'Payment cancelled') {
        toast({
          title: 'Payment failed',
          description: err.message,
          variant: 'error',
        });
        setScreen('pay');
      }
    }
  };

  const handleDevSkip = async () => {
    try {
      const result = await devBypass();
      setToken(result.accessToken);
      setUser({
        id: String(result.candidate.id),
        name: result.candidate.full_name,
        email: `${result.candidate.mobile}@candidate.ats`,
        role: 'candidate',
        avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${result.candidate.full_name}`,
        createdAt: new Date(),
      });
      navigate('/candidate/dashboard');
    } catch (err: any) {
      toast({
        title: 'Dev bypass failed',
        description: err.message,
        variant: 'error',
      });
    }
  };

  const completeRegistration = async (
    s: CandidatePaymentState,
    payment: {
      razorpay_order_id: string;
      razorpay_payment_id: string;
      razorpay_signature: string;
    },
  ) => {
    try {
      const fd = new FormData();
      fd.append('mobile', s.mobile);
      fd.append('force', s.force);
      fd.append('rank', s.rank);
      fd.append('fullName', s.fullName);
      fd.append('unit', s.unit);
      fd.append('retirementDate', s.retirementDate);
      fd.append('post', s.post);
      if (s.otherPost) fd.append('otherPost', s.otherPost);
      if (s.gunLicense) fd.append('gunLicense', s.gunLicense);
      fd.append('loc1', s.loc1);
      if (s.loc2) fd.append('loc2', s.loc2);
      if (s.loc3) fd.append('loc3', s.loc3);
      fd.append('applicationFee', String(s.applicationFee));
      if (s.idCard) fd.append('idCard', s.idCard);
      if (s.dischargeBook) fd.append('dischargeBook', s.dischargeBook);
      if (s.policeVerification)
        fd.append('policeVerification', s.policeVerification);
      fd.append('razorpay_order_id', payment.razorpay_order_id);
      fd.append('razorpay_payment_id', payment.razorpay_payment_id);
      fd.append('razorpay_signature', payment.razorpay_signature);

      const result = await registerCandidate(fd);
      if (result.accessToken) setToken(result.accessToken);
      setUser({
        id: String(result.candidate.id),
        name: s.fullName,
        email: s.mobile ? `${s.mobile}@candidate.ats` : 'candidate@ats.com',
        role: 'candidate',
        avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${s.fullName}`,
        createdAt: new Date(),
      });
    } catch (err: any) {
      toast({
        title: 'Registration failed',
        description: err.message,
        variant: 'error',
      });
    }
  };

  if (!state) return null;

  /* ── Success screen ─────────────────────────────────────────────────── */
  if (screen === 'success') {
    return (
      <div className='min-h-screen bg-gray-50 flex flex-col items-center justify-center px-6'>
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className='w-full max-w-sm text-center'
        >
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.15, type: 'spring', stiffness: 200 }}
            className='w-24 h-24 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6'
          >
            <CheckCircle className='w-12 h-12 text-green-500' />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <h1
              className='text-2xl font-extrabold text-gray-900 mb-2'
              style={{ fontFamily: 'Plus Jakarta Sans' }}
            >
              Payment Successful!
            </h1>
            <p className='text-gray-500 text-sm mb-1'>
              ₹1 received · Ex-Serviceman Jobs Registration
            </p>
            <p className='text-gray-400 text-xs mb-8'>
              {state.fullName} · {state.loc1}
            </p>

            <div className='bg-white rounded-2xl border border-gray-100 shadow-sm p-4 mb-6 text-left space-y-2'>
              {[
                { label: 'Applicant', value: state.fullName },
                { label: 'Rank', value: `${state.rank}, ${state.force}` },
                { label: 'Post', value: state.post },
                { label: 'Location', value: state.loc1 },
                { label: 'Amount Paid', value: '₹1 (Test)' },
              ].map((r) => (
                <div
                  key={r.label}
                  className='flex justify-between items-center py-1 border-b border-gray-50 last:border-0'
                >
                  <span className='text-xs text-gray-400'>{r.label}</span>
                  <span className='text-xs font-semibold text-gray-800'>
                    {r.value}
                  </span>
                </div>
              ))}
            </div>

            <Button
              size='lg'
              className='w-full rounded-xl text-sm font-bold h-12'
              onClick={() => navigate('/candidate/dashboard')}
            >
              Go to Dashboard
            </Button>
          </motion.div>
        </motion.div>
      </div>
    );
  }

  /* ── Pay screen ─────────────────────────────────────────────────────── */
  return (
    <div className='min-h-screen bg-gray-50 flex flex-col'>
      {/* Header */}
      <div className='bg-white border-b border-gray-100 px-4 py-3 flex items-center gap-3'>
        <button
          onClick={() => navigate(-1)}
          className='w-8 h-8 rounded-xl bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors'
        >
          <ArrowLeft className='w-4 h-4 text-gray-600' />
        </button>
        <div className='flex items-center gap-2'>
          <div className='w-7 h-7 bg-[#F7A607] rounded-lg flex items-center justify-center'>
            <CreditCard className='w-4 h-4 text-white' />
          </div>
          <span
            className='text-sm font-bold text-gray-900'
            style={{ fontFamily: 'Plus Jakarta Sans' }}
          >
            Ex-Serviceman Jobs — Payment
          </span>
        </div>
      </div>

      <div className='flex-1 px-4 py-6 max-w-sm mx-auto w-full space-y-4'>
        {/* Order summary */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className='bg-[#292e31] rounded-2xl p-5 text-white'
        >
          <p className='text-xs text-gray-400 mb-1'>Application Fee</p>
          <div className='flex items-baseline gap-1.5 mb-1'>
            <span className='text-3xl font-extrabold'>
              ₹{state.applicationFee.toLocaleString()}
            </span>
            <span className='text-sm text-gray-400'>one-time</span>
          </div>
          <div className='inline-flex items-center gap-1.5 bg-[#F7A607]/20 text-[#F7A607] text-xs font-semibold px-2.5 py-1 rounded-full mb-4'>
            <CreditCard className='w-3 h-3' /> Charging ₹1 (test mode)
          </div>
          <div className='pt-3 border-t border-white/10 space-y-2'>
            {[
              { icon: User, label: 'Applicant', value: state.fullName },
              {
                icon: Shield,
                label: 'Rank & Force',
                value: `${state.rank}, ${state.force}`,
              },
              { icon: Briefcase, label: 'Post Applied', value: state.post },
              { icon: MapPin, label: 'Location', value: state.loc1 },
            ].map(({ icon: Icon, label, value }) => (
              <div key={label} className='flex justify-between items-center'>
                <div className='flex items-center gap-1.5'>
                  <Icon className='w-3 h-3 text-gray-400' />
                  <span className='text-xs text-gray-400'>{label}</span>
                </div>
                <span className='text-xs font-semibold text-white truncate max-w-[55%] text-right'>
                  {value}
                </span>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Pay info */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className='bg-white rounded-2xl border border-gray-100 shadow-sm p-4'
        >
          <p className='text-sm font-semibold text-gray-900 mb-3'>
            Accepted Payment Methods
          </p>
          <div className='grid grid-cols-3 gap-2'>
            {['UPI', 'Cards', 'Net Banking'].map((m) => (
              <div
                key={m}
                className='flex flex-col items-center gap-1 py-2.5 px-2 bg-gray-50 rounded-xl'
              >
                <span className='text-xs font-semibold text-gray-600'>{m}</span>
              </div>
            ))}
          </div>
          <p className='text-xs text-gray-400 mt-3 text-center'>
            GPay · PhonePe · BHIM · All UPI apps · Visa · Mastercard
          </p>
        </motion.div>

        {/* Pay button */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
        >
          <Button
            size='lg'
            className='w-full rounded-xl text-sm font-bold gap-2.5 h-13'
            onClick={handlePay}
            disabled={!rzpReady || screen === 'processing'}
          >
            {screen === 'processing' ? (
              <>
                <div className='w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin' />
                Opening Razorpay...
              </>
            ) : (
              <>
                <CreditCard className='w-4 h-4' />
                Pay ₹1 Now (Test)
              </>
            )}
          </Button>

          <p className='text-center text-xs text-gray-400 flex items-center justify-center gap-1.5 mt-3'>
            <Shield className='w-3.5 h-3.5 text-green-500' />
            Secured by Razorpay · 256-bit SSL
          </p>

          <div className='text-center mt-3'>
            <button
              type='button'
              onClick={handleDevSkip}
              className='text-xs text-gray-400 hover:text-[#F7A607] transition-colors underline underline-offset-2'
            >
              Skip for now (dev mode)
            </button>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
