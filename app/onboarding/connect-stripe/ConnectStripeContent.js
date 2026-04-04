'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { loadConnectAndInitialize } from '@stripe/connect-js'
import {
  ConnectComponentsProvider,
  ConnectAccountOnboarding,
} from '@stripe/react-connect-js'
import { useAuth } from '@/context/AuthContext'
import { useLang } from '@/context/LangContext'
import { doc, updateDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { Leaf } from 'lucide-react'

export default function ConnectStripeContent() {
  const { user } = useAuth()
  const router = useRouter()

  let langCtx = null
  try { langCtx = useLang() } catch {}
  const lang = langCtx?.lang || 'en'
  const es = lang === 'es'

  const [stripeConnectInstance, setStripeConnectInstance] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!user) return

    const initStripe = async () => {
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

        await updateDoc(doc(db, 'users', user.uid), {
          stripeAccountId: accountId,
          stripeAccountStatus: 'pending',
        })

        const instance = loadConnectAndInitialize({
          publishableKey: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
          fetchClientSecret: async () => {
            const sessionRes = await fetch('/api/stripe/connect/account-session', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ stripeAccountId: accountId }),
            })
            const data = await sessionRes.json()
            return data.clientSecret
          },
        })

        setStripeConnectInstance(instance)
      } catch (err) {
        console.error('Stripe Connect init error:', err)
        setError(err.message || 'Something went wrong. Please try again.')
      } finally {
        setLoading(false)
      }
    }

    initStripe()
  }, [user])

  const handleComplete = async () => {
    await updateDoc(doc(db, 'users', user.uid), {
      stripeAccountStatus: 'complete',
      paymentPath: 'stripe',
    })
    router.push('/dashboard')
  }

  const handleSkip = async () => {
    try {
      if (user) {
        await updateDoc(doc(db, 'users', user.uid), {
          paymentPath: 'pending',
        })
      }
    } catch (err) {
      console.error('Skip write failed:', err)
    } finally {
      router.push('/dashboard')
    }
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
        <p className="text-[#5DCAA5] text-xs mt-1">
          {es ? '' : 'Conecta tu banco'}
        </p>
        {/* Progress dots — step 4 of 4 */}
        <div className="flex gap-1.5 mt-4">
          {[1, 2, 3, 4].map(s => (
            <div
              key={s}
              className="h-1.5 rounded-full flex-1 bg-white"
            />
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 px-4 py-6 flex flex-col" style={{ maxWidth: 480, margin: '0 auto', width: '100%' }}>
        {loading && (
          <div className="flex-1 flex flex-col items-center justify-center gap-3">
            <div className="w-8 h-8 rounded-full border-2 border-[#0F6E56] border-t-transparent animate-spin" />
            <p className="text-sm text-gray-400">
              {es ? 'Preparando tu cuenta...' : 'Setting up your account...'}
            </p>
          </div>
        )}

        {error && (
          <div className="flex-1 flex flex-col items-center justify-center gap-4">
            <p className="text-sm text-red-600 text-center">{error}</p>
            <button
              onClick={() => window.location.reload()}
              className="bg-[#0F6E56] text-white font-semibold text-sm px-6 py-3 rounded-xl hover:bg-[#0B5A46] transition-colors"
            >
              {es ? 'Reintentar' : 'Try again'}
            </button>
          </div>
        )}

        {stripeConnectInstance && !loading && (
          <ConnectComponentsProvider connectInstance={stripeConnectInstance}>
            <ConnectAccountOnboarding onExit={handleComplete} />
          </ConnectComponentsProvider>
        )}

        <p className="text-[11px] text-gray-400 text-center mt-4 leading-relaxed">
          {es
            ? 'Stripe maneja tu información bancaria de forma segura. YardSync nunca ve tus datos.'
            : 'Your bank details are handled securely by Stripe. YardSync never sees your account information.'}
        </p>

        <button
          onClick={handleSkip}
          className="w-full text-center text-gray-400 text-[13px] hover:text-gray-600 transition-colors py-2 mt-4"
        >
          {es ? 'Omitir por ahora' : 'Skip for now'}
        </button>
      </div>
    </div>
  )
}
