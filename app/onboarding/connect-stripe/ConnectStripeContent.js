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
  const [confirmed, setConfirmed] = useState(false)   // nothing is provisioned until this is true
  const initedRef = useRef(false)

  // A scoped crew member converting into their own business — show the extra
  // gravity (this makes them a full owner + starts a Stripe payment setup).
  const isCrewConversion = profile?.crewMode === true && !profile?.stripeAccountId

  // ── Access gate ONLY (redirects). Runs on mount. Creates NOTHING. ──
  useEffect(() => {
    if (loading) return
    if (!user) { router.replace('/login'); return }
    const justSubscribed = typeof window !== 'undefined' && window.location.search.includes('subscribed=true')
    const status = profile?.subscriptionStatus
    const allowed = status === 'active' || status === 'trialing'
      || status === 'free_until_paid' || status === 'past_due'
    if (!allowed && !justSubscribed) {
      router.replace(status === 'canceled' || status === 'cancelled' ? '/reactivate' : '/dashboard')
    }
  }, [user, profile, loading, router])

  // ── Provisioning: create the Connect account + start the embedded onboarding.
  // Fires ONLY after the user explicitly confirms — so entering the page and
  // backing out is a true no-op (no Stripe account, no stripeAccountId write). ──
  useEffect(() => {
    if (!confirmed || !user || initedRef.current) return
    initedRef.current = true   // create-account is not idempotent — at most once

    const init = async () => {
      try {
        const res = await fetch('/api/stripe/connect/create-account', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ uid: user.uid }),
        })
        const { accountId } = await res.json()

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
        initedRef.current = false   // allow a retry on failure
      }
    }
    init()
  }, [confirmed, user])

  const handleComplete = async () => {
    await updateDoc(doc(db, 'users', user.uid), {
      stripeAccountStatus: 'complete',
      paymentPath: 'stripe',
    })
    fetch('/api/stripe/connect/save-account-metadata', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ uid: user.uid }),
    }).catch(err => console.error('Save metadata failed (non-fatal):', err))
    router.push('/dashboard?connected=true')
  }

  // Back out with no side effects (nothing was provisioned pre-confirm).
  const handleCancel = () => router.push(isCrewConversion ? '/settings?tab=team' : '/dashboard')

  return (
    <div style={{ minHeight: '100vh', background: '#f8faf9' }}>
      <div style={{ background: '#0F6E56', padding: '20px 16px', textAlign: 'center' }}>
        <div style={{ color: '#9FE1CB', fontSize: '12px', marginBottom: '4px' }}>YardSync</div>
        <div style={{ color: '#fff', fontSize: '18px', fontWeight: '500' }}>{isCrewConversion ? 'Start your own business' : 'Connect your bank'}</div>
        <div style={{ color: '#5DCAA5', fontSize: '12px', marginTop: '2px' }}>{isCrewConversion ? 'Empieza tu propio negocio' : 'Conecta tu banco'}</div>
      </div>

      <div style={{ padding: '24px 16px', maxWidth: '480px', margin: '0 auto' }}>
        {/* Crew-conversion gravity notice — only when a scoped crew member is
            converting, so an accidental tap can't provision anything. */}
        {isCrewConversion && !confirmed && (
          <div style={{ background: '#fff', border: '1px solid #E3EBE7', borderRadius: '12px', padding: '16px', marginBottom: '18px' }}>
            <div style={{ fontSize: '14px', color: '#16241d', fontWeight: 700, marginBottom: '8px' }}>Ready to run your own business?</div>
            <p style={{ fontSize: '13px', color: '#3F6F60', margin: '0 0 8px', lineHeight: 1.55 }}>
              This turns your crew account into your own YardSync business — you&apos;ll get your own clients, invoices, and dashboard. <strong>You stay on your current crews.</strong>
            </p>
            <ul style={{ margin: 0, padding: '0 0 0 18px', fontSize: '12.5px', color: '#3F6F60', lineHeight: 1.6 }}>
              <li>Setting up payments with Stripe (bank + basic identity).</li>
              <li>It&apos;s <strong>free to start</strong> — your $39/mo plan only begins after your first client pays you.</li>
              <li>Nothing is created until you tap <strong>Start</strong> below. Not ready? Just go back.</li>
            </ul>
            <p style={{ fontSize: '12.5px', color: '#3F6F60', margin: '10px 0 0', lineHeight: 1.55 }}>
              Esto convierte tu cuenta de equipo en tu propio negocio de YardSync. <strong>Sigues en tus equipos.</strong> Es <strong>gratis para empezar</strong> — tu plan de $39/mes comienza cuando tu primer cliente te pague. No se crea nada hasta que toques <strong>Empezar</strong>.
            </p>
          </div>
        )}

        {/* Trust + fee explainers (persona testing) */}
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
        <div style={{ background: '#fff', border: '1px solid #E3EBE7', borderRadius: '12px', padding: '14px 16px', marginBottom: '18px' }}>
          <div style={{ fontSize: '13px', color: '#0B5A46', fontWeight: 700, marginBottom: '8px' }}>
            💸 How YardSync gets paid — no surprises
          </div>
          <ul style={{ margin: 0, padding: '0 0 0 18px', fontSize: '12px', color: '#3F6F60', lineHeight: 1.6 }}>
            <li><strong>Connecting is free.</strong> You pay nothing until your first client pays you.</li>
            <li>After that, it&apos;s <strong>$39/month</strong>.</li>
            <li>Each invoice has a <strong>5.5% fee, capped at $100</strong> — big jobs never pay an oversized cut.</li>
            <li>Optional: <strong>build the fee into your price</strong> so you keep your full amount — you set one all-in price (it&apos;s not a card surcharge).</li>
          </ul>
          <div style={{ fontSize: '13px', color: '#0B5A46', fontWeight: 700, margin: '12px 0 8px' }}>
            💸 Cómo cobra YardSync — sin sorpresas
          </div>
          <ul style={{ margin: 0, padding: '0 0 0 18px', fontSize: '12px', color: '#3F6F60', lineHeight: 1.6 }}>
            <li><strong>Conectar es gratis.</strong> No pagas nada hasta que tu primer cliente te pague.</li>
            <li>Después, son <strong>$39 al mes</strong>.</li>
            <li>Cada factura tiene una <strong>comisión del 5.5%, con tope de $100</strong> — los trabajos grandes nunca pagan de más.</li>
            <li>Opcional: <strong>incluye la comisión en tu precio</strong> para que recibas tu monto completo — fijas un solo precio todo incluido (no es un recargo por tarjeta).</li>
          </ul>
        </div>

        {/* Pre-confirm: a deliberate action gates ALL provisioning. */}
        {!confirmed ? (
          <div>
            <button
              type="button"
              onClick={() => setConfirmed(true)}
              style={{ width: '100%', background: '#0F6E56', color: '#fff', fontWeight: 700, fontSize: '15px', padding: '14px', borderRadius: '12px', border: 'none', cursor: 'pointer' }}
            >
              {isCrewConversion ? 'Start my business · Empezar' : 'Continue · Continuar'}
            </button>
            <button
              type="button"
              onClick={handleCancel}
              style={{ width: '100%', background: 'transparent', color: '#6B7280', fontWeight: 600, fontSize: '13px', padding: '12px', borderRadius: '12px', border: 'none', cursor: 'pointer', marginTop: '6px' }}
            >
              {isCrewConversion ? 'Not now — go back · Ahora no' : 'Go back · Volver'}
            </button>
          </div>
        ) : !stripeConnectInstance ? (
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
