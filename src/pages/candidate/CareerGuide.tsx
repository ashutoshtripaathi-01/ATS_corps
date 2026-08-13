import { motion } from 'framer-motion';
import { BookOpen, Shield, FileText, Briefcase, CheckCircle, Star, Phone, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const GUIDES = [
  {
    icon: FileText, color: 'bg-blue-50 text-blue-600 dark:bg-blue-900/25 dark:text-blue-400',
    title: 'Preparing Your Documents',
    points: [
      'Keep your Discharge Book (Form B / Service Certificate) handy — this is the most important document',
      'Obtain a Police Verification Certificate from your local station',
      'Carry original ID card along with 2 photocopies for every interview',
      'Keep your pension PPO order and service number accessible',
    ],
  },
  {
    icon: Briefcase, color: 'bg-amber-50 text-[#F7A607] dark:bg-amber-900/20',
    title: 'Jobs Ex-Servicemen Are Preferred For',
    points: [
      'Armed / Unarmed Security Guards at banks, hospitals, and malls',
      'Security Supervisors and Quick Response Team members',
      'Gunman or Personal Bodyguard roles',
      'Dog Handlers and Traffic Marshals',
      'Estate security for tea gardens and industrial units',
    ],
  },
  {
    icon: Star, color: 'bg-green-50 text-green-600 dark:bg-green-900/20 dark:text-green-400',
    title: 'Interview Tips',
    points: [
      'Arrive 15 minutes early — punctuality shows discipline',
      'Wear formal attire; service uniform (if retained) creates a strong impression',
      'Be ready to share your unit, rank, and key responsibilities from service',
      'Highlight any special skills — weapons handling, crowd control, first aid',
      'Bring a pen and a notebook — it shows professionalism',
    ],
  },
  {
    icon: Shield, color: 'bg-purple-50 text-purple-600 dark:bg-purple-900/20 dark:text-purple-400',
    title: 'Your Rights as an Ex-Serviceman',
    points: [
      'ECHS (Ex-Servicemen Contributory Health Scheme) benefits continue after service',
      'Priority in government job applications under ex-servicemen quota',
      'Ex-servicemen get 3-year age relaxation in most state government jobs',
      'ESM boards in each state can help with resettlement and grievances',
    ],
  },
];

export default function CareerGuide() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#13161a]">
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-10 py-6 lg:py-8">

        <div className="mb-6">
          <h1 className="text-2xl font-extrabold text-gray-900 dark:text-[#F0EFEA]" style={{ fontFamily: 'Plus Jakarta Sans' }}>
            Career Guide
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            Tips and resources for ex-servicemen transitioning to civilian work
          </p>
        </div>

        {/* Hero banner */}
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
          className="bg-[#1a1d1f] rounded-2xl p-6 lg:p-8 text-white mb-6 relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 w-64 h-64 rounded-full bg-[#F7A607]/8 -translate-y-1/2 translate-x-1/4 pointer-events-none" />
          <div className="relative z-10 flex flex-col lg:flex-row items-start lg:items-center gap-5">
            <div className="w-14 h-14 rounded-2xl bg-[#F7A607] flex items-center justify-center shrink-0">
              <BookOpen className="w-7 h-7 text-white" />
            </div>
            <div className="flex-1">
              <p className="font-extrabold text-lg mb-1" style={{ fontFamily: 'Plus Jakarta Sans' }}>
                Warrior to Workforce
              </p>
              <p className="text-sm text-gray-300 leading-relaxed max-w-2xl">
                Your service to the nation has given you discipline, teamwork, and leadership — qualities every employer values.
                This guide helps you make the most of those skills in your civilian career.
              </p>
            </div>
            <button onClick={() => navigate('/candidate/jobs')}
              className="shrink-0 flex items-center gap-2 px-5 py-2.5 bg-[#F7A607] hover:bg-[#e09500] text-white text-sm font-bold rounded-xl transition-colors"
            >
              Browse Jobs <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </motion.div>

        {/* Guide cards — 2×2 on desktop */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-5">
          {GUIDES.map(({ icon: Icon, color, title, points }, i) => (
            <motion.div key={title}
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 * i }}
              className="bg-white dark:bg-[#1e2227] border border-gray-100 dark:border-white/8 rounded-2xl shadow-sm overflow-hidden"
            >
              <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-50 dark:border-white/8">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${color}`}>
                  <Icon className="w-4 h-4" />
                </div>
                <p className="text-sm font-bold text-gray-900 dark:text-[#F0EFEA]">{title}</p>
              </div>
              <ul className="p-5 space-y-2.5">
                {points.map((pt) => (
                  <li key={pt} className="flex items-start gap-2.5">
                    <CheckCircle className="w-3.5 h-3.5 text-[#F7A607] mt-0.5 shrink-0" />
                    <span className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">{pt}</span>
                  </li>
                ))}
              </ul>
            </motion.div>
          ))}
        </div>

        {/* Help footer */}
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}
          className="bg-[#F7A607]/8 border border-[#F7A607]/20 rounded-2xl p-5"
        >
          <div className="flex items-start gap-3">
            <Phone className="w-4 h-4 text-[#F7A607] shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-bold text-gray-900 dark:text-[#F0EFEA] mb-1">Need Help?</p>
              <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                Contact your nearest Zila Sainik Board or Rajya Sainik Board for personalized resettlement guidance.
                Ex-Serviceman Jobs coordinators are also available — reach out through your registered mobile number.
              </p>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
