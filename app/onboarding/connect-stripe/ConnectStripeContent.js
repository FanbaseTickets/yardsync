'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { loadConnectAndInitialize } from '@stripe/connect-js'
import { ConnectComponentsProvider, ConnectAccountOnboarding } from '@stripe/react-connect-js'
import { useAuth } from '@/context/AuthContext'
import { doc, updateDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'

export default function ConnectStripeContent() {
  const { user, profile, loading } = useAuth()
  const router = useRouter()
  const [stripeConnectInstance, setStripeConnectInstance] = useState(null)
  const initedRef = useRef(false)

  useEffect(() => {
    if (loading) return
    if (!user) { router.replace('/login'); return }

    // Subscription gate: you pay the YardSync subscription BEFORE connecting a
    // bank. This page isn't behind the AppShell sub-gate, so without this an
    // un-subscribed user could reach the bank step (and create a Connect
    // account) by URL — a free-rider hole. Allow the just-subscribed grace
    // window (?subscribed=true) since the profile can lag the checkout webhook.
    const justSubscribed = typeof window !== 'undefined' && window.location.search.includes('subscribed=true')
    const status = profile?.subscriptionStatus
    const subscribed = status === 'active' || status === 'trialing'
    if (!subscribed && !justSubscribed) {
      router.replace(status === 'canceled' || status === 'cancelled' ? '/reactivate' : '/subscribe')
      return
    }

    // Create the Connect account at most once (the effect re-runs on profile
    // changes, and create-account is not idempotent).
    if (initedRef.current) return
    initedRef.current = true

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
  }, [user, profile, loading])

  const handleComplete = async () => {
    await updateDoc(doc(db, 'users', user.uid), {
      stripeAccountStatus: 'complete',
      paymentPath: 'stripe',
    })
    // Write stripeAccountId into subscription metadata for reward cron
    fetch('/api/stripe/connect/save-account-metadata', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ uid: user.uid }),
    }).catch(err => console.error('Save metadata failed (non-fatal):', err))
    router.push('/dashboard?subscribed=true')
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

      </div>
    </div>
  )
}
