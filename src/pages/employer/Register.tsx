import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  ChevronLeft, Building2, Hash, CreditCard, Mail,
  MapPin, AlertCircle, Zap, ChevronDown, CheckCircle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAppStore } from '@/store/useAppStore'
import { toast } from '@/hooks/useToast'
import { BRAND } from '@/constants'
import { registerEmployer } from '@/lib/api'
import { setToken } from '@/lib/tokenStore'

/* ─── Data ───────────────────────────────────────────────────────────── */
const STATES = [
  'Assam', 'Arunachal Pradesh', 'Meghalaya', 'Manipur', 'Mizoram',
  'Nagaland', 'Sikkim', 'Tripura', 'West Bengal', 'Bihar',
  'Uttar Pradesh', 'Madhya Pradesh', 'Rajasthan', 'Gujarat',
  'Maharashtra', 'Karnataka', 'Tamil Nadu', 'Telangana',
  'Andhra Pradesh', 'Kerala', 'Odisha', 'Jharkhand', 'Chhattisgarh',
  'Haryana', 'Punjab', 'Himachal Pradesh', 'Uttarakhand',
  'Delhi', 'Goa', 'Other',
] as const

/* ─── Types ──────────────────────────────────────────────────────────── */
interface FormState {
  companyName: string
  gst: string
  pan: string
  email: string
  state: string
  district: string
  address: string
  pincode: string
}

type FieldErrors = Partial<Record<keyof FormState, string>>

const INITIAL: FormState = {
  companyName: '',
  gst: '',
  pan: '',
  email: '',
  state: 'Assam',
  district: '',
  address: '',
  pincode: '',
}

/* ─── Shared atoms ───────────────────────────────────────────────────── */
function FieldLabel({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <label className="block text-sm font-medium text-gray-700 mb-1.5">
      {children}{required && <span className="text-red-500 ml-0.5">*</span>}
    </label>
  )
}

function FieldError({ msg }: { msg?: string }) {
  if (!msg) return null
  return (
    <p className="flex items-center gap-1 mt-1.5 text-xs text-red-500">
      <AlertCircle className="w-3.5 h-3.5 shrink-0" />{msg}
    </p>
  )
}

function TextInput({
  label, required, placeholder, value, onChange,
  type = 'text', icon, hint, transform,
}: {
  label: string
  required?: boolean
  placeholder: string
  value: string
  onChange: (v: string) => void
  type?: string
  icon?: React.ElementType
  hint?: string
  transform?: (v: string) => string
}) {
  const Icon = icon
  return (
    <div>
      <FieldLabel required={required}>{label}</FieldLabel>
      {hint && <p className="text-xs text-gray-400 mb-1.5">{hint}</p>}
      <div className="relative">
        {Icon && (
          <Icon className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
        )}
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(transform ? transform(e.target.value) : e.target.value)}
          placeholder={placeholder}
          className={`w-full h-12 rounded-xl border border-gray-200 bg-white text-sm text-gray-900
            placeholder:text-gray-400 outline-none transition-all
            focus:border-[#F7A607] focus:ring-2 focus:ring-[#F7A607]/10
            ${Icon ? 'pl-10 pr-4' : 'px-4'}`}
        />
      </div>
    </div>
  )
}

function SelectInput({
  label, required, value, onChange, placeholder, options,
}: {
  label: string
  required?: boolean
  value: string
  onChange: (v: string) => void
  placeholder: string
  options: readonly string[]
}) {
  return (
    <div>
      <FieldLabel required={required}>{label}</FieldLabel>
      <div className="relative">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={`w-full h-12 rounded-xl border border-gray-200 bg-white text-sm appearance-none
            outline-none transition-all focus:border-[#F7A607] focus:ring-2 focus:ring-[#F7A607]/10
            pl-4 pr-10 ${value ? 'text-gray-900' : 'text-gray-400'} cursor-pointer`}
        >
          <option value="" disabled>{placeholder}</option>
          {options.map((o) => (
            <option key={o} value={o}>{o}</option>
          ))}
        </select>
        <ChevronDown className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
      </div>
    </div>
  )
}

