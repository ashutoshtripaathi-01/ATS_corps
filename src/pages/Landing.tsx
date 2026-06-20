import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  ArrowRight,
  Shield,
  Users,
  Building2,
  CheckCircle,
  Zap,
  MapPin,
  Star,
  Briefcase,
  UserCheck,
  Award,
  ChevronRight,
  IndianRupee,
  Phone,
  ClipboardList,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Navbar } from '@/components/shared/Navbar';
import { RoleSelectModal } from '@/components/shared/RoleSelectModal';
import { AnimatedCounter } from '@/components/shared/AnimatedCounter';
import { BRAND } from '@/constants';
import heroImage from '@/assets/cover.png';
import heroBg from '@/assets/cover 1.png';
import companyLogo from '@/assets/company logo.png';

/* ─── Static data ────────────────────────────────────────────────────────── */

const PARTNERS = [
  {
    abbr: 'HPCL',
    full: 'Hindustan Petroleum',
    bg: 'bg-green-50',
    border: 'border-green-200',
    text: 'text-green-800',
  },
  {
    abbr: 'NEEPCO',
    full: 'NE Electric Power Corp.',
    bg: 'bg-blue-50',
    border: 'border-blue-200',
    text: 'text-blue-800',
  },
  {
    abbr: 'OIL',
    full: 'Oil India Limited',
    bg: 'bg-orange-50',
    border: 'border-orange-200',
    text: 'text-orange-800',
  },
  {
    abbr: 'ONGC',
    full: 'Oil & Natural Gas Corp.',
    bg: 'bg-red-50',
    border: 'border-red-200',
    text: 'text-red-800',
  },
  {
    abbr: 'NRL',
    full: 'Numaligarh Refinery Ltd.',
    bg: 'bg-purple-50',
    border: 'border-purple-200',
    text: 'text-purple-800',
  },
  {
    abbr: 'BVFCL',
    full: 'Brahmaputra Valley Fertilizer',
    bg: 'bg-teal-50',
    border: 'border-teal-200',
    text: 'text-teal-800',
  },
];

const WHO_WE_SERVE = [
  {
    icon: Shield,
    label: 'Ex-Servicemen',
    desc: 'Army, Navy, Air Force & Para-Military veterans transitioning into civilian employment.',
    bg: 'bg-blue-50',
    color: 'text-blue-600',
    tags: ['Army', 'Navy', 'Air Force', 'Para Military'],
  },
  {
    icon: Briefcase,
    label: 'Security Personnel',
    desc: 'Armed & unarmed guards, supervisors, and response team professionals for deployment.',
    bg: 'bg-[#F7A607]/10',
    color: 'text-[#F7A607]',
    tags: ['Guard Unarmed', 'Guard Armed', 'Supervisor', 'QRT'],
  },
  {
    icon: Users,
    label: 'Industrial Workforce',
    desc: 'Operators, maintenance staff, and support personnel for industrial and infrastructure projects.',
    bg: 'bg-green-50',
    color: 'text-green-600',
    tags: ['Operators', 'Technicians', 'Support Staff'],
  },
  {
    icon: Award,
    label: 'Skilled Workers',
    desc: 'Drivers, dog handlers, traffic marshals, and other specialized skilled professionals.',
    bg: 'bg-purple-50',
    color: 'text-purple-600',
    tags: ['Drivers', 'Dog Handlers', 'Traffic Marshals'],
  },
  {
    icon: Building2,
    label: 'PSU & Government Organizations',
    desc: 'HPCL, NEEPCO, ONGC, Oil India, and public sector units requiring verified workforce.',
    bg: 'bg-gray-100',
    color: 'text-gray-700',
    tags: ['HPCL', 'NEEPCO', 'ONGC', 'Oil India'],
  },
  {
    icon: Zap,
    label: 'Private Sector Employers',
    desc: 'Private companies, tea estates, banks, and organizations needing reliable, screened workers.',
    bg: 'bg-orange-50',
    color: 'text-orange-600',
    tags: ['Tea Estates', 'Banks', 'Hospitality', 'Construction'],
  },
];

const WHY_EMPLOYERS = [
  {
    icon: UserCheck,
    title: 'Verified Workforce',
    desc: 'Every candidate undergoes profile verification before being recommended to your organization.',
    bg: 'bg-blue-50',
    color: 'text-blue-600',
  },
  {
    icon: Zap,
    title: 'Faster Hiring',
    desc: 'Receive a shortlisted pool of qualified candidates matched to your specific workforce requirements.',
    bg: 'bg-[#F7A607]/10',
    color: 'text-[#F7A607]',
  },
  {
    icon: ClipboardList,
    title: 'Recruitment Support',
    desc: 'Ex-Serviceman Jobs actively supports you throughout the hiring, screening, and placement process.',
    bg: 'bg-green-50',
    color: 'text-green-600',
  },
  {
    icon: MapPin,
    title: 'Location-Based Deployment',
    desc: 'Find candidates based on district, region, shift requirement, and deployment availability.',
    bg: 'bg-purple-50',
    color: 'text-purple-600',
  },
];

