import { createBrowserRouter, Navigate } from 'react-router-dom'
import Landing from '@/pages/Landing'
import { CandidateLayout } from '@/layouts/CandidateLayout'
import { EmployerLayout } from '@/layouts/EmployerLayout'
import { AdminLayout } from '@/layouts/AdminLayout'
import { AuthGuard } from '@/components/shared/AuthGuard'

// Candidate pages
import CandidateDashboard from '@/pages/candidate/Dashboard'
import CandidateJobs from '@/pages/candidate/Jobs'
import JobDetail from '@/pages/candidate/JobDetail'
import Applications from '@/pages/candidate/Applications'
import CandidateRegister from '@/pages/candidate/Register'
import CandidatePayment from '@/pages/candidate/Payment'
import CandidateProfile from '@/pages/candidate/Profile'
import SavedJobs from '@/pages/candidate/SavedJobs'
import CandidateInterviews from '@/pages/candidate/Interviews'
import BrowseCompanies from '@/pages/candidate/BrowseCompanies'
import CandidateMessages from '@/pages/candidate/Messages'
import CandidateNotifications from '@/pages/candidate/Notifications'
import CareerGuide from '@/pages/candidate/CareerGuide'
import ResumeBuilder from '@/pages/candidate/ResumeBuilder'
import CandidateSettings from '@/pages/candidate/Settings'

// Employer pages
import EmployerRegister from '@/pages/employer/Register'
import EmployerDashboard from '@/pages/employer/Dashboard'
import PostJob from '@/pages/employer/PostJob'
import ManageJobs from '@/pages/employer/ManageJobs'
import EmployerApplications from '@/pages/employer/EmployerApplications'
import CandidateDB from '@/pages/employer/CandidateDB'
import EmployerInterviews from '@/pages/employer/EmployerInterviews'
import Analytics from '@/pages/employer/Analytics'
import Payments from '@/pages/employer/Payments'
import CompanyProfile from '@/pages/employer/CompanyProfile'
import EmployerSettings from '@/pages/employer/EmployerSettings'

// Admin pages
import AdminLogin from '@/pages/admin/Login'
import AdminDashboard from '@/pages/admin/Dashboard'
import AdminCompanies from '@/pages/admin/Companies'
import AdminCandidates from '@/pages/admin/Candidates'
import AdminJobs from '@/pages/admin/Jobs'
import AdminSettings from '@/pages/admin/Settings'

export const router = createBrowserRouter([
  {
    path: '/',
    element: <Landing />,
  },
  {
    path: '/candidate/register',
    element: <CandidateRegister />,
  },
  {
    path: '/candidate/payment',
    element: <CandidatePayment />,
  },
  {
    path: '/employer/register',
    element: <EmployerRegister />,
  },
  {
    path: '/admin/login',
    element: <AdminLogin />,
  },
  {
    path: '/candidate',
    element: <CandidateLayout />,
    children: [
      { index: true, element: <Navigate to="/candidate/dashboard" replace /> },
      { path: 'dashboard',     element: <CandidateDashboard /> },
      { path: 'jobs',          element: <CandidateJobs /> },
      { path: 'jobs/:id',      element: <JobDetail /> },
      { path: 'applications',  element: <Applications /> },
      { path: 'saved',         element: <SavedJobs /> },
      { path: 'interviews',    element: <CandidateInterviews /> },
      { path: 'companies',     element: <BrowseCompanies /> },
      { path: 'messages',      element: <CandidateMessages /> },
      { path: 'notifications', element: <CandidateNotifications /> },
      { path: 'career-guide',  element: <CareerGuide /> },
      { path: 'resume-builder',element: <ResumeBuilder /> },
      { path: 'profile',       element: <CandidateProfile /> },
      { path: 'settings',      element: <CandidateSettings /> },
    ],
  },
  {
    path: '/employer',
    element: <EmployerLayout />,
    children: [
      { index: true, element: <Navigate to="/employer/dashboard" replace /> },
      { path: 'dashboard',    element: <EmployerDashboard /> },
      { path: 'post-job',     element: <PostJob /> },
      { path: 'jobs',         element: <ManageJobs /> },
      { path: 'applications', element: <EmployerApplications /> },
      { path: 'candidates',   element: <CandidateDB /> },
      { path: 'interviews',   element: <EmployerInterviews /> },
      { path: 'analytics',    element: <Analytics /> },
      { path: 'payments',     element: <Payments /> },
      { path: 'company',      element: <CompanyProfile /> },
      { path: 'settings',     element: <EmployerSettings /> },
    ],
  },
  {
    path: '/admin',
    element: <AuthGuard role="admin"><AdminLayout /></AuthGuard>,
    children: [
      { index: true, element: <Navigate to="/admin/dashboard" replace /> },
      { path: 'dashboard',  element: <AdminDashboard /> },
      { path: 'companies',  element: <AdminCompanies /> },
      { path: 'candidates', element: <AdminCandidates /> },
      { path: 'jobs',       element: <AdminJobs /> },
      { path: 'settings',   element: <AdminSettings /> },
    ],
  },
  {
    path: '*',
    element: (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <div className="text-6xl mb-4">404</div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Page not found</h1>
        <a href="/" className="text-[#F7A607] hover:underline">Go home</a>
      </div>
    ),
  },
])
