export type UserRole = 'candidate' | 'employer' | 'admin'

export interface User {
  id: string
  name: string
  email: string
  phone?: string
  role: UserRole
  avatar?: string
  createdAt: Date
}

export interface Candidate extends User {
  role: 'candidate'
  headline?: string
  location?: string
  experience?: number
  resumeScore?: number
  profileStrength?: number
  skills?: string[]
  currentRole?: string
  education?: Education[]
  workHistory?: WorkExperience[]
}

export interface Employer extends User {
  role: 'employer'
  companyName: string
  companyLogo?: string
  industry?: string
  companySize?: string
  website?: string
  gst?: string
}

export interface Education {
  id: string
  degree: string
  institution: string
  year: string
  grade?: string
}

export interface WorkExperience {
  id: string
  title: string
  company: string
  location?: string
  from: string
  to?: string
  current: boolean
  description?: string
}

export interface Job {
  id: string
  title: string
  company: string
  companyLogo?: string
  location: string
  salaryMin: number
  salaryMax: number
  experience: string
  skills: string[]
  postedAt: Date
  type: 'full-time' | 'part-time' | 'contract' | 'internship' | 'freelance'
  workMode: 'remote' | 'hybrid' | 'onsite'
  description?: string
  requirements?: string[]
  responsibilities?: string[]
  benefits?: string[]
  applicants?: number
  status: 'active' | 'paused' | 'closed' | 'draft'
  industry?: string
  department?: string
  companyRating?: number
  isSaved?: boolean
  isApplied?: boolean
  employerId: string
}

export interface Application {
  id: string
  jobId: string
  candidateId: string
  job?: Job
  candidate?: Candidate
  status: 'applied' | 'under-review' | 'shortlisted' | 'interview' | 'offer' | 'hired' | 'rejected'
  appliedAt: Date
  updatedAt: Date
  coverLetter?: string
  resume?: string
  notes?: string
}

export interface Interview {
  id: string
  applicationId: string
  jobTitle: string
  company: string
  companyLogo?: string
  date: Date
  time: string
  type: 'phone' | 'video' | 'in-person' | 'technical'
  status: 'scheduled' | 'completed' | 'cancelled' | 'rescheduled'
  meetingLink?: string
  location?: string
  notes?: string
}

export interface Notification {
  id: string
  type: 'application' | 'interview' | 'message' | 'job-alert' | 'system'
  title: string
  body: string
  read: boolean
  createdAt: Date
  link?: string
}

export interface Company {
  id: string
  name: string
  logo?: string
  industry: string
  size: string
  rating: number
  openPositions: number
  location: string
  description?: string
  website?: string
  founded?: string
}

export interface FilterState {
  search: string
  location: string[]
  salaryMin: number
  salaryMax: number
  experience: string[]
  skills: string[]
  workMode: string[]
  industry: string[]
  type: string[]
}
