import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { Briefcase, Building2, ArrowRight, Sparkles } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { useAppStore } from '@/store/useAppStore'

interface EntryModalProps {
  open: boolean
  onClose: () => void
}

export function EntryModal({ open, onClose }: EntryModalProps) {
  const navigate = useNavigate()
  const setUser = useAppStore((s) => s.setUser)

  const handleCandidate = () => {
    setUser({ id: 'c1', name: 'Harshit Sharma', email: 'harshit@example.com', role: 'candidate', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Harshit', createdAt: new Date() })
    onClose()
    navigate('/candidate/dashboard')
  }

  const handleEmployer = () => {
    onClose()
    navigate('/employer/register')
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl p-0 overflow-hidden">
        <div className="p-8">
          <DialogHeader className="text-center mb-8">
            <div className="flex items-center justify-center gap-2 mb-3">
              <Sparkles className="w-5 h-5 text-[#F7A607]" />
              <span className="text-sm font-semibold text-[#F7A607] uppercase tracking-wide">Get Started</span>
            </div>
            <DialogTitle className="text-3xl font-bold text-center">What would you like to do?</DialogTitle>
            <DialogDescription className="text-center text-base mt-2">
              Choose your journey and get started in seconds.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <motion.div
              whileHover={{ scale: 1.02, y: -4 }}
              whileTap={{ scale: 0.98 }}
              transition={{ duration: 0.2 }}
              onClick={handleCandidate}
              className="group cursor-pointer rounded-2xl border-2 border-gray-100 hover:border-[#F7A607] p-6 bg-white hover:shadow-xl hover:shadow-[#F7A607]/10 transition-all"
            >
              <div className="w-14 h-14 rounded-2xl bg-[#F7A607]/10 group-hover:bg-[#F7A607] flex items-center justify-center mb-4 transition-colors">
                <Briefcase className="w-7 h-7 text-[#F7A607] group-hover:text-white transition-colors" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">I Want a Job</h3>
              <p className="text-sm text-gray-500 mb-4 leading-relaxed">
                Find jobs, apply instantly, track applications and build your career.
              </p>
              <Button className="w-full group-hover:bg-[#F7A607]">
                Continue as Candidate
                <ArrowRight className="w-4 h-4" />
              </Button>
            </motion.div>

            <motion.div
              whileHover={{ scale: 1.02, y: -4 }}
              whileTap={{ scale: 0.98 }}
              transition={{ duration: 0.2 }}
              onClick={handleEmployer}
              className="group cursor-pointer rounded-2xl border-2 border-gray-100 hover:border-[#292e31] p-6 bg-white hover:shadow-xl hover:shadow-gray-900/10 transition-all"
            >
              <div className="w-14 h-14 rounded-2xl bg-[#292e31]/10 group-hover:bg-[#292e31] flex items-center justify-center mb-4 transition-colors">
                <Building2 className="w-7 h-7 text-[#292e31] group-hover:text-white transition-colors" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">I Want to Hire People</h3>
              <p className="text-sm text-gray-500 mb-4 leading-relaxed">
                Post jobs, manage candidates and hire top talent faster.
              </p>
              <Button variant="dark" className="w-full">
                Continue as Employer
                <ArrowRight className="w-4 h-4" />
              </Button>
            </motion.div>
          </div>

          <p className="text-center text-xs text-gray-400 mt-6">
            By continuing, you agree to our{' '}
            <span className="text-[#F7A607] cursor-pointer hover:underline">Terms of Service</span> and{' '}
            <span className="text-[#F7A607] cursor-pointer hover:underline">Privacy Policy</span>
          </p>
        </div>
      </DialogContent>
    </Dialog>
  )
}
