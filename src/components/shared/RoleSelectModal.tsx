import { useState } from 'react';
import { motion } from 'framer-motion';
import { X, Zap, ChevronRight, Check } from 'lucide-react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { CandidateAuthModal } from './CandidateAuthModal';
import { EmployerAuthModal } from './EmployerAuthModal';
import { BRAND } from '@/constants';

/* ─── Custom illustrations ───────────────────────────────────────────────── */

function GuardIllustration() {
  return (
    <svg
      viewBox='0 0 160 190'
      fill='none'
      xmlns='http://www.w3.org/2000/svg'
      className='w-full h-full'
    >
      {/* Shield backdrop */}
      <path
        d='M80 18 L130 44 L130 104 Q130 154 80 170 Q30 154 30 104 L30 44 Z'
        fill='rgba(255,255,255,0.06)'
        stroke='rgba(255,255,255,0.13)'
        strokeWidth='1.5'
      />

      {/* Head */}
      <circle cx='80' cy='72' r='15.5' fill='rgba(255,255,255,0.92)' />

      {/* Military cap brim */}
      <rect
        x='57'
        y='65'
        width='46'
        height='5'
        rx='2.5'
        fill='rgba(255,255,255,0.95)'
      />
      {/* Cap crown */}
      <path d='M62 65 Q80 52 98 65' fill='rgba(255,255,255,0.92)' />
      {/* Cap badge dot */}
      <circle cx='80' cy='62' r='4' fill='#F7A607' />
      <circle cx='80' cy='62' r='1.8' fill='rgba(255,255,255,0.9)' />

      {/* Neck */}
      <rect
        x='75'
        y='87'
        width='10'
        height='9'
        rx='2'
        fill='rgba(255,255,255,0.88)'
      />

      {/* Uniform torso */}
      <path
        d='M53 94 Q53 92 80 92 Q107 92 107 94 L111 154 Q111 158 80 158 Q49 158 49 154 Z'
        fill='rgba(255,255,255,0.88)'
      />

      {/* Collar V-line */}
      <path
        d='M71 92 L77 110 L80 113 L83 110 L89 92'
        stroke='rgba(37,99,235,0.3)'
        strokeWidth='1.5'
        strokeLinecap='round'
        strokeLinejoin='round'
        fill='none'
      />

      {/* Left epaulette */}
      <rect x='48' y='93' width='15' height='8' rx='4' fill='#F7A607' />
      <rect
        x='50'
        y='95.5'
        width='3.5'
        height='3'
        rx='0.5'
        fill='rgba(255,255,255,0.65)'
      />
      <rect
        x='55.5'
        y='95.5'
        width='3.5'
        height='3'
        rx='0.5'
        fill='rgba(255,255,255,0.65)'
      />

      {/* Right epaulette */}
      <rect x='97' y='93' width='15' height='8' rx='4' fill='#F7A607' />
      <rect
        x='99'
        y='95.5'
        width='3.5'
        height='3'
        rx='0.5'
        fill='rgba(255,255,255,0.65)'
      />
      <rect
        x='104.5'
        y='95.5'
        width='3.5'
        height='3'
        rx='0.5'
        fill='rgba(255,255,255,0.65)'
      />

      {/* Star medal on chest */}
      <polygon
        points='80,113 82.9,121.5 92,121.5 84.8,126.5 87.7,135 80,130 72.3,135 75.2,126.5 68,121.5 77.1,121.5'
        fill='#F7A607'
      />

      {/* Rank stripes – left sleeve */}
      <rect
        x='50'
        y='120'
        width='13'
        height='2.5'
        rx='1.25'
        fill='rgba(247,166,7,0.85)'
      />
      <rect
        x='50'
        y='125'
        width='13'
        height='2.5'
        rx='1.25'
        fill='rgba(247,166,7,0.85)'
      />
      <rect
        x='50'
        y='130'
        width='13'
        height='2.5'
        rx='1.25'
        fill='rgba(247,166,7,0.85)'
      />

      {/* Rank stripes – right sleeve */}
      <rect
        x='97'
        y='120'
        width='13'
        height='2.5'
        rx='1.25'
        fill='rgba(247,166,7,0.85)'
      />
      <rect
        x='97'
        y='125'
        width='13'
        height='2.5'
        rx='1.25'
        fill='rgba(247,166,7,0.85)'
      />
      <rect
        x='97'
        y='130'
        width='13'
        height='2.5'
        rx='1.25'
        fill='rgba(247,166,7,0.85)'
      />

      {/* Floating stars */}
      <polygon
        points='120,46 121.7,51.5 127,51.5 122.7,54.8 124.4,60.3 120,57 115.6,60.3 117.3,54.8 113,51.5 118.3,51.5'
        fill='rgba(247,166,7,0.6)'
      />
      <polygon
        points='42,40 43.4,44.7 48,44.7 44.4,47.3 45.8,52 42,49.4 38.2,52 39.6,47.3 36,44.7 40.6,44.7'
        fill='rgba(247,166,7,0.45)'
      />
      <circle cx='132' cy='84' r='3.5' fill='rgba(247,166,7,0.3)' />

      {/* Ground shadow */}
      <ellipse cx='80' cy='165' rx='38' ry='6' fill='rgba(0,0,0,0.18)' />
    </svg>
  );
}