const HOW_CANDIDATE = [
  {
    n: '01',
    title: 'Register Profile',
    desc: 'Submit your details, skills, and workforce experience.',
  },
  {
    n: '02',
    title: 'Submit Documents',
    desc: 'Upload service records, identity proof, and certificates.',
  },
  {
    n: '03',
    title: 'Verification Process',
    desc: 'Ex-Serviceman Jobs verifies your documents and background.',
  },
  {
    n: '04',
    title: 'Pay Placement Fee',
    desc: 'One-time location-based fee to activate employer matching.',
  },
  {
    n: '05',
    title: 'Employer Matching',
    desc: 'We match your profile to verified employer requirements.',
  },
  {
    n: '06',
    title: 'Placement Support',
    desc: 'Ex-Serviceman Jobs supports you through interview and final hiring.',
  },
];

const HOW_EMPLOYER = [
  {
    n: '01',
    title: 'Register Organization',
    desc: 'List your company and pay the portal registration fee.',
  },
  {
    n: '02',
    title: 'Submit Requirements',
    desc: 'Specify manpower type, quantity, location, and salary.',
  },
  {
    n: '03',
    title: 'ATS Screening',
    desc: 'Ex-Serviceman Jobs screens and verifies suitable candidates.',
  },
  {
    n: '04',
    title: 'Candidate Matching',
    desc: 'Receive a shortlisted pool matching your criteria.',
  },
  {
    n: '05',
    title: 'Conduct Interviews',
    desc: 'Interview pre-screened, background-verified candidates.',
  },
  {
    n: '06',
    title: 'Hiring Support',
    desc: 'Ex-Serviceman Jobs assists with onboarding and documentation.',
  },
];

const STATS = [
  {
    value: 500,
    suffix: '+',
    label: 'Verified Candidates',
    sub: 'Professionals registered',
    icon: UserCheck,
    bg: 'bg-blue-50',
    color: 'text-blue-600',
  },
  {
    value: 12,
    suffix: '+',
    label: 'Partner Organizations',
    sub: 'PSUs & companies onboarded',
    icon: Building2,
    bg: 'bg-[#F7A607]/10',
    color: 'text-[#F7A607]',
  },
  {
    value: 15,
    suffix: '+',
    label: 'Districts Covered',
    sub: 'Across Assam & NE India',
    icon: MapPin,
    bg: 'bg-green-50',
    color: 'text-green-600',
  },
  {
    value: 95,
    suffix: '%',
    label: 'Placement Success Rate',
    sub: 'Placements successfully closed',
    icon: Award,
    bg: 'bg-purple-50',
    color: 'text-purple-600',
  },
];

const TESTIMONIALS = [
  {
    name: 'Rajiv Borah',
    rank: 'Ex-Army, Havildar',
    service: '18 years service',
    placedAt: 'HPCL Assam Division',
    force: 'Army',
    quote:
      'Ex-Serviceman Jobs handled my verification and placement professionally. The process was smooth, transparent, and faster than I expected.',
  },
  {
    name: 'Bikash Kalita',
    rank: 'Ex-BSF, Head Constable',
    service: '14 years service',
    placedAt: 'Jorhat Tea Estate',
    force: 'Para Military',
    quote:
      'I submitted my documents and Ex-Serviceman Jobs did the rest. Now I am employed close to home with a stable salary and good working conditions.',
  },
  {
    name: 'Pranjal Das',
    rank: 'Retired Subedar Major',
    service: '22 years service',
    placedAt: 'NEEPCO Umiam',
    force: 'Army',
    quote:
      'Ex-Serviceman Jobs matched me to a position that fits my rank and experience. The employer already knew my background when I walked in for the interview.',
  },
];

const FORCE_CHIP: Record<string, string> = {
  Army: 'bg-green-100 text-green-700',
  'Para Military': 'bg-orange-100 text-orange-700',
  Navy: 'bg-blue-100 text-blue-700',
  'Air Force': 'bg-sky-100 text-sky-700',
};

/* ─── Page ───────────────────────────────────────────────────────────────── */

