import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  Briefcase, MapPin, AlertCircle, ChevronDown,
  Users, IndianRupee, Shield, Clock, CheckCircle,
  Building2, Zap, ChevronLeft,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toast } from '@/hooks/useToast'
import { BRAND } from '@/constants'
import { postJob } from '@/lib/api'
import { useAppStore } from '@/store/useAppStore'

/* ─── Data ───────────────────────────────────────────────────────────────── */
const MANPOWER_TYPES = [
  'Security Guard (Unarmed)',
  'Security Guard (Armed)',
  'Security Supervisor',
  'Night Shift Guard',
  'Quick Response Team Member',
  'Gunman / Personal Bodyguard',
  'Dog Handler',
  'Traffic Marshal',
] as const

const SALARY_RANGES = [
  { label: '₹15,000 – ₹20,000 / month', value: '15k-20k' },
  { label: '₹20,000 – ₹30,000 / month', value: '20k-30k' },
  { label: '₹30,000 – ₹50,000 / month', value: '30k-50k' },
  { label: '₹50,000 & above / month',    value: '50k+' },
] as const

const LOCATIONS = ['Guwahati & Around', 'Upper Assam', 'Lower Assam'] as const

const SHIFTS = ['Day (8 hrs)', 'Night (8 hrs)', 'Rotating (12 hrs)', 'Split Shift'] as const

const WORK_SITES = [
  'Bank / ATM', 'Hospital / Clinic', 'Warehouse / Logistics',
  'Residential Complex', 'Industrial / Factory', 'Tea Estate',
  'Commercial Mall / Office', 'Government Building', 'Other',
] as const

const MIN_RANKS = [
  'Sepoy / Constable',
  'Lance Naik / Head Constable',
  'Naik / Sub-Inspector',
  'Havildar / Inspector',
  'Naib Subedar / DSP',
  'Any Rank',
] as const

const MIN_SERVICES = ['2 years', '3 years', '5 years', '7 years', '10 years', 'Any'] as const

/* ─── Types ──────────────────────────────────────────────────────────────── */
interface FormState {
  manpowerType: string
  quantity: string
  salaryRange: string
  location: string
  shift: string
  workSite: string
  minRank: string
  minService: string
  description: string
}

type FieldErrors = Partial<Record<keyof FormState, string>>

const INITIAL: FormState = {
  manpowerType: '',
  quantity: '',
  salaryRange: '',
  location: '',
  shift: '',
  workSite: '',
  minRank: '',
  minService: '',
  description: '',
}

/* ─── Atoms ──────────────────────────────────────────────────────────────── */
function Label({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <label className="block text-sm font-medium text-gray-700 mb-1.5">
      {children}{required && <span className="text-red-500 ml-0.5">*</span>}
    </label>
  )
}

function FieldErr({ msg }: { msg?: string }) {
  if (!msg) return null
  return (
    <p className="flex items-center gap-1 mt-1.5 text-xs text-red-500">
      <AlertCircle className="w-3.5 h-3.5 shrink-0" />{msg}
    </p>
  )
}

