'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import { useLang } from '@/context/LangContext'
import { t } from '@/lib/i18n'
import { doc, setDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { Leaf, Check, Zap, Star } from 'lucide-react'
import toast from 'react-hot-toast'

function SubscribeInner() {
  const { user, profile, signOut } = useAuth()
  const router                     = useRouter()
  const searchParams               = useSearchParams()

  // Try LangContext first, fall back to localStorage for pre-auth
  let langCtx = null
  try { langCtx = useLang() } catch {}
  const [fallbackLang, setFallbackLang] = useState('en')
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const stored = window.localStorage.getItem('yardsync_lang')
      if (stored === 'es' || stored === 'en') setFallbackLang(stored)
    }
  }, [])
  const lang = langCtx?.lang || profile?.language || fallbackLang
  const tr = (section, key) => t(lang, section, key)

  const [selectedPlan, setSelectedPlan] = useState('monthly')
  const [setupFee,     setSetupFee]     = useState(false)
  const [loading,      setLoading]      = useState(false)
  const [redirecting,  setRedirecting]  = useState(false)

  // Client-side backup write: if returning from Stripe with session_id,
  // fetch session data and write stripeCustomerId/stripeSubscriptionId to Firestore
  // before redirecting to onboarding. This ensures fields are written even if the
  // webhook is delayed.
  useEffect(() => {
    const sessionId = searchParams.get('session_id')
    const plan      = searchParams.get('plan')
    if (sessionId && user) {
      setRedirecting(true)
      ;(async () => {
        try {
          const res  = await fetch(`/api/stripe/session?sessionId=${sessionId}`)
          const data = await res.json()
          if (data.customerId && data.subscriptionId) {
            await setDoc(doc(db, 'users', user.uid), {
              stripeCustomerId:     data.customerId,
              stripeSubscriptionId: data.subscriptionId,
              subscriptionStatus:   'active',
            }, { merge: true })
            console.log('Client-side backup write complete', { uid: user.uid, stripeSubscriptionId: data.subscriptionId })
          }
        } catch (err) {
          console.error('Client-side backup write failed (non-fatal):', err.message)
        }
        router.push(`/onboarding/connect-stripe?subscribed=true&plan=${plan || 'monthly'}`)
      })()
      return
    }

    if (searchParams.get('cancelled')) {
      toast.error(tr('subscribe', 'checkout_cancel'))
    }
  }, [user])

  async function handleCheckout() {
    if (!user) return
    setLoading(true)
    try {
      const priceId = selectedPlan === 'annual'
        ? process.env.NEXT_PUBLIC_STRIPE_PRICE_ANNUAL
        : process.env.NEXT_PUBLIC_STRIPE_PRICE_MONTHLY

      const res = await fetch('/api/stripe/checkout', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          priceId,
          setupFee,
          gardenerUid:   user.uid,
          gardenerEmail: user.email,
        }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      window.location.href = data.url
    } catch (err) {
      toast.error(tr('subscribe', 'checkout_error'))
      setLoading(false)
    }
  }

  const monthlyTotal = setupFee ? 39 + 99 : 39
  const annualTotal  = setupFee ? 390 + 99 : 390
  const displayTotal = selectedPlan === 'annual' ? annualTotal : monthlyTotal

  const monthlyFeatures = [
    tr('subscribe', 'unlimited'),
    tr('subscribe', 'square'),
    tr('subscribe', 'auto_sms'),
    tr('subscribe', 'bilingual'),
  ]
  const annualFeatures = [
    tr('subscribe', 'everything'),
    tr('subscribe', 'best_value'),
    tr('subscribe', 'priority'),
    tr('subscribe', 'early_access'),
  ]
  const setupFeatures = [
    tr('subscribe', 'setup_1'),
    tr('subscribe', 'setup_2'),
    tr('subscribe', 'setup_3'),
    tr('subscribe', 'setup_4'),
  ]

  if (redirecting) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-brand-800 via-brand-700 to-brand-600 flex flex-col items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-white/10 backdrop-blur border border-white/20 flex items-center justify-center">
            <Leaf size={30} className="text-white" />
          </div>
          <div className="w-8 h-8 rounded-full border-2 border-white/40 border-t-white animate-spin" />
          <p className="text-white/80 text-sm font-medium">
            {lang === 'es' ? 'Configurando tu cuenta...' : 'Setting up your account...'}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-800 via-brand-700 to-brand-600 flex flex-col items-center justify-center px-5 py-10">

      {/* Header */}
      <div className="flex flex-col items-center mb-8">
        <div className="w-16 h-16 rounded-2xl bg-white/10 backdrop-blur border border-white/20 flex items-center justify-center mb-3">
          <Leaf size={30} className="text-white" />
        </div>
        <h1 className="text-3xl font-display text-white tracking-tight">YardSync</h1>
        <p className="text-brand-200 text-sm mt-1 text-center">
          {tr('subscribe', 'choose_plan')}
        </p>
      </div>

      <div className="w-full max-w-sm space-y-3">

        {/* Monthly plan */}
        <button
          onClick={() => setSelectedPlan('monthly')}
          className={`w-full rounded-2xl p-4 text-left transition-all border-2 ${
            selectedPlan === 'monthly'
              ? 'bg-white border-white shadow-xl'
              : 'bg-white/10 border-white/20 hover:bg-white/15'
          }`}
        >
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <p className={`text-[15px] font-bold ${selectedPlan === 'monthly' ? 'text-gray-900' : 'text-white'}`}>
                  {tr('subscribe', 'monthly')}
                </p>
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                  selectedPlan === 'monthly'
                    ? 'bg-brand-100 text-brand-700'
                    : 'bg-white/20 text-white'
                }`}>
                  {tr('subscribe', 'most_popular')}
                </span>
              </div>
              <p className={`text-[13px] mt-0.5 ${selectedPlan === 'monthly' ? 'text-gray-500' : 'text-brand-200'}`}>
                {tr('subscribe', 'cancel_anytime')}
              </p>
            </div>
            <div className="text-right">
              <p className={`text-[22px] font-bold ${selectedPlan === 'monthly' ? 'text-gray-900' : 'text-white'}`}>
                $39
              </p>
              <p className={`text-[11px] ${selectedPlan === 'monthly' ? 'text-gray-400' : 'text-brand-200'}`}>
                {tr('subscribe', 'per_month')}
              </p>
            </div>
          </div>
          <div className={`mt-3 pt-3 border-t space-y-1.5 ${
            selectedPlan === 'monthly' ? 'border-gray-100' : 'border-white/20'
          }`}>
            {monthlyFeatures.map(f => (
              <div key={f} className="flex items-center gap-2">
                <Check size={13} className={selectedPlan === 'monthly' ? 'text-brand-600' : 'text-brand-300'} />
                <p className={`text-[12px] ${selectedPlan === 'monthly' ? 'text-gray-600' : 'text-brand-100'}`}>{f}</p>
              </div>
            ))}
          </div>
        </button>

        {/* Annual plan */}
        <button
          onClick={() => setSelectedPlan('annual')}
          className={`w-full rounded-2xl p-4 text-left transition-all border-2 ${
            selectedPlan === 'annual'
              ? 'bg-white border-white shadow-xl'
              : 'bg-white/10 border-white/20 hover:bg-white/15'
          }`}
        >
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <p className={`text-[15px] font-bold ${selectedPlan === 'annual' ? 'text-gray-900' : 'text-white'}`}>
                  {tr('subscribe', 'annual')}
                </p>
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                  selectedPlan === 'annual'
                    ? 'bg-amber-100 text-amber-700'
                    : 'bg-white/20 text-white'
                }`}>
                  {tr('subscribe', 'save_78')}
                </span>
              </div>
              <p className={`text-[13px] mt-0.5 ${selectedPlan === 'annual' ? 'text-gray-500' : 'text-brand-200'}`}>
                {tr('subscribe', 'billed_annually')}
              </p>
            </div>
            <div className="text-right">
              <p className={`text-[22px] font-bold ${selectedPlan === 'annual' ? 'text-gray-900' : 'text-white'}`}>
                $390
              </p>
              <p className={`text-[11px] ${selectedPlan === 'annual' ? 'text-gray-400' : 'text-brand-200'}`}>
                {tr('subscribe', 'per_year')}
              </p>
            </div>
          </div>
          <div className={`mt-3 pt-3 border-t space-y-1.5 ${
            selectedPlan === 'annual' ? 'border-gray-100' : 'border-white/20'
          }`}>
            {annualFeatures.map(f => (
              <div key={f} className="flex items-center gap-2">
                <Star size={13} className={selectedPlan === 'annual' ? 'text-amber-500' : 'text-amber-300'} />
                <p className={`text-[12px] ${selectedPlan === 'annual' ? 'text-gray-600' : 'text-brand-100'}`}>{f}</p>
              </div>
            ))}
          </div>
        </button>

        {/* Setup fee add-on */}
        <button
          onClick={() => setSetupFee(!setupFee)}
          className={`w-full rounded-2xl p-4 text-left transition-all border-2 ${
            setupFee
              ? 'bg-white border-white shadow-xl'
              : 'bg-white/10 border-white/20 hover:bg-white/15'
          }`}
        >
          <div className="flex items-center gap-3">
            <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
              setupFee
                ? 'bg-brand-600 border-brand-600'
                : 'border-white/40'
            }`}>
              {setupFee && <Check size={12} className="text-white" />}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className={`text-[14px] font-semibold ${setupFee ? 'text-gray-900' : 'text-white'}`}>
                  {tr('subscribe', 'setup_title')}
                </p>
                <Zap size={13} className={setupFee ? 'text-amber-500' : 'text-amber-300'} />
              </div>
              <p className={`text-[12px] mt-0.5 ${setupFee ? 'text-gray-500' : 'text-brand-200'}`}>
                {tr('subscribe', 'setup_desc')}
              </p>
            </div>
            <div className="text-right flex-shrink-0">
              <p className={`text-[16px] font-bold ${setupFee ? 'text-gray-900' : 'text-white'}`}>+$99</p>
              <p className={`text-[10px] ${setupFee ? 'text-gray-400' : 'text-brand-200'}`}>{tr('subscribe', 'one_time')}</p>
            </div>
          </div>
          {setupFee && (
            <div className="mt-3 pt-3 border-t border-gray-100 space-y-1">
              {setupFeatures.map(f => (
                <div key={f} className="flex items-center gap-2">
                  <Check size={11} className="text-brand-600" />
                  <p className="text-[11px] text-gray-500">{f}</p>
                </div>
              ))}
            </div>
          )}
        </button>

        {/* Total + CTA */}
        <div className="bg-white/10 border border-white/20 rounded-2xl p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[13px] text-brand-200">
              {selectedPlan === 'annual' ? tr('subscribe', 'annual_plan') : tr('subscribe', 'monthly_plan')}
            </p>
            <p className="text-[13px] text-white font-medium">
              {selectedPlan === 'annual' ? '$390/' + (lang === 'es' ? 'año' : 'yr') : '$39/' + (lang === 'es' ? 'mes' : 'mo')}
            </p>
          </div>
          {setupFee && (
            <div className="flex items-center justify-between mb-3">
              <p className="text-[13px] text-brand-200">{tr('subscribe', 'pro_setup')}</p>
              <p className="text-[13px] text-white font-medium">$99 {tr('subscribe', 'one_time')}</p>
            </div>
          )}
          <div className="flex items-center justify-between pt-3 border-t border-white/20">
            <p className="text-[14px] font-semibold text-white">{tr('subscribe', 'due_today')}</p>
            <p className="text-[20px] font-bold text-white">${displayTotal}</p>
          </div>
        </div>

        <button
          onClick={handleCheckout}
          disabled={loading}
          className="w-full bg-white text-brand-700 font-bold text-[15px] py-4 rounded-2xl shadow-xl hover:bg-brand-50 transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
        >
          {loading ? (
            <span className="w-5 h-5 border-2 border-brand-400 border-t-transparent rounded-full animate-spin" />
          ) : (
            <>
              <span>{selectedPlan === 'annual' ? tr('subscribe', 'start_annual') : tr('subscribe', 'start_monthly')}</span>
              <span className="text-brand-400">→</span>
            </>
          )}
        </button>

        <p className="text-center text-brand-300 text-[11px]">
          {tr('subscribe', 'footer')}
        </p>

        <button
          onClick={signOut}
          className="w-full text-center text-brand-300 text-[12px] hover:text-white transition-colors py-2"
        >
          {tr('subscribe', 'sign_out')}
        </button>

      </div>

      <p className="text-brand-400 text-xs mt-8 text-center">
        YardSync · A JNew Technologies platform
      </p>
    </div>
  )
}

export default function SubscribePage() {
  return (
    <Suspense fallback={null}>
      <SubscribeInner />
    </Suspense>
  )
}
