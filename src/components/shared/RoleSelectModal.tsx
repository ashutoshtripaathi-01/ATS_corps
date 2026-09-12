import { useState } from 'react';
import { motion } from 'framer-motion';
import { ChevronRight, Check, ShieldCheck } from 'lucide-react';
import companyLogo from '@/assets/company logo.png';
import logoHPCL   from '@/assets/Partners logo/HPCL.png';
import logoNEEPCO from '@/assets/Partners logo/NEEPCO.png';
import logoNSIC   from '@/assets/Partners logo/NSIC.png';
import logoIOCL   from '@/assets/Partners logo/IOCL.png';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { CandidateAuthModal }   from './CandidateAuthModal';
import { EmployerAuthModal }    from './EmployerAuthModal';
import { BRAND }                from '@/constants';

/* ─── Card data ──────────────────────────────────────────────────────────── */
const CARDS = [
  {
    role:         'candidate' as const,
    eyebrow:      'FOR CANDIDATES',
    title:        'Find Your Next\nOpportunity',
    description:  'Access verified job opportunities from trusted employers and build your professional profile.',
    features:     ['Verified job listings', 'Easy applications', 'Track your application status'],
    cta:          'Continue as Candidate',
    image:        '/candidate.png',
    cardBg:       'bg-white',
    borderColor:  'border-blue-300',
    hoverBorder:  'hover:border-blue-500',
    eyebrowColor: 'text-blue-600',
    checkBg:      'bg-blue-600',
    ctaBg:        'bg-blue-600 hover:bg-blue-700',
    hoverShadow:  '0 16px 48px rgba(37,99,235,0.16)',
    focusRing:    'focus-visible:ring-blue-500',
    eyebrowAlign: 'text-left',
  },
  {
    role:         'employer' as const,
    eyebrow:      'FOR EMPLOYERS',
    title:        'Hire Verified\nTalent',
    description:  'Connect with skilled and disciplined ex-servicemen and manage your recruitment process with ease.',
    features:     ['Verified candidate profiles', 'Post job vacancies', 'Manage applicants efficiently'],
    cta:          'Continue as Employer',
    image:        '/industrial.png',
    cardBg:       'bg-amber-50/60',
    borderColor:  'border-amber-300',
    hoverBorder:  'hover:border-amber-500',
    eyebrowColor: 'text-amber-600',
    checkBg:      'bg-amber-500',
    ctaBg:        'bg-[#F7A607] hover:bg-amber-500',
    hoverShadow:  '0 16px 48px rgba(245,158,11,0.18)',
    focusRing:    'focus-visible:ring-amber-400',
    eyebrowAlign: 'text-right',
  },
] as const;

const PARTNERS = [
  { name: 'HPCL',   logo: logoHPCL   },
  { name: 'NEEPCO', logo: logoNEEPCO },
  { name: 'NSIC',   logo: logoNSIC   },
  { name: 'IOCL',   logo: logoIOCL   },
];

/* ─── Component ──────────────────────────────────────────────────────────── */

interface RoleSelectModalProps {
  open: boolean;
  onClose: () => void;
  defaultMode?: 'login' | 'register';
}

