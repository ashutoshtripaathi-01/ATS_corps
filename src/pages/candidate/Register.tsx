import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronLeft,
  ChevronRight,
  CheckCircle,
  Shield,
  Anchor,
  Plane,
  Star,
  CreditCard,
  MapPin,
  Briefcase,
  FileText,
  Calendar,
  AlertCircle,
  X,
  Zap,
  Upload,
  ArrowLeft,
  Info,
  Lock,
  Award,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAppStore } from '@/store/useAppStore';
import { toast } from '@/hooks/useToast';
import { BRAND } from '@/constants';
import companyLogo from '@/assets/company logo.png';

/* ─── Data ───────────────────────────────────────────────────────────────── */
const FORCES = ['Army', 'Navy', 'Air Force', 'Para Military'] as const;
type Force = (typeof FORCES)[number];

const FORCE_META: Record<Force, { icon: React.ElementType; color: string; description: string }> = {
  Army:           { icon: Shield, color: 'text-green-700',  description: 'Indian Army' },
  Navy:           { icon: Anchor, color: 'text-blue-700',   description: 'Indian Navy' },
  'Air Force':    { icon: Plane,  color: 'text-sky-600',    description: 'Indian Air Force' },
  'Para Military':{ icon: Star,   color: 'text-orange-600', description: 'CRPF / BSF / CISF / ITBP' },
};

const RANKS: Record<Force, string[]> = {
  Army: ['Sepoy','Rifleman','Lance Naik','Naik','Havildar','Havildar Major','Naib Subedar','Subedar','Subedar Major','Hony. Lieutenant','Hony. Captain'],
  Navy: ['Seaman 2nd Class','Seaman 1st Class','Leading Seaman','Petty Officer','Chief Petty Officer','Master Chief Petty Officer 2','Master Chief Petty Officer 1','Hony. Sub Lieutenant'],
  'Air Force': ['Aircraftman','Leading Aircraftman','Corporal','Sergeant','Junior Warrant Officer (JWO)','Warrant Officer (WO)','Master Warrant Officer (MWO)','Hony. Flying Officer'],
  'Para Military': ['Constable (GD)','Head Constable (GD)','Assistant Sub-Inspector (ASI)','Sub-Inspector (SI)','Inspector','Assistant Commandant','Deputy Commandant'],
};

const POSTS    = ['Any', 'Guard Unarmed', 'Gunman', 'Security Supervisor', 'Other'] as const;
const LOCATIONS = ['Upper Assam', 'Guwahati & Around', 'Lower Assam'] as const;
const LOCATION_FEES: Record<string, number> = {
  'Upper Assam': 100, 'Guwahati & Around': 100, 'Lower Assam': 100,
};

