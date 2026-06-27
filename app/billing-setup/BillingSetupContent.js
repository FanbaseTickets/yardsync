'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import { useLang } from '@/context/LangContext'
import { saveGardenerProfile } from '@/lib/db'
import { startCardCapture } from '@/lib/cardCapture'
import { Check } from 'lucide-react'
import toast from 'react-hot-toast'

// Free-access model (docs/FREE_ACCESS_SPEC.md): the informed-consent step shown
// before we save a card on file. Discloses "$0 today", lets the contractor pick
// monthly vs annual, and states the card-on-file authorization (the legal
// mandate the terms-reviewer flagged) — THEN launches the $0 setup checkout.
// Reached from the invoice-send card_required gate with ?return=<invoice path>.
export default function BillingSetupContent() {
  const { user, profile, loading } = useAuth()
  const { lang } = useLang()
  const router = useRouter()

  const [plan,   setPlan]   = useState('monthly')
  const [saving, setSaving] = useState(false)
  const [returnPath, setReturnPath] = useState('/dashboard')

  useEffect(() => {
    // ?return= read via window.location to avoid a Suspense boundary (constraint #3).
    const r = new URLSearchParams(window.location.search).get('return')
    if (r && r.startsWith('/')) setReturnPath(r)
  }, [])

  // Default the toggle to whatever plan is already on the profile.
  useEffect(() => {
    if (profile?.subscriptionPlan === 'annual') setPlan('annual')
  }, [profile?.subscriptionPlan])

  // Guards. This page lives outside AppShell, so it does its own redirects.
  useEffect(() => {
    if (loading) return
    if (!user) { router.replace('/login'); return }
    // Already subscribed/active, or a card is already on file → nothing to set up.
    if (profile && (profile.subscriptionStatus === 'active'
                 || profile.subscriptionStatus === 'past_due'
                 || profile.pmOnFile === true)) {
      router.replace(returnPath)
    }
  }, [loading, user, profile?.subscriptionStatus, profile?.pmOnFile, returnPath, router])

  async function handleSaveCard() {
    if (!user || saving) return
    setSaving(true)
    try {
      // Persist the chosen plan BEFORE the card save so the first-paid
      // activation bills the right amount.
      await saveGardenerProfile(user.uid, { subscriptionPlan: plan })
      // Launch the $0 setup checkout; Stripe returns to the original invoice
      // page (?card=saved) so they can finish sending.
      await startCardCapture(user, returnPath)
    } catch (err) {
      toast.error(err.message || (lang === 'es' ? 'Algo salió mal' : 'Something went wrong'))
      setSaving(false)
    }
  }

  const t = lang === 'es' ? {
    eyebrow:   'Configura tu facturación',
    title:     'Sin cobro hoy',
    sub:       'Guardamos tu tarjeta de forma segura, pero no pagas nada hasta que tu primer cliente te pague. En ese momento empieza tu plan.',
    monthly:   'Mensual',
    annual:    'Anual',
    perMonth:  '/mes',
    perYear:   '/año',
    save:      'Ahorra $78',
    monthlyD:  'Facturado cada mes',
    annualD:   'Facturado una vez al año',
    auth:      (p) => p === 'annual'
      ? 'Al guardar tu tarjeta, autorizas a YardSync a cobrar $390/año cuando tu primer cliente te pague, y a renovar cada año hasta que canceles. Hoy no se cobra nada.'
      : 'Al guardar tu tarjeta, autorizas a YardSync a cobrar $39/mes cuando tu primer cliente te pague, y a renovar cada mes hasta que canceles. Hoy no se cobra nada.',
    cta:       'Guardar mi tarjeta',
    back:      'Ahora no',
    today:     '$0 hoy',
  } : {
    eyebrow:   'Set up billing',
    title:     '$0 today',
    sub:       'We securely save your card, but you pay nothing until your first client pays you. Your plan starts then.',
    monthly:   'Monthly',
    annual:    'Annual',
    perMonth:  '/mo',
    perYear:   '/yr',
    save:      'Save $78',
    monthlyD:  'Billed every month',
    annualD:   'Billed once a year',
    auth:      (p) => p === 'annual'
      ? 'By saving your card, you authorize YardSync to charge $390/year when your first client pays you, renewing each year until you cancel. Nothing is charged today.'
      : 'By saving your card, you authorize YardSync to charge $39/month when your first client pays you, renewing each month until you cancel. Nothing is charged today.',
    cta:       'Save my card',
    back:      'Not now',
    today:     '$0 today',
  }

  const PlanCard = ({ id, name, price, per, desc, badge }) => (
    <button
      type="button"
      onClick={() => setPlan(id)}
      className={`w-full text-left rounded-2xl border-2 p-4 transition-colors ${
        plan === id ? 'border-brand-600 bg-brand-50' : 'border-gray-200 bg-white hover:border-gray-300'
      }`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
            plan === id ? 'border-brand-600 bg-brand-600' : 'border-gray-300'
          }`}>
            {plan === id && <Check size={12} className="text-white" />}
          </span>
          <span className="text-[15px] font-semibold text-gray-900">{name}</span>
          {badge && (
            <span className="text-[10px] bg-green-100 text-green-800 px-1.5 py-0.5 rounded-full font-semibold">{badge}</span>
          )}
        </div>
        <div className="text-right">
          <span className="text-[17px] font-bold text-gray-900">{price}</span>
          <span className="text-[12px] text-gray-500">{per}</span>
        </div>
      </div>
      <p className="text-[12px] text-gray-500 mt-1 ml-7">{desc}</p>
    </button>
  )

  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-800 via-brand-700 to-brand-600 flex flex-col items-center justify-center px-5 py-10">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center mb-5">
          <div className="w-14 h-14 rounded-2xl bg-white/10 backdrop-blur border border-white/20 flex items-center justify-center mb-3 overflow-hidden">
            <img src="/logo-mark-white.png" alt="YardSync" className="w-[26px] h-[26px]" />
          </div>
          <p className="text-[12px] font-medium text-brand-100 uppercase tracking-wide">{t.eyebrow}</p>
          <h1 className="text-3xl font-display text-white tracking-tight mt-1">{t.title}</h1>
        </div>

        <div className="bg-white rounded-2xl p-5 shadow-xl">
          <p className="text-[13px] text-gray-600 leading-relaxed mb-4">{t.sub}</p>

          <div className="space-y-2.5">
            <PlanCard id="monthly" name={t.monthly} price="$39" per={t.perMonth} desc={t.monthlyD} />
            <PlanCard id="annual"  name={t.annual}  price="$390" per={t.perYear} desc={t.annualD} badge={t.save} />
          </div>

          <p className="text-[11px] text-gray-400 leading-relaxed mt-4">{t.auth(plan)}</p>

          <button
            type="button"
            onClick={handleSaveCard}
            disabled={saving}
            className="w-full mt-4 bg-brand-600 hover:bg-brand-700 disabled:opacity-60 text-white font-semibold text-[15px] rounded-xl py-3 transition-colors"
          >
            {saving ? '…' : `${t.cta} →`}
          </button>
          <button
            type="button"
            onClick={() => router.replace(returnPath)}
            className="w-full mt-2 text-[13px] text-gray-500 hover:text-gray-700 py-1.5"
          >
            {t.back}
          </button>
        </div>
      </div>
    </div>
  )
}
