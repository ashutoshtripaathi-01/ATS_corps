import { motion } from 'framer-motion';
import {
  BookOpen,
  Shield,
  FileText,
  Briefcase,
  CheckCircle,
  Star,
  Users,
  Phone,
} from 'lucide-react';

const GUIDES = [
  {
    icon: FileText,
    color: 'bg-blue-50 text-blue-600',
    title: 'Preparing Your Documents',
    points: [
      'Keep your Discharge Book (Form B / Service Certificate) handy — this is the most important document',
      'Obtain a Police Verification Certificate from your local station',
      'Carry original ID card along with 2 photocopies for every interview',
      'Keep your pension PPO order and service number accessible',
    ],
  },
  {
    icon: Briefcase,
    color: 'bg-amber-50 text-[#F7A607]',
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
    icon: Star,
    color: 'bg-green-50 text-green-600',
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
    icon: Shield,
    color: 'bg-purple-50 text-purple-600',
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
  return (
    <div className='p-4 sm:p-6 max-w-2xl mx-auto'>
      <div className='mb-5'>
        <h1
          className='text-xl font-extrabold text-gray-900 mb-0.5'
          style={{ fontFamily: 'Plus Jakarta Sans' }}
        >
          Career Guide
        </h1>
        <p className='text-sm text-gray-500'>
          Tips and resources for ex-servicemen transitioning to civilian work
        </p>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className='bg-[#292e31] rounded-2xl p-5 text-white mb-5'
      >
        <div className='flex items-start gap-3'>
          <div className='w-10 h-10 rounded-xl bg-[#F7A607] flex items-center justify-center shrink-0'>
            <BookOpen className='w-5 h-5 text-white' />
          </div>
          <div>
            <p
              className='font-bold text-sm'
              style={{ fontFamily: 'Plus Jakarta Sans' }}
            >
              Welcome, Warrior to Workforce
            </p>
            <p className='text-xs text-gray-300 mt-1 leading-relaxed'>
              Your service to the nation has given you discipline, teamwork, and
              leadership — qualities every employer values. This guide helps you
              make the most of those skills in your civilian career.
            </p>
          </div>
        </div>
      </motion.div>

      <div className='space-y-4'>
        {GUIDES.map(({ icon: Icon, color, title, points }, i) => (
          <motion.div
            key={title}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.08 * i }}
            className='bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden'
          >
            <div className='flex items-center gap-2.5 px-4 py-3 border-b border-gray-50'>
              <div
                className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${color}`}
              >
                <Icon className='w-4 h-4' />
              </div>
              <p className='text-sm font-bold text-gray-900'>{title}</p>
            </div>
            <ul className='p-4 space-y-2.5'>
              {points.map((pt) => (
                <li key={pt} className='flex items-start gap-2.5'>
                  <CheckCircle className='w-3.5 h-3.5 text-[#F7A607] mt-0.5 shrink-0' />
                  <span className='text-sm text-gray-700 leading-relaxed'>
                    {pt}
                  </span>
                </li>
              ))}
            </ul>
          </motion.div>
        ))}
      </div>

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.35 }}
        className='mt-5 bg-[#F7A607]/8 border border-[#F7A607]/20 rounded-2xl p-4'
      >
        <div className='flex items-start gap-3'>
          <Phone className='w-4 h-4 text-[#F7A607] shrink-0 mt-0.5' />
          <div>
            <p className='text-sm font-bold text-gray-900 mb-0.5'>Need Help?</p>
            <p className='text-xs text-gray-600 leading-relaxed'>
              Contact your nearest Zila Sainik Board or Rajya Sainik Board for
              personalized resettlement guidance. Ex-Serviceman Jobs
              coordinators are also available to assist — reach out through your
              registered mobile number.
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
