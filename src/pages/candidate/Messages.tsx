import { motion } from 'framer-motion';
import { MessageSquare, Bell, Phone, Clock } from 'lucide-react';

export default function CandidateMessages() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#13161a]">
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-10 py-6 lg:py-8">

        <div className="mb-6">
          <h1 className="text-2xl font-extrabold text-gray-900 dark:text-[#F0EFEA]" style={{ fontFamily: 'Plus Jakarta Sans' }}>
            Messages
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            Direct messages from employers and Ex-Serviceman Jobs
          </p>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">

          {/* Empty inbox */}
          <div className="lg:col-span-2">
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              className="bg-white dark:bg-[#1e2227] border border-gray-100 dark:border-white/8 rounded-2xl p-16 text-center shadow-sm"
            >
              <div className="w-16 h-16 rounded-2xl bg-gray-100 dark:bg-white/10 flex items-center justify-center mx-auto mb-4">
                <MessageSquare className="w-8 h-8 text-gray-400" />
              </div>
              <p className="text-base font-semibold text-gray-700 dark:text-gray-200 mb-2">No messages yet</p>
              <p className="text-xs text-gray-400 dark:text-gray-500 max-w-xs mx-auto leading-relaxed">
                When employers or Ex-Serviceman Jobs coordinators message you, conversations will appear here.
              </p>
            </motion.div>
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
              className="bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800/30 rounded-2xl p-5"
            >
              <div className="flex items-start gap-3">
                <Bell className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-bold text-blue-900 dark:text-blue-300 mb-1">Messaging coming soon</p>
                  <p className="text-xs text-blue-700 dark:text-blue-400 leading-relaxed">
                    You will be able to communicate directly with recruiters and receive interview invites through this portal.
                  </p>
                </div>
              </div>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
              className="bg-white dark:bg-[#1e2227] border border-gray-100 dark:border-white/8 rounded-2xl p-5 shadow-sm"
            >
              <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-3">Contact Us</p>
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-[#F7A607]/10 flex items-center justify-center shrink-0">
                    <Phone className="w-3.5 h-3.5 text-[#F7A607]" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-gray-900 dark:text-[#F0EFEA]">Phone / WhatsApp</p>
                    <p className="text-xs text-gray-400 mt-0.5">We'll contact you on your registered number</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-[#F7A607]/10 flex items-center justify-center shrink-0">
                    <Clock className="w-3.5 h-3.5 text-[#F7A607]" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-gray-900 dark:text-[#F0EFEA]">Response Time</p>
                    <p className="text-xs text-gray-400 mt-0.5">Within 2–3 working days</p>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
}