/* ─── Page ───────────────────────────────────────────────────────────── */
export default function EmployerRegister() {
  const navigate = useNavigate()
  const location = useLocation()
  const mobile: string = (location.state as any)?.mobile ?? ''
  const setUser = useAppStore((s) => s.setUser)

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

    if (!data.companyName.trim())
      e.companyName = 'Company name is required'

    if (!data.gst.trim())
      e.gst = 'GST number is required'
    else if (!/^\d{2}[A-Z]{5}\d{4}[A-Z]{1}[A-Z\d]{1}[Z]{1}[A-Z\d]{1}$/.test(data.gst))
      e.gst = 'Enter a valid 15-digit GSTIN (e.g. 18AABCU9603R1ZM)'

    if (!data.pan.trim())
      e.pan = 'PAN number is required'
    else if (!/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(data.pan))
      e.pan = 'Enter a valid 10-character PAN (e.g. AABCU9603R)'

    if (!data.email.trim())
      e.email = 'Official email is required'
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email))
      e.email = 'Enter a valid email address'

    if (!data.state)
      e.state = 'Please select a state'
    if (!data.district.trim())
      e.district = 'District is required'
    if (!data.address.trim())
      e.address = 'Address is required'
    if (!data.pincode.trim())
      e.pincode = 'Pincode is required'
    else if (!/^\d{6}$/.test(data.pincode))
      e.pincode = 'Enter a valid 6-digit pincode'

    setErrors(e)
    if (Object.keys(e).length > 0) {
      toast({ title: 'Required fields missing', description: 'Please fill all highlighted fields.', variant: 'error' })
      return false
    }
    return true
  }

  const handleSubmit = async () => {
    if (!validate()) return
    setSubmitting(true)
    try {
      const result = await registerEmployer({
        companyName: data.companyName,
        gst: data.gst,
        pan: data.pan,
        email: data.email,
        mobile,
        state: data.state,
        district: data.district,
        address: data.address,
        pincode: data.pincode,
      })
      setDone(true)
      await new Promise((r) => setTimeout(r, 900))
      if (result.accessToken) setToken(result.accessToken)
      setUser({
        id: String(result.employer.id),
        name: result.employer.company_name,
        email: result.employer.email,
        role: 'employer',
        createdAt: new Date(result.employer.created_at),
      })
      toast({ title: 'Account created!', description: `Welcome, ${data.companyName}!`, variant: 'success' })
      navigate('/employer/dashboard')
    } catch (err: any) {
      toast({ title: 'Registration failed', description: err.message || 'Please try again.', variant: 'error' })
      setSubmitting(false)
    }
  }

  /* Success overlay */
  if (done) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-6">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: 'spring' }}
          className="text-center"
        >
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.1, type: 'spring', stiffness: 220 }}
            className="w-20 h-20 bg-[#F7A607]/10 rounded-full flex items-center justify-center mx-auto mb-5"
          >
            <CheckCircle className="w-10 h-10 text-[#F7A607]" />
          </motion.div>
          <h2 className="text-2xl font-extrabold text-gray-900 mb-1" style={{ fontFamily: 'Plus Jakarta Sans' }}>
            Account Created!
          </h2>
          <p className="text-gray-500 text-sm mb-3">{data.companyName}</p>
          <div className="w-8 h-1 bg-[#F7A607] rounded-full animate-pulse mx-auto" />
          <p className="text-xs text-gray-400 mt-3">Redirecting to dashboard...</p>
        </motion.div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col max-w-lg mx-auto">
      {/* ── Header ── */}
      <div className="sticky top-0 z-40 bg-white border-b border-gray-100 shadow-sm">
        <div className="flex items-center gap-3 px-4 h-14">
          <button
            onClick={() => navigate('/')}
            className="w-9 h-9 rounded-xl border border-gray-200 flex items-center justify-center hover:bg-gray-50 transition-colors shrink-0"
          >
            <ChevronLeft className="w-4 h-4 text-gray-600" />
          </button>
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <div className="w-7 h-7 rounded-lg bg-[#292e31] flex items-center justify-center shrink-0">
              <Zap className="w-3.5 h-3.5 text-[#F7A607]" />
            </div>
            <span
              className="text-sm font-bold text-gray-900 truncate"
              style={{ fontFamily: 'Plus Jakarta Sans' }}
            >
              {BRAND.name} — Recruiter Registration
            </span>
          </div>
        </div>
      </div>

      {/* ── Body ── */}
      <div className="flex-1 overflow-y-auto pb-28 px-4 pt-5 space-y-5">

        {/* Page title */}
        <div>
          <h1 className="text-xl font-extrabold text-gray-900" style={{ fontFamily: 'Plus Jakarta Sans' }}>
            Company Details
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Fill in your company information to create your recruiter account.
          </p>
        </div>

        {/* ── Company identity card ── */}
        <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm space-y-4">
          <div className="flex items-center gap-2 pb-1 border-b border-gray-50">
            <Building2 className="w-4 h-4 text-[#F7A607]" />
            <p className="text-sm font-semibold text-gray-900">Company Identity</p>
          </div>

          <div>
            <TextInput
              label="Company Name"
              required
              placeholder="e.g. Assam Security Services Pvt. Ltd."
              value={data.companyName}
              onChange={(v) => update('companyName', v)}
              icon={Building2}
            />
            <FieldError msg={errors.companyName} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <TextInput
                label="GST Number"
                required
                placeholder="18AABCU9603R1ZM"
                value={data.gst}
                onChange={(v) => update('gst', v)}
                icon={Hash}
                transform={(v) => v.toUpperCase()}
                hint="15-digit GSTIN"
              />
              <FieldError msg={errors.gst} />
            </div>
            <div>
              <TextInput
                label="PAN Number"
                required
                placeholder="AABCU9603R"
                value={data.pan}
                onChange={(v) => update('pan', v)}
                icon={CreditCard}
                transform={(v) => v.toUpperCase()}
                hint="10-character PAN"
              />
              <FieldError msg={errors.pan} />
            </div>
          </div>

          <div>
            <TextInput
              label="Official Email Address"
              required
              placeholder="hr@yourcompany.com"
              value={data.email}
              onChange={(v) => update('email', v)}
              type="email"
              icon={Mail}
            />
            <FieldError msg={errors.email} />
          </div>
        </div>

        {/* ── Location card ── */}
        <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm space-y-4">
          <div className="flex items-center gap-2 pb-1 border-b border-gray-50">
            <MapPin className="w-4 h-4 text-[#F7A607]" />
            <p className="text-sm font-semibold text-gray-900">Location</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <SelectInput
                label="State"
                required
                value={data.state}
                onChange={(v) => update('state', v)}
                placeholder="Select state"
                options={STATES}
              />
              <FieldError msg={errors.state} />
            </div>
            <div>
              <TextInput
                label="District"
                required
                placeholder="e.g. Kamrup"
                value={data.district}
                onChange={(v) => update('district', v)}
              />
              <FieldError msg={errors.district} />
            </div>
          </div>

          <div>
            <FieldLabel required>Address</FieldLabel>
            <textarea
              value={data.address}
              onChange={(e) => {
                update('address', e.target.value)
              }}
              placeholder="Building, street, area / locality"
              rows={2}
              className="w-full rounded-xl border border-gray-200 bg-white text-sm text-gray-900
                placeholder:text-gray-400 outline-none px-4 py-3 transition-all resize-none
                focus:border-[#F7A607] focus:ring-2 focus:ring-[#F7A607]/10"
            />
            <FieldError msg={errors.address} />
          </div>

          <div>
            <TextInput
              label="Pincode"
              required
              placeholder="781001"
              value={data.pincode}
              onChange={(v) => update('pincode', v)}
            />
            <FieldError msg={errors.pincode} />
          </div>
        </div>
      </div>

      {/* ── Fixed bottom bar ── */}
      <div className="fixed bottom-0 left-0 right-0 max-w-lg mx-auto bg-white border-t border-gray-100 px-4 py-3 shadow-[0_-4px_20px_rgba(0,0,0,0.05)]">
        <Button
          size="lg"
          variant="dark"
          className="w-full rounded-xl text-sm font-bold gap-2"
          onClick={handleSubmit}
          disabled={submitting}
        >
          {submitting ? (
            <>
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Creating Account...
            </>
          ) : (
            <>
              Create Recruiter Account
              <Building2 className="w-4 h-4" />
            </>
          )}
        </Button>

      </div>
    </div>
  )
}