export function RoleSelectModal({
  open,
  onClose,
  defaultMode = 'login',
}: RoleSelectModalProps) {
  const [flow, setFlow] = useState<'role-select' | 'candidate' | 'employer'>('role-select');

  const handleClose = () => {
    setFlow('role-select');
    onClose();
  };

  return (
    <>
      <Dialog open={open && flow === 'role-select'} onOpenChange={handleClose}>
        <DialogContent
          className='max-w-[960px] w-[calc(100%-20px)] p-0 overflow-hidden border-0
            shadow-[0_32px_80px_rgba(15,23,42,0.24)] rounded-2xl max-h-[96vh] overflow-y-auto'
        >
          <div className='bg-white'>

            {/* ══ HEADER ══════════════════════════════════════════════════ */}
            <div className='flex items-center justify-between px-6 sm:px-8 pt-5 sm:pt-6 pb-0'>
              <div className='flex items-center gap-2.5'>
                <img src={companyLogo} alt='Ex-Serviceman Jobs' className='w-9 h-9 object-contain' />
                <div>
                  <p className='font-bold text-[#1a1d1f] text-sm leading-tight' style={{ fontFamily: 'Plus Jakarta Sans' }}>
                    {BRAND.name}
                  </p>
                  <p className='text-[9px] font-semibold text-gray-400 uppercase tracking-widest leading-tight mt-0.5'>
                    Service Continues Beyond Uniform
                  </p>
                </div>
              </div>
              {/* The built-in DialogContent × button sits at absolute right-4 top-4 */}
            </div>

            {/* ══ HEADING ═════════════════════════════════════════════════ */}
            <div className='text-center pt-7 pb-5 px-6 sm:px-8'>
              <h2
                className='text-[26px] sm:text-[32px] font-extrabold text-[#0f172a] leading-tight tracking-tight'
                style={{ fontFamily: 'Plus Jakarta Sans' }}
              >
                How would you like to continue?
              </h2>
              <p className='text-[15px] text-slate-500 mt-2'>
                Choose the option that best describes you.
              </p>
            </div>

            {/* ══ ROLE CARDS ══════════════════════════════════════════════ */}
            <div className='px-5 sm:px-8 pb-5'>
              <div className='grid grid-cols-1 sm:grid-cols-2 gap-4'>
                {CARDS.map(({
                  role, eyebrow, title, description, features, cta, image,
                  cardBg, borderColor, hoverBorder, eyebrowColor, checkBg,
                  ctaBg, hoverShadow, focusRing, eyebrowAlign,
                }) => (
                  <motion.div
                    key={role}
                    onClick={() => setFlow(role)}
                    initial={false}
                    whileHover={{ y: -4 }}
                    whileTap={{ scale: 0.987 }}
                    transition={{ type: 'spring', stiffness: 340, damping: 26 }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.boxShadow = hoverShadow; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.boxShadow = ''; }}
                    role='button'
                    tabIndex={0}
                    aria-label={cta}
                    onKeyDown={(e) => e.key === 'Enter' && setFlow(role)}
                    className={`group relative flex flex-col overflow-hidden rounded-2xl border-2
                      ${cardBg} ${borderColor} ${hoverBorder}
                      cursor-pointer transition-colors duration-200 shadow-sm p-5 sm:p-6
                      focus:outline-none focus-visible:ring-2 ${focusRing}`}
                  >
                    {/* Faded watermark at bottom-right */}
                    <img
                      src={image}
                      alt=''
                      aria-hidden
                      className='pointer-events-none select-none absolute -bottom-6 -right-6
                        w-44 sm:w-52 opacity-[0.07]'
                    />

                    {/* Eyebrow */}
                    <p className={`text-[10.5px] font-bold uppercase tracking-[0.14em] ${eyebrowColor} ${eyebrowAlign} mb-3`}>
                      {eyebrow}
                    </p>

                    {/* Large image + Title/Description row */}
                    <div className='flex items-start gap-3.5 mb-4 relative z-10'>
                      <img
                        src={image}
                        alt={eyebrow}
                        className='w-[108px] h-[108px] object-contain shrink-0 -mt-1'
                      />
                      <div>
                        <h3
                          className='text-[20px] sm:text-[21px] font-bold text-[#0f172a] leading-snug whitespace-pre-line mb-1.5'
                          style={{ fontFamily: 'Plus Jakarta Sans' }}
                        >
                          {title}
                        </h3>
                        <p className='text-[12.5px] text-slate-500 leading-relaxed'>
                          {description}
                        </p>
                      </div>
                    </div>

                    {/* Feature bullets */}
                    <ul className='space-y-2 mb-5 relative z-10'>
                      {features.map((f) => (
                        <li key={f} className='flex items-center gap-2.5'>
                          <div className={`w-[22px] h-[22px] rounded-full ${checkBg} flex items-center justify-center shrink-0`}>
                            <Check className='w-3 h-3 text-white' strokeWidth={3} />
                          </div>
                          <span className='text-[13px] font-medium text-slate-700'>{f}</span>
                        </li>
                      ))}
                    </ul>

                    {/* CTA button — partial width, left-aligned */}
                    <button
                      tabIndex={-1}
                      onClick={(e) => { e.stopPropagation(); setFlow(role); }}
                      className={`relative z-10 flex items-center gap-3
                        px-5 py-3 rounded-xl ${ctaBg} text-white self-start
                        transition-colors duration-150 min-w-[210px]`}
                    >
                      <span className='text-[13.5px] font-semibold'>{cta}</span>
                      <ChevronRight className='w-4 h-4 ml-auto group-hover:translate-x-1 transition-transform duration-200' />
                    </button>
                  </motion.div>
                ))}
              </div>
            </div>

            {/* ══ TRUSTED ORGANIZATIONS ═══════════════════════════════════ */}
            <div className='mx-5 sm:mx-8 border-t border-gray-100 pt-4 pb-4'>
              <div className='flex items-center gap-3 mb-3.5'>
                <div className='flex-1 h-px bg-gray-200' />
                <p className='text-[10px] font-bold text-gray-400 uppercase tracking-[0.15em] shrink-0'>
                  Trusted by Leading Organizations
                </p>
                <div className='flex-1 h-px bg-gray-200' />
              </div>

              <div className='flex items-center justify-center gap-5 sm:gap-8 flex-wrap'>
                {PARTNERS.map(({ name, logo }) => (
                  <div key={name} className='h-8 flex items-center opacity-60 hover:opacity-100 transition-opacity duration-200'>
                    <img src={logo} alt={name} className='h-8 w-auto max-w-[72px] object-contain' />
                  </div>
                ))}
                <span className='text-[12px] font-medium text-gray-400'>+ More</span>
              </div>
            </div>

            {/* ══ FOOTER ══════════════════════════════════════════════════ */}
            <div className='mx-5 sm:mx-8 border-t border-gray-100 py-3.5
              flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2'>
              <div className='flex items-center gap-2'>
                <ShieldCheck className='w-3.5 h-3.5 text-gray-400 shrink-0' />
                <span className='text-[11.5px] text-gray-400'>A trusted platform for our veterans</span>
              </div>
              <p className='text-[11.5px] text-gray-400 flex items-center gap-1.5'>
                <span className='hover:text-gray-600 cursor-pointer transition-colors'>Terms of Service</span>
                <span className='text-gray-300'>|</span>
                <span className='hover:text-gray-600 cursor-pointer transition-colors'>Privacy Policy</span>
              </p>
            </div>

          </div>
        </DialogContent>
      </Dialog>

      {/* ── Auth modals — ALL existing logic & props preserved exactly ── */}
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