function BuildingIllustration() {
  return (
    <svg
      viewBox='0 0 160 190'
      fill='none'
      xmlns='http://www.w3.org/2000/svg'
      className='w-full h-full'
    >
      {/* Background glow */}
      <ellipse cx='80' cy='115' rx='58' ry='52' fill='rgba(255,255,255,0.04)' />

      {/* Building shadow */}
      <rect
        x='44'
        y='67'
        width='74'
        height='98'
        rx='4'
        fill='rgba(0,0,0,0.28)'
      />

      {/* Building body */}
      <rect
        x='41'
        y='64'
        width='74'
        height='98'
        rx='4'
        fill='rgba(255,255,255,0.13)'
        stroke='rgba(255,255,255,0.22)'
        strokeWidth='1'
      />

      {/* Roof ledge */}
      <rect
        x='37'
        y='61'
        width='82'
        height='6'
        rx='3'
        fill='rgba(255,255,255,0.22)'
      />

      {/* Windows row 1 */}
      <rect
        x='52'
        y='76'
        width='16'
        height='13'
        rx='2'
        fill='rgba(247,166,7,0.9)'
      />
      <rect
        x='74'
        y='76'
        width='16'
        height='13'
        rx='2'
        fill='rgba(255,255,255,0.28)'
      />
      <rect
        x='96'
        y='76'
        width='16'
        height='13'
        rx='2'
        fill='rgba(247,166,7,0.65)'
      />

      {/* Windows row 2 */}
      <rect
        x='52'
        y='96'
        width='16'
        height='13'
        rx='2'
        fill='rgba(255,255,255,0.22)'
      />
      <rect
        x='74'
        y='96'
        width='16'
        height='13'
        rx='2'
        fill='rgba(247,166,7,0.88)'
      />
      <rect
        x='96'
        y='96'
        width='16'
        height='13'
        rx='2'
        fill='rgba(255,255,255,0.3)'
      />

      {/* Windows row 3 */}
      <rect
        x='52'
        y='116'
        width='16'
        height='13'
        rx='2'
        fill='rgba(247,166,7,0.6)'
      />
      <rect
        x='74'
        y='116'
        width='16'
        height='13'
        rx='2'
        fill='rgba(255,255,255,0.18)'
      />
      <rect
        x='96'
        y='116'
        width='16'
        height='13'
        rx='2'
        fill='rgba(247,166,7,0.78)'
      />

      {/* Door */}
      <rect
        x='68'
        y='138'
        width='24'
        height='24'
        rx='3'
        fill='rgba(0,0,0,0.28)'
      />
      <rect
        x='70'
        y='140'
        width='20'
        height='20'
        rx='2'
        fill='rgba(255,255,255,0.1)'
      />
      <circle cx='87.5' cy='151' r='2' fill='rgba(247,166,7,0.75)' />

      {/* Flag pole */}
      <rect
        x='78.5'
        y='25'
        width='2.5'
        height='38'
        rx='1'
        fill='rgba(255,255,255,0.6)'
      />
      {/* Flag */}
      <path d='M81 26 L103 33.5 L81 41 Z' fill='#F7A607' />
      <line
        x1='81'
        y1='33.5'
        x2='103'
        y2='33.5'
        stroke='rgba(255,255,255,0.3)'
        strokeWidth='0.5'
      />

      {/* Person left */}
      <circle cx='51' cy='153' r='5.5' fill='rgba(255,255,255,0.72)' />
      <path
        d='M51 158.5 L49 168 M51 158.5 L53 168'
        stroke='rgba(255,255,255,0.72)'
        strokeWidth='2.2'
        strokeLinecap='round'
      />
      <path
        d='M46 162 L56 162'
        stroke='rgba(255,255,255,0.55)'
        strokeWidth='2'
        strokeLinecap='round'
      />

      {/* Person right */}
      <circle cx='109' cy='151' r='5.5' fill='rgba(255,255,255,0.62)' />
      <path
        d='M109 156.5 L107 166 M109 156.5 L111 166'
        stroke='rgba(255,255,255,0.62)'
        strokeWidth='2.2'
        strokeLinecap='round'
      />
      <path
        d='M104 160 L114 160'
        stroke='rgba(255,255,255,0.48)'
        strokeWidth='2'
        strokeLinecap='round'
      />

      {/* Sparkle top-right */}
      <path
        d='M130 52 L132 58 L138 52 L132 58 L130 64 L132 58 Z'
        fill='rgba(247,166,7,0.5)'
      />
      <circle cx='26' cy='96' r='3.5' fill='rgba(247,166,7,0.35)' />
      <circle cx='135' cy='118' r='2.5' fill='rgba(247,166,7,0.28)' />

      {/* Ground */}
      <ellipse cx='80' cy='168' rx='46' ry='6' fill='rgba(0,0,0,0.2)' />
    </svg>
  );
}

