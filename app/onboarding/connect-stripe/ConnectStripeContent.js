'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import { useLang } from '@/context/LangContext'
import { doc, setDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { Leaf, AlertCircle } from 'lucide-react'
import { loadConnectAndInitialize } from '@stripe/connect-js'

export default function ConnectStripeContent() {
  const { user } = useAuth()
  const router = useRouter()

  let langCtx = null
  try { langCtx = useLang() } catch {}
  const lang = langCtx?.lang || 'en'
  const es = lang === 'es'

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const containerRef = useRef(null)
  const mountedRef = useRef(false)

  async function initConnect() {
    if (!user?.uid) return
    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/stripe/connect/create-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid: user.uid }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Failed to create account')
      }

      const { accountId, clientSecret } = await res.json()

      // Write account ID to Firestore (client-side)
      await setDoc(doc(db, 'users', user.uid), {
        stripeAccountId: accountId,
        stripeAccountStatus: 'pending',
      }, { merge: true })

      // Initialize Stripe Connect embedded onboarding
      const stripeConnectInstance = await loadConnectAndInitialize({
        publishableKey: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
        fetchClientSecret: async () => {
          return clientSecret
        },
      })

      const onboardingElement = stripeConnectInstance.create('account-onboarding')

      onboardingElement.setOnExit(async () => {
        // Onboarding complete
        await setDoc(doc(db, 'users', user.uid), {
          stripeAccountStatus: 'complete',
          paymentPath: 'stripe',
        }, { merge: true })
        router.push('/dashboard')
      })

      // Clear container and mount
      if (containerRef.current) {
        containerRef.current.innerHTML = ''
        containerRef.current.appendChild(onboardingElement)
      }

      setLoading(false)
    } catch (err) {
      console.error('Stripe Connect init error:', err)
      setError(err.message)
      setLoading(false)
    }
  }

  useEffect(() => {
    if (mountedRef.current) return
    mountedRef.current = true
    initConnect()
  }, [user])

  async function handleSkip() {
    if (!user?.uid) return
    await setDoc(doc(db, 'users', user.uid), { paymentPath: 'pending' }, { merge: true })
    router.push('/dashboard')
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <div className="bg-[#0F6E56] px-5 pt-12 pb-6">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-9 h-9 rounded-xl bg-white/15 flex items-center justify-center">
            <Leaf size={18} className="text-white" />
          </div>
          <span className="text-white/70 text-sm font-medium">YardSync</span>
        </div>
        <h1 className="text-white text-xl font-bold mt-3">
          {es ? 'Conecta tu banco' : 'Connect your bank'}
        </h1>
        {/* Progress dots — step 4 of 4 */}
        <div className="flex gap-1.5 mt-4">
          {[1, 2, 3, 4].map(s => (
            <div
              key={s}
              className={`h-1.5 rounded-full flex-1 ${s <= 4 ? 'bg-white' : 'bg-white/30'}`}
            />
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 px-5 py-6 flex flex-col">
        {loading && (
          <div className="flex-1 flex flex-col items-center justify-center gap-3">
            <div className="w-8 h-8 rounded-full border-2 border-[#0F6E56] border-t-transparent animate-spin" />
            <p className="text-sm text-gray-400">
              {es ? 'Preparando conexión segura...' : 'Preparing secure connection...'}
            </p>
          </div>
        )}

        {error && (
          <div className="flex-1 flex flex-col items-center justify-center gap-4">
            <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center">
              <AlertCircle size={24} className="text-red-500" />
            </div>
            <p className="text-sm text-gray-600 text-center">{error}</p>
            <button
              onClick={() => { mountedRef.current = false; initConnect() }}
              className="bg-[#0F6E56] text-white font-semibold text-sm px-6 py-3 rounded-xl hover:bg-[#0B5A46] transition-colors"
            >
              {es ? 'Reintentar' : 'Try again'}
            </button>
          </div>
        )}

        {/* Stripe embedded onboarding mounts here */}
        <div ref={containerRef} className={loading || error ? 'hidden' : ''} />

        {!loading && !error && (
          <p className="text-[11px] text-gray-400 text-center mt-4">
            {es
              ? 'Stripe maneja tu información bancaria de forma segura. YardSync nunca ve tus datos.'
              : 'Your bank details are handled securely by Stripe. YardSync never sees your account information.'}
          </p>
        )}

        {/* Skip link */}
        <button
          onClick={handleSkip}
          className="w-full text-center text-gray-400 text-[13px] hover:text-gray-600 transition-colors py-2 mt-auto"
        >
          {es ? 'Omitir por ahora' : 'Skip for now'}
        </button>
      </div>
    </div>
  )
}
