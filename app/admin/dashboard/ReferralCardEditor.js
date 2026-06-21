'use client'

/**
 * Admin editor for the founder referral card shown on /grow.
 *
 * Shows the shareable /grow link (Copy/Share/Open) and an editable detail panel:
 * headshot + name + title, each independently toggleable so the card can stay
 * plain or be made personable. Loads/saves via /api/admin/referral-card
 * (admin-verified, firestoreRest — no Firestore rule change). Headshot upload
 * reuses the LogoUpload component (Firebase Storage).
 */

import { useState, useEffect } from 'react'
import { useAuth } from '@/context/AuthContext'
import LogoUpload from '@/components/ui/LogoUpload'
import toast from 'react-hot-toast'

export default function ReferralCardEditor() {
  const { user } = useAuth()
  const growUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'https://yardsyncapp.com'}/grow`

  const [form, setForm] = useState({
    founderName: '', founderTitle: '', founderHeadshotUrl: '',
    showName: false, showTitle: false, showHeadshot: false,
  })
  const [saving, setSaving] = useState(false)
  const [open,   setOpen]   = useState(false)

  useEffect(() => {
    if (!user) return
    let cancelled = false
    ;(async () => {
      try {
        const idToken = await user.getIdToken()
        const res = await fetch('/api/admin/referral-card', { headers: { Authorization: `Bearer ${idToken}` } })
        const data = await res.json()
        if (!cancelled && data?.card) setForm(f => ({ ...f, ...data.card }))
      } catch { /* non-fatal — defaults stand */ }
    })()
    return () => { cancelled = true }
  }, [user])

  function setField(k, v) { setForm(f => ({ ...f, [k]: v })) }

  async function handleSave() {
    setSaving(true)
    try {
      const idToken = await user.getIdToken()
      const res = await fetch('/api/admin/referral-card', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
        body: JSON.stringify(form),
      })
      if (!res.ok) throw new Error('save failed')
      toast.success('Referral card saved ✓')
    } catch {
      toast.error('Could not save the referral card')
    } finally {
      setSaving(false)
    }
  }

  function copyGrow() { navigator.clipboard.writeText(growUrl); toast.success('Copied') }
  async function shareGrow() {
    try {
      if (navigator.share) await navigator.share({ title: 'YardSync', text: 'Run your field-service business from your phone:', url: growUrl })
      else copyGrow()
    } catch { /* share sheet cancelled */ }
  }

  const Toggle = ({ field, label }) => (
    <label className="flex items-center gap-2 cursor-pointer">
      <input type="checkbox" checked={!!form[field]} onChange={e => setField(field, e.target.checked)} className="w-4 h-4 accent-brand-600" />
      <span className="text-[13px] text-gray-700">{label}</span>
    </label>
  )

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-[15px] font-semibold text-gray-900">Your YardSync referral card</h2>
          <p className="text-[13px] text-gray-500 mt-0.5">Share this to pitch YardSync — recipients can forward it and sign up.</p>
        </div>
        <a href="/grow" target="_blank" rel="noopener noreferrer" className="text-[13px] font-medium text-brand-700 hover:text-brand-800 whitespace-nowrap">Open card →</a>
      </div>

      <div className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2 mt-3">
        <span className="text-[12px] text-gray-600 flex-1 truncate">{growUrl}</span>
        <button onClick={copyGrow} className="text-[12px] font-medium text-brand-700 hover:text-brand-800">Copy</button>
        <button onClick={shareGrow} className="text-[12px] font-medium text-brand-700 hover:text-brand-800">Share</button>
      </div>

      <button onClick={() => setOpen(o => !o)} className="mt-3 text-[12px] font-medium text-brand-700 hover:text-brand-800">
        {open ? 'Hide card details' : 'Edit card details (name, title, headshot)'}
      </button>

      {open && (
        <div className="mt-3 pt-3 border-t border-gray-100 space-y-4">
          <p className="text-[12px] text-gray-500">Add your details to make the card personal, and toggle each on/off. Leave them all off (or blank) to keep the card plain.</p>

          <LogoUpload
            label="Your headshot"
            storageName="referral-headshot"
            noun="headshot"
            rounded="rounded-full"
            value={form.founderHeadshotUrl}
            onChange={url => setField('founderHeadshotUrl', url)}
            hint="Square photo, max 2MB."
          />

          <div>
            <label className="text-[13px] font-medium text-gray-700 block mb-1">Your name</label>
            <input value={form.founderName} onChange={e => setField('founderName', e.target.value)} placeholder="Jay Johnson" maxLength={80}
              className="w-full rounded-xl border border-gray-200 bg-white text-[14px] px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-brand-500" />
          </div>
          <div>
            <label className="text-[13px] font-medium text-gray-700 block mb-1">Your title</label>
            <input value={form.founderTitle} onChange={e => setField('founderTitle', e.target.value)} placeholder="Founder, YardSync" maxLength={80}
              className="w-full rounded-xl border border-gray-200 bg-white text-[14px] px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-brand-500" />
          </div>

          <div className="space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">Show on card</p>
            <Toggle field="showHeadshot" label="Headshot" />
            <Toggle field="showName" label="Name" />
            <Toggle field="showTitle" label="Title" />
          </div>

          <button onClick={handleSave} disabled={saving}
            className="w-full bg-brand-600 text-white font-semibold py-2.5 rounded-xl hover:bg-brand-700 transition-colors disabled:opacity-60">
            {saving ? 'Saving…' : 'Save card'}
          </button>
        </div>
      )}
    </div>
  )
}
