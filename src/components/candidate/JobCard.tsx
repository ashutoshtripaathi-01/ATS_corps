import { motion } from 'framer-motion'
import { MapPin, Clock, Bookmark, BookmarkCheck, ExternalLink, Star, Users } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useCandidateStore } from '@/store/useAppStore'
import { formatSalary, timeAgo } from '@/lib/utils'
import type { Job } from '@/types'

interface JobCardProps {
  job: Job
  compact?: boolean
}

export function JobCard({ job, compact = false }: JobCardProps) {
  const navigate = useNavigate()
  const { savedJobs, appliedJobs, toggleSaveJob, applyJob } = useCandidateStore()
  const isSaved = savedJobs.includes(job.id)
  const isApplied = appliedJobs.includes(job.id)

  const workModeColor = {
    remote: 'success',
    hybrid: 'info',
    onsite: 'secondary',
  }[job.workMode] as 'success' | 'info' | 'secondary'

  return (
    <motion.div
      whileHover={{ y: -4 }}
      transition={{ duration: 0.2 }}
      className={`bg-white dark:bg-[#1e2227] rounded-2xl border border-gray-100 dark:border-gray-800 hover:border-[#F7A607]/40 hover:shadow-lg hover:shadow-[#F7A607]/5 transition-all ${compact ? 'p-4' : 'p-5'}`}
    >
      <div className="flex items-start gap-3 mb-3">
        <img
          src={job.companyLogo || `https://api.dicebear.com/7.x/initials/svg?seed=${job.company}`}
          alt={job.company}
          className="w-12 h-12 rounded-xl border border-gray-100 dark:border-gray-700 object-cover shrink-0"
        />
        <div className="flex-1 min-w-0">
          <h3
            className="font-bold text-gray-900 dark:text-white hover:text-[#F7A607] cursor-pointer truncate transition-colors"
            onClick={() => navigate(`/candidate/jobs/${job.id}`)}
          >
            {job.title}
          </h3>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className="text-sm text-gray-600 dark:text-gray-400 font-medium">{job.company}</span>
            {job.companyRating && (
              <div className="flex items-center gap-0.5 text-xs text-gray-500">
                <Star className="w-3 h-3 fill-[#F7A607] text-[#F7A607]" />
                <span>{job.companyRating}</span>
              </div>
            )}
          </div>
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); toggleSaveJob(job.id) }}
          className={`p-2 rounded-xl transition-colors shrink-0 ${isSaved ? 'text-[#F7A607] bg-[#F7A607]/10' : 'text-gray-400 hover:text-[#F7A607] hover:bg-[#F7A607]/5'}`}
        >
          {isSaved ? <BookmarkCheck className="w-4 h-4" /> : <Bookmark className="w-4 h-4" />}
        </button>
      </div>

      <div className="flex flex-wrap gap-1.5 mb-3">
        {job.skills.slice(0, 3).map((skill) => (
          <Badge key={skill} variant="secondary" className="text-xs">{skill}</Badge>
        ))}
        {job.skills.length > 3 && (
          <Badge variant="outline" className="text-xs">+{job.skills.length - 3}</Badge>
        )}
      </div>

      <div className="grid grid-cols-2 gap-1.5 mb-3 text-xs text-gray-500 dark:text-gray-400">
        <div className="flex items-center gap-1">
          <MapPin className="w-3.5 h-3.5 shrink-0" />
          <span className="truncate">{job.location}</span>
        </div>
        <div className="flex items-center gap-1">
          <Clock className="w-3.5 h-3.5 shrink-0" />
          <span>{timeAgo(job.postedAt)}</span>
        </div>
      </div>

      <div className="flex items-center gap-2 mb-4">
        <span className="text-sm font-bold text-[#F7A607]">{formatSalary(job.salaryMin, job.salaryMax)}/yr</span>
        <span className="text-xs text-gray-400">•</span>
        <span className="text-xs text-gray-500">{job.experience}</span>
        <Badge variant={workModeColor} className="ml-auto text-xs capitalize">{job.workMode}</Badge>
      </div>

      {job.applicants !== undefined && (
        <div className="flex items-center gap-1 mb-3 text-xs text-gray-400">
          <Users className="w-3 h-3" />
          <span>{job.applicants} applicants</span>
        </div>
      )}

      <div className="flex gap-2">
        <Button
          size="sm"
          className={`flex-1 text-xs ${isApplied ? 'bg-green-500 hover:bg-green-600' : ''}`}
          onClick={() => { applyJob(job.id); navigate(`/candidate/jobs/${job.id}/apply`) }}
          disabled={isApplied}
        >
          {isApplied ? 'Applied ✓' : 'Apply Now'}
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="px-2"
          onClick={() => navigate(`/candidate/jobs/${job.id}`)}
        >
          <ExternalLink className="w-3.5 h-3.5" />
        </Button>
      </div>
    </motion.div>
  )
}