function SelectField({
  label, required, value, onChange, placeholder, options, error,
}: {
  label: string; required?: boolean; value: string; onChange: (v: string) => void
  placeholder: string; options: readonly { label: string; value: string }[] | readonly string[]
  error?: string
}) {
  const opts = options.map((o) =>
    typeof o === 'string' ? { label: o, value: o } : o
  )
  return (
    <div>
      <Label required={required}>{label}</Label>
      <div className="relative">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={`w-full h-12 rounded-xl border bg-white text-sm appearance-none pl-4 pr-10 outline-none
            transition-all cursor-pointer
            ${error ? 'border-red-300 focus:border-red-400 focus:ring-2 focus:ring-red-100' : 'border-gray-200 focus:border-[#F7A607] focus:ring-2 focus:ring-[#F7A607]/10'}
            ${value ? 'text-gray-900' : 'text-gray-400'}`}
        >
          <option value="" disabled>{placeholder}</option>
          {opts.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        <ChevronDown className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
      </div>
      <FieldErr msg={error} />
    </div>
  )
}

/* ─── Page ───────────────────────────────────────────────────────────────── */
export default function PostJob() {
  const navigate = useNavigate()
  const { user } = useAppStore()
  const [data, setData] = useState<FormState>(INITIAL)
  const [errors, setErrors] = useState<FieldErrors>({})
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)

  const update = (k: keyof FormState, v: string) => {
    setData((p) => ({ ...p, [k]: v }))
    setErrors((p) => { const n = { ...p }; delete n[k]; return n })
  }

  const validate = (): boolean => {
    const e: FieldErrors = {}
    if (!data.manpowerType) e.manpowerType = 'Select type of manpower'
    if (!data.quantity)     e.quantity     = 'Enter number of guards required'
    else if (isNaN(Number(data.quantity)) || Number(data.quantity) < 1)
      e.quantity = 'Enter a valid quantity (min 1)'
    if (!data.salaryRange)  e.salaryRange  = 'Select a salary range'
    if (!data.location)     e.location     = 'Select a posting location'
    if (!data.shift)        e.shift        = 'Select shift type'
    if (!data.workSite)     e.workSite     = 'Select work site type'
    if (!data.minRank)      e.minRank      = 'Select minimum rank'
    if (!data.minService)   e.minService   = 'Select minimum service years'
    if (!data.description.trim()) e.description = 'Add a brief job description'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSubmit = async () => {
    if (!validate()) {
      toast({ title: 'Required fields missing', description: 'Fill all highlighted fields.', variant: 'error' })
      return
    }
    setSubmitting(true)
    try {
      await postJob({
        employerId: user?.id ?? '',
        manpowerType: data.manpowerType,
        quantity: Number(data.quantity),
        salaryRange: data.salaryRange,
        location: data.location,
        shift: data.shift,
        workSite: data.workSite,
        minRank: data.minRank,
        minService: data.minService,
        description: data.description,
      })
      setDone(true)
      await new Promise((r) => setTimeout(r, 1000))
      toast({ title: 'Job Posted!', description: `${data.manpowerType} listing is now live.`, variant: 'success' })
      navigate('/employer/jobs')
    } catch (err: any) {
      toast({ title: 'Failed to post job', description: err.message || 'Please try again.', variant: 'error' })
      setSubmitting(false)
    }
  }

  /* Success */
  if (done) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
          transition={{ type: 'spring' }}
          className="text-center max-w-xs"
        >
          <motion.div
            initial={{ scale: 0 }} animate={{ scale: 1 }}
            transition={{ delay: 0.1, type: 'spring', stiffness: 220 }}
            className="w-20 h-20 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-5"
          >
            <CheckCircle className="w-10 h-10 text-green-500" />
          </motion.div>
          <h2 className="text-2xl font-extrabold text-gray-900 mb-1" style={{ fontFamily: 'Plus Jakarta Sans' }}>
            Job Posted!
          </h2>
          <p className="text-gray-500 text-sm mb-2">{data.manpowerType}</p>
          <p className="text-xs text-gray-400">Redirecting to My Jobs...</p>
        </motion.div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col max-w-2xl mx-auto">

      {/* Header */}
      <div className="sticky top-0 z-40 bg-white border-b border-gray-100 shadow-sm">
        <div className="flex items-center gap-3 px-4 h-14">
          <button onClick={() => navigate('/employer/dashboard')}
            className="w-9 h-9 rounded-xl border border-gray-200 flex items-center justify-center hover:bg-gray-50 transition-colors shrink-0">
            <ChevronLeft className="w-4 h-4 text-gray-600" />
          </button>
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <div className="w-7 h-7 rounded-lg bg-[#292e31] flex items-center justify-center shrink-0">
              <Zap className="w-3.5 h-3.5 text-[#F7A607]" />
            </div>
            <span className="text-sm font-bold text-gray-900 truncate" style={{ fontFamily: 'Plus Jakarta Sans' }}>
              {BRAND.name} — Post a Job
            </span>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto pb-32 px-4 pt-5 space-y-5">

        <div>
          <h1 className="text-xl font-extrabold text-gray-900" style={{ fontFamily: 'Plus Jakarta Sans' }}>
            New Job Posting
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Fill in the details below to list a vacancy for ex-servicemen candidates.
          </p>
        </div>

        {/* ── Section 1: Position ── */}
        <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm space-y-4">
          <div className="flex items-center gap-2 pb-1 border-b border-gray-50">
            <Briefcase className="w-4 h-4 text-[#F7A607]" />
            <p className="text-sm font-semibold text-gray-900">Position Details</p>
          </div>

          <SelectField
            label="Type of Manpower Required"
            required
            value={data.manpowerType}
            onChange={(v) => update('manpowerType', v)}
            placeholder="Select manpower type"
            options={MANPOWER_TYPES}
            error={errors.manpowerType}
          />

          <div>
            <Label required>Quantity of Guards Required</Label>
            <div className="relative">
              <Users className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              <input
                type="number"
                min={1}
                max={500}
                value={data.quantity}
                onChange={(e) => update('quantity', e.target.value)}
                placeholder="e.g. 10"
                className={`w-full h-12 rounded-xl border bg-white text-sm pl-10 pr-4 outline-none transition-all
                  ${errors.quantity ? 'border-red-300 focus:border-red-400 focus:ring-2 focus:ring-red-100'
                    : 'border-gray-200 focus:border-[#F7A607] focus:ring-2 focus:ring-[#F7A607]/10'}
                  placeholder:text-gray-400 text-gray-900`}
              />
            </div>
            <FieldErr msg={errors.quantity} />
          </div>

          <SelectField
            label="Salary Range"
            required
            value={data.salaryRange}
            onChange={(v) => update('salaryRange', v)}
            placeholder="Select salary range"
            options={SALARY_RANGES}
            error={errors.salaryRange}
          />
        </div>

        {/* ── Section 2: Location & Schedule ── */}
        <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm space-y-4">
          <div className="flex items-center gap-2 pb-1 border-b border-gray-50">
            <MapPin className="w-4 h-4 text-[#F7A607]" />
            <p className="text-sm font-semibold text-gray-900">Location & Schedule</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <SelectField
              label="Posting Location"
              required
              value={data.location}
              onChange={(v) => update('location', v)}
              placeholder="Select location"
              options={LOCATIONS}
              error={errors.location}
            />
            <SelectField
              label="Shift Type"
              required
              value={data.shift}
              onChange={(v) => update('shift', v)}
              placeholder="Select shift"
              options={SHIFTS}
              error={errors.shift}
            />
          </div>

          <SelectField
            label="Work Site Type"
            required
            value={data.workSite}
            onChange={(v) => update('workSite', v)}
            placeholder="Where will the guard be deployed?"
            options={WORK_SITES}
            error={errors.workSite}
          />
        </div>

        {/* ── Section 3: Eligibility ── */}
        <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm space-y-4">
          <div className="flex items-center gap-2 pb-1 border-b border-gray-50">
            <Shield className="w-4 h-4 text-[#F7A607]" />
            <p className="text-sm font-semibold text-gray-900">Eligibility Criteria</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <SelectField
              label="Minimum Rank"
              required
              value={data.minRank}
              onChange={(v) => update('minRank', v)}
              placeholder="Select rank"
              options={MIN_RANKS}
              error={errors.minRank}
            />
            <SelectField
              label="Minimum Service Years"
              required
              value={data.minService}
              onChange={(v) => update('minService', v)}
              placeholder="Select years"
              options={MIN_SERVICES}
              error={errors.minService}
            />
          </div>
        </div>

        {/* ── Section 4: Description ── */}
        <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm space-y-3">
          <div className="flex items-center gap-2 pb-1 border-b border-gray-50">
            <Clock className="w-4 h-4 text-[#F7A607]" />
            <p className="text-sm font-semibold text-gray-900">Job Description</p>
          </div>

          <div>
            <Label required>Duties & Requirements</Label>
            <textarea
              value={data.description}
              onChange={(e) => update('description', e.target.value)}
              placeholder={`Describe the role and key responsibilities.\n\ne.g.\n• Guard premises and conduct regular patrols\n• Monitor CCTV and maintain visitor logs\n• Report any suspicious activity to supervisor`}
              rows={5}
              className={`w-full rounded-xl border bg-white text-sm text-gray-900 placeholder:text-gray-400
                outline-none px-4 py-3 transition-all resize-none
                ${errors.description ? 'border-red-300 focus:border-red-400 focus:ring-2 focus:ring-red-100'
                  : 'border-gray-200 focus:border-[#F7A607] focus:ring-2 focus:ring-[#F7A607]/10'}`}
            />
            <FieldErr msg={errors.description} />
          </div>
        </div>

        {/* Summary preview (shows once all required fields are filled) */}
        {data.manpowerType && data.quantity && data.salaryRange && data.location && (
          <motion.div
            initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
            className="bg-[#292e31] rounded-2xl p-4 text-white"
          >
            <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wide mb-2">Posting Preview</p>
            <p className="text-base font-extrabold" style={{ fontFamily: 'Plus Jakarta Sans' }}>{data.manpowerType}</p>
            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2">
              <span className="flex items-center gap-1 text-xs text-gray-300">
                <Users className="w-3 h-3" />{data.quantity} guard{Number(data.quantity) !== 1 ? 's' : ''}
              </span>
              {data.location && (
                <span className="flex items-center gap-1 text-xs text-gray-300">
                  <MapPin className="w-3 h-3" />{data.location}
                </span>
              )}
              {data.salaryRange && (
                <span className="flex items-center gap-1 text-xs text-[#F7A607] font-semibold">
                  <IndianRupee className="w-3 h-3" />
                  {SALARY_RANGES.find((s) => s.value === data.salaryRange)?.label}
                </span>
              )}
            </div>
          </motion.div>
        )}
      </div>

      {/* Fixed bottom bar */}
      <div className="fixed bottom-0 left-0 right-0 max-w-2xl mx-auto bg-white border-t border-gray-100 px-4 py-3 shadow-[0_-4px_20px_rgba(0,0,0,0.05)]">
        <Button
          size="lg" variant="dark"
          className="w-full rounded-xl text-sm font-bold gap-2"
          onClick={handleSubmit}
          disabled={submitting}
        >
          {submitting ? (
            <>
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Publishing Job...
            </>
          ) : (
            <>
              <Briefcase className="w-4 h-4" />
              Post Job
            </>
          )}
        </Button>

      </div>
    </div>
  )
}
