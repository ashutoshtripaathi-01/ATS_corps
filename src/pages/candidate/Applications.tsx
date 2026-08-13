import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Briefcase, Clock, CheckCircle, MapPin, IndianRupee } from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useAppStore } from '@/store/useAppStore'
import { getCandidateApplications } from '@/lib/api'

interface Application {
  id: number; job_id: number; status: string; created_at: string;
  manpower_type: string; location: string; salary_range: string;
  salary_min: number; salary_max: number; company_name: string | null; company_district: string | null;
}

const STATUS_STYLE: Record<string, string> = {
  applied:       'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  'under-review':'bg-purple-50 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
  shortlisted:   'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  interview:     'bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300',
  offer:         'bg-teal-50 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300',
  hired:         'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
  rejected:      'bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400',
}

function AppCard({ app }: { app: Application }) {
  const navigate = useNavigate()
  const daysAgo  = Math.floor((Date.now() - new Date(app.created_at).getTime()) / 86400000)
  return (
    <div onClick={() => navigate(`/candidate/jobs/${app.job_id}`)}
      className="bg-white dark:bg-[#1e2227] border border-gray-100 dark:border-white/8 rounded-2xl p-5 shadow-sm cursor-pointer hover:border-[#F7A607]/40 hover:shadow-md transition-all"
    >
      <div className="flex items-start gap-3 mb-3">
        <div className="w-10 h-10 rounded-xl bg-[#292e31] flex items-center justify-center shrink-0">
          <Briefcase className="w-4 h-4 text-[#F7A607]" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-sm text-gray-900 dark:text-[#F0EFEA] truncate">{app.manpower_type}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{app.company_name ?? 'Government / PSU'}</p>
        </div>
        <span className={`inline-flex text-[10px] font-semibold px-2.5 py-1 rounded-full shrink-0 ${STATUS_STYLE[app.status] ?? 'bg-gray-100 text-gray-600'}`}>
          {app.status.charAt(0).toUpperCase() + app.status.slice(1)}
        </span>
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-gray-500 dark:text-gray-400">
        <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{app.location}</span>
        <span className="flex items-center gap-1 text-[#F7A607] font-semibold">
          <IndianRupee className="w-3 h-3" />
          {app.salary_min > 0
            ? `${(app.salary_min / 1000).toFixed(0)}k – ${app.salary_max > 0 ? (app.salary_max / 1000).toFixed(0) + 'k' : 'above'}`
            : app.salary_range}
        </span>
        <span className="flex items-center gap-1 ml-auto">
          <Clock className="w-3 h-3" />
          {daysAgo === 0 ? 'Applied today' : `Applied ${daysAgo}d ago`}
        </span>
      </div>
    </div>
  )
}

const EmptyState = () => (
  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
    className="bg-white dark:bg-[#1e2227] border border-gray-100 dark:border-white/8 rounded-2xl p-16 text-center shadow-sm"
  >
    <div className="w-14 h-14 rounded-2xl bg-gray-100 dark:bg-white/10 flex items-center justify-center mx-auto mb-4">
      <Briefcase className="w-7 h-7 text-gray-400" />
    </div>
    <p className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-1">No applications in this category</p>
    <p className="text-xs text-gray-400 dark:text-gray-500 max-w-xs mx-auto leading-relaxed">
      Once your profile is verified, browse jobs and apply directly from the platform.
    </p>
    <div className="flex items-center justify-center gap-6 mt-6 flex-wrap">
      {[
        { icon: CheckCircle, label: 'Profile submitted', done: true },
        { icon: Clock,       label: 'Under verification', done: false },
        { icon: Briefcase,   label: 'Employer matching',  done: false },
      ].map(({ icon: Icon, label, done }) => (
        <div key={label} className="flex flex-col items-center gap-1.5">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center ${done ? 'bg-[#F7A607]/15' : 'bg-gray-100 dark:bg-white/10'}`}>
            <Icon className={`w-4 h-4 ${done ? 'text-[#F7A607]' : 'text-gray-400'}`} />
          </div>
          <span className="text-[10px] text-gray-500 text-center max-w-[70px] leading-tight">{label}</span>
        </div>
      ))}
    </div>
  </motion.div>
)

export default function Applications() {
  const { user }  = useAppStore()
  const [apps,    setApps]   = useState<Application[]>([])
  const [loading, setLoading]= useState(true)

  useEffect(() => {
    if (!user?.id || user.id === 'skip-test') { setLoading(false); return }
    getCandidateApplications(user.id).then(setApps).catch(console.error).finally(() => setLoading(false))
  }, [user?.id])

  const tabGroups = {
    all:       apps,
    active:    apps.filter(a => ['applied','under-review','shortlisted'].includes(a.status)),
    interview: apps.filter(a => a.status === 'interview'),
    offer:     apps.filter(a => ['offer','hired'].includes(a.status)),
  }
  const counts = {
    total: apps.length,
    review: apps.filter(a => ['under-review','shortlisted'].includes(a.status)).length,
    interview: apps.filter(a => a.status === 'interview').length,
    offer: apps.filter(a => ['offer','hired'].includes(a.status)).length,
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#13161a]">
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-10 py-6 lg:py-8">

        <div className="mb-6">
          <h1 className="text-2xl font-extrabold text-gray-900 dark:text-[#F0EFEA]" style={{ fontFamily: 'Plus Jakarta Sans' }}>
            My Applications
          </h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-0.5">Track the status of your job applications</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {[
            { label: 'Total Applied',  value: counts.total,     light: 'bg-blue-50 text-blue-700',    dark: 'dark:bg-blue-900/25 dark:text-blue-300' },
            { label: 'Under Review',   value: counts.review,    light: 'bg-yellow-50 text-yellow-700', dark: 'dark:bg-yellow-900/25 dark:text-yellow-300' },
            { label: 'Interviews',     value: counts.interview, light: 'bg-purple-50 text-purple-700', dark: 'dark:bg-purple-900/25 dark:text-purple-300' },
            { label: 'Offers',         value: counts.offer,     light: 'bg-green-50 text-green-700',   dark: 'dark:bg-green-900/25 dark:text-green-300' },
          ].map(s => (
            <div key={s.label} className={`rounded-2xl p-5 ${s.light} ${s.dark}`}>
              {loading
                ? <div className="h-8 w-8 bg-current opacity-20 rounded animate-pulse mb-1" />
                : <p className="text-3xl font-extrabold">{s.value}</p>
              }
              <p className="text-xs font-medium opacity-80 mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>

        <Tabs defaultValue="all">
          <TabsList className="mb-5">
            {(['all','active','interview','offer'] as const).map(t => (
              <TabsTrigger key={t} value={t}>
                {t.charAt(0).toUpperCase() + t.slice(1)}
                <span className="ml-1 text-xs opacity-70">({tabGroups[t].length})</span>
              </TabsTrigger>
            ))}
          </TabsList>
          {(['all','active','interview','offer'] as const).map(t => (
            <TabsContent key={t} value={t}>
              {loading ? (
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                  {[1,2].map(i => <div key={i} className="h-28 bg-white dark:bg-[#1e2227] border border-gray-100 dark:border-white/8 rounded-2xl animate-pulse" />)}
                </div>
              ) : tabGroups[t].length > 0 ? (
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                  {tabGroups[t].map(app => <AppCard key={app.id} app={app} />)}
                </div>
              ) : (
                <EmptyState />
              )}
            </TabsContent>
          ))}
        </Tabs>
      </div>
    </div>
  )
}
