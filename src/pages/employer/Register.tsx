import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  ChevronLeft, Building2, Hash, CreditCard, Mail,
  MapPin, AlertCircle, Zap, ChevronDown, CheckCircle,
  Shield, Users, Star, Phone,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAppStore } from '@/store/useAppStore'
import { toast } from '@/hooks/useToast'
import { BRAND } from '@/constants'
import { registerEmployer } from '@/lib/api'
import { setToken } from '@/lib/tokenStore'
import companyLogo from '@/assets/company logo.png'

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

interface FormState {
  companyName: string; gst: string; pan: string; email: string
  state: string; district: string; address: string; pincode: string
}

type FieldErrors = Partial<Record<keyof FormState, string>>

const INITIAL: FormState = {
  companyName: '', gst: '', pan: '', email: '',
  state: 'Assam', district: '', address: '', pincode: '',
}

/* ─── Atoms ──────────────────────────────────────────────────────────── */
function FieldError({ msg }: { msg?: string }) {
  if (!msg) return null
  return (
    <p className="flex items-center gap-1 mt-1.5 text-xs text-red-500">
      <AlertCircle className="w-3.5 h-3.5 shrink-0" />{msg}
    </p>
  )
}

function Field({ label, required, hint, error, children }: {
  label: string; required?: boolean; hint?: string; error?: string; children: React.ReactNode
}) {
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-700 mb-1.5">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {hint && <p className="text-xs text-gray-400 mb-1.5">{hint}</p>}
      {children}
      <FieldError msg={error} />
    </div>
  )
}

const inputCls = (hasIcon = false) =>
  `w-full h-11 rounded-xl border border-gray-200 bg-white text-sm text-gray-900
   placeholder:text-gray-400 outline-none transition-all
   focus:border-[#F7A607] focus:ring-2 focus:ring-[#F7A607]/10
   ${hasIcon ? 'pl-9 pr-4' : 'px-4'}`

function TextInput({ label, required, placeholder, value, onChange, type = 'text', icon: Icon, hint, transform, error }: {
  label: string; required?: boolean; placeholder: string; value: string
  onChange: (v: string) => void; type?: string; icon?: React.ElementType
  hint?: string; transform?: (v: string) => string; error?: string
}) {
  return (
    <Field label={label} required={required} hint={hint} error={error}>
      <div className="relative">
        {Icon && <Icon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />}
        <input
          type={type} value={value}
          onChange={(e) => onChange(transform ? transform(e.target.value) : e.target.value)}
          placeholder={placeholder} className={inputCls(!!Icon)}
        />
      </div>
    </Field>
  )
}

