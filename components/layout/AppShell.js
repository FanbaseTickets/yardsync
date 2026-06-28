'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import { useLang } from '@/context/LangContext'
import BottomNav from './BottomNav'
import WelcomeModal from '@/components/WelcomeModal'
import { getGardenerProfile, saveGardenerProfile } from '@/lib/db'
import { Leaf } from 'lucide-react'

export default function AppShell({ children }) {
  const { user, loading, signingUp, refreshProfile } = useAuth()
  const { lang } = useLang()
  const router = useRouter()

  const [pastDue, setPastDue] = useState(false)

  const [subStatus,  setSubStatus]  = useState(null)
  const [subLoading, setSubLoading] = useState(true)
  const [setupMsg,   setSetupMsg]   = useState(false)

  const timeoutRef    = useRef(null)
  const hasChecked    = useRef(false)
  const redirectedRef = useRef(false)

  // Redirect to login if not authenticated.
  //
  // Defense in depth against the cold-lambda post-signup hang:
  //   1) signUp / signInWithGoogle eagerly setUser/setLoading in AuthContext
  //      to short-circuit the gap before onAuthStateChanged fires.
  //   2) signingUp ref (also set by signUp / signInWithGoogle) suppresses
  //      this guard for ~5s after a signup begins. On a cold Vercel lambda
  //      this component can mount with user=null even AFTER the eager setUser
  //      because the AuthProvider hasn't finished hydrating in the new tree —
  //      so the redirect-to-login guard fires, /login bounces back, ping-pong.
  //      The flag tells us "an auth hydration is in flight, don't bounce."
  useEffect(() => {
    if (!loading && !user && !signingUp?.current) {
      console.log('[AppShell] redirect→/login fired — loading:', loading, 'user:', user?.uid || 'null', 'path:', typeof window !== 'undefined' ? window.location.pathname : '(ssr)')
      router.replace('/login')
    }
  }, [user, loading, router, signingUp])

  // Run subscription check ONCE when user is available
  useEffect(() => {
    if (!user) return
    if (hasChecked.current) return
    hasChecked.current = true

    const isPostPayment = typeof window !== 'undefined' && window.location.search.includes('subscribed=true')

    // Clear any stale timeout
    if (timeoutRef.current) clearTimeout(timeoutRef.current)

    // Single timeout — only ONE path runs
    if (isPostPayment) {
      // Post-payment: long grace period, never redirect to /subscribe
      timeoutRef.current = setTimeout(() => {
        if (subLoading && !redirectedRef.current) {
          console.log('AppShell — post-payment grace period, showing setup message')
          setSetupMsg(true)
          // Don't redirect — fail open after another 5 seconds
          timeoutRef.current = setTimeout(() => {
            if (subLoading) {
              console.log('AppShell — post-payment final fallback, failing open')
              setSubStatus('active')
              setSubLoading(false)
            }
          }, 5000)
        }
      }, 10000)
    } else {
      // Normal flow: 4-second hard timeout → redirect to /subscribe.
      // Skipped during a signup window — during signup the profile write
      // races the auth hydration on cold lambdas and a 4s subscribe bounce
      // would short-circuit the post-signup /dashboard mount.
      timeoutRef.current = setTimeout(() => {
        if (signingUp?.current) {
          console.log('[AppShell] 4s timeout — skipped, signup in progress')
          return
        }
        if (subLoading && !redirectedRef.current) {
          // Fail OPEN into the free model rather than the dead /subscribe paywall —
          // a hung profile read must not strand a free-access contractor.
          console.log('[AppShell] 4s timeout — failing open to free_until_paid. subStatus was:', subStatus, 'user:', user?.uid)
          redirectedRef.current = true
          setSubStatus('free_until_paid')
          setSubLoading(false)
        }
      }, 4000)
    }

    checkSubscription(isPostPayment)

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }
  }, [user])

  async function checkSubscription(isPostPayment) {
    if (!user?.uid) { setSubLoading(false); return }

    // Admin bypasses
    if (user.email === process.env.NEXT_PUBLIC_ADMIN_EMAIL) {
      clearTimeout(timeoutRef.current)
      setSubStatus('active')
      setSubLoading(false)
      return
    }

    const maxRetries = isPostPayment ? 12 : 3
    const delayMs    = isPostPayment ? 1000 : 500

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      if (!user?.uid || redirectedRef.current) { setSubLoading(false); return }
      try {
        const profile = await getGardenerProfile(user.uid)
        if (profile) {
          const status = profile.subscriptionStatus || 'none'

          // Free-access model (docs/FREE_ACCESS_SPEC.md): a 'free_until_paid'
          // contractor has FULL app access with no charge — and we do NOT force
          // Stripe Connect here. They explore + build their card + add clients
          // freely; the card-on-file + Connect requirement is enforced at
          // invoice-send time (that's the "get paid" setup step). The $39/mo
          // subscription is created when their first client invoice is paid.
          if (status === 'free_until_paid') {
            clearTimeout(timeoutRef.current)
            setSubStatus('active')
            setSubLoading(false)
            return
          }

          // Legacy accounts created before the free-access launch have status
          // 'none' (or missing). The old /subscribe paywall is dead — migrate
          // them into the free model and grant access (the card gate at
          // invoice-send + first-paid activation take over, same as a new
          // signup). Without this, pre-launch accounts hit the dead paywall.
          if (status === 'none') {
            clearTimeout(timeoutRef.current)
            try {
              await saveGardenerProfile(user.uid, {
                subscriptionStatus: 'free_until_paid',
                subscriptionPlan:   'monthly',
                pmOnFile:           false,
                freeUntilPaidSince: new Date().toISOString(),
              })
              await refreshProfile?.()
            } catch (e) {
              console.error('[AppShell] legacy free-access migration failed:', e)
            }
            setSubStatus('active')
            setSubLoading(false)
            return
          }

          // 'past_due' = a charge failed (e.g. the first-paid activation or a
          // renewal). Stripe Smart Retries run for ~2 weeks; keep the
          // contractor in (grace period) rather than locking them out. If every
          // retry fails Stripe cancels the sub → status 'canceled' → /reactivate.
          // (docs/FREE_ACCESS_SPEC.md §4.4.)
          if (status === 'active' || status === 'canceling' || status === 'past_due') {
            // Success — clear timeout immediately
            clearTimeout(timeoutRef.current)
            setPastDue(status === 'past_due')

            // Stripe-only: check if bank account setup is complete
            const onOnboardingRoute = typeof window !== 'undefined' && window.location.pathname.startsWith('/onboarding')
            if (!onOnboardingRoute && !isPostPayment && !profile.stripeAccountId) {
              // Bank not connected yet — send to Stripe Connect onboarding.
              // Gating on !stripeAccountId (not stripeAccountStatus) — the status field was
              // poisoned by a one-time migration script and is no longer authoritative.
              redirectedRef.current = true
              router.replace('/onboarding/connect-stripe')
              return
            }

            setSubStatus('active')
            setSubLoading(false)
            return
          }
          // Not active
          if (!isPostPayment) {
            clearTimeout(timeoutRef.current)
            if (status === 'canceled' || status === 'cancelled') {
              setSubStatus(status)
              setSubLoading(false)
              redirectedRef.current = true
              router.replace('/reactivate')
              return
            }
            // Any other/unknown status — fail OPEN into the free model rather than
            // the dead /subscribe paywall (a stale/odd status must not lock out a
            // free-access contractor).
            setSubStatus('free_until_paid')
            setSubLoading(false)
            return
          }
          // Post-payment but not active yet — keep retrying
        }
      } catch (err) {
        console.error('Subscription check error:', err)
      }
      if (attempt < maxRetries - 1) {
        await new Promise(r => setTimeout(r, delayMs))
      }
    }

    // Retries exhausted
    clearTimeout(timeoutRef.current)
    if (!redirectedRef.current) {
      if (isPostPayment) {
        // Fail open for paying users
        console.log('AppShell — post-payment retries exhausted, failing open')
        setSubStatus('active')
        setSubLoading(false)
      } else {
        // Fail OPEN into the free model rather than the dead /subscribe paywall.
        setSubStatus('free_until_paid')
        setSubLoading(false)
      }
    }
  }

  if (loading || subLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-brand-600 flex items-center justify-center">
            <Leaf size={22} className="text-white" />
          </div>
          <div className="w-8 h-8 rounded-full border-2 border-brand-600 border-t-transparent animate-spin" />
          <span className="text-sm text-gray-400 font-medium">
            {setupMsg ? 'Setting up your account...' : 'Loading YardSync...'}
          </span>
        </div>
      </div>
    )
  }

  if (!user) return null
  if (subStatus !== 'active' && subStatus !== 'canceling') return null

  return (
    <div className="min-h-screen bg-gray-100 flex items-start justify-center">
      <div className="flex flex-col h-screen w-full max-w-lg bg-white shadow-xl relative">
        {pastDue && (
          <button
            type="button"
            onClick={() => router.push('/settings?tab=billing')}
            className="w-full bg-amber-500 hover:bg-amber-600 text-white text-[12px] font-medium py-2 px-3 text-center transition-colors"
          >
            {lang === 'es'
              ? '⚠ Tu último pago falló — toca para actualizar tu tarjeta'
              : '⚠ Your last payment failed — tap to update your card'}
          </button>
        )}
        <main className="flex-1 overflow-hidden pb-14">{children}</main>
        <BottomNav />
        <WelcomeModal />
      </div>
    </div>
  )
}
