'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { loadConnectAndInitialize } from '@stripe/connect-js'
import { ConnectComponentsProvider, ConnectAccountOnboarding } from '@stripe/react-connect-js'
import { useAuth } from '@/context/AuthContext'
import { doc, updateDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'

export default function ConnectStripeContent() {
  const { user } = useAuth()
  const router = useRouter()
  const [stripeConnectInstance, setStripeConnectInstance] = useState(null)

  useEffect(() => {
    if (!user) return

    const init = async () => {
      try {
        const res = await fetch('/api/stripe/connect/create-account', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ uid: user.uid }),
        })
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
      }
    }

    init()
  }, [user])

  const handleComplete = async () => {
    await updateDoc(doc(db, 'users', user.uid), {
      stripeAccountStatus: 'complete',
      paymentPath: 'stripe',
    })
    router.push('/dashboard?subscribed=true')
  }

  const handleUseSquare = async () => {
    try {
      if (user) await updateDoc(doc(db, 'users', user.uid), { paymentPath: 'square' })
    } catch (err) {
      console.error(err)
    } finally {
      router.push('/dashboard?subscribed=true')
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f8faf9' }}>
      <div style={{ background: '#0F6E56', padding: '20px 16px', textAlign: 'center' }}>
        <div style={{ color: '#9FE1CB', fontSize: '12px', marginBottom: '4px' }}>YardSync</div>
        <div style={{ color: '#fff', fontSize: '18px', fontWeight: '500' }}>Connect your bank</div>
        <div style={{ color: '#5DCAA5', fontSize: '12px', marginTop: '2px' }}>Conecta tu banco</div>
      </div>

      <div style={{ padding: '24px 16px', maxWidth: '480px', margin: '0 auto' }}>
        {!stripeConnectInstance ? (
          <div style={{ textAlign: 'center', padding: '40px', color: '#6B7280' }}>
            Setting up your account...
          </div>
        ) : (
          <ConnectComponentsProvider connectInstance={stripeConnectInstance}>
            <ConnectAccountOnboarding onExit={handleComplete} />
          </ConnectComponentsProvider>
        )}

        <div style={{ textAlign: 'center', marginTop: '16px', fontSize: '12px', color: '#6B7280', lineHeight: '1.5' }}>
          Your bank details are handled securely by Stripe.<br />
          YardSync never sees your account information.
        </div>

        <button
          onClick={handleUseSquare}
          style={{ display: 'block', width: '100%', marginTop: '16px', padding: '10px', background: 'transparent', border: 'none', color: '#6B7280', fontSize: '13px', cursor: 'pointer', textAlign: 'center' }}
        >
          Use Square instead
        </button>
      </div>
    </div>
  )
}
