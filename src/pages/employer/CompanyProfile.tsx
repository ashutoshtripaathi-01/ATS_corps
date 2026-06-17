import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import {
  Building2, MapPin, Mail, Phone, Hash, CreditCard,
  CheckCircle, Edit3, Save, X, RefreshCw,
} from 'lucide-react'
import { useAppStore } from '@/store/useAppStore'
import { getEmployer, updateEmployer } from '@/lib/api'
import { toast } from '@/hooks/useToast'

interface Employer {
  id: number
  company_name: string
  gst: string
  pan: string
  email: string
  mobile: string | null
  state: string
  district: string
  address: string
  pincode: string
  status: string
  created_at: string
}

export default function CompanyProfile() {
  const { user } = useAppStore()
  const [employer, setEmployer] = useState<Employer | null>(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState<Partial<Employer>>({})

  useEffect(() => {
    if (!user?.id) return
    getEmployer(user.id)
      .then((data) => { setEmployer(data); setForm(data) })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [user?.id])

  const handleSave = async () => {
    if (!employer) return
    setSaving(true)
    try {
      const updated = await updateEmployer(String(employer.id), {
        companyName: form.company_name ?? employer.company_name,
        email: form.email ?? employer.email,
        mobile: form.mobile ?? '',
        state: form.state ?? employer.state,
        district: form.district ?? employer.district,
        address: form.address ?? employer.address,
        pincode: form.pincode ?? employer.pincode,
      })
      setEmployer(updated.employer)
      setEditing(false)
      toast({ title: 'Profile updated', variant: 'success' })
    } catch (e: any) {
      toast({ title: 'Update failed', description: e.message, variant: 'error' })
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="p-6 max-w-2xl mx-auto space-y-4">
        {[1,2].map(i => <div key={i} className="h-36 bg-white border border-gray-100 rounded-2xl animate-pulse" />)}
      </div>
    )
  }

  if (!employer) {
    return (
      <div className="p-6 max-w-2xl mx-auto">
        <div className="bg-white border border-gray-100 rounded-2xl p-10 text-center shadow-sm">
          <Building2 className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-sm font-semibold text-gray-700">Company profile not found</p>
          <p className="text-xs text-gray-400 mt-1">Make sure you are registered as an employer.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 sm:p-6 max-w-2xl mx-auto space-y-4">
      <div className="flex items-center justify-between mb-1">
        <div>
          <h1 className="text-xl font-extrabold text-gray-900" style={{ fontFamily: 'Plus Jakarta Sans' }}>Company Profile</h1>
          <p className="text-sm text-gray-500 mt-0.5">Your recruiter account details</p>
        </div>
        {!editing ? (
          <button onClick={() => setEditing(true)}
            className="flex items-center gap-1.5 text-xs font-semibold text-[#F7A607] hover:underline">
            <Edit3 className="w-3.5 h-3.5" /> Edit
          </button>
        ) : (
          <div className="flex gap-2">
            <button onClick={() => { setEditing(false); setForm(employer) }}
              className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 hover:text-gray-700">
              <X className="w-3.5 h-3.5" /> Cancel
            </button>
            <button onClick={handleSave} disabled={saving}
              className="flex items-center gap-1.5 text-xs font-semibold text-green-600 hover:text-green-700 disabled:opacity-50">
              {saving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              Save
            </button>
          </div>
        )}
      </div>

      {/* Identity */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
        className="bg-[#292e31] rounded-2xl p-5 text-white"
      >
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-xl bg-[#F7A607] flex items-center justify-center shrink-0 text-xl font-extrabold text-white">
            {employer.company_name.slice(0, 2).toUpperCase()}
          </div>
          <div>
            {editing ? (
              <input
                value={form.company_name ?? ''}
                onChange={(e) => setForm(p => ({ ...p, company_name: e.target.value }))}
                className="bg-white/10 border border-white/20 rounded-lg px-3 py-1.5 text-sm font-bold text-white w-full outline-none focus:border-[#F7A607]"
              />
            ) : (
              <p className="text-lg font-extrabold" style={{ fontFamily: 'Plus Jakarta Sans' }}>{employer.company_name}</p>
            )}
            <p className="text-sm text-gray-300 mt-0.5">{employer.state}</p>
            <div className="flex items-center gap-1.5 mt-1">
              <CheckCircle className="w-3.5 h-3.5 text-green-400" />
              <span className="text-xs text-green-400 font-semibold">{employer.status.charAt(0).toUpperCase() + employer.status.slice(1)}</span>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Company Details */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
        className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden"
      >
        <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-50">
          <Hash className="w-4 h-4 text-[#F7A607]" />
          <p className="text-sm font-bold text-gray-900">Registration Details</p>
        </div>
        <div className="p-4 grid grid-cols-2 gap-3">
          {[
            { label: 'GST Number', value: employer.gst, readOnly: true },
            { label: 'PAN Number', value: employer.pan, readOnly: true },
          ].map(({ label, value }) => (
            <div key={label} className="bg-gray-50 rounded-xl p-3">
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-0.5">{label}</p>
              <p className="text-sm font-mono font-semibold text-gray-800">{value}</p>
            </div>
          ))}
        </div>
      </motion.div>

      {/* Contact */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
        className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden"
      >
        <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-50">
          <Mail className="w-4 h-4 text-[#F7A607]" />
          <p className="text-sm font-bold text-gray-900">Contact Info</p>
        </div>
        <div className="p-4 space-y-3">
          {[
            { label: 'Email', icon: Mail, key: 'email', type: 'email' },
            { label: 'Mobile', icon: Phone, key: 'mobile', type: 'tel' },
          ].map(({ label, icon: Icon, key, type }) => (
            <div key={key} className="flex items-center gap-3">
              <Icon className="w-4 h-4 text-gray-400 shrink-0" />
              {editing ? (
                <input
                  type={type}
                  value={(form as any)[key] ?? ''}
                  onChange={(e) => setForm(p => ({ ...p, [key]: e.target.value }))}
                  className="flex-1 h-9 rounded-xl border border-gray-200 px-3 text-sm outline-none focus:border-[#F7A607] focus:ring-2 focus:ring-[#F7A607]/10"
                  placeholder={label}
                />
              ) : (
                <p className="text-sm text-gray-800">{(employer as any)[key] || <span className="text-gray-400">—</span>}</p>
              )}
            </div>
          ))}
        </div>
      </motion.div>

      {/* Address */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
        className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden"
      >
        <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-50">
          <MapPin className="w-4 h-4 text-[#F7A607]" />
          <p className="text-sm font-bold text-gray-900">Address</p>
        </div>
        <div className="p-4 space-y-3">
          {editing ? (
            <div className="space-y-2">
              <textarea
                value={form.address ?? ''}
                onChange={(e) => setForm(p => ({ ...p, address: e.target.value }))}
                rows={2}
                className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-[#F7A607] resize-none"
                placeholder="Address"
              />
              <div className="grid grid-cols-2 gap-2">
                {[
                  { key: 'district', placeholder: 'District' },
                  { key: 'state',    placeholder: 'State' },
                  { key: 'pincode',  placeholder: 'Pincode' },
                ].map(({ key, placeholder }) => (
                  <input key={key} value={(form as any)[key] ?? ''} placeholder={placeholder}
                    onChange={(e) => setForm(p => ({ ...p, [key]: e.target.value }))}
                    className="h-9 rounded-xl border border-gray-200 px-3 text-sm outline-none focus:border-[#F7A607]"
                  />
                ))}
              </div>
            </div>
          ) : (
            <div className="text-sm text-gray-700 leading-relaxed">
              <p>{employer.address}</p>
              <p className="mt-1 text-gray-500">{employer.district}, {employer.state} – {employer.pincode}</p>
            </div>
          )}
        </div>
      </motion.div>

      <p className="text-center text-xs text-gray-400 pb-2">
        Registered on {new Date(employer.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
      </p>
    </div>
  )
}