function SelectInput({ label, required, value, onChange, placeholder, options, error }: {
  label: string; required?: boolean; value: string; onChange: (v: string) => void
  placeholder: string; options: readonly string[]; error?: string
}) {
  return (
    <Field label={label} required={required} error={error}>
      <div className="relative">
        <select value={value} onChange={(e) => onChange(e.target.value)}
          className={`${inputCls()} appearance-none cursor-pointer ${value ? 'text-gray-900' : 'text-gray-400'}`}
        >
          <option value="" disabled>{placeholder}</option>
          {options.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
      </div>
    </Field>
  )
}

/* ─── Page ───────────────────────────────────────────────────────────── */
export default function EmployerRegister() {
  const navigate  = useNavigate()
  const location  = useLocation()
  const mobile: string = (location.state as any)?.mobile ?? ''
  const setUser   = useAppStore((s) => s.setUser)

  const [data,       setData]       = useState<FormState>(INITIAL)
  const [errors,     setErrors]     = useState<FieldErrors>({})
  const [submitting, setSubmitting] = useState(false)
  const [done,       setDone]       = useState(false)

  const update = (k: keyof FormState, v: string) => {
    setData((p) => ({ ...p, [k]: v }))
    setErrors((p) => { const n = { ...p }; delete n[k]; return n })
  }

  const validate = (): boolean => {
    const e: FieldErrors = {}
    if (!data.companyName.trim()) e.companyName = 'Company name is required'
    if (!data.gst.trim()) e.gst = 'GST number is required'
    else if (!/^\d{2}[A-Z]{5}\d{4}[A-Z]{1}[A-Z\d]{1}[Z]{1}[A-Z\d]{1}$/.test(data.gst)) e.gst = 'Enter a valid 15-digit GSTIN'
    if (!data.pan.trim()) e.pan = 'PAN number is required'
    else if (!/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(data.pan)) e.pan = 'Enter a valid 10-character PAN'
    if (!data.email.trim()) e.email = 'Official email is required'
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) e.email = 'Enter a valid email address'
    if (!data.state) e.state = 'Please select a state'
    if (!data.district.trim()) e.district = 'District is required'
    if (!data.address.trim()) e.address = 'Address is required'
    if (!data.pincode.trim()) e.pincode = 'Pincode is required'
    else if (!/^\d{6}$/.test(data.pincode)) e.pincode = 'Enter a valid 6-digit pincode'
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
        companyName: data.companyName, gst: data.gst, pan: data.pan,
        email: data.email, mobile, state: data.state,
        district: data.district, address: data.address, pincode: data.pincode,
      })
      setDone(true)
      await new Promise((r) => setTimeout(r, 900))
      if (result.accessToken) setToken(result.accessToken)
      setUser({
        id: String(result.employer.id), name: result.employer.company_name,
        email: result.employer.email, role: 'employer', createdAt: new Date(result.employer.created_at),
      })
      toast({ title: 'Account created!', description: `Welcome, ${data.companyName}!`, variant: 'success' })
      navigate('/employer/dashboard')
    } catch (err: any) {
      toast({ title: 'Registration failed', description: err.message || 'Please try again.', variant: 'error' })
      setSubmitting(false)
    }
  }

  /* ── Success state ── */
  if (done) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-6">
        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ type: 'spring' }} className="text-center">
          <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.1, type: 'spring', stiffness: 220 }}
            className="w-20 h-20 bg-[#F7A607]/10 rounded-full flex items-center justify-center mx-auto mb-5"
          >
            <CheckCircle className="w-10 h-10 text-[#F7A607]" />
          </motion.div>
          <h2 className="text-2xl font-extrabold text-gray-900 mb-1" style={{ fontFamily: 'Plus Jakarta Sans' }}>Account Created!</h2>
          <p className="text-gray-500 text-sm mb-3">{data.companyName}</p>
          <div className="w-8 h-1 bg-[#F7A607] rounded-full animate-pulse mx-auto" />
          <p className="text-xs text-gray-400 mt-3">Redirecting to dashboard...</p>
        </motion.div>
      </div>
    )
  }

  /* ── Main layout ── */
  return (
    <div className="min-h-screen lg:h-screen bg-gray-50 flex flex-col lg:flex-row overflow-hidden">

      {/* ════════════════════════════════════════
          LEFT SIDEBAR — desktop only
      ════════════════════════════════════════ */}
      <aside className="hidden lg:flex lg:w-[300px] xl:w-[320px] shrink-0 bg-[#1a1d1f] flex-col sticky top-0 h-screen overflow-y-auto">

        {/* Gold accent */}
        <div className="h-1 w-full bg-gradient-to-r from-[#F7A607] via-[#ffcc55] to-[#F7A607] shrink-0" />

        {/* Logo */}
        <div className="px-7 pt-7 pb-6 border-b border-white/8">
          <div className="flex items-center gap-3">
            <img src={companyLogo} alt={BRAND.name} className="w-10 h-10 object-contain" />
            <div>
              <p className="font-extrabold text-white text-sm leading-tight" style={{ fontFamily: 'Plus Jakarta Sans' }}>
                {BRAND.name}
              </p>
              <p className="text-[10px] text-gray-500 mt-0.5">Recruiter Portal</p>
            </div>
          </div>
        </div>

        {/* Info block */}
        <div className="px-7 py-6 flex-1">
          <div className="inline-flex items-center gap-2 bg-[#F7A607]/15 border border-[#F7A607]/30 rounded-full px-3 py-1.5 mb-6">
            <Shield className="w-3 h-3 text-[#F7A607]" />
            <span className="text-[9px] font-bold text-[#F7A607] uppercase tracking-widest">DGR Empanelled · Ministry of Defence</span>
          </div>

          <h2 className="text-xl font-extrabold text-white leading-snug mb-2" style={{ fontFamily: 'Plus Jakarta Sans' }}>
            Hire Verified<br /><span className="text-[#F7A607]">Ex-Servicemen</span>
          </h2>
          <p className="text-xs text-gray-400 leading-relaxed mb-7">
            Access India's most trusted database of retired Army, Navy, Air Force, and Para-Military personnel.
          </p>

          {/* Benefits */}
          <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-3">Why Recruit With Us</p>
          <ul className="space-y-3">
            {[
              { icon: Users,    text: 'Access 500+ verified ex-servicemen profiles' },
              { icon: Shield,   text: 'DGR-empanelled — trusted by Govt. of India' },
              { icon: Star,     text: 'Pre-screened candidates with service records' },
              { icon: Zap,      text: 'Post jobs and fill positions in days, not weeks' },
            ].map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-start gap-2.5">
                <div className="w-6 h-6 rounded-lg bg-[#F7A607]/15 flex items-center justify-center shrink-0 mt-0.5">
                  <Icon className="w-3 h-3 text-[#F7A607]" />
                </div>
                <span className="text-xs text-gray-400 leading-relaxed">{text}</span>
              </li>
            ))}
          </ul>

          {/* Registered mobile */}
          {mobile && (
            <div className="mt-8 bg-white/5 border border-white/10 rounded-xl p-3.5">
              <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest mb-1">Registered As</p>
              <div className="flex items-center gap-2">
                <Phone className="w-3.5 h-3.5 text-[#F7A607]" />
                <span className="text-sm font-bold text-white">+91 {mobile}</span>
              </div>
            </div>
          )}
        </div>

        {/* Trust strip */}
        <div className="px-7 py-5 border-t border-white/8">
          <div className="flex flex-wrap gap-1.5">
            {['Govt. of India', 'DGR Partner', 'Ministry of Defence'].map((tag) => (
              <span key={tag} className="text-[9px] font-semibold text-gray-500 bg-white/5 border border-white/8 px-2 py-0.5 rounded-full">
                {tag}
              </span>
            ))}
          </div>
        </div>
      </aside>

      {/* ════════════════════════════════════════
          RIGHT PANEL — form
      ════════════════════════════════════════ */}
      <div className="flex-1 flex flex-col min-w-0 lg:overflow-hidden">

        {/* Sticky header */}
        <div className="sticky top-0 z-40 bg-white border-b border-gray-100 shrink-0">
          <div className="flex items-center gap-3 px-4 lg:px-8 h-14">
            <button onClick={() => navigate('/')}
              className="w-9 h-9 rounded-xl border border-gray-200 flex items-center justify-center hover:bg-gray-50 transition-colors shrink-0"
            >
              <ChevronLeft className="w-4 h-4 text-gray-600" />
            </button>
            <div className="flex items-center gap-2 flex-1 min-w-0">
              {/* Mobile brand */}
              <div className="flex items-center gap-2 lg:hidden">
                <div className="w-7 h-7 rounded-lg bg-[#292e31] flex items-center justify-center shrink-0">
                  <Zap className="w-3.5 h-3.5 text-[#F7A607]" />
                </div>
                <span className="text-sm font-bold text-gray-900 truncate" style={{ fontFamily: 'Plus Jakarta Sans' }}>
                  {BRAND.name} — Recruiter Registration
                </span>
              </div>
              {/* Desktop label */}
              <div className="hidden lg:flex items-center gap-2">
                <span className="text-xs font-bold text-[#F7A607] uppercase tracking-wider">Recruiter Registration</span>
                <span className="text-gray-300">·</span>
                <span className="text-sm text-gray-500">Company Details</span>
              </div>
            </div>
            <Building2 className="w-4 h-4 text-gray-400 shrink-0" />
          </div>
        </div>

        {/* Scrollable form area */}
        <div className="flex-1 overflow-y-auto pb-6">
          <div className="px-4 lg:px-10 xl:px-16 py-6 max-w-3xl lg:max-w-none mx-auto">

            <div className="mb-6">
              <h1 className="text-xl lg:text-2xl font-extrabold text-gray-900" style={{ fontFamily: 'Plus Jakarta Sans' }}>
                Company Details
              </h1>
              <p className="text-sm text-gray-500 mt-0.5">Fill in your company information to create your recruiter account.</p>
            </div>

            <motion.div className="space-y-5" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>

              {/* Company Identity */}
              <div className="bg-white border border-gray-100 rounded-2xl p-5 lg:p-6 shadow-sm">
                <div className="flex items-center gap-2 mb-5 pb-3 border-b border-gray-50">
                  <div className="w-7 h-7 rounded-lg bg-[#F7A607]/10 flex items-center justify-center shrink-0">
                    <Building2 className="w-3.5 h-3.5 text-[#F7A607]" />
                  </div>
                  <p className="text-sm font-bold text-gray-900">Company Identity</p>
                </div>

                <div className="space-y-4">
                  <TextInput label="Company Name" required
                    placeholder="e.g. Assam Security Services Pvt. Ltd."
                    value={data.companyName} onChange={(v) => update('companyName', v)}
                    icon={Building2} error={errors.companyName}
                  />

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <TextInput label="GST Number" required hint="15-digit GSTIN"
                      placeholder="18AABCU9603R1ZM" value={data.gst}
                      onChange={(v) => update('gst', v)} icon={Hash}
                      transform={(v) => v.toUpperCase()} error={errors.gst}
                    />
                    <TextInput label="PAN Number" required hint="10-character PAN"
                      placeholder="AABCU9603R" value={data.pan}
                      onChange={(v) => update('pan', v)} icon={CreditCard}
                      transform={(v) => v.toUpperCase()} error={errors.pan}
                    />
                  </div>

                  <TextInput label="Official Email Address" required type="email"
                    placeholder="hr@yourcompany.com" value={data.email}
                    onChange={(v) => update('email', v)} icon={Mail} error={errors.email}
                  />
                </div>
              </div>

              {/* Location */}
              <div className="bg-white border border-gray-100 rounded-2xl p-5 lg:p-6 shadow-sm">
                <div className="flex items-center gap-2 mb-5 pb-3 border-b border-gray-50">
                  <div className="w-7 h-7 rounded-lg bg-[#F7A607]/10 flex items-center justify-center shrink-0">
                    <MapPin className="w-3.5 h-3.5 text-[#F7A607]" />
                  </div>
                  <p className="text-sm font-bold text-gray-900">Location</p>
                </div>

                <div className="space-y-4">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <SelectInput label="State" required value={data.state}
                      onChange={(v) => update('state', v)} placeholder="Select state"
                      options={STATES} error={errors.state}
                    />
                    <TextInput label="District" required placeholder="e.g. Kamrup"
                      value={data.district} onChange={(v) => update('district', v)}
                      error={errors.district}
                    />
                  </div>

                  <Field label="Address" required error={errors.address}>
                    <textarea value={data.address} onChange={(e) => update('address', e.target.value)}
                      placeholder="Building, street, area / locality" rows={2}
                      className="w-full rounded-xl border border-gray-200 bg-white text-sm text-gray-900
                        placeholder:text-gray-400 outline-none px-4 py-3 transition-all resize-none
                        focus:border-[#F7A607] focus:ring-2 focus:ring-[#F7A607]/10"
                    />
                  </Field>

                  <div className="lg:w-1/2">
                    <TextInput label="Pincode" required placeholder="781001"
                      value={data.pincode} onChange={(v) => update('pincode', v)}
                      error={errors.pincode}
                    />
                  </div>
                </div>
              </div>

              {/* Submit button */}
              <Button size="lg" variant="dark"
                className="w-full lg:w-auto lg:min-w-[260px] rounded-xl text-sm font-bold gap-2"
                onClick={handleSubmit} disabled={submitting}
              >
                {submitting ? (
                  <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Creating Account...</>
                ) : (
                  <>Create Recruiter Account <Building2 className="w-4 h-4" /></>
                )}
              </Button>

            </motion.div>
          </div>
        </div>
      </div>
    </div>
  )
}
