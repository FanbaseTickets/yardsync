'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import { Leaf, Check, Zap, Star } from 'lucide-react'
import toast from 'react-hot-toast'

export default function SubscribePage() {
  const { user, profile, signOut } = useAuth()
  const router                     = useRouter()
  const searchParams               = useSearchParams()

  const [selectedPlan, setSelectedPlan] = useState('monthly')
  const [setupFee,     setSetupFee]     = useState(false)
  const [loading,      setLoading]      = useState(false)

  useEffect(() => {
    if (searchParams.get('cancelled')) {
      toast.error('Checkout cancelled — choose a plan to continue')
    }
  }, [])

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
      toast.error('Could not start checkout — try again')
      setLoading(false)
    }
  }

  const monthlyTotal = setupFee ? 39 + 99 : 39
  const annualTotal  = setupFee ? 390 + 99 : 390
  const displayTotal = selectedPlan === 'annual' ? annualTotal : monthlyTotal

  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-800 via-brand-700 to-brand-600 flex flex-col items-center justify-center px-5 py-10">

      {/* Header */}
      <div className="flex flex-col items-center mb-8">
        <div className="w-16 h-16 rounded-2xl bg-white/10 backdrop-blur border border-white/20 flex items-center justify-center mb-3">
          <Leaf size={30} className="text-white" />
        </div>
        <h1 className="text-3xl font-display text-white tracking-tight">YardSync</h1>
        <p className="text-brand-200 text-sm mt-1 text-center">
          Choose your plan to get started
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
                  Monthly
                </p>
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                  selectedPlan === 'monthly'
                    ? 'bg-brand-100 text-brand-700'
                    : 'bg-white/20 text-white'
                }`}>
                  MOST POPULAR
                </span>
              </div>
              <p className={`text-[13px] mt-0.5 ${selectedPlan === 'monthly' ? 'text-gray-500' : 'text-brand-200'}`}>
                Cancel anytime
              </p>
            </div>
            <div className="text-right">
              <p className={`text-[22px] font-bold ${selectedPlan === 'monthly' ? 'text-gray-900' : 'text-white'}`}>
                $39
              </p>
              <p className={`text-[11px] ${selectedPlan === 'monthly' ? 'text-gray-400' : 'text-brand-200'}`}>
                per month
              </p>
            </div>
          </div>
          <div className={`mt-3 pt-3 border-t space-y-1.5 ${
            selectedPlan === 'monthly' ? 'border-gray-100' : 'border-white/20'
          }`}>
            {[
              'Unlimited clients',
              'Square invoice integration',
              'Auto SMS reminders',
              'English & Spanish support',
            ].map(f => (
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
                  Annual
                </p>
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                  selectedPlan === 'annual'
                    ? 'bg-amber-100 text-amber-700'
                    : 'bg-white/20 text-white'
                }`}>
                  SAVE $78
                </span>
              </div>
              <p className={`text-[13px] mt-0.5 ${selectedPlan === 'annual' ? 'text-gray-500' : 'text-brand-200'}`}>
                $32.50/month billed annually
              </p>
            </div>
            <div className="text-right">
              <p className={`text-[22px] font-bold ${selectedPlan === 'annual' ? 'text-gray-900' : 'text-white'}`}>
                $390
              </p>
              <p className={`text-[11px] ${selectedPlan === 'annual' ? 'text-gray-400' : 'text-brand-200'}`}>
                per year
              </p>
            </div>
          </div>
          <div className={`mt-3 pt-3 border-t space-y-1.5 ${
            selectedPlan === 'annual' ? 'border-gray-100' : 'border-white/20'
          }`}>
            {[
              'Everything in Monthly',
              'Best value — 2 months free',
              'Priority support',
              'Early access to new features',
            ].map(f => (
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
                  Professional Setup
                </p>
                <Zap size={13} className={setupFee ? 'text-amber-500' : 'text-amber-300'} />
              </div>
              <p className={`text-[12px] mt-0.5 ${setupFee ? 'text-gray-500' : 'text-brand-200'}`}>
                We set up your clients, packages & schedule for you
              </p>
            </div>
            <div className="text-right flex-shrink-0">
              <p className={`text-[16px] font-bold ${setupFee ? 'text-gray-900' : 'text-white'}`}>+$99</p>
              <p className={`text-[10px] ${setupFee ? 'text-gray-400' : 'text-brand-200'}`}>one-time</p>
            </div>
          </div>
          {setupFee && (
            <div className="mt-3 pt-3 border-t border-gray-100 space-y-1">
              {[
                'We enter all your existing clients',
                'Set up your service packages',
                'Schedule recurring visits',
                'Ready to use on day one',
              ].map(f => (
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
              {selectedPlan === 'annual' ? 'Annual plan' : 'Monthly plan'}
            </p>
            <p className="text-[13px] text-white font-medium">
              {selectedPlan === 'annual' ? '$390/yr' : '$39/mo'}
            </p>
          </div>
          {setupFee && (
            <div className="flex items-center justify-between mb-3">
              <p className="text-[13px] text-brand-200">Professional setup</p>
              <p className="text-[13px] text-white font-medium">$99 once</p>
            </div>
          )}
          <div className="flex items-center justify-between pt-3 border-t border-white/20">
            <p className="text-[14px] font-semibold text-white">Due today</p>
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
              <span>Start {selectedPlan === 'annual' ? 'Annual' : 'Monthly'} Plan</span>
              <span className="text-brand-400">→</span>
            </>
          )}
        </button>

        <p className="text-center text-brand-300 text-[11px]">
          Secured by Stripe · Cancel anytime · No hidden fees
        </p>

        <button
          onClick={signOut}
          className="w-full text-center text-brand-300 text-[12px] hover:text-white transition-colors py-2"
        >
          Sign out
        </button>

      </div>

      <p className="text-brand-400 text-xs mt-8 text-center">
        YardSync · A JNew Technologies platform
      </p>
    </div>
  )
}