export default function Landing() {
  const [modalOpen, setModalOpen] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('register');

  const openAuth = (mode: 'login' | 'register' = 'register') => {
    setAuthMode(mode);
    setModalOpen(true);
  };

  return (
    <div className='min-h-screen bg-white overflow-x-hidden'>
      <Navbar />

      {/* ══════════════════════════════════════════
          HERO
      ══════════════════════════════════════════ */}
      <section className='relative pt-28 pb-24 overflow-hidden'>
        {/* Background image */}
        <div
          className='absolute inset-0 bg-cover bg-center'
          style={{ backgroundImage: `url(${heroBg})` }}
        />
        {/* Layered overlays — near-solid on the left so the copy is crisp and
            high-contrast, fading right so the photograph stays visible. */}
        <div className='absolute inset-0 bg-gradient-to-r from-white via-white/92 to-white/60' />
        <div className='absolute inset-0 bg-gradient-to-t from-white/85 via-transparent to-white/30' />

        <div className='absolute inset-0 pointer-events-none overflow-hidden'>
          <div className='absolute -top-32 -right-32 w-96 h-96 rounded-full bg-[#F7A607]/10 blur-3xl' />
          <div className='absolute -bottom-16 -left-16 w-72 h-72 rounded-full bg-blue-500/5 blur-3xl' />
        </div>

        <div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10'>
          <div className='grid grid-cols-1 lg:grid-cols-2 gap-14 items-center'>
            {/* Left — Copy */}
            <motion.div
              initial={{ opacity: 0, y: 28 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55 }}
            >
              <div className='inline-flex items-center gap-2 bg-white/90 backdrop-blur-sm rounded-full px-4 py-1.5 mb-6 shadow-sm ring-1 ring-gray-200'>
                <Shield className='w-4 h-4 text-[#F7A607]' />
                <span className='text-sm font-semibold text-[#292e31]'>
                  Workforce Recruitment &amp; Staffing Partner · Assam &amp;
                  Northeast India
                </span>
              </div>

              <h1
                className='text-5xl lg:text-6xl font-extrabold text-[#1a1d1f] leading-[1.08] mb-5'
                style={{
                  fontFamily: 'Plus Jakarta Sans',
                  letterSpacing: '-0.5px',
                }}
              >
                Connecting{' '}
                <span className='text-[#F7A607] relative'>
                  Ex-Serviceman Workforce
                  <svg
                    className='absolute -bottom-1 left-0 w-full'
                    height='6'
                    viewBox='0 0 300 6'
                  >
                    <path
                      d='M0 5 Q150 0 300 5'
                      stroke='#F7A607'
                      strokeWidth='2.5'
                      fill='none'
                      strokeLinecap='round'
                    />
                  </svg>
                </span>
                <br />
                With Trusted Employers
              </h1>

              <div className='flex flex-wrap gap-3 mb-8'>
                <Button
                  size='xl'
                  variant='dark'
                  onClick={() => openAuth('register')}
                  className='group gap-2 rounded-xl'
                >
                  Find Employment
                  <ArrowRight className='w-5 h-5 transition-transform group-hover:translate-x-1' />
                </Button>
                <Button
                  size='xl'
                  variant='outline'
                  onClick={() => openAuth('register')}
                  className='gap-2 rounded-xl bg-white/95 border-gray-300 text-[#292e31] hover:bg-[#F7A607] hover:text-white hover:border-[#F7A607]'
                >
                  Hire Talent
                  <Building2 className='w-5 h-5' />
                </Button>
              </div>

              <div className='flex flex-wrap items-center gap-3'>
                {[
                  { icon: CheckCircle, text: 'Verified candidate profiles' },
                  { icon: Shield, text: 'Background screened' },
                  { icon: MapPin, text: 'All of Assam & NE India' },
                ].map(({ icon: Icon, text }) => (
                  <span
                    key={text}
                    className='flex items-center gap-1.5 text-sm font-medium text-[#292e31] bg-white/85 backdrop-blur-sm rounded-full px-3 py-1.5 shadow-sm ring-1 ring-gray-200'
                  >
                    <Icon className='w-4 h-4 text-[#F7A607]' />
                    {text}
                  </span>
                ))}
              </div>
            </motion.div>

            {/* Right — Hero image */}
            <motion.div
              initial={{ opacity: 0, x: 36 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.65, delay: 0.18 }}
              className='relative hidden lg:block'
            >
              {/* Square crop (matches reference ratio), reduced size, with the
                  green caption bar overlaid at the bottom. */}
              <div className='relative mx-auto w-full max-w-md aspect-[4/5] rounded-3xl overflow-hidden shadow-2xl ring-1 ring-black/10'>
                <img
                  src={heroImage}
                  alt='Modern day soldier handling advanced weapon and communication systems'
                  className='w-full h-full object-cover object-top'
                />
                {/* Green caption bar */}
                <div className='absolute inset-x-0 bottom-0 bg-[#5f7355]/95 px-5 py-3'>
                  <p className='text-center text-white text-sm font-medium leading-snug tracking-wide'>
                    Modern day soldier is handling Technologically Advanced
                    Weapon, Radar &amp; Communication Systems and is tech savvy!
                  </p>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════
          TRUST STRIP — Partners
      ══════════════════════════════════════════ */}
      <section className='bg-[#1a1d1f] py-10 border-t border-white/5'>
        <div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8'>
          <div className='text-center mb-5'>
            <p className='text-sm font-semibold text-gray-300'>
              Trusted by Leading Organizations
            </p>
            <p className='text-xs text-gray-500 mt-1'>
              Supporting workforce recruitment for public sector organizations,
              security agencies, and private employers.
            </p>
          </div>
          <div className='flex flex-wrap items-center justify-center gap-3 mb-5'>
            {PARTNERS.map((p) => (
              <div
                key={p.abbr}
                className={`flex items-center gap-2 ${p.bg} ${p.border} border rounded-xl px-3.5 py-2`}
              >
                <span className={`text-sm font-extrabold ${p.text}`}>
                  {p.abbr}
                </span>
                <span className='text-xs text-gray-500 hidden xl:block'>
                  {p.full}
                </span>
              </div>
            ))}
          </div>
          <div className='flex justify-center'>
            <div
              className='inline-flex items-center gap-2 px-4 py-2 border border-dashed border-[#F7A607]/40 rounded-xl cursor-pointer hover:border-[#F7A607] transition-colors'
              onClick={() => openAuth('register')}
            >
              <span className='text-xs font-semibold text-[#F7A607]'>
                + Register Your Company
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════
          HOW Ex-Serviceman Jobs SUPPORTS RECRUITMENT
      ══════════════════════════════════════════ */}
      <section className='py-20 bg-white'>
        <div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8'>
          <div className='text-center mb-14'>
            <div className='inline-flex items-center gap-2 bg-[#F7A607]/10 rounded-full px-4 py-1.5 mb-4'>
              <Zap className='w-4 h-4 text-[#F7A607]' />
              <span className='text-sm font-semibold text-[#F7A607]'>
                Our Process
              </span>
            </div>
            <h2
              className='text-4xl font-extrabold text-gray-900 mb-4'
              style={{ fontFamily: 'Plus Jakarta Sans' }}
            >
              How Ex-Serviceman Jobs Supports Recruitment
            </h2>
            <p className='text-gray-500 text-lg max-w-2xl mx-auto leading-relaxed'>
              Ex-Serviceman Jobs manages candidate verification, workforce
              matching, employer requirements, and placement coordination to
              ensure successful hiring outcomes.
            </p>
          </div>

          {/* Three-party diagram */}
          <div className='flex flex-col md:flex-row items-center justify-center gap-4 md:gap-0 mb-16'>
            {/* Employer box */}
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
              className='bg-gray-50 border border-gray-200 rounded-2xl p-6 text-center w-full max-w-[220px]'
            >
              <div className='w-12 h-12 rounded-xl bg-[#292e31] flex items-center justify-center mx-auto mb-3'>
                <Building2 className='w-5 h-5 text-[#F7A607]' />
              </div>
              <p
                className='font-extrabold text-gray-900 mb-1'
                style={{ fontFamily: 'Plus Jakarta Sans' }}
              >
                Employer
              </p>
              <p className='text-xs text-gray-500 leading-snug'>
                Posts manpower requirements, pays registration fee
              </p>
            </motion.div>

            {/* Arrow + Ex-Serviceman Jobs */}
            <div className='flex flex-col md:flex-row items-center gap-0 md:gap-0'>
              <motion.div
                initial={{ scaleX: 0 }}
                whileInView={{ scaleX: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: 0.2 }}
                className='hidden md:block h-0.5 w-12 bg-[#F7A607]/40 origin-left'
              />
              <div className='w-3 h-3 rounded-full bg-[#F7A607]/40 hidden md:block' />

              <motion.div
                initial={{ opacity: 0, scale: 0.85 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: 0.3 }}
                className='relative mx-4'
              >
                <div className='bg-[#292e31] rounded-2xl p-5 text-center shadow-2xl shadow-[#292e31]/20 relative z-10 w-56'>
                  <img
                    src={companyLogo}
                    alt='Ex-Serviceman Jobs'
                    className='w-12 h-12 object-contain mx-auto mb-3'
                  />
                  <p
                    className='font-extrabold text-white text-base mb-1'
                    style={{ fontFamily: 'Plus Jakarta Sans' }}
                  >
                    Ex-Serviceman Jobs
                  </p>
                  <p className='text-xs text-gray-400 leading-snug'>
                    Verification · Screening · Matching · Placement
                  </p>
                  <div className='absolute -top-2 -right-2 bg-[#F7A607] rounded-full px-2 py-0.5'>
                    <span className='text-[10px] font-bold text-white'>
                      Middle Layer
                    </span>
                  </div>
                </div>
              </motion.div>

              <div className='w-3 h-3 rounded-full bg-[#F7A607]/40 hidden md:block' />
              <motion.div
                initial={{ scaleX: 0 }}
                whileInView={{ scaleX: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: 0.2 }}
                className='hidden md:block h-0.5 w-12 bg-[#F7A607]/40 origin-right'
              />
            </div>

            {/* Candidate box */}
            <motion.div
              initial={{ opacity: 0, x: 30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
              className='bg-gray-50 border border-gray-200 rounded-2xl p-6 text-center w-full max-w-[220px]'
            >
              <div className='w-12 h-12 rounded-xl bg-blue-600 flex items-center justify-center mx-auto mb-3'>
                <Shield className='w-5 h-5 text-white' />
              </div>
              <p
                className='font-extrabold text-gray-900 mb-1'
                style={{ fontFamily: 'Plus Jakarta Sans' }}
              >
                Candidate
              </p>
              <p className='text-xs text-gray-500 leading-snug'>
                Verified, matched, and placed by Ex-Serviceman Jobs
              </p>
            </motion.div>
          </div>

          {/* 3 value props */}
          <div className='grid grid-cols-1 md:grid-cols-3 gap-6'>
            {[
              {
                icon: UserCheck,
                title: 'Verified Profiles',
                desc: 'Every candidate is verified before placement. Employers receive pre-screened, background-checked personnel.',
                bg: 'bg-blue-50',
                color: 'text-blue-600',
              },
              {
                icon: Zap,
                title: 'Workforce Matching',
                desc: 'Ex-Serviceman Jobs matches candidate skills, experience, and location preference against employer requirements.',
                bg: 'bg-[#F7A607]/10',
                color: 'text-[#F7A607]',
              },
              {
                icon: CheckCircle,
                title: 'End-to-End Placement',
                desc: 'From registration to final hire, Ex-Serviceman Jobs manages the complete recruitment workflow for both parties.',
                bg: 'bg-green-50',
                color: 'text-green-600',
              },
            ].map(({ icon: Icon, title, desc, bg, color }, i) => (
              <motion.div
                key={title}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.45, delay: i * 0.12 }}
                className='bg-white border border-gray-100 rounded-2xl p-6 shadow-sm'
              >
                <div
                  className={`w-12 h-12 rounded-2xl ${bg} flex items-center justify-center mb-4`}
                >
                  <Icon className={`w-6 h-6 ${color}`} />
                </div>
                <h3
                  className='font-bold text-gray-900 mb-2'
                  style={{ fontFamily: 'Plus Jakarta Sans' }}
                >
                  {title}
                </h3>
                <p className='text-sm text-gray-500 leading-relaxed'>{desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════
          WHY EMPLOYERS CHOOSE Ex-Serviceman Jobs
      ══════════════════════════════════════════ */}
      <section className='py-20 bg-[#f8f9fc]'>
        <div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8'>
          <div className='text-center mb-12'>
            <div className='inline-flex items-center gap-2 bg-[#292e31]/8 rounded-full px-4 py-1.5 mb-4'>
              <Building2 className='w-4 h-4 text-[#292e31]' />
              <span className='text-sm font-semibold text-[#292e31]'>
                For Employers
              </span>
            </div>
            <h2
              className='text-4xl font-extrabold text-gray-900 mb-3'
              style={{ fontFamily: 'Plus Jakarta Sans' }}
            >
              Why Employers Choose Ex-Serviceman Jobs
            </h2>
            <p className='text-gray-500 text-lg max-w-xl mx-auto'>
              We take the complexity out of workforce recruitment and deliver
              results your organization can rely on.
            </p>
          </div>

          <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5'>
            {WHY_EMPLOYERS.map(({ icon: Icon, title, desc, bg, color }, i) => (
              <motion.div
                key={title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.1 }}
                className='bg-white border border-gray-100 rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow'
              >
                <div
                  className={`w-12 h-12 rounded-2xl ${bg} flex items-center justify-center mb-4`}
                >
                  <Icon className={`w-6 h-6 ${color}`} />
                </div>
                <h3
                  className='font-bold text-gray-900 mb-2'
                  style={{ fontFamily: 'Plus Jakarta Sans' }}
                >
                  {title}
                </h3>
                <p className='text-sm text-gray-500 leading-relaxed'>{desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════
          WHO WE SERVE
      ══════════════════════════════════════════ */}
      <section className='py-20 bg-white'>
        <div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8'>
          <div className='text-center mb-12'>
            <h2
              className='text-4xl font-extrabold text-gray-900 mb-3'
              style={{ fontFamily: 'Plus Jakarta Sans' }}
            >
              Who We Serve
            </h2>
            <p className='text-gray-500 text-lg max-w-xl mx-auto'>
              Ex-Serviceman Jobs connects a wide range of workforce
              professionals with employers across Assam and Northeast India.
            </p>
          </div>

          <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5'>
            {WHO_WE_SERVE.map(
              ({ icon: Icon, label, desc, bg, color, tags }, i) => (
                <motion.div
                  key={label}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.4, delay: i * 0.08 }}
                  className='bg-white border border-gray-100 rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow'
                >
                  <div
                    className={`w-11 h-11 rounded-xl ${bg} flex items-center justify-center mb-4`}
                  >
                    <Icon className={`w-5 h-5 ${color}`} />
                  </div>
                  <h3
                    className='font-bold text-gray-900 text-base mb-2'
                    style={{ fontFamily: 'Plus Jakarta Sans' }}
                  >
                    {label}
                  </h3>
                  <p className='text-xs text-gray-500 leading-relaxed mb-3'>
                    {desc}
                  </p>
                  <div className='flex flex-wrap gap-1'>
                    {tags.map((t) => (
                      <span
                        key={t}
                        className='text-[10px] font-semibold text-gray-600 bg-gray-100 px-2 py-0.5 rounded-full'
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                </motion.div>
              ),
            )}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════
          HOW IT WORKS — Two-track
      ══════════════════════════════════════════ */}
      <section className='py-20 bg-[#f8f9fc]'>
        <div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8'>
          <div className='text-center mb-14'>
            <h2
              className='text-4xl font-extrabold text-gray-900 mb-3'
              style={{ fontFamily: 'Plus Jakarta Sans' }}
            >
              How Ex-Serviceman Jobs Works
            </h2>
            <p className='text-gray-500 text-base'>
              A structured, transparent process for both candidates and
              employers.
            </p>
          </div>

          <div className='grid grid-cols-1 lg:grid-cols-2 gap-8'>
            {/* Candidate track */}
            <div className='bg-gradient-to-br from-[#0b1e62] to-[#2563eb] rounded-3xl p-7 text-white'>
              <div className='flex items-center gap-3 mb-7'>
                <div className='w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center'>
                  <Shield className='w-5 h-5 text-white' />
                </div>
                <div>
                  <p
                    className='font-extrabold text-base'
                    style={{ fontFamily: 'Plus Jakarta Sans' }}
                  >
                    For Candidates
                  </p>
                  <p className='text-xs text-blue-200'>
                    Ex-servicemen, security professionals &amp; skilled workers
                  </p>
                </div>
              </div>
              <div className='space-y-3'>
                {HOW_CANDIDATE.map(({ n, title, desc }, i) => (
                  <div key={n} className='flex gap-4'>
                    <div className='flex flex-col items-center'>
                      <div className='w-8 h-8 rounded-xl bg-[#F7A607] flex items-center justify-center shrink-0'>
                        <span className='text-xs font-extrabold text-white'>
                          {n}
                        </span>
                      </div>
                      {i < HOW_CANDIDATE.length - 1 && (
                        <div className='w-0.5 h-4 bg-white/15 mt-1.5' />
                      )}
                    </div>
                    <div className='pb-1'>
                      <p
                        className='font-bold text-sm mb-0.5'
                        style={{ fontFamily: 'Plus Jakarta Sans' }}
                      >
                        {title}
                      </p>
                      <p className='text-xs text-blue-200 leading-snug'>
                        {desc}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
              <button
                onClick={() => openAuth('register')}
                className='mt-6 flex items-center gap-2 text-sm font-bold text-[#F7A607] hover:gap-3 transition-all'
              >
                Register as Candidate <ChevronRight className='w-4 h-4' />
              </button>
            </div>

            {/* Employer track */}
            <div className='bg-gradient-to-br from-[#1a0f04] via-[#7c3a08] to-[#d97706] rounded-3xl p-7 text-white'>
              <div className='flex items-center gap-3 mb-7'>
                <div className='w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center'>
                  <Building2 className='w-5 h-5 text-white' />
                </div>
                <div>
                  <p
                    className='font-extrabold text-base'
                    style={{ fontFamily: 'Plus Jakarta Sans' }}
                  >
                    For Employers
                  </p>
                  <p className='text-xs text-amber-200'>
                    PSUs, security agencies &amp; private companies
                  </p>
                </div>
              </div>
              <div className='space-y-3'>
                {HOW_EMPLOYER.map(({ n, title, desc }, i) => (
                  <div key={n} className='flex gap-4'>
                    <div className='flex flex-col items-center'>
                      <div className='w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center shrink-0'>
                        <span className='text-xs font-extrabold text-white'>
                          {n}
                        </span>
                      </div>
                      {i < HOW_EMPLOYER.length - 1 && (
                        <div className='w-0.5 h-4 bg-white/15 mt-1.5' />
                      )}
                    </div>
                    <div className='pb-1'>
                      <p
                        className='font-bold text-sm mb-0.5'
                        style={{ fontFamily: 'Plus Jakarta Sans' }}
                      >
                        {title}
                      </p>
                      <p className='text-xs text-amber-200 leading-snug'>
                        {desc}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
              <button
                onClick={() => openAuth('register')}
                className='mt-6 flex items-center gap-2 text-sm font-bold text-[#F7A607] hover:gap-3 transition-all'
              >
                Register Your Organization <ChevronRight className='w-4 h-4' />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════
          STATS
      ══════════════════════════════════════════ */}
      <section className='py-16 bg-[#1a1d1f] text-white'>
        <div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8'>
          <div className='grid grid-cols-2 lg:grid-cols-4 gap-8'>
            {STATS.map(
              ({ value, suffix, label, sub, icon: Icon, bg, color }, i) => (
                <motion.div
                  key={label}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.45, delay: i * 0.1 }}
                  className='flex flex-col items-center text-center'
                >
                  <div
                    className={`w-12 h-12 rounded-2xl ${bg} flex items-center justify-center mb-4`}
                  >
                    <Icon className={`w-6 h-6 ${color}`} />
                  </div>
                  <p
                    className='text-4xl font-extrabold text-white mb-1'
                    style={{ fontFamily: 'Plus Jakarta Sans' }}
                  >
                    <AnimatedCounter end={value} suffix={suffix} />
                  </p>
                  <p className='font-semibold text-gray-200 text-sm'>{label}</p>
                  <p className='text-gray-500 text-xs mt-0.5'>{sub}</p>
                </motion.div>
              ),
            )}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════
          TESTIMONIALS
      ══════════════════════════════════════════ */}
      <section className='py-20 bg-white'>
        <div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8'>
          <div className='text-center mb-12'>
            <h2
              className='text-4xl font-extrabold text-gray-900 mb-3'
              style={{ fontFamily: 'Plus Jakarta Sans' }}
            >
              Successful Placements by Ex-Serviceman Jobs
            </h2>
            <p className='text-gray-500 text-base'>
              Real candidates. Verified profiles. Trusted employers.
            </p>
          </div>

          <div className='grid grid-cols-1 md:grid-cols-3 gap-6'>
            {TESTIMONIALS.map((t, i) => (
              <motion.div
                key={t.name}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.1 }}
                className='bg-gray-50 rounded-2xl p-6 border border-gray-100 flex flex-col'
              >
                {/* Stars */}
                <div className='flex items-center gap-0.5 mb-4'>
                  {Array.from({ length: 5 }).map((_, idx) => (
                    <Star
                      key={idx}
                      className='w-4 h-4 text-[#F7A607] fill-[#F7A607]'
                    />
                  ))}
                </div>

                <p className='text-gray-700 text-sm leading-relaxed mb-4 flex-1'>
                  "{t.quote}"
                </p>

                {/* Placed at badge */}
                <div className='flex items-center gap-1.5 mb-4 px-3 py-2 bg-green-50 border border-green-100 rounded-xl w-fit'>
                  <CheckCircle className='w-3.5 h-3.5 text-green-600 shrink-0' />
                  <span className='text-xs font-semibold text-green-700'>
                    Placed at {t.placedAt}
                  </span>
                </div>

                <div className='flex items-center gap-3 pt-4 border-t border-gray-100'>
                  <div className='w-10 h-10 rounded-full bg-[#292e31] flex items-center justify-center shrink-0'>
                    <span className='text-xs font-extrabold text-[#F7A607]'>
                      {t.name
                        .split(' ')
                        .map((n) => n[0])
                        .join('')
                        .slice(0, 2)}
                    </span>
                  </div>
                  <div className='flex-1 min-w-0'>
                    <p className='font-semibold text-sm text-gray-900'>
                      {t.name}
                    </p>
                    <p className='text-xs text-gray-500'>{t.rank}</p>
                    <p className='text-[10px] text-gray-400 mt-0.5'>
                      {t.service}
                    </p>
                  </div>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${FORCE_CHIP[t.force] ?? 'bg-gray-100 text-gray-600'}`}
                  >
                    {t.force}
                  </span>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════
          DUAL CTA
      ══════════════════════════════════════════ */}
      <section className='py-20 bg-[#f8f9fc]'>
        <div className='max-w-5xl mx-auto px-4 sm:px-6 lg:px-8'>
          <div className='grid grid-cols-1 md:grid-cols-2 gap-5'>
            {/* Candidate CTA */}
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.45 }}
              className='bg-gradient-to-br from-[#0b1e62] to-[#2563eb] rounded-3xl p-8 text-white'
            >
              <div className='w-12 h-12 rounded-2xl bg-white/15 flex items-center justify-center mb-5'>
                <Shield className='w-6 h-6 text-white' />
              </div>
              <p className='text-xs font-bold text-blue-200 uppercase tracking-widest mb-2'>
                For Candidates
              </p>
              <h3
                className='text-2xl font-extrabold text-white mb-3 leading-tight'
                style={{ fontFamily: 'Plus Jakarta Sans' }}
              >
                Find Employment
                <br />
                Opportunities
              </h3>
              <p className='text-sm text-blue-200 leading-relaxed mb-6'>
                Register your profile and connect with verified employers across
                Assam. Ex-Serviceman Jobs handles your verification and
                placement from start to finish.
              </p>
              <ul className='space-y-2 mb-7'>
                {[
                  'Register once, get matched to multiple employers',
                  'Ex-Serviceman Jobs verifies your profile and documents',
                  'Location-based placement across Assam & NE India',
                ].map((f) => (
                  <li
                    key={f}
                    className='flex items-center gap-2 text-sm text-blue-100'
                  >
                    <CheckCircle className='w-4 h-4 text-[#F7A607] shrink-0' />
                    {f}
                  </li>
                ))}
              </ul>
              <Button
                size='lg'
                className='w-full bg-[#F7A607] hover:bg-[#e09500] text-white font-bold rounded-xl gap-2 border-0'
                onClick={() => openAuth('register')}
              >
                Find Employment <ArrowRight className='w-4 h-4' />
              </Button>
            </motion.div>

            {/* Employer CTA */}
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.45, delay: 0.1 }}
              className='bg-[#292e31] rounded-3xl p-8 text-white'
            >
              <div className='w-12 h-12 rounded-2xl bg-[#F7A607]/15 flex items-center justify-center mb-5'>
                <Building2 className='w-6 h-6 text-[#F7A607]' />
              </div>
              <p className='text-xs font-bold text-gray-400 uppercase tracking-widest mb-2'>
                For Organizations
              </p>
              <h3
                className='text-2xl font-extrabold text-white mb-3 leading-tight'
                style={{ fontFamily: 'Plus Jakarta Sans' }}
              >
                Hire Qualified
                <br />
                Workforce
              </h3>
              <p className='text-sm text-gray-400 leading-relaxed mb-6'>
                Register your organization on Ex-Serviceman Jobs and access a
                verified, screened pool of candidates ready for deployment.
              </p>
              <ul className='space-y-2 mb-7'>
                {[
                  'Access pre-verified, background-checked candidates',
                  'Post workforce requirements and receive shortlists',
                  'Ex-Serviceman Jobs manages screening and placement support',
                ].map((f) => (
                  <li
                    key={f}
                    className='flex items-center gap-2 text-sm text-gray-300'
                  >
                    <CheckCircle className='w-4 h-4 text-[#F7A607] shrink-0' />
                    {f}
                  </li>
                ))}
              </ul>
              <Button
                size='lg'
                className='w-full bg-[#F7A607] hover:bg-[#e09500] text-white font-bold rounded-xl gap-2 border-0'
                onClick={() => openAuth('register')}
              >
                Register Your Organization <ArrowRight className='w-4 h-4' />
              </Button>
            </motion.div>
          </div>

          <div className='flex justify-center mt-8'>
            <a
              href='tel:+919876543210'
              className='flex items-center gap-2 text-sm text-gray-500 hover:text-[#F7A607] transition-colors'
            >
              <Phone className='w-4 h-4' />
              Need help? Call us at{' '}
              <span className='font-semibold text-gray-700'>
                +91 98765 43210
              </span>
            </a>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════
          FOOTER
      ══════════════════════════════════════════ */}
      <footer className='bg-[#111416] text-gray-400 py-14'>
        <div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8'>
          <div className='grid grid-cols-2 md:grid-cols-4 gap-8 mb-10'>
            <div className='col-span-2 md:col-span-1'>
              <div className='flex items-center gap-2 mb-4'>
                <img
                  src={companyLogo}
                  alt='Ex-Serviceman Jobs'
                  className='w-9 h-9 object-contain'
                />
                <span
                  className='font-extrabold text-xl text-white'
                  style={{ fontFamily: 'Plus Jakarta Sans' }}
                >
                  {BRAND.name}
                </span>
              </div>
              <p className='text-sm leading-relaxed mb-3'>
                Workforce recruitment and staffing partner serving employers and
                candidates across Assam &amp; Northeast India.
              </p>
              <p className='text-xs text-gray-600'>
                Registered Recruitment Agency · Assam
              </p>
            </div>

            {[
              {
                title: 'For Candidates',
                links: [
                  'Find Employment',
                  'Register Profile',
                  'Service Fees',
                  'Track Applications',
                  'About the Process',
                ],
              },
              {
                title: 'For Employers',
                links: [
                  'Hire Talent',
                  'Register Company',
                  'Post a Requirement',
                  'Candidate Database',
                  'Pricing & Fees',
                ],
              },
              {
                title: 'Company',
                links: [
                  'About Ex-Serviceman Jobs',
                  'Our Partners',
                  'Contact Us',
                  'Privacy Policy',
                  'Terms of Service',
                ],
              },
            ].map((col) => (
              <div key={col.title}>
                <h4 className='font-semibold text-white mb-3 text-sm'>
                  {col.title}
                </h4>
                <ul className='space-y-2'>
                  {col.links.map((link) => (
                    <li key={link}>
                      <a
                        href='#'
                        className='text-sm hover:text-[#F7A607] transition-colors'
                      >
                        {link}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <div className='border-t border-gray-800 pt-8 flex flex-col sm:flex-row justify-between items-center gap-4'>
            <p className='text-sm'>© 2026 {BRAND.name}. All rights reserved.</p>
            <div className='flex items-center gap-2 text-xs text-gray-600'>
              <Shield className='w-3.5 h-3.5 text-[#F7A607]' />
              Trusted · Verified · Professional
            </div>
          </div>
        </div>
      </footer>

      <RoleSelectModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        defaultMode={authMode}
      />
    </div>
  );
}