/* ─── Types ──────────────────────────────────────────────────────────────── */
interface FormState {
  force: Force | ''; rank: string; fullName: string; mobile: string; unit: string;
  idCard: File | null; retirementDate: string; dischargeBook: File | null;
  policeVerification: File | null; post: string; gunLicense: string;
  otherPost: string; loc1: string; loc2: string; loc3: string;
}
const INITIAL: FormState = {
  force:'', rank:'', fullName:'', mobile:'', unit:'', idCard:null,
  retirementDate:'', dischargeBook:null, policeVerification:null,
  post:'Any', gunLicense:'', otherPost:'', loc1:'', loc2:'', loc3:'',
};

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
    <p className='flex items-center gap-1 mt-1.5 text-xs text-red-500'>
      <AlertCircle className='w-3.5 h-3.5 shrink-0' />{msg}
    </p>
  );
}
function TextInput({ label, required, placeholder, value, onChange, type = 'text', icon }: {
  label: string; required?: boolean; placeholder: string; value: string;
  onChange: (v: string) => void; type?: string; icon?: React.ElementType;
}) {
  const Icon = icon;
  return (
    <div>
      <FieldLabel required={required}>{label}</FieldLabel>
      <div className='relative'>
        {Icon && <Icon className='absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none' />}
        <input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
          className={`w-full h-12 rounded-xl border border-gray-200 bg-white text-sm text-gray-900 placeholder:text-gray-400
            outline-none transition-all focus:border-[#F7A607] focus:ring-2 focus:ring-[#F7A607]/10
            ${Icon ? 'pl-10 pr-4' : 'px-4'}`}
        />
      </div>
    </div>
  );
}
function SelectInput({ label, required, value, onChange, placeholder, options, disabled }: {
  label?: string; required?: boolean; value: string; onChange: (v: string) => void;
  placeholder: string; options: string[]; disabled?: boolean;
}) {
  return (
    <div>
      {label && <FieldLabel required={required}>{label}</FieldLabel>}
      <div className='relative'>
        <select value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled}
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
function FileUpload({ label, required, hint, file, onChange, accept = 'image/*,.pdf' }: {
  label: string; required?: boolean; hint?: string; file: File | null;
  onChange: (f: File | null) => void; accept?: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <div>
      <FieldLabel required={required}>{label}</FieldLabel>
      {hint && <p className='text-xs text-gray-400 mb-2'>{hint}</p>}
      <input ref={ref} type='file' accept={accept} className='hidden' onChange={(e) => onChange(e.target.files?.[0] ?? null)} />
      {file ? (
        <div className='flex items-center gap-3 px-4 py-3 bg-green-50 border border-green-200 rounded-xl'>
          <div className='w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center shrink-0'>
            <CheckCircle className='w-4 h-4 text-green-600' />
          </div>
          <div className='flex-1 min-w-0'>
            <p className='text-sm font-medium text-gray-900 truncate'>{file.name}</p>
            <p className='text-xs text-gray-500'>{(file.size / 1024).toFixed(0)} KB</p>
          </div>
          <button onClick={() => onChange(null)} className='p-1 rounded-lg hover:bg-red-50 transition-colors'>
            <X className='w-4 h-4 text-gray-400 hover:text-red-500' />
          </button>
        </div>
      ) : (
        <button onClick={() => ref.current?.click()}
          className='w-full flex items-center gap-4 px-4 py-4 bg-gray-50 border border-dashed border-gray-300 rounded-xl
            hover:bg-gray-100 hover:border-gray-400 active:scale-[0.99] transition-all text-left'
        >
          <div className='w-10 h-10 bg-white border border-gray-200 rounded-xl flex items-center justify-center shrink-0 shadow-sm'>
            <Upload className='w-4 h-4 text-gray-500' />
          </div>
          <div>
            <p className='text-sm font-medium text-gray-700'>Click to upload</p>
            <p className='text-xs text-gray-400 mt-0.5'>JPG, PNG or PDF · Max 5 MB</p>
          </div>
        </button>
      )}
    </div>
  );
}

/* ─── Step 1: Service Details ─────────────────────────────────────────────── */
function ServiceStep({ data, update, errors }: {
  data: FormState; update: (k: keyof FormState, v: any) => void;
  errors: Partial<Record<keyof FormState, string>>;
}) {
  return (
    <div className='space-y-5 pt-2 pb-6'>
      {/* Force selection */}
      <div>
        <FieldLabel required>Armed Force</FieldLabel>
        <div className='grid grid-cols-2 lg:grid-cols-4 gap-2'>
          {(FORCES as unknown as Force[]).map((f) => {
            const meta = FORCE_META[f];
            const Icon = meta.icon;
            const selected = data.force === f;
            return (
              <button key={f} type='button'
                onClick={() => { update('force', f); update('rank', ''); }}
                className={`flex items-center gap-3 px-3 py-3 rounded-xl border-2 text-left transition-all active:scale-[0.98]
                  ${selected ? 'border-[#F7A607] bg-[#F7A607]/5' : 'border-gray-200 bg-white hover:border-gray-300'}`}
              >
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${selected ? 'bg-[#F7A607]/15' : 'bg-gray-100'}`}>
                  <Icon className={`w-4 h-4 ${selected ? 'text-[#F7A607]' : meta.color}`} />
                </div>
                <div className='min-w-0'>
                  <p className={`text-sm font-semibold leading-tight ${selected ? 'text-[#292e31]' : 'text-gray-800'}`}>{f}</p>
                  <p className='text-[10px] text-gray-400 truncate'>{meta.description}</p>
                </div>
              </button>
            );
          })}
        </div>
        <FieldError msg={errors.force} />
      </div>

      {/* Rank */}
      <div>
        <SelectInput label='Rank / Designation' required value={data.rank} onChange={(v) => update('rank', v)}
          placeholder={data.force ? 'Select your rank' : 'Select force first'}
          options={data.force ? RANKS[data.force] : []} disabled={!data.force}
        />
        <FieldError msg={errors.rank} />
      </div>

      {/* Name + Mobile — 2-col on desktop */}
      <div className='grid grid-cols-1 lg:grid-cols-2 gap-4'>
        <div>
          <TextInput label='Full Name' required placeholder='As per service records' value={data.fullName} onChange={(v) => update('fullName', v)} />
          <FieldError msg={errors.fullName} />
        </div>
        <div>
          <label className='block text-sm font-medium text-gray-700 mb-1.5'>
            Mobile Number <span className='text-red-500'>*</span>
          </label>
          <div className='flex gap-2'>
            <div className='flex items-center gap-1.5 px-3 h-12 bg-gray-50 border border-gray-200 rounded-xl shrink-0'>
              <span className='text-base'>🇮🇳</span>
              <span className='text-sm font-semibold text-gray-700'>+91</span>
            </div>
            <input type='tel' inputMode='numeric' maxLength={10} placeholder='9876543210' value={data.mobile}
              onChange={(e) => update('mobile', e.target.value.replace(/\D/g, ''))}
              className='flex-1 h-12 px-3 text-sm border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-[#F7A607]/40 focus:border-[#F7A607]'
            />
          </div>
          <FieldError msg={errors.mobile} />
        </div>
      </div>

      {/* Unit + Retirement date — 2-col on desktop */}
      <div className='grid grid-cols-1 lg:grid-cols-2 gap-4'>
        <div>
          <TextInput label='Unit / Regiment' required placeholder='e.g. 4 ASSAM RIFLES' value={data.unit} onChange={(v) => update('unit', v)} />
          <FieldError msg={errors.unit} />
        </div>
        <div>
          <FieldLabel required>Date of Retirement</FieldLabel>
          <div className='relative'>
            <Calendar className='absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none' />
            <input type='date' value={data.retirementDate}
              onChange={(e) => update('retirementDate', e.target.value)}
              max={new Date().toISOString().split('T')[0]}
              className={`w-full h-12 rounded-xl border border-gray-200 bg-white text-sm outline-none
                transition-all focus:border-[#F7A607] focus:ring-2 focus:ring-[#F7A607]/10 pl-10 pr-4
                ${data.retirementDate ? 'text-gray-900' : 'text-gray-400'}`}
            />
          </div>
          <FieldError msg={errors.retirementDate} />
        </div>
      </div>

      {/* ID Card upload */}
      <div>
        <FileUpload label='Ex-Serviceman Identity Card' required hint='Upload front side — clear photo or scanned copy'
          file={data.idCard} onChange={(f) => update('idCard', f)} />
        <FieldError msg={errors.idCard} />
      </div>
    </div>
  );
}

/* ─── Step 2: Documents ───────────────────────────────────────────────────── */
function DocumentsStep({ data, update, errors }: {
  data: FormState; update: (k: keyof FormState, v: any) => void;
  errors: Partial<Record<keyof FormState, string>>;
}) {
  return (
    <div className='pt-2 pb-6 space-y-4'>
      <div className='flex gap-3 p-3.5 bg-blue-50 border border-blue-100 rounded-xl'>
        <Info className='w-4 h-4 text-blue-500 shrink-0 mt-0.5' />
        <p className='text-xs text-blue-700 leading-relaxed'>
          All documents are encrypted and stored securely. Used only for background verification.
        </p>
      </div>

      <div className='grid grid-cols-1 lg:grid-cols-2 gap-4'>
        {/* Discharge Book */}
        <div className='bg-white border border-gray-100 rounded-2xl p-4 space-y-3 shadow-sm'>
          <div className='flex items-center gap-2.5'>
            <div className='w-8 h-8 rounded-lg bg-[#F7A607]/10 flex items-center justify-center'>
              <FileText className='w-4 h-4 text-[#F7A607]' />
            </div>
            <div>
              <p className='text-sm font-semibold text-gray-900'>Educational Qualification</p>
              <p className='text-xs text-gray-500'>Discharge Book upload</p>
            </div>
          </div>
          <FileUpload label='Discharge Book' required hint='Army / Navy / Air Force / Para Military Discharge Book'
            file={data.dischargeBook} onChange={(f) => update('dischargeBook', f)} />
          <FieldError msg={errors.dischargeBook} />
        </div>

        {/* Police Verification */}
        <div className='bg-white border border-gray-100 rounded-2xl p-4 space-y-3 shadow-sm'>
          <div className='flex items-center gap-2.5'>
            <div className='w-8 h-8 rounded-lg bg-green-50 flex items-center justify-center'>
              <Shield className='w-4 h-4 text-green-600' />
            </div>
            <div>
              <p className='text-sm font-semibold text-gray-900'>Police Verification</p>
              <p className='text-xs text-gray-500'>Clearance certificate from local police</p>
            </div>
          </div>
          <FileUpload label='Police Verification Certificate' hint='Upload police clearance from your home district (optional)'
            file={data.policeVerification} onChange={(f) => update('policeVerification', f)} />
          <FieldError msg={errors.policeVerification} />
        </div>
      </div>
    </div>
  );
}

/* ─── Step 3: Post & Location ─────────────────────────────────────────────── */
function PostLocationStep({ data, update, errors }: {
  data: FormState; update: (k: keyof FormState, v: any) => void;
  errors: Partial<Record<keyof FormState, string>>;
}) {
  const locOptions = (excluding: string[]) =>
    (LOCATIONS as unknown as string[]).filter((l) => !excluding.includes(l));

  return (
    <div className='pt-2 pb-6 space-y-4'>
      <div className='grid grid-cols-1 lg:grid-cols-2 gap-4 items-start'>

        {/* Post Applied For */}
        <div className='bg-white border border-gray-100 rounded-2xl p-4 shadow-sm space-y-3'>
          <div className='flex items-center gap-2'>
            <Briefcase className='w-4 h-4 text-[#F7A607]' />
            <p className='text-sm font-semibold text-gray-900'>Post Applied For</p>
          </div>
          <FieldLabel>Select the post you are applying for</FieldLabel>
          <div className='grid grid-cols-2 gap-2'>
            {(POSTS as unknown as string[]).map((post) => {
              const active = data.post === post;
              return (
                <button key={post} type='button' onClick={() => update('post', post)}
                  className={`relative flex items-center gap-2 px-3 py-3 rounded-xl border-2 text-left transition-all active:scale-[0.98]
                    ${active ? 'border-[#F7A607] bg-[#F7A607]/5' : 'border-gray-200 bg-gray-50 hover:border-gray-300 hover:bg-white'}`}
                >
                  <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0
                    ${active ? 'border-[#F7A607] bg-[#F7A607]' : 'border-gray-300'}`}>
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
              <motion.div key='gun' initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
                <TextInput label='Gun / Weapon License Number' required placeholder='Enter license number' value={data.gunLicense} onChange={(v) => update('gunLicense', v)} />
                <FieldError msg={errors.gunLicense} />
              </motion.div>
            )}
            {data.post === 'Other' && (
              <motion.div key='other' initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
                <TextInput label='Specify Post' required placeholder='Enter the post you are applying for' value={data.otherPost} onChange={(v) => update('otherPost', v)} />
                <FieldError msg={errors.otherPost} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Preferred Location */}
        <div className='bg-white border border-gray-100 rounded-2xl p-4 shadow-sm space-y-4'>
          <div className='flex items-start gap-2'>
            <MapPin className='w-4 h-4 text-[#F7A607] shrink-0 mt-0.5' />
            <div>
              <p className='text-sm font-semibold text-gray-900'>Preferred Posting Location</p>
              <p className='text-xs text-gray-500 mt-0.5'>Arrange in order of preference. No location can repeat.</p>
            </div>
          </div>

          {([
            { key: 'loc1' as const, label: 'Priority 1', badge: '1st Choice', badgeColor: 'bg-[#F7A607] text-white' },
            { key: 'loc2' as const, label: 'Priority 2', badge: '2nd Choice', badgeColor: 'bg-gray-200 text-gray-700' },
            { key: 'loc3' as const, label: 'Priority 3', badge: '3rd Choice', badgeColor: 'bg-gray-100 text-gray-600' },
          ]).map(({ key, label, badge, badgeColor }) => {
            const excluding = key === 'loc1' ? [] : key === 'loc2' ? [data.loc1] : [data.loc1, data.loc2];
            const isDisabled = (key === 'loc2' && !data.loc1) || (key === 'loc3' && !data.loc2);
            return (
              <div key={key}>
                <div className='flex items-center justify-between mb-1.5'>
                  <FieldLabel>{label}</FieldLabel>
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${badgeColor}`}>{badge}</span>
                </div>
                <SelectInput value={data[key]}
                  onChange={(v) => { update(key, v); if (key === 'loc1') { update('loc2', ''); update('loc3', ''); } if (key === 'loc2') update('loc3', ''); }}
                  placeholder='Select location' options={locOptions(excluding)} disabled={isDisabled}
                />
                <FieldError msg={errors[key]} />
              </div>
            );
          })}

          {data.loc1 && (
            <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
              className='flex items-center justify-between p-3 bg-amber-50 border border-amber-100 rounded-xl'
            >
              <div>
                <p className='text-xs text-gray-500'>Application fee for</p>
                <p className='text-sm font-semibold text-gray-900'>{data.loc1}</p>
              </div>
              <p className='text-lg font-extrabold text-[#F7A607]'>₹{LOCATION_FEES[data.loc1]?.toLocaleString()}</p>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── Step 4: Confirm & Proceed ───────────────────────────────────────────── */
function PaymentStep({ data, onProceed, onGoBack }: {
  data: FormState; onProceed: () => void; onGoBack: () => void;
}) {
  const fee = LOCATION_FEES[data.loc1] ?? 0;

  if (!data.loc1) {
    return (
      <div className='pt-2 pb-6 flex flex-col items-center justify-center min-h-[50vh] text-center gap-4'>
        <div className='w-14 h-14 bg-amber-50 rounded-2xl flex items-center justify-center'>
          <MapPin className='w-7 h-7 text-amber-500' />
        </div>
        <p className='font-semibold text-gray-900'>No location selected</p>
        <p className='text-sm text-gray-500'>Go back to Step 3 and select your preferred posting location.</p>
        <button onClick={onGoBack} className='flex items-center gap-2 text-sm font-semibold text-[#F7A607] hover:underline'>
          <ArrowLeft className='w-4 h-4' /> Go back to Step 3
        </button>
      </div>
    );
  }

  return (
    <div className='pt-2 pb-6 space-y-4'>
      <div className='grid grid-cols-1 lg:grid-cols-2 gap-4'>
        {/* Summary card */}
        <div className='bg-[#292e31] rounded-2xl p-5 text-white'>
          <p className='text-xs text-gray-400 mb-1'>Application Fee</p>
          <div className='flex items-baseline gap-1.5 mb-1'>
            <span className='text-3xl font-extrabold'>₹{fee.toLocaleString()}</span>
            <span className='text-sm text-gray-400'>one-time</span>
          </div>
          <div className='inline-flex items-center gap-1.5 bg-[#F7A607]/20 text-[#F7A607] text-xs font-semibold px-2.5 py-1 rounded-full mb-3'>
            <CreditCard className='w-3 h-3' /> One-time registration fee
          </div>
          <div className='pt-3 border-t border-white/10 space-y-1.5'>
            {[
              { label: 'Applicant',           value: data.fullName || '—' },
              { label: 'Rank & Force',        value: `${data.rank}, ${data.force}` },
              { label: 'Post Applied',        value: data.post },
              { label: 'Priority 1 Location', value: data.loc1 },
            ].map((r) => (
              <div key={r.label} className='flex justify-between items-center'>
                <span className='text-xs text-gray-400'>{r.label}</span>
                <span className='text-xs font-semibold text-white truncate max-w-[55%] text-right'>{r.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Fee reference */}
        <div className='bg-white border border-gray-100 rounded-2xl p-4 shadow-sm flex flex-col justify-between'>
          <p className='text-xs font-medium text-gray-500 mb-3'>Location fee structure</p>
          <div className='divide-y divide-gray-50 flex-1'>
            {Object.entries(LOCATION_FEES).map(([loc, amt]) => (
              <div key={loc} className={`flex items-center justify-between py-2.5 ${data.loc1 === loc ? 'text-[#292e31]' : 'text-gray-500'}`}>
                <div className='flex items-center gap-2'>
                  <MapPin className={`w-3.5 h-3.5 ${data.loc1 === loc ? 'text-[#F7A607]' : 'text-gray-300'}`} />
                  <span className={`text-sm ${data.loc1 === loc ? 'font-semibold' : 'font-normal'}`}>{loc}</span>
                  {data.loc1 === loc && (
                    <span className='text-[10px] font-semibold px-1.5 py-0.5 bg-[#F7A607]/10 text-[#F7A607] rounded-full'>Selected</span>
                  )}
                </div>
                <span className={`text-sm font-bold ${data.loc1 === loc ? 'text-[#F7A607]' : 'text-gray-400'}`}>₹{amt.toLocaleString()}</span>
              </div>
            ))}
          </div>
          <p className='text-[10px] text-gray-400 mt-4 flex items-center gap-1.5 pt-3 border-t border-gray-50'>
            <Lock className='w-3 h-3 text-green-500' /> Secured by Razorpay · 256-bit SSL
          </p>
        </div>
      </div>

      <Button size='lg' className='w-full lg:max-w-xs rounded-xl text-sm font-bold gap-2.5 h-13' onClick={onProceed}>
        <CreditCard className='w-4 h-4' /> Proceed to Payment
      </Button>
    </div>
  );
}

/* ─── Step metadata ───────────────────────────────────────────────────────── */
const STEPS = [
  { label: 'Service',    desc: 'Force, rank & personal details' },
  { label: 'Documents',  desc: 'Discharge book & verification' },
  { label: 'Preference', desc: 'Post applied & preferred location' },
  { label: 'Payment',    desc: 'Review & proceed to payment' },
];

/* ─── Main Page ───────────────────────────────────────────────────────────── */
export default function CandidateRegister() {
  const navigate = useNavigate();
  const { user } = useAppStore();

  const [step, setStep] = useState(1);
  const [data, setData] = useState<FormState>(INITIAL);
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});

  const update = (k: keyof FormState, v: any) => {
    setData((p) => ({ ...p, [k]: v }));
    setErrors((p) => { const n = { ...p }; delete n[k]; return n; });
  };

  const validate = (): boolean => {
    const e: Partial<Record<keyof FormState, string>> = {};
    if (step === 1) {
      if (!data.force) e.force = 'Please select your armed force';
      if (!data.rank) e.rank = 'Please select your rank';
      if (!data.fullName.trim()) e.fullName = 'Full name is required';
      if (!/^[6-9]\d{9}$/.test(data.mobile)) e.mobile = 'Enter a valid 10-digit mobile number';
      if (!data.unit.trim()) e.unit = 'Unit / regiment is required';
      if (!data.idCard) e.idCard = 'Please upload your Ex-SM Identity Card';
      if (!data.retirementDate) e.retirementDate = 'Date of retirement is required';
    }
    if (step === 2) {
      if (!data.dischargeBook) e.dischargeBook = 'Please upload your Discharge Book';
    }
    if (step === 3) {
      if (data.post === 'Gunman' && !data.gunLicense.trim()) e.gunLicense = 'License number is required';
      if (data.post === 'Other' && !data.otherPost.trim()) e.otherPost = 'Please specify the post';
      if (!data.loc1) e.loc1 = 'Please select Priority 1 location';
      if (!data.loc2) e.loc2 = 'Please select Priority 2 location';
      if (!data.loc3) e.loc3 = 'Please select Priority 3 location';
    }
    setErrors(e);
    if (Object.keys(e).length > 0) {
      toast({ title: 'Required fields missing', description: 'Please fill all required fields.', variant: 'error' });
      return false;
    }
    return true;
  };

  const goNext = () => { if (!validate()) return; setStep((s) => s + 1); window.scrollTo(0, 0); };
  const goBack = () => { if (step > 1) { setStep((s) => s - 1); window.scrollTo(0, 0); } else navigate('/'); };

  return (
    <div className='min-h-screen bg-gray-50 flex flex-col lg:flex-row'>

      {/* ══════════════════════════════════════════════════════════
          LEFT SIDEBAR — desktop only
      ══════════════════════════════════════════════════════════ */}
      <aside className='hidden lg:flex lg:w-[260px] xl:w-[280px] shrink-0 bg-[#1a1d1f] flex-col sticky top-0 h-screen overflow-y-auto'>

        {/* Logo + brand */}
        <div className='px-6 pt-7 pb-6 border-b border-white/8'>
          <div className='flex items-center gap-3 mb-1'>
            <img src={companyLogo} alt='Ex-Serviceman Jobs' className='w-9 h-9 object-contain' />
            <div>
              <p className='font-extrabold text-white text-sm leading-tight' style={{ fontFamily: 'Plus Jakarta Sans' }}>
                Ex-Serviceman Jobs
              </p>
              <p className='text-[10px] text-gray-500 mt-0.5'>Candidate Registration</p>
            </div>
          </div>
        </div>

        {/* Vertical step progress */}
        <div className='px-6 py-6 flex-1'>
          <p className='text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-5'>Registration Steps</p>
          <div className='space-y-1'>
            {STEPS.map(({ label, desc }, i) => {
              const s      = i + 1;
              const done   = s < step;
              const active = s === step;
              return (
                <div key={label} className='flex gap-3'>
                  {/* Step marker + connector */}
                  <div className='flex flex-col items-center'>
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-xs font-bold transition-all
                      ${done   ? 'bg-green-500 text-white'
                      : active ? 'bg-[#F7A607] text-white ring-4 ring-[#F7A607]/20'
                      :          'bg-white/8 text-gray-500'}`}
                    >
                      {done ? <CheckCircle className='w-4 h-4' /> : s}
                    </div>
                    {i < STEPS.length - 1 && (
                      <div className={`w-0.5 h-8 mt-1 rounded-full transition-all ${done ? 'bg-green-500/40' : 'bg-white/8'}`} />
                    )}
                  </div>
                  {/* Label */}
                  <div className='pb-8'>
                    <p className={`text-sm font-semibold leading-tight transition-all ${active ? 'text-white' : done ? 'text-green-400' : 'text-gray-500'}`}>
                      {label}
                    </p>
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
            Documents encrypted & secure
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
          MAIN CONTENT — full width on mobile, flex-1 on desktop
      ══════════════════════════════════════════════════════════ */}
      <div className='flex-1 flex flex-col min-w-0'>

        {/* ── Sticky header ── */}
        <div className='sticky top-0 z-40 bg-white border-b border-gray-100'>
          <div className='flex items-center gap-3 px-4 lg:px-8 h-14 max-w-3xl lg:max-w-none mx-auto'>
            <button onClick={goBack}
              className='w-9 h-9 rounded-xl border border-gray-200 flex items-center justify-center hover:bg-gray-50 transition-colors shrink-0'
            >
              <ChevronLeft className='w-4 h-4 text-gray-600' />
            </button>
            <div className='flex items-center gap-2 flex-1 min-w-0'>
              {/* Brand — mobile only (desktop has sidebar) */}
              <div className='flex items-center gap-2 lg:hidden'>
                <div className='w-7 h-7 rounded-lg bg-[#F7A607] flex items-center justify-center shrink-0'>
                  <Zap className='w-3.5 h-3.5 text-white' />
                </div>
                <span className='text-sm font-bold text-gray-900 truncate' style={{ fontFamily: 'Plus Jakarta Sans' }}>
                  {BRAND.name} — Registration
                </span>
              </div>
              {/* Step name — desktop only */}
              <div className='hidden lg:flex items-center gap-2'>
                <span className='text-xs font-bold text-[#F7A607] uppercase tracking-wider'>
                  Step {step} of 4
                </span>
                <span className='text-gray-300'>·</span>
                <span className='text-sm font-semibold text-gray-700'>{STEPS[step - 1].label}</span>
                <span className='hidden xl:inline text-xs text-gray-400'>— {STEPS[step - 1].desc}</span>
              </div>
            </div>
            <span className='text-xs font-semibold text-[#F7A607] shrink-0'>{step}/4</span>
          </div>

          {/* Progress bar */}
          <div className='h-0.5 bg-gray-100'>
            <motion.div className='h-full bg-[#F7A607]'
              animate={{ width: `${(step / 4) * 100}%` }} transition={{ duration: 0.35, ease: 'easeInOut' }} />
          </div>

          {/* Step tabs — mobile only */}
          <div className='flex border-b border-gray-100 lg:hidden'>
            {STEPS.map(({ label }, i) => {
              const s = i + 1; const done = s < step; const active = s === step;
              return (
                <div key={label} className={`flex-1 flex flex-col items-center py-2 gap-0.5 border-b-2 transition-all
                  ${active ? 'border-[#F7A607]' : done ? 'border-green-400' : 'border-transparent'}`}>
                  <span className={`text-[11px] font-semibold ${active ? 'text-[#F7A607]' : done ? 'text-green-600' : 'text-gray-400'}`}>
                    {done ? '✓' : s}
                  </span>
                  <span className={`text-[9px] font-medium ${active ? 'text-[#F7A607]' : done ? 'text-green-600' : 'text-gray-400'}`}>
                    {label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Form content ── */}
        <div className='flex-1 overflow-y-auto pb-28 lg:pb-12'>
          <div className='px-4 lg:px-8 xl:px-12 max-w-3xl lg:max-w-none mx-auto'>
            <AnimatePresence mode='wait'>
              <motion.div key={step}
                initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
              >
                {step === 1 && <ServiceStep      data={data} update={update} errors={errors} />}
                {step === 2 && <DocumentsStep    data={data} update={update} errors={errors} />}
                {step === 3 && <PostLocationStep  data={data} update={update} errors={errors} />}
                {step === 4 && (
                  <PaymentStep data={data}
                    onProceed={() => navigate('/candidate/payment', {
                      state: {
                        mobile: data.mobile, fullName: data.fullName, rank: data.rank,
                        force: data.force, post: data.post, loc1: data.loc1,
                        loc2: data.loc2, loc3: data.loc3,
                        applicationFee: LOCATION_FEES[data.loc1] ?? 0,
                        unit: data.unit, retirementDate: data.retirementDate,
                        otherPost: data.otherPost, gunLicense: data.gunLicense,
                        idCard: data.idCard, dischargeBook: data.dischargeBook,
                        policeVerification: data.policeVerification,
                      },
                    })}
                    onGoBack={() => { setStep(3); window.scrollTo(0, 0); }}
                  />
                )}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>

        {/* ── Bottom continue bar (steps 1–3) ── */}
        {step < 4 && (
          <div className='fixed bottom-0 left-0 right-0 lg:sticky lg:bottom-auto lg:top-auto bg-white border-t border-gray-100 px-4 lg:px-8 py-3 shadow-[0_-4px_20px_rgba(0,0,0,0.05)] lg:shadow-none'>
            <div className='max-w-3xl lg:max-w-none mx-auto'>
              <Button size='lg' className='w-full lg:w-auto lg:min-w-[200px] rounded-xl text-sm font-bold gap-2' onClick={goNext}>
                {step === 3 ? 'Continue to Payment' : 'Continue'}
                <ChevronRight className='w-4 h-4' />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
