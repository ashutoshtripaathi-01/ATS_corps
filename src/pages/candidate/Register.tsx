import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronLeft, ChevronRight, CheckCircle, Shield, Anchor, Plane, Star,
  CreditCard, MapPin, Briefcase, FileText, Calendar, AlertCircle, X, Zap,
  Upload, ArrowLeft, Lock, Award, RefreshCw, Pencil, Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAppStore } from '@/store/useAppStore';
import { toast } from '@/hooks/useToast';
import { BRAND } from '@/constants';
import { saveProfile, updateDraft, getCandidateProfile } from '@/lib/api';
import companyLogo from '@/assets/company logo.png';

/* ─── Data ───────────────────────────────────────────────────────────────── */
const FORCES = ['Army', 'Navy', 'Air Force', 'Para Military'] as const;
type Force = (typeof FORCES)[number];

const FORCE_META: Record<Force, { icon: React.ElementType; color: string; description: string }> = {
  Army:            { icon: Shield, color: 'text-green-700',  description: 'Indian Army' },
  Navy:            { icon: Anchor, color: 'text-blue-700',   description: 'Indian Navy' },
  'Air Force':     { icon: Plane,  color: 'text-sky-600',    description: 'Indian Air Force' },
  'Para Military': { icon: Star,   color: 'text-orange-600', description: 'CRPF / BSF / CISF / ITBP' },
};

const RANKS: Record<Force, string[]> = {
  Army:            ['Sepoy','Rifleman','Lance Naik','Naik','Havildar','Havildar Major','Naib Subedar','Subedar','Subedar Major','Hony. Lieutenant','Hony. Captain'],
  Navy:            ['Seaman 2nd Class','Seaman 1st Class','Leading Seaman','Petty Officer','Chief Petty Officer','Master Chief Petty Officer 2','Master Chief Petty Officer 1','Hony. Sub Lieutenant'],
  'Air Force':     ['Aircraftman','Leading Aircraftman','Corporal','Sergeant','Junior Warrant Officer (JWO)','Warrant Officer (WO)','Master Warrant Officer (MWO)','Hony. Flying Officer'],
  'Para Military': ['Constable (GD)','Head Constable (GD)','Assistant Sub-Inspector (ASI)','Sub-Inspector (SI)','Inspector','Assistant Commandant','Deputy Commandant'],
};

const POSTS    = ['Any', 'Guard Unarmed', 'Gunman', 'Security Supervisor', 'Other'] as const;
const LOCATIONS = ['Upper Assam', 'Guwahati & Around', 'Lower Assam'] as const;

const REGISTRATION_FEE = 1;

/* ─── Step metadata ───────────────────────────────────────────────────────── */
const STEPS = [
  { label: 'Personal & Service',       shortLabel: 'Personal',   desc: 'Force, rank & personal details' },
  { label: 'Documents & Verification', shortLabel: 'Documents',  desc: 'Service documents & verification' },
  { label: 'Job Preferences',          shortLabel: 'Preferences', desc: 'Preferred roles & locations' },
  { label: 'Review & Payment',         shortLabel: 'Review',     desc: 'Review your details & complete registration' },
];

/* ─── Types ──────────────────────────────────────────────────────────────── */
interface FormState {
  force: Force | ''; rank: string; fullName: string; mobile: string; unit: string;
  idCard: File | null; retirementDate: string; dischargeBook: File | null;
  policeVerification: File | null; post: string; gunLicense: string;
  otherPost: string; loc1: string; loc2: string; loc3: string;
}
const INITIAL: FormState = {
  force: '', rank: '', fullName: '', mobile: '', unit: '', idCard: null,
  retirementDate: '', dischargeBook: null, policeVerification: null,
  post: 'Any', gunLicense: '', otherPost: '', loc1: '', loc2: '', loc3: '',
};

interface ServerProfile {
  force: string | null; rank: string | null; full_name: string | null;
  mobile: string | null; unit: string | null; retirement_date: string | null;
  post: string | null; other_post: string | null; gun_license: string | null;
  loc1: string | null; loc2: string | null; loc3: string | null;
  id_card_path: string | null; discharge_book_path: string | null;
  police_verification_path: string | null; payment_status: string;
}

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

/* ─── Helpers ─────────────────────────────────────────────────────────────── */
function getResumeStep(p: ServerProfile): number {
  if (!p.mobile && !p.force && !p.full_name) return 1;
  if (!p.id_card_path || !p.discharge_book_path) return 2;
  if (!p.loc1) return 3;
  return 4;
}

function formatDate(iso: string): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch { return iso; }
}

/* ─── Shared atoms ───────────────────────────────────────────────────────── */
function FieldLabel({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <label className='block text-sm font-medium text-gray-700 mb-1.5'>
      {children}{required && <span className='text-red-500 ml-0.5'>*</span>}
    </label>
  );
}

function FieldError({ msg }: { msg?: string }) {
  if (!msg) return null;
  return (
    <p className='flex items-center gap-1 mt-1.5 text-xs text-red-500' role='alert'>
      <AlertCircle className='w-3.5 h-3.5 shrink-0' />{msg}
    </p>
  );
}

function TextInput({
  label, required, placeholder, value, onChange, type = 'text', icon,
}: {
  label: string; required?: boolean; placeholder: string; value: string;
  onChange: (v: string) => void; type?: string; icon?: React.ElementType;
}) {
  const Icon = icon;
  return (
    <div>
      <FieldLabel required={required}>{label}</FieldLabel>
      <div className='relative'>
        {Icon && (
          <Icon className='absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none' />
        )}
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          aria-label={label}
          className={`w-full h-12 rounded-xl border border-gray-200 bg-white text-sm text-gray-900 placeholder:text-gray-400
            outline-none transition-all focus:border-[#F7A607] focus:ring-2 focus:ring-[#F7A607]/10
            ${Icon ? 'pl-10 pr-4' : 'px-4'}`}
        />
      </div>
    </div>
  );
}

