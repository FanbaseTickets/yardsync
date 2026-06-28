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

    // Access gate. Free-access model (docs/FREE_ACCESS_SPEC.md): connecting
    // Stripe is FREE and is the whole funnel, so 'free_until_paid' (and the
    // grace 'past_due') must be allowed here — the anti-abuse mechanism is the
    // card-on-file gate at invoice-send, NOT a subscription. Only bounce
    // genuinely locked-out states (canceled → /reactivate, none → /subscribe).
    // Allow the just-subscribed grace window (?subscribed=true) since the
    // profile can lag the checkout webhook.
    const justSubscribed = typeof window !== 'undefined' && window.location.search.includes('subscribed=true')
    const status = profile?.subscriptionStatus
    const allowed = status === 'active' || status === 'trialing'
      || status === 'free_until_paid' || status === 'past_due'
    if (!allowed && !justSubscribed) {
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
    // Free-access model: connecting Stripe must NOT activate/charge the
    // subscription. ?connected=true shows a "bank connected" toast only; the
    // $39/mo subscription is created server-side on the first PAID client
    // invoice. (Was ?subscribed=true, which the dashboard treated as a paid
    // checkout and wrote subscriptionStatus:'active' — the bug that made Connect
    // skip the card-on-file gate and pre-activate before any client paid.)
    router.push('/dashboard?connected=true')
  }


  return (
    <div style={{ minHeight: '100vh', background: '#f8faf9' }}>
      <div style={{ background: '#0F6E56', padding: '20px 16px', textAlign: 'center' }}>
        <div style={{ color: '#9FE1CB', fontSize: '12px', marginBottom: '4px' }}>YardSync</div>
        <div style={{ color: '#fff', fontSize: '18px', fontWeight: '500' }}>Connect your bank</div>
        <div style={{ color: '#5DCAA5', fontSize: '12px', marginTop: '2px' }}>Conecta tu banco</div>
      </div>

      <div style={{ padding: '24px 16px', maxWidth: '480px', margin: '0 auto' }}>
        {/* Trust reassurance — persona testing (Marco + Riley) showed the bank/
            KYC step is the #1 anxiety + "is this legit?" moment. Name-drop the
            big brands on Stripe + clarify no LLC/EIN needed before the form. */}
        <div style={{ background: '#EFF8F4', border: '1px solid #C9EADD', borderRadius: '12px', padding: '14px 16px', marginBottom: '18px' }}>
          <div style={{ fontSize: '13px', color: '#0B5A46', fontWeight: 700, marginBottom: '5px' }}>
            🔒 Powered by Stripe — trusted by Amazon, Uber, DoorDash &amp; Shopify
          </div>
          <p style={{ fontSize: '12px', color: '#3F6F60', margin: 0, lineHeight: 1.5 }}>
            Stripe is the same secure payment system the big brands use. <strong>No LLC or business license needed</strong> — your SSN as a sole proprietor works. YardSync never sees your bank or card details.
          </p>
          <p style={{ fontSize: '12px', color: '#3F6F60', margin: '7px 0 0', lineHeight: 1.5 }}>
            Stripe es el mismo sistema de pago seguro que usan grandes marcas como Amazon, Uber y DoorDash. <strong>No necesitas LLC ni licencia</strong> — tu Seguro Social como dueño único funciona. YardSync nunca ve tu información bancaria.
          </p>
        </div>
        {/* Fee explainer — set expectations BEFORE they invoice, in plain terms.
            Reflects the live model: free-access, $39/mo, 5.5% capped at $100,
            optional pass-through. Honesty here is a trust signal. */}
        <div style={{ background: '#fff', border: '1px solid #E3EBE7', borderRadius: '12px', padding: '14px 16px', marginBottom: '18px' }}>
          <div style={{ fontSize: '13px', color: '#0B5A46', fontWeight: 700, marginBottom: '8px' }}>
            💸 How YardSync gets paid — no surprises
          </div>
          <ul style={{ margin: 0, padding: '0 0 0 18px', fontSize: '12px', color: '#3F6F60', lineHeight: 1.6 }}>
            <li><strong>Connecting is free.</strong> You pay nothing until your first client pays you.</li>
            <li>After that, it&apos;s <strong>$39/month</strong>.</li>
            <li>Each invoice has a <strong>5.5% fee, capped at $100</strong> — big jobs never pay an oversized cut.</li>
            <li>Optional: <strong>pass the fee to your client</strong> at checkout so you keep your full price.</li>
          </ul>
          <div style={{ fontSize: '13px', color: '#0B5A46', fontWeight: 700, margin: '12px 0 8px' }}>
            💸 Cómo cobra YardSync — sin sorpresas
          </div>
          <ul style={{ margin: 0, padding: '0 0 0 18px', fontSize: '12px', color: '#3F6F60', lineHeight: 1.6 }}>
            <li><strong>Conectar es gratis.</strong> No pagas nada hasta que tu primer cliente te pague.</li>
            <li>Después, son <strong>$39 al mes</strong>.</li>
            <li>Cada factura tiene una <strong>comisión del 5.5%, con tope de $100</strong> — los trabajos grandes nunca pagan de más.</li>
            <li>Opcional: <strong>pásale la comisión a tu cliente</strong> al cobrar para que recibas tu precio completo.</li>
          </ul>
        </div>
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