/* ─── Component ──────────────────────────────────────────────────────────── */

interface RoleSelectModalProps {
  open: boolean;
  onClose: () => void;
  defaultMode?: 'login' | 'register';
}

const CARDS = [
  {
    role: 'candidate' as const,
    gradient: 'from-[#0b1e62] via-[#1d4ed8] to-[#3b82f6]',
    hoverShadow: '0 24px 48px rgba(59,130,246,0.28)',
    illustration: <GuardIllustration />,
    tag: 'For Candidates',
    title: 'Find Employment\nOpportunities',
    description:
      'Access verified job opportunities from trusted employers and build your professional profile.',
    features: [
      'Apply to verified jobs',
      'Track your application status',
      'Build your candidate profile',
      'Receive job alerts',
    ],
  },
  {
    role: 'employer' as const,
    gradient: 'from-[#3d1503] via-[#92400e] to-[#d97706]',
    hoverShadow: '0 24px 48px rgba(217,119,6,0.28)',
    illustration: <BuildingIllustration />,
    tag: 'For Employers',
    title: 'Hire Qualified\nTalent',
    description:
      'Access verified candidate profiles and manage your hiring process through ATS Corps.',
    features: [
      'Post job vacancies',
      'Access verified candidates',
      'Manage applicants efficiently',
      'Receive recruitment support',
    ],
  },
];

