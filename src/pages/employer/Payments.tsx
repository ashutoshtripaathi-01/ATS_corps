import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { CreditCard, FileText, Shield, Clock, ChevronRight } from 'lucide-react'

const PLANS = [
  { name: 'Starter', price: '₹999', period: '/month', posts: '3 Job Posts', features: ['3 active job posts', 'Candidate database access', 'Basic analytics', 'Email support'], highlight: false },
  { name: 'Growth',  price: '₹2,499', period: '/month', posts: '10 Job Posts', features: ['10 active job posts', 'Full candidate database', 'Advanced analytics', 'Priority support', 'Interview scheduling'], highlight: true },
  { name: 'Enterprise', price: 'Custom', period: '', posts: 'Unlimited', features: ['Unlimited job posts', 'Dedicated account manager', 'Custom integrations', 'SLA support', 'Bulk hiring tools'], highlight: false },
]

export default function Payments() {
  const navigate = useNavigate()

  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto">
      <div className="mb-5">
        <h1 className="text-xl font-extrabold text-gray-900 mb-0.5" style={{ fontFamily: 'Plus Jakarta Sans' }}>Payments & Plans</h1>
        <p className="text-sm text-gray-500">Manage your subscription and billing</p>
      </div>

      {/* Current plan banner */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
        className="bg-[#292e31] rounded-2xl p-5 text-white mb-6"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs text-gray-400 mb-0.5">Current Plan</p>
            <p className="text-lg font-extrabold" style={{ fontFamily: 'Plus Jakarta Sans' }}>Free Trial</p>
            <p className="text-sm text-gray-300 mt-1">Razorpay integration coming soon. Job posting is currently free.</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-[#F7A607] flex items-center justify-center shrink-0">
            <CreditCard className="w-5 h-5 text-white" />
          </div>
        </div>
      </motion.div>

      {/* Plans */}
      <div className="grid md:grid-cols-3 gap-4 mb-6">
        {PLANS.map(({ name, price, period, posts, features, highlight }, i) => (
          <motion.div key={name}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.08 * i }}
            className={`rounded-2xl p-5 border ${highlight ? 'border-[#F7A607] bg-[#F7A607]/5 shadow-[0_0_0_1px_#F7A607]' : 'border-gray-100 bg-white shadow-sm'}`}
          >
            {highlight && (
              <p className="text-[10px] font-extrabold text-[#F7A607] uppercase tracking-widest mb-2">Most Popular</p>
            )}
            <p className="text-base font-extrabold text-gray-900" style={{ fontFamily: 'Plus Jakarta Sans' }}>{name}</p>
            <p className="text-sm text-gray-500 mb-3">{posts}</p>
            <p className="text-2xl font-extrabold text-gray-900">{price}<span className="text-xs font-normal text-gray-400">{period}</span></p>
            <ul className="mt-4 space-y-2 mb-5">
              {features.map(f => (
                <li key={f} className="flex items-center gap-2 text-xs text-gray-600">
                  <Shield className="w-3.5 h-3.5 text-[#F7A607] shrink-0" />{f}
                </li>
              ))}
            </ul>
            <button disabled
              className={`w-full h-9 rounded-xl text-sm font-semibold transition-colors disabled:cursor-not-allowed
                ${highlight ? 'bg-[#F7A607] text-white opacity-60' : 'border border-gray-200 text-gray-700 opacity-60'}`}
            >
              {price === 'Custom' ? 'Contact Sales' : 'Coming Soon'}
            </button>
          </motion.div>
        ))}
      </div>

      {/* Skip — test mode */}
      <div className="text-center mb-6">
        <button
          onClick={() => navigate('/employer/dashboard')}
          className="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-[#F7A607] transition-colors underline underline-offset-2"
        >
          Skip for now (test mode)
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Invoice history */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}
        className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden"
      >
        <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-50">
          <FileText className="w-4 h-4 text-[#F7A607]" />
          <p className="text-sm font-bold text-gray-900">Invoice History</p>
        </div>
        <div className="py-10 text-center">
          <Clock className="w-8 h-8 text-gray-300 mx-auto mb-2" />
          <p className="text-sm text-gray-400">No invoices yet</p>
        </div>
      </motion.div>
    </div>
  )
}