function SelectInput({
  label, required, value, onChange, placeholder, options, disabled,
}: {
  label?: string; required?: boolean; value: string; onChange: (v: string) => void;
  placeholder: string; options: string[]; disabled?: boolean;
}) {
  return (
    <div>
      {label && <FieldLabel required={required}>{label}</FieldLabel>}
      <div className='relative'>
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          aria-label={label ?? placeholder}
          className={`w-full h-12 rounded-xl border border-gray-200 bg-white text-sm appearance-none outline-none
            transition-all focus:border-[#F7A607] focus:ring-2 focus:ring-[#F7A607]/10 pl-4 pr-10
            ${value ? 'text-gray-900' : 'text-gray-400'}
            ${disabled ? 'opacity-50 cursor-not-allowed bg-gray-50' : 'cursor-pointer'}`}
        >
          <option value='' disabled>{placeholder}</option>
          {options.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
        <ChevronLeft className='absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none rotate-[-90deg]' />
      </div>
    </div>
  );
}

/* ─── Document upload card ────────────────────────────────────────────────── */
function DocUpload({
  label, required, optional, description, file, onChange, accept = 'image/*,.pdf',
  serverUploaded = false,
}: {
  label: string; required?: boolean; optional?: boolean; description?: string;
  file: File | null; onChange: (f: File | null) => void; accept?: string;
  serverUploaded?: boolean;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const sizeMB = file ? (file.size / (1024 * 1024)).toFixed(1) : null;
  const isUploaded = !!file || serverUploaded;

  return (
    <div className='bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-sm'>
      {/* Card header */}
      <div className='flex items-start justify-between px-4 pt-4 pb-3 border-b border-gray-50'>
        <div className='flex items-center gap-2.5'>
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0
            ${isUploaded ? 'bg-green-50' : required ? 'bg-[#F7A607]/10' : 'bg-gray-100'}`}>
            <FileText className={`w-4 h-4 ${isUploaded ? 'text-green-600' : required ? 'text-[#F7A607]' : 'text-gray-400'}`} />
          </div>
          <div>
            <p className='text-sm font-semibold text-gray-900 leading-tight'>{label}</p>
            {description && <p className='text-xs text-gray-500 mt-0.5'>{description}</p>}
          </div>
        </div>
        {required && !isUploaded && (
          <span className='text-[10px] font-bold text-[#F7A607] bg-[#F7A607]/10 px-2 py-0.5 rounded-full shrink-0 ml-2 mt-0.5'>
            Required
          </span>
        )}
        {optional && !isUploaded && (
          <span className='text-[10px] font-bold text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full shrink-0 ml-2 mt-0.5'>
            Optional
          </span>
        )}
      </div>

      {/* Upload area */}
      <div className='p-4'>
        <input
          ref={ref}
          type='file'
          accept={accept}
          className='hidden'
          aria-label={`Upload ${label}`}
          onChange={(e) => onChange(e.target.files?.[0] ?? null)}
        />

        {file ? (
          /* New file selected */
          <div className='flex items-center gap-3 p-3 bg-green-50 border border-green-200 rounded-xl'>
            <div className='w-9 h-9 bg-green-100 rounded-lg flex items-center justify-center shrink-0'>
              <CheckCircle className='w-4 h-4 text-green-600' />
            </div>
            <div className='flex-1 min-w-0'>
              <p className='text-sm font-semibold text-gray-900 truncate'>{file.name}</p>
              <p className='text-xs text-gray-500 mt-0.5'>{sizeMB} MB · Selected</p>
            </div>
            <div className='flex items-center gap-1.5 shrink-0'>
              <button type='button' onClick={() => ref.current?.click()}
                aria-label={`Replace ${label}`}
                className='flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors'>
                <RefreshCw className='w-3 h-3' /> Replace
              </button>
              <button type='button' onClick={() => onChange(null)} aria-label={`Remove ${label}`}
                className='p-1.5 rounded-lg hover:bg-red-50 transition-colors text-gray-400 hover:text-red-500'>
                <X className='w-3.5 h-3.5' />
              </button>
            </div>
          </div>
        ) : serverUploaded ? (
          /* Already on server */
          <div className='flex items-center gap-3 p-3 bg-green-50 border border-green-200 rounded-xl'>
            <div className='w-9 h-9 bg-green-100 rounded-lg flex items-center justify-center shrink-0'>
              <CheckCircle className='w-4 h-4 text-green-600' />
            </div>
            <div className='flex-1 min-w-0'>
              <p className='text-sm font-semibold text-gray-900'>Already uploaded</p>
              <p className='text-xs text-gray-500 mt-0.5'>Securely on record · uploaded previously</p>
            </div>
            <button type='button' onClick={() => ref.current?.click()}
              aria-label={`Replace ${label}`}
              className='shrink-0 flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors'>
              <RefreshCw className='w-3 h-3' /> Replace
            </button>
          </div>
        ) : (
          /* Empty — upload prompt */
          <button type='button' onClick={() => ref.current?.click()} aria-label={`Upload ${label}`}
            className='w-full flex items-center gap-4 px-4 py-4 bg-gray-50 border border-dashed border-gray-300 rounded-xl
              hover:bg-gray-100 hover:border-[#F7A607]/50 active:scale-[0.99] transition-all text-left focus-visible:outline-none
              focus-visible:ring-2 focus-visible:ring-[#F7A607]/40'>
            <div className='w-10 h-10 bg-white border border-gray-200 rounded-xl flex items-center justify-center shrink-0 shadow-sm'>
              <Upload className='w-4 h-4 text-gray-500' />
            </div>
            <div>
              <p className='text-sm font-semibold text-gray-700'>Click to select file</p>
              <p className='text-xs text-gray-400 mt-0.5'>JPG, PNG or PDF · Maximum 5 MB</p>
            </div>
          </button>
        )}
      </div>
    </div>
  );
}

/* ─── Review section atoms ───────────────────────────────────────────────── */
function ReviewSection({
  title, children, onEdit, editLabel = 'Edit',
}: {
  title: string; children: React.ReactNode; onEdit: () => void; editLabel?: string;
}) {
  return (
    <div className='bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden'>
      <div className='flex items-center justify-between px-5 py-3.5 border-b border-gray-50 bg-gray-50/60'>
        <p className='text-[10px] font-bold text-gray-500 uppercase tracking-widest'>{title}</p>
        <button type='button' onClick={onEdit}
          className='flex items-center gap-1.5 text-xs font-semibold text-[#F7A607] hover:text-[#d99400] transition-colors'>
          <Pencil className='w-3 h-3' />{editLabel}
        </button>
      </div>
      <div className='px-5 py-4 space-y-3'>{children}</div>
    </div>
  );
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className='flex justify-between items-start gap-4 py-0.5'>
      <span className='text-xs text-gray-400 shrink-0 mt-0.5'>{label}</span>
      <span className='text-sm font-semibold text-gray-900 text-right max-w-[60%] break-words'>{value || '—'}</span>
    </div>
  );
}

function DocStatusRow({ label, uploaded, optional }: { label: string; uploaded: boolean; optional?: boolean }) {
  return (
    <div className='flex items-center gap-3'>
      {uploaded
        ? <CheckCircle className='w-4 h-4 text-green-500 shrink-0' />
        : <div className='w-4 h-4 rounded-full border-2 border-dashed border-gray-300 shrink-0' />
      }
      <span className={`text-sm flex-1 leading-tight ${uploaded ? 'text-gray-800 font-medium' : 'text-gray-400'}`}>
        {label}
      </span>
      {!uploaded && optional  && <span className='text-xs text-gray-400 shrink-0 italic'>Optional</span>}
      {!uploaded && !optional && <span className='text-xs text-amber-500 shrink-0 font-semibold'>Required</span>}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   STEP 1 — Personal & Service
══════════════════════════════════════════════════════════════════════════ */
function PersonalServiceStep({
  data, update, errors,
}: {
  data: FormState;
  update: (k: keyof FormState, v: any) => void;
  errors: Partial<Record<keyof FormState, string>>;
}) {
  return (
    <div className='space-y-6 pt-2 pb-8'>
      <div>
        <h2 className='text-lg font-extrabold text-gray-900 leading-tight' style={{ fontFamily: 'Plus Jakarta Sans' }}>
          Tell us about your service
        </h2>
        <p className='text-sm text-gray-500 mt-1'>
          Your military background helps us match you with suitable employment opportunities.
        </p>
      </div>

      {/* Force selection */}
      <div>
        <p className='text-sm font-semibold text-gray-700 mb-3'>
          Which force did you serve in? <span className='text-red-500'>*</span>
        </p>
        <div className='grid grid-cols-2 lg:grid-cols-4 gap-2'>
          {(FORCES as unknown as Force[]).map((f) => {
            const meta = FORCE_META[f];
            const Icon = meta.icon;
            const selected = data.force === f;
            return (
              <button key={f} type='button'
                onClick={() => { update('force', f); update('rank', ''); }}
                aria-pressed={selected}
                className={`flex items-center gap-3 px-3 py-3.5 rounded-xl border-2 text-left transition-all active:scale-[0.98]
                  focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F7A607]/40
                  ${selected ? 'border-[#F7A607] bg-[#F7A607]/5' : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'}`}>
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0
                  ${selected ? 'bg-[#F7A607]/15' : 'bg-gray-100'}`}>
                  <Icon className={`w-4 h-4 ${selected ? 'text-[#F7A607]' : meta.color}`} />
                </div>
                <div className='min-w-0'>
                  <p className={`text-sm font-semibold leading-tight ${selected ? 'text-[#292e31]' : 'text-gray-800'}`}>{f}</p>
                  <p className='text-[10px] text-gray-400 truncate mt-0.5'>{meta.description}</p>
                </div>
              </button>
            );
          })}
        </div>
        <FieldError msg={errors.force} />
      </div>

      {/* Rank */}
      <div>
        <SelectInput
          label='Rank / Designation' required
          value={data.rank} onChange={(v) => update('rank', v)}
          placeholder={data.force ? 'Select your rank' : 'Select a force first'}
          options={data.force ? RANKS[data.force] : []}
          disabled={!data.force}
        />
        <FieldError msg={errors.rank} />
      </div>

      {/* Full Name + Mobile — 2-col on desktop */}
      <div className='grid grid-cols-1 lg:grid-cols-2 gap-4'>
        <div>
          <TextInput label='Full Name' required placeholder='As per service records'
            value={data.fullName} onChange={(v) => update('fullName', v)} />
          <FieldError msg={errors.fullName} />
        </div>
        <div>
          <label className='block text-sm font-medium text-gray-700 mb-1.5' htmlFor='mobile-input'>
            Mobile Number <span className='text-red-500'>*</span>
          </label>
          <div className='flex gap-2'>
            <div className='flex items-center gap-1.5 px-3 h-12 bg-gray-50 border border-gray-200 rounded-xl shrink-0 select-none'>
              <span className='text-base leading-none'>🇮🇳</span>
              <span className='text-sm font-semibold text-gray-700'>+91</span>
            </div>
            <input id='mobile-input' type='tel' inputMode='numeric' maxLength={10}
              placeholder='9876543210' value={data.mobile}
              onChange={(e) => update('mobile', e.target.value.replace(/\D/g, ''))}
              aria-label='Mobile number'
              className='flex-1 h-12 px-3 text-sm border border-gray-200 rounded-xl bg-white
                focus:outline-none focus:ring-2 focus:ring-[#F7A607]/40 focus:border-[#F7A607] transition-all' />
          </div>
          <FieldError msg={errors.mobile} />
        </div>
      </div>

      {/* Unit + Retirement date — 2-col on desktop */}
      <div className='grid grid-cols-1 lg:grid-cols-2 gap-4'>
        <div>
          <TextInput label='Unit / Regiment' required placeholder='e.g. 4 ASSAM RIFLES'
            value={data.unit} onChange={(v) => update('unit', v)} />
          <FieldError msg={errors.unit} />
        </div>
        <div>
          <FieldLabel required>Date of Retirement</FieldLabel>
          <div className='relative'>
            <Calendar className='absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none' />
            <input type='date' value={data.retirementDate}
              onChange={(e) => update('retirementDate', e.target.value)}
              max={new Date().toISOString().split('T')[0]}
              aria-label='Date of retirement'
              className={`w-full h-12 rounded-xl border border-gray-200 bg-white text-sm outline-none
                transition-all focus:border-[#F7A607] focus:ring-2 focus:ring-[#F7A607]/10 pl-10 pr-4
                ${data.retirementDate ? 'text-gray-900' : 'text-gray-400'}`} />
          </div>
          <FieldError msg={errors.retirementDate} />
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   STEP 2 — Documents & Verification
══════════════════════════════════════════════════════════════════════════ */
function DocumentsVerificationStep({
  data, update, errors, serverProfile,
}: {
  data: FormState;
  update: (k: keyof FormState, v: any) => void;
  errors: Partial<Record<keyof FormState, string>>;
  serverProfile: ServerProfile | null;
}) {
  return (
    <div className='space-y-6 pt-2 pb-8'>
      <div>
        <h2 className='text-lg font-extrabold text-gray-900 leading-tight' style={{ fontFamily: 'Plus Jakarta Sans' }}>
          Upload your service documents
        </h2>
        <p className='text-sm text-gray-500 mt-1'>
          These documents are used to verify your ex-serviceman status and eligibility.
        </p>
      </div>

      <div className='flex gap-3 p-4 bg-gray-50 border border-gray-200 rounded-xl'>
        <Lock className='w-4 h-4 text-gray-500 shrink-0 mt-0.5' />
        <div>
          <p className='text-sm font-semibold text-gray-700'>Your documents are private</p>
          <p className='text-xs text-gray-500 mt-0.5 leading-relaxed'>
            Documents are used only for candidate verification. They are not visible to employers or other candidates.
          </p>
          <p className='text-xs text-gray-400 mt-2'>Accepted formats: JPG, PNG, PDF · Maximum 5 MB per file</p>
        </div>
      </div>

      <div className='space-y-3'>
        <p className='text-xs font-bold text-gray-500 uppercase tracking-widest'>Required Documents</p>
        <div>
          <DocUpload label='Military / Ex-Serviceman Identity Card'
            description='Front side — clear photo or scanned copy' required
            file={data.idCard} onChange={(f) => update('idCard', f)}
            serverUploaded={!!serverProfile?.id_card_path} />
          <FieldError msg={errors.idCard} />
        </div>
        <div>
          <DocUpload label='Discharge Book'
            description='Army / Navy / Air Force / Para Military Discharge Book' required
            file={data.dischargeBook} onChange={(f) => update('dischargeBook', f)}
            serverUploaded={!!serverProfile?.discharge_book_path} />
          <FieldError msg={errors.dischargeBook} />
        </div>
      </div>

      <div className='space-y-3'>
        <p className='text-xs font-bold text-gray-500 uppercase tracking-widest'>Optional Documents</p>
        <DocUpload label='Police Verification Certificate'
          description='Clearance certificate from your home district police · Uploading this may help speed up verification.'
          optional file={data.policeVerification} onChange={(f) => update('policeVerification', f)}
          serverUploaded={!!serverProfile?.police_verification_path} />
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   STEP 3 — Job Preferences
══════════════════════════════════════════════════════════════════════════ */
function JobPreferencesStep({
  data, update, errors,
}: {
  data: FormState;
  update: (k: keyof FormState, v: any) => void;
  errors: Partial<Record<keyof FormState, string>>;
}) {
  const locOptions = (excluding: string[]) =>
    (LOCATIONS as unknown as string[]).filter((l) => !excluding.includes(l));

  return (
    <div className='space-y-6 pt-2 pb-8'>
      <div>
        <h2 className='text-lg font-extrabold text-gray-900 leading-tight' style={{ fontFamily: 'Plus Jakarta Sans' }}>
          Tell us where and what you want to work
        </h2>
        <p className='text-sm text-gray-500 mt-1'>
          We'll use these preferences to recommend suitable opportunities.
        </p>
      </div>

      <div className='grid grid-cols-1 lg:grid-cols-2 gap-5 items-start'>
        {/* Role preference */}
        <div className='bg-white border border-gray-100 rounded-2xl p-5 shadow-sm space-y-4'>
          <div className='flex items-center gap-2'>
            <Briefcase className='w-4 h-4 text-[#F7A607]' />
            <p className='text-sm font-bold text-gray-900'>What type of role are you interested in?</p>
          </div>
          <div className='space-y-2' role='radiogroup' aria-label='Job role preference'>
            {(POSTS as unknown as string[]).map((post) => {
              const active = data.post === post;
              return (
                <button key={post} type='button' role='radio' aria-checked={active}
                  onClick={() => update('post', post)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border-2 text-left transition-all active:scale-[0.99]
                    focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F7A607]/40
                    ${active ? 'border-[#F7A607] bg-[#F7A607]/5' : 'border-gray-200 bg-gray-50 hover:border-gray-300 hover:bg-white'}`}>
                  <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 transition-all
                    ${active ? 'border-[#F7A607] bg-[#F7A607]' : 'border-gray-300 bg-white'}`}>
                    {active && <div className='w-1.5 h-1.5 bg-white rounded-full' />}
                  </div>
                  <span className={`text-sm font-medium ${active ? 'text-[#292e31]' : 'text-gray-700'}`}>{post}</span>
                </button>
              );
            })}
          </div>
          <FieldError msg={errors.post} />
          <AnimatePresence>
            {data.post === 'Gunman' && (
              <motion.div key='gun' initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className='overflow-hidden'>
                <TextInput label='Gun / Weapon License Number' required placeholder='Enter license number'
                  value={data.gunLicense} onChange={(v) => update('gunLicense', v)} />
                <FieldError msg={errors.gunLicense} />
              </motion.div>
            )}
            {data.post === 'Other' && (
              <motion.div key='other' initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className='overflow-hidden'>
                <TextInput label='Specify Role' required placeholder='Describe the role you are interested in'
                  value={data.otherPost} onChange={(v) => update('otherPost', v)} />
                <FieldError msg={errors.otherPost} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Location preferences */}
        <div className='bg-white border border-gray-100 rounded-2xl p-5 shadow-sm space-y-5'>
          <div>
            <div className='flex items-center gap-2 mb-1'>
              <MapPin className='w-4 h-4 text-[#F7A607]' />
              <p className='text-sm font-bold text-gray-900'>Your preferred locations</p>
            </div>
            <p className='text-xs text-gray-500'>Arrange your locations in order of preference. The same location cannot appear twice.</p>
          </div>

          {([
            { key: 'loc1' as const, num: '1', label: 'First choice',  numBg: 'bg-[#F7A607] text-white' },
            { key: 'loc2' as const, num: '2', label: 'Second choice', numBg: 'bg-gray-700 text-white' },
            { key: 'loc3' as const, num: '3', label: 'Third choice',  numBg: 'bg-gray-300 text-gray-700' },
          ]).map(({ key, num, label, numBg }) => {
            const excluding  = key === 'loc1' ? [] : key === 'loc2' ? [data.loc1] : [data.loc1, data.loc2];
            const isDisabled = (key === 'loc2' && !data.loc1) || (key === 'loc3' && !data.loc2);
            return (
              <div key={key} className='space-y-1.5'>
                <div className='flex items-center gap-2'>
                  <span className={`w-5 h-5 rounded-full text-[10px] font-extrabold flex items-center justify-center shrink-0 ${numBg}`}>{num}</span>
                  <span className='text-xs font-semibold text-gray-600'>{label}</span>
                </div>
                <SelectInput
                  value={data[key]}
                  onChange={(v) => {
                    update(key, v);
                    if (key === 'loc1') { update('loc2', ''); update('loc3', ''); }
                    if (key === 'loc2') update('loc3', '');
                  }}
                  placeholder={isDisabled ? 'Select a higher priority first' : 'Choose location'}
                  options={locOptions(excluding)}
                  disabled={isDisabled}
                />
                <FieldError msg={errors[key]} />
              </div>
            );
          })}

          {data.loc1 && (
            <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
              className='flex items-center justify-between p-3.5 bg-amber-50 border border-amber-100 rounded-xl mt-2'>
              <div>
                <p className='text-xs font-semibold text-gray-700'>Registration Fee</p>
                <p className='text-[11px] text-gray-500 mt-0.5'>One-time · non-refundable</p>
              </div>
              <p className='text-xl font-extrabold text-[#F7A607]'>₹{REGISTRATION_FEE.toLocaleString()}</p>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   STEP 4 — Review & Payment (full redesign)
══════════════════════════════════════════════════════════════════════════ */
function ReviewPaymentStep({
  data, serverProfile, onProceed, onEdit, onGoBack, saving,
}: {
  data: FormState;
  serverProfile: ServerProfile | null;
  onProceed: () => void;
  onEdit: (step: number) => void;
  onGoBack: () => void;
  saving?: boolean;
}) {
  const fee = REGISTRATION_FEE;
  const docIdCard    = !!(data.idCard    || serverProfile?.id_card_path);
  const docDischarge = !!(data.dischargeBook || serverProfile?.discharge_book_path);
  const docPolice    = !!(data.policeVerification || serverProfile?.police_verification_path);

  if (!data.loc1) {
    return (
      <div className='pt-2 pb-8 flex flex-col items-center justify-center min-h-[50vh] text-center gap-4'>
        <div className='w-14 h-14 bg-amber-50 rounded-2xl flex items-center justify-center'>
          <MapPin className='w-7 h-7 text-amber-500' />
        </div>
        <p className='font-semibold text-gray-900'>No location selected</p>
        <p className='text-sm text-gray-500 max-w-xs'>Go back to Job Preferences and choose your preferred posting locations.</p>
        <button type='button' onClick={onGoBack}
          className='flex items-center gap-2 text-sm font-semibold text-[#F7A607] hover:underline focus-visible:outline-none'>
          <ArrowLeft className='w-4 h-4' /> Back to Job Preferences
        </button>
      </div>
    );
  }

  return (
    <div className='space-y-4 pt-2 pb-8'>
      {/* Heading */}
      <div>
        <h2 className='text-lg font-extrabold text-gray-900 leading-tight' style={{ fontFamily: 'Plus Jakarta Sans' }}>
          Review your registration
        </h2>
        <p className='text-sm text-gray-500 mt-1'>
          Please confirm your details below before completing payment.
        </p>
      </div>

      {/* Personal & Service */}
      <ReviewSection title='Personal & Service' onEdit={() => onEdit(1)}>
        <ReviewRow label='Full Name'          value={data.fullName} />
        <ReviewRow label='Mobile'             value={data.mobile ? `+91 ${data.mobile}` : ''} />
        <ReviewRow label='Armed Force'        value={data.force} />
        <ReviewRow label='Rank'               value={data.rank} />
        <ReviewRow label='Unit / Regiment'    value={data.unit} />
        <ReviewRow label='Date of Retirement' value={data.retirementDate ? formatDate(data.retirementDate) : ''} />
      </ReviewSection>

      {/* Documents */}
      <ReviewSection title='Documents' onEdit={() => onEdit(2)} editLabel='Review Documents'>
        <DocStatusRow label='Military / Ex-Serviceman Identity Card' uploaded={docIdCard} />
        <DocStatusRow label='Discharge Book'                         uploaded={docDischarge} />
        <DocStatusRow label='Police Verification Certificate'        uploaded={docPolice} optional />
      </ReviewSection>

      {/* Job Preferences */}
      <ReviewSection title='Job Preferences' onEdit={() => onEdit(3)}>
        <ReviewRow label='Preferred Role' value={data.post === 'Other' ? (data.otherPost || 'Other') : data.post} />
        <ReviewRow label='1st Priority'   value={data.loc1} />
        {data.loc2 && <ReviewRow label='2nd Priority' value={data.loc2} />}
        {data.loc3 && <ReviewRow label='3rd Priority' value={data.loc3} />}
      </ReviewSection>

      {/* Registration Fee */}
      <div className='bg-white border border-gray-100 rounded-2xl p-5 shadow-sm'>
        <div className='flex items-center justify-between'>
          <div>
            <p className='text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1'>Registration Fee</p>
            <p className='text-sm font-semibold text-gray-800'>One-time · covers all preferred locations</p>
            <p className='text-xs text-gray-400 mt-1'>Non-refundable · Secured by Razorpay</p>
          </div>
          <p className='text-4xl font-black text-[#F7A607]'>₹{fee}</p>
        </div>
      </div>

      {/* CTA */}
      <Button size='lg' className='w-full rounded-xl text-sm font-bold gap-2.5 h-13'
        onClick={onProceed} disabled={saving}>
        {saving ? (
          <><div className='w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin' />Saving…</>
        ) : (
          <><CreditCard className='w-4 h-4' />Confirm Details & Pay ₹{fee}</>
        )}
      </Button>

      <p className='text-center text-xs text-gray-400 leading-relaxed'>
        Secure payment powered by Razorpay · 256-bit SSL encryption
      </p>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   MAIN PAGE
══════════════════════════════════════════════════════════════════════════ */
export default function CandidateRegister() {
  const navigate = useNavigate();
  const { user } = useAppStore();

  const [step,           setStep]           = useState(1);
  const [data,           setData]           = useState<FormState>(INITIAL);
  const [errors,         setErrors]         = useState<Partial<Record<keyof FormState, string>>>({});
  const [saving,         setSaving]         = useState(false);
  const [returnToReview, setReturnToReview] = useState(false);
  const [profileLoading, setProfileLoading] = useState(true);
  const [serverProfile,  setServerProfile]  = useState<ServerProfile | null>(null);
  const [saveStatus,     setSaveStatus]     = useState<SaveStatus>('idle');

  // Refs for autosave
  const dataRef        = useRef(data);
  const debounceRef    = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedTimerRef  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const canAutosaveRef = useRef(false); // gates autosave until initial load is done

  // Keep dataRef current
  useEffect(() => { dataRef.current = data; }, [data]);

  /* ── On mount: load existing profile ── */
  useEffect(() => {
    if (!user?.id) { setProfileLoading(false); return; }
    getCandidateProfile(user.id)
      .then((p: ServerProfile) => {
        if (p.payment_status === 'paid') {
          navigate('/candidate/dashboard', { replace: true });
          return;
        }
        setServerProfile(p);
        // Pre-populate text fields from server
        setData({
          force:           (p.force as Force) || '',
          rank:            p.rank             || '',
          fullName:        p.full_name        || '',
          mobile:          p.mobile           || '',
          unit:            p.unit             || '',
          idCard:          null,               // File objects can't be restored
          retirementDate:  p.retirement_date  ? p.retirement_date.split('T')[0] : '',
          dischargeBook:   null,
          policeVerification: null,
          post:            p.post             || 'Any',
          gunLicense:      p.gun_license      || '',
          otherPost:       p.other_post       || '',
          loc1:            p.loc1             || '',
          loc2:            p.loc2             || '',
          loc3:            p.loc3             || '',
        });
        setStep(getResumeStep(p));
      })
      .catch(() => { /* fresh start — keep INITIAL state */ })
      .finally(() => {
        setProfileLoading(false);
        // Allow autosave to fire after a short delay (avoids saving on initial populate)
        setTimeout(() => { canAutosaveRef.current = true; }, 200);
      });
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── Autosave trigger (debounced 800ms) ── */
  const triggerAutosave = useCallback(() => {
    if (!canAutosaveRef.current || !user?.id) return;
    if (debounceRef.current)   clearTimeout(debounceRef.current);
    if (savedTimerRef.current) clearTimeout(savedTimerRef.current);

    debounceRef.current = setTimeout(async () => {
      setSaveStatus('saving');
      try {
        const d = dataRef.current;
        await updateDraft({
          force:          d.force          || undefined,
          rank:           d.rank           || undefined,
          fullName:       d.fullName       || undefined,
          mobile:         d.mobile         || undefined,
          unit:           d.unit           || undefined,
          retirementDate: d.retirementDate || undefined,
          post:           d.post           || undefined,
          otherPost:      d.otherPost      || '',
          gunLicense:     d.gunLicense     || '',
          loc1:           d.loc1           || undefined,
          loc2:           d.loc2           || '',
          loc3:           d.loc3           || '',
        });
        setSaveStatus('saved');
        savedTimerRef.current = setTimeout(() => setSaveStatus('idle'), 3000);
      } catch {
        setSaveStatus('error');
      }
    }, 800);
  }, [user?.id]);

  /* ── Field update + autosave for text fields ── */
  const update = useCallback((k: keyof FormState, v: any) => {
    setData((p) => ({ ...p, [k]: v }));
    setErrors((p) => { const n = { ...p }; delete n[k]; return n; });
    if (typeof v === 'string') triggerAutosave();
  }, [triggerAutosave]);

  /* ── Validation ── */
  const validate = (): boolean => {
    const e: Partial<Record<keyof FormState, string>> = {};

    if (step === 1) {
      if (!data.force)                         e.force          = 'Please select your armed force';
      if (!data.rank)                          e.rank           = 'Please select your rank';
      if (!data.fullName.trim())               e.fullName       = 'Full name is required';
      if (!/^[6-9]\d{9}$/.test(data.mobile))  e.mobile         = 'Enter a valid 10-digit mobile number';
      if (!data.unit.trim())                   e.unit           = 'Unit / regiment is required';
      if (!data.retirementDate)                e.retirementDate = 'Date of retirement is required';
    }

    if (step === 2) {
      const idOk  = !!(data.idCard       || serverProfile?.id_card_path);
      const dbOk  = !!(data.dischargeBook || serverProfile?.discharge_book_path);
      if (!idOk) e.idCard       = 'Please upload your Ex-Serviceman Identity Card';
      if (!dbOk) e.dischargeBook = 'Please upload your Discharge Book';
    }

    if (step === 3) {
      if (data.post === 'Gunman' && !data.gunLicense.trim()) e.gunLicense = 'License number is required';
      if (data.post === 'Other'  && !data.otherPost.trim())  e.otherPost  = 'Please specify the role';
      if (!data.loc1) e.loc1 = 'Please select your first preferred location';
      if (!data.loc2) e.loc2 = 'Please select your second preferred location';
      if (!data.loc3) e.loc3 = 'Please select your third preferred location';
    }

    setErrors(e);
    if (Object.keys(e).length > 0) {
      toast({ title: 'Required fields missing', description: 'Please fill all required fields before continuing.', variant: 'error' });
      return false;
    }
    return true;
  };

  const goNext = () => {
    if (!validate()) return;
    if (returnToReview) {
      setReturnToReview(false);
      setStep(4);
    } else {
      setStep((s) => s + 1);
    }
    window.scrollTo(0, 0);
  };

  const goBack = () => {
    if (returnToReview) {
      setReturnToReview(false);
      setStep(4);
      window.scrollTo(0, 0);
      return;
    }
    if (step > 1) { setStep((s) => s - 1); window.scrollTo(0, 0); }
    else navigate('/');
  };

  /* Edit from review: jump to a step and set returnToReview so "Continue" goes back to 4 */
  const handleEditSection = (targetStep: number) => {
    setReturnToReview(true);
    setStep(targetStep);
    window.scrollTo(0, 0);
  };

  /* Proceed to payment: save full profile then navigate */
  const handleProceed = async () => {
    setSaving(true);
    try {
      const fd = new FormData();
      fd.append('mobile',         data.mobile);
      fd.append('force',          data.force);
      fd.append('rank',           data.rank);
      fd.append('fullName',       data.fullName);
      fd.append('unit',           data.unit);
      fd.append('retirementDate', data.retirementDate);
      fd.append('post',           data.post);
      if (data.otherPost)  fd.append('otherPost',  data.otherPost);
      if (data.gunLicense) fd.append('gunLicense', data.gunLicense);
      fd.append('loc1', data.loc1);
      if (data.loc2) fd.append('loc2', data.loc2);
      if (data.loc3) fd.append('loc3', data.loc3);
      fd.append('applicationFee', String(REGISTRATION_FEE));
      if (data.idCard)             fd.append('idCard',             data.idCard);
      if (data.dischargeBook)      fd.append('dischargeBook',      data.dischargeBook);
      if (data.policeVerification) fd.append('policeVerification', data.policeVerification);

      await saveProfile(fd);

      navigate('/candidate/payment', {
        state: {
          mobile:         data.mobile,
          fullName:       data.fullName,
          rank:           data.rank,
          force:          data.force,
          post:           data.post,
          loc1:           data.loc1,
          loc2:           data.loc2,
          loc3:           data.loc3,
          applicationFee: REGISTRATION_FEE,
          unit:           data.unit,
          retirementDate: data.retirementDate,
          otherPost:      data.otherPost,
          gunLicense:     data.gunLicense,
        },
      });
    } catch (err: any) {
      toast({ title: 'Could not save profile', description: err.message, variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  /* ── Profile loading screen ── */
  if (profileLoading) {
    return (
      <div className='min-h-screen bg-gray-50 flex items-center justify-center'>
        <div className='flex flex-col items-center gap-3'>
          <Loader2 className='w-10 h-10 text-[#F7A607] animate-spin' />
          <p className='text-sm font-semibold text-gray-600'>Loading your registration…</p>
        </div>
      </div>
    );
  }

  /* ── Save status label ── */
  const SaveStatusLabel = () => {
    if (saveStatus === 'idle') return null;
    return (
      <div className='flex items-center gap-1.5' aria-live='polite'>
        {saveStatus === 'saving' && (
          <><div className='w-3 h-3 border border-gray-400 border-t-gray-600 rounded-full animate-spin shrink-0' />
            <span className='text-[11px] text-gray-400'>Saving…</span></>
        )}
        {saveStatus === 'saved' && (
          <><CheckCircle className='w-3.5 h-3.5 text-green-500 shrink-0' />
            <span className='text-[11px] text-green-600 font-semibold'>Saved</span></>
        )}
        {saveStatus === 'error' && (
          <><AlertCircle className='w-3.5 h-3.5 text-amber-500 shrink-0' />
            <span className='text-[11px] text-amber-600'>Couldn't save</span></>
        )}
      </div>
    );
  };

  const continueBtnLabel =
    step === 4 ? null
    : returnToReview ? 'Save & Return to Review'
    : step === 3     ? 'Review & Continue'
    :                  'Continue';

  return (
    <div className='min-h-screen lg:h-screen bg-gray-50 flex flex-col lg:flex-row overflow-hidden'>

      {/* ══════════════════════════════════════════════════════════
          LEFT SIDEBAR — desktop only
      ══════════════════════════════════════════════════════════ */}
      <aside className='hidden lg:flex lg:w-[260px] xl:w-[280px] shrink-0 bg-[#1a1d1f] flex-col sticky top-0 h-screen overflow-y-auto'
        aria-label='Registration progress'>
        {/* Logo */}
        <div className='px-6 pt-7 pb-6 border-b border-white/8'>
          <div className='flex items-center gap-3'>
            <img src={companyLogo} alt='Ex-Serviceman Jobs' className='w-9 h-9 object-contain' />
            <div>
              <p className='font-extrabold text-white text-sm leading-tight' style={{ fontFamily: 'Plus Jakarta Sans' }}>
                Ex-Serviceman Jobs
              </p>
              <p className='text-[10px] text-gray-500 mt-0.5'>Candidate Registration</p>
            </div>
          </div>
        </div>

        {/* Resume indicator if returning */}
        {serverProfile && (serverProfile.force || serverProfile.full_name) && (
          <div className='mx-4 mt-4 px-3 py-2.5 bg-[#F7A607]/10 border border-[#F7A607]/20 rounded-xl'>
            <p className='text-[10px] font-bold text-[#F7A607] uppercase tracking-wide'>Resuming registration</p>
            <p className='text-xs text-gray-400 mt-0.5 truncate'>{serverProfile.full_name || 'Your draft is saved'}</p>
          </div>
        )}

        {/* Vertical step progress */}
        <div className='px-6 py-6 flex-1'>
          <p className='text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-5'>Your Registration</p>
          <div className='space-y-1'>
            {STEPS.map(({ label, desc }, i) => {
              const s      = i + 1;
              const done   = s < step;
              const active = s === step;
              return (
                <div key={label} className='flex gap-3'>
                  <div className='flex flex-col items-center'>
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-xs font-bold transition-all
                        ${done   ? 'bg-green-500 text-white'
                        : active ? 'bg-[#F7A607] text-white ring-4 ring-[#F7A607]/20'
                        :          'bg-white/8 text-gray-500'}`}
                      aria-current={active ? 'step' : undefined}>
                      {done ? <CheckCircle className='w-4 h-4' /> : s}
                    </div>
                    {i < STEPS.length - 1 && (
                      <div className={`w-0.5 h-8 mt-1 rounded-full transition-all ${done ? 'bg-green-500/40' : 'bg-white/8'}`} />
                    )}
                  </div>
                  <div className='pb-8'>
                    <p className={`text-sm font-semibold leading-tight transition-all
                      ${active ? 'text-white' : done ? 'text-green-400' : 'text-gray-500'}`}>{label}</p>
                    <p className={`text-[10px] mt-0.5 leading-snug ${active ? 'text-gray-400' : 'text-gray-600'}`}>{desc}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Trust badges */}
        <div className='px-6 pb-6 space-y-2 border-t border-white/8 pt-4'>
          <div className='flex items-center gap-2 text-xs text-gray-500'>
            <Lock className='w-3.5 h-3.5 text-green-500 shrink-0' />
            Documents private — not shared with employers
          </div>
          <div className='flex items-center gap-2 text-xs text-gray-500'>
            <Shield className='w-3.5 h-3.5 text-[#F7A607] shrink-0' />
            DGR Empanelled Partner
          </div>
          <div className='flex items-center gap-2 text-xs text-gray-500'>
            <Award className='w-3.5 h-3.5 text-blue-400 shrink-0' />
            Ministry of Defence, Govt. of India
          </div>
          {user?.email && (
            <div className='mt-3 px-3 py-2 bg-white/5 rounded-xl'>
              <p className='text-[10px] text-gray-500'>Registering as</p>
              <p className='text-xs font-semibold text-white truncate mt-0.5'>{user.email}</p>
            </div>
          )}
        </div>
      </aside>

      {/* ══════════════════════════════════════════════════════════
          MAIN CONTENT
      ══════════════════════════════════════════════════════════ */}
      <div className='flex-1 flex flex-col min-w-0 lg:overflow-hidden'>

        {/* Sticky header */}
        <div className='sticky top-0 z-40 bg-white border-b border-gray-100'>
          <div className='flex items-center gap-3 px-4 lg:px-8 h-14 max-w-3xl lg:max-w-none mx-auto'>
            <button onClick={goBack} aria-label='Go back'
              className='w-9 h-9 rounded-xl border border-gray-200 flex items-center justify-center hover:bg-gray-50 transition-colors shrink-0
                focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F7A607]/40'>
              <ChevronLeft className='w-4 h-4 text-gray-600' />
            </button>

            <div className='flex items-center gap-2 flex-1 min-w-0'>
              {/* Mobile brand */}
              <div className='flex items-center gap-2 lg:hidden'>
                <div className='w-7 h-7 rounded-lg bg-[#F7A607] flex items-center justify-center shrink-0'>
                  <Zap className='w-3.5 h-3.5 text-white' />
                </div>
                <span className='text-sm font-bold text-gray-900 truncate' style={{ fontFamily: 'Plus Jakarta Sans' }}>
                  {BRAND.name} — Registration
                </span>
              </div>
              {/* Desktop step info */}
              <div className='hidden lg:flex items-center gap-2'>
                <span className='text-xs font-bold text-[#F7A607] uppercase tracking-wider'>Step {step} of 4</span>
                <span className='text-gray-300'>·</span>
                <span className='text-sm font-semibold text-gray-700'>{STEPS[step - 1].label}</span>
                <span className='hidden xl:inline text-xs text-gray-400'>— {STEPS[step - 1].desc}</span>
              </div>
            </div>

            {/* Save status indicator */}
            <SaveStatusLabel />

            <span className='text-xs font-semibold text-[#F7A607] shrink-0 ml-1'>{step}/4</span>
          </div>

          {/* Progress bar */}
          <div className='h-0.5 bg-gray-100'>
            <motion.div className='h-full bg-[#F7A607]'
              animate={{ width: `${(step / 4) * 100}%` }}
              transition={{ duration: 0.35, ease: 'easeInOut' }} />
          </div>

          {/* Mobile step tabs */}
          <div className='flex border-b border-gray-100 lg:hidden' role='tablist' aria-label='Registration steps'>
            {STEPS.map(({ shortLabel }, i) => {
              const s      = i + 1;
              const done   = s < step;
              const active = s === step;
              return (
                <div key={shortLabel} role='tab' aria-selected={active}
                  aria-label={`Step ${s}: ${STEPS[i].label}`}
                  className={`flex-1 flex flex-col items-center py-2 gap-0.5 border-b-2 transition-all
                    ${active ? 'border-[#F7A607]' : done ? 'border-green-400' : 'border-transparent'}`}>
                  <span className={`text-[11px] font-semibold ${active ? 'text-[#F7A607]' : done ? 'text-green-600' : 'text-gray-400'}`}>
                    {done ? '✓' : s}
                  </span>
                  <span className={`text-[9px] font-medium leading-tight text-center ${active ? 'text-[#F7A607]' : done ? 'text-green-600' : 'text-gray-400'}`}>
                    {shortLabel}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Form content */}
        <div className='flex-1 overflow-y-auto pb-28 lg:pb-6'>
          <div className='px-4 lg:px-8 xl:px-12 max-w-3xl lg:max-w-none mx-auto'>
            <AnimatePresence mode='wait'>
              <motion.div key={step}
                initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}>
                {step === 1 && <PersonalServiceStep data={data} update={update} errors={errors} />}
                {step === 2 && <DocumentsVerificationStep data={data} update={update} errors={errors} serverProfile={serverProfile} />}
                {step === 3 && <JobPreferencesStep data={data} update={update} errors={errors} />}
                {step === 4 && (
                  <ReviewPaymentStep
                    data={data} serverProfile={serverProfile}
                    saving={saving} onProceed={handleProceed}
                    onEdit={handleEditSection}
                    onGoBack={() => { setReturnToReview(false); setStep(3); window.scrollTo(0, 0); }}
                  />
                )}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>

        {/* Bottom continue bar — steps 1–3 only */}
        {step < 4 && (
          <div className='fixed bottom-0 left-0 right-0 lg:sticky lg:bottom-auto bg-white border-t border-gray-100 px-4 lg:px-8 py-3 shadow-[0_-4px_20px_rgba(0,0,0,0.05)] lg:shadow-none'>
            <div className='max-w-3xl lg:max-w-none mx-auto'>
              <Button size='lg' className='w-full lg:w-auto lg:min-w-[220px] rounded-xl text-sm font-bold gap-2'
                onClick={goNext}>
                {continueBtnLabel}
                <ChevronRight className='w-4 h-4' />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