export function RoleSelectModal({
  open,
  onClose,
  defaultMode = 'login',
}: RoleSelectModalProps) {
  const [flow, setFlow] = useState<'role-select' | 'candidate' | 'employer'>(
    'role-select',
  );

  const handleClose = () => {
    setFlow('role-select');
    onClose();
  };

  return (
    <>
      <Dialog open={open && flow === 'role-select'} onOpenChange={handleClose}>
        <DialogContent className='max-w-[880px] p-0 overflow-hidden border-0 shadow-2xl rounded-3xl max-h-[92vh] overflow-y-auto'>
          <div className='bg-white px-4 sm:px-8 pt-5 sm:pt-6 pb-4 sm:pb-5'>
            {/* Top bar */}
            <div className='flex items-center justify-between mb-4'>
              <div className='flex items-center gap-2.5'>
                <div className='w-9 h-9 rounded-xl bg-[#292e31] flex items-center justify-center shadow-sm'>
                  <Zap className='w-5 h-5 text-[#F7A607]' />
                </div>
                <span
                  className='font-extrabold text-gray-900 text-base'
                  style={{ fontFamily: 'Plus Jakarta Sans' }}
                >
                  {BRAND.name}
                </span>
              </div>
            </div>

            {/* Headline */}
            <div className='text-center mb-4'>
              <h2
                className='text-[24px] font-extrabold text-gray-900 leading-tight'
                style={{
                  fontFamily: 'Plus Jakarta Sans',
                  letterSpacing: '-0.3px',
                }}
              >
                Choose Your Role
              </h2>
              <p className='text-sm text-gray-500 mt-1.5 leading-relaxed'>
                Connecting verified candidates and trusted employers through ATS
                Corps.
              </p>
            </div>

            {/* Role cards */}
            <div className='grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4'>
              {CARDS.map(
                ({
                  role,
                  gradient,
                  hoverShadow,
                  illustration,
                  tag,
                  title,
                  description,
                  features,
                }) => (
                  <motion.button
                    key={role}
                    initial={false}
                    whileHover={{ y: -8 }}
                    whileTap={{ scale: 0.97 }}
                    transition={{ type: 'spring', stiffness: 300, damping: 22 }}
                    onClick={() => setFlow(role)}
                    className={`group relative rounded-2xl overflow-hidden cursor-pointer text-left
                    bg-gradient-to-br ${gradient} shadow-lg`}
                    style={
                      { '--hover-shadow': hoverShadow } as React.CSSProperties
                    }
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLElement).style.boxShadow =
                        hoverShadow;
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLElement).style.boxShadow = '';
                    }}
                  >
                    {/* Radial highlight */}
                    <div
                      className='absolute inset-0 pointer-events-none'
                      style={{
                        background:
                          'radial-gradient(ellipse at 55% 25%, rgba(255,255,255,0.14) 0%, transparent 60%)',
                      }}
                    />

                    {/* Hover border glow */}
                    <div className='absolute inset-0 rounded-2xl border border-white/10 group-hover:border-[#F7A607]/55 transition-colors duration-300 pointer-events-none z-10' />

                    {/* Portrait on mobile, landscape on sm+ */}
                    <div className='flex flex-col sm:flex-row items-stretch sm:min-h-[188px]'>
                      {/* Illustration */}
                      <div className='relative sm:w-[128px] sm:shrink-0 flex items-center justify-center py-5 sm:py-4'>
                        {/* horizontal separator — mobile only */}
                        <div className='absolute bottom-0 left-[10%] right-[10%] h-px bg-white/12 sm:hidden' />
                        {/* vertical separator — desktop only */}
                        <div className='hidden sm:block absolute inset-y-[18%] right-0 w-px bg-white/12' />
                        <div className='w-[96px] sm:w-[98px]'>{illustration}</div>
                      </div>

                      {/* Content */}
                      <div
                        className='relative flex-1 px-4 py-4 flex flex-col justify-between'
                        style={{
                          background:
                            'linear-gradient(to bottom, rgba(0,0,0,0.10) 0%, rgba(0,0,0,0.42) 100%)',
                        }}
                      >
                        <div>
                          <span className='inline-flex items-center text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-white/15 text-white/90 mb-2 tracking-wide'>
                            {tag}
                          </span>
                          <h3
                            className='text-[15px] font-extrabold text-white leading-tight whitespace-pre-line mb-1.5'
                            style={{ fontFamily: 'Plus Jakarta Sans' }}
                          >
                            {title}
                          </h3>
                          <p className='text-[11px] text-white/70 leading-snug mb-3'>
                            {description}
                          </p>
                        </div>
                        <div>
                          <ul className='grid grid-cols-2 gap-x-2 gap-y-1.5 mb-3'>
                            {features.map((f) => (
                              <li
                                key={f}
                                className='flex items-start gap-1.5 text-[10.5px] text-white/85'
                              >
                                <div className='w-3 h-3 rounded-full bg-[#F7A607]/30 flex items-center justify-center shrink-0 mt-px'>
                                  <Check className='w-2 h-2 text-[#F7A607]' />
                                </div>
                                {f}
                              </li>
                            ))}
                          </ul>
                          <div className='flex items-center gap-1 text-[11px] font-bold text-[#F7A607]'>
                            {role === 'candidate'
                              ? 'Continue as Candidate'
                              : 'Continue as Employer'}
                            <ChevronRight className='w-3.5 h-3.5 group-hover:translate-x-1 transition-transform duration-200' />
                          </div>
                        </div>
                      </div>
                    </div>
                  </motion.button>
                ),
              )}
            </div>

            {/* Trust strip + Terms */}
            <div className='mt-4 pt-3.5 border-t border-gray-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-4'>
              <div className='flex items-center gap-2 flex-wrap'>
                <span className='text-[10px] font-semibold text-gray-400 uppercase tracking-widest shrink-0'>
                  Trusted by
                </span>
                <div className='flex items-center gap-1.5 flex-wrap'>
                  {[
                    {
                      abbr: 'HPCL',
                      bg: 'bg-green-50',
                      text: 'text-green-700',
                      border: 'border-green-200',
                    },
                    {
                      abbr: 'NEEPCO',
                      bg: 'bg-blue-50',
                      text: 'text-blue-700',
                      border: 'border-blue-200',
                    },
                    {
                      abbr: 'ONGC',
                      bg: 'bg-red-50',
                      text: 'text-red-700',
                      border: 'border-red-200',
                    },
                    {
                      abbr: 'NRL',
                      bg: 'bg-purple-50',
                      text: 'text-purple-700',
                      border: 'border-purple-200',
                    },
                  ].map((p) => (
                    <span
                      key={p.abbr}
                      className={`text-[10px] font-extrabold px-2 py-0.5 rounded-md border ${p.bg} ${p.text} ${p.border}`}
                    >
                      {p.abbr}
                    </span>
                  ))}
                  <span className='text-[10px] text-gray-400 font-medium'>
                    & more
                  </span>
                </div>
              </div>
              <p className='text-[10px] text-gray-400 sm:shrink-0'>
                By continuing you agree to our{' '}
                <span className='text-[#F7A607] cursor-pointer hover:underline'>
                  Terms
                </span>{' '}
                &amp;{' '}
                <span className='text-[#F7A607] cursor-pointer hover:underline'>
                  Privacy
                </span>
              </p>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <CandidateAuthModal
        open={flow === 'candidate'}
        onClose={handleClose}
        onBack={() => setFlow('role-select')}
        mode={defaultMode}
      />

      <EmployerAuthModal
        open={flow === 'employer'}
        onClose={handleClose}
        onBack={() => setFlow('role-select')}
        mode={defaultMode}
      />
    </>
  );
}
