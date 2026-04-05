'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import { useLang } from '@/context/LangContext'
import { doc, setDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { getClients, getInvoices } from '@/lib/db'
import { Leaf, Check, Star } from 'lucide-react'
import toast from 'react-hot-toast'

export default function ReactivateContent() {
  const { user, profile } = useAuth()
  const router = useRouter()

  let langCtx = null
  try { langCtx = useLang() } catch {}
  const lang = langCtx?.lang || profile?.language || 'en'
  const es = lang === 'es'

  const [selectedPlan, setSelectedPlan] = useState('monthly')
  const [loading, setLoading] = useState(false)
  const [clientCount, setClientCount] = useState(0)
  const [invoiceCount, setInvoiceCount] = useState(0)
  const [dataLoading, setDataLoading] = useState(true)

  const firstName = profile?.name
    ? profile.name.split(' ').find(w => w.length > 1) || profile.name.split(' ')[0]
    : (es ? 'amigo' : 'there')

  useEffect(() => {
    if (!user) return
    ;(async () => {
      try {
        const [clients, invoices] = await Promise.all([
          getClients(user.uid),
          getInvoices(user.uid),
        ])
        setClientCount(clients.length)
        setInvoiceCount(invoices.length)
      } catch {}
      setDataLoading(false)
    })()
  }, [user])

  async function handleReactivate() {
    if (!user) return
    setLoading(true)
    try {
      const res = await fetch('/api/stripe/reactivate-subscription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stripeSubscriptionId: profile?.stripeSubscriptionId,
          stripeCustomerId: profile?.stripeCustomerId,
          plan: selectedPlan,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)

      if (data.reactivated) {
        // Cancel was removed — subscription is back
        await setDoc(doc(db, 'users', user.uid), {
          subscriptionStatus: 'active',
          cancelAt: null,
        }, { merge: true })
        router.push('/dashboard?reactivated=true')
      } else {
        // New subscription created
        if (data.clientSecret) {
          const { loadStripe } = await import('@stripe/stripe-js')
          const stripe = await loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY)
          const { error } = await stripe.confirmCardPayment(data.clientSecret)
          if (error) throw new Error(error.message)
        }
        await setDoc(doc(db, 'users', user.uid), {
          subscriptionStatus: 'active',
          stripeSubscriptionId: data.subscriptionId,
          subscriptionPlan: selectedPlan,
          cancelAt: null,
          rewardStreak: 0,
          rewardTierHeld: 'base',
        }, { merge: true })
        router.push('/dashboard?reactivated=true')
      }
    } catch (err) {
      toast.error(err.message || (es ? 'Error al reactivar' : 'Failed to reactivate'))
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-800 via-brand-700 to-brand-600 flex flex-col items-center justify-center px-5 py-10">
      {/* Header */}
      <div className="flex flex-col items-center mb-8">
        <div className="w-16 h-16 rounded-2xl bg-white/10 backdrop-blur border border-white/20 flex items-center justify-center mb-3">
          <Leaf size={30} className="text-white" />
        </div>
        <h1 className="text-3xl font-display text-white tracking-tight">
          {es ? `Bienvenido de vuelta, ${firstName}` : `Welcome back, ${firstName}`}
        </h1>
        {!dataLoading && (
          <p className="text-brand-200 text-sm mt-2 text-center">
            {es
              ? `Tus ${clientCount} clientes y ${invoiceCount} facturas están justo donde los dejaste.`
              : `Your ${clientCount} clients and ${invoiceCount} invoices are right where you left them.`}
          </p>
        )}
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
              <p className={`text-[15px] font-bold ${selectedPlan === 'monthly' ? 'text-gray-900' : 'text-white'}`}>
                {es ? 'Mensual' : 'Monthly'}
              </p>
              <p className={`text-[13px] mt-0.5 ${selectedPlan === 'monthly' ? 'text-gray-500' : 'text-brand-200'}`}>
                {es ? 'Cancela cuando quieras' : 'Cancel anytime'}
              </p>
            </div>
            <div className="text-right">
              <p className={`text-[22px] font-bold ${selectedPlan === 'monthly' ? 'text-gray-900' : 'text-white'}`}>$39</p>
              <p className={`text-[11px] ${selectedPlan === 'monthly' ? 'text-gray-400' : 'text-brand-200'}`}>/{es ? 'mes' : 'mo'}</p>
            </div>
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
                  {es ? 'Anual' : 'Annual'}
                </p>
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                  selectedPlan === 'annual' ? 'bg-amber-100 text-amber-700' : 'bg-white/20 text-white'
                }`}>
                  {es ? 'Ahorra $78' : 'Save $78'}
                </span>
              </div>
              <p className={`text-[13px] mt-0.5 ${selectedPlan === 'annual' ? 'text-gray-500' : 'text-brand-200'}`}>
                {es ? 'Facturado anualmente' : 'Billed annually'}
              </p>
            </div>
            <div className="text-right">
              <p className={`text-[22px] font-bold ${selectedPlan === 'annual' ? 'text-gray-900' : 'text-white'}`}>$390</p>
              <p className={`text-[11px] ${selectedPlan === 'annual' ? 'text-gray-400' : 'text-brand-200'}`}>/{es ? 'año' : 'yr'}</p>
            </div>
          </div>
        </button>

        {/* Reactivate button */}
        <button
          onClick={handleReactivate}
          disabled={loading}
          className="w-full bg-white text-brand-700 font-bold text-[15px] py-4 rounded-2xl shadow-xl hover:bg-brand-50 transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
        >
          {loading ? (
            <span className="w-5 h-5 border-2 border-brand-400 border-t-transparent rounded-full animate-spin" />
          ) : (
            <span>{es ? 'Reactivar YardSync' : 'Reactivate YardSync'}</span>
          )}
        </button>

        <p className="text-center text-brand-300 text-[11px]">
          {es
            ? 'Se cobrará a tu método de pago registrado.'
            : 'Your payment method on file will be charged.'}
        </p>
      </div>

      <p className="text-brand-400 text-xs mt-8 text-center">
        YardSync · A JNew Technologies platform
      </p>
    </div>
  )
}
