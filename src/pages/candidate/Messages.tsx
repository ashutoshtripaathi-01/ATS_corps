import { motion } from 'framer-motion';
import { MessageSquare, Bell } from 'lucide-react';

export default function CandidateMessages() {
  return (
    <div className='p-4 sm:p-6 max-w-2xl mx-auto'>
      <div className='mb-5'>
        <h1
          className='text-xl font-extrabold text-gray-900 mb-0.5'
          style={{ fontFamily: 'Plus Jakarta Sans' }}
        >
          Messages
        </h1>
        <p className='text-sm text-gray-500'>
          Direct messages from employers and Ex-Serviceman Jobs
        </p>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className='bg-white border border-gray-100 rounded-2xl p-12 text-center shadow-sm'
      >
        <div className='w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-4'>
          <MessageSquare className='w-7 h-7 text-gray-400' />
        </div>
        <p className='text-sm font-semibold text-gray-700 mb-1'>
          No messages yet
        </p>
        <p className='text-xs text-gray-400 max-w-xs mx-auto leading-relaxed'>
          When employers or Ex-Serviceman Jobs coordinators message you,
          conversations will appear here.
        </p>
      </motion.div>

      <div className='mt-4 bg-blue-50 border border-blue-100 rounded-2xl p-4'>
        <div className='flex items-start gap-3'>
          <Bell className='w-4 h-4 text-blue-500 shrink-0 mt-0.5' />
          <p className='text-xs text-blue-800 leading-relaxed'>
            <span className='font-bold'>Messaging coming soon.</span> You will
            be able to communicate directly with recruiters and receive
            interview invites through this portal. Until then, Ex-Serviceman
            Jobs will contact you on your registered mobile number.
          </p>
        </div>
      </div>
    </div>
  );
}
