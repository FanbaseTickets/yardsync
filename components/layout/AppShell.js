'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import BottomNav from './BottomNav'
import { getGardenerProfile } from '@/lib/db'
import { Leaf } from 'lucide-react'

export default function AppShell({ children }) {
  const { user, loading } = useAuth()
  const router = useRouter()

  const [subStatus,  setSubStatus]  = useState(null)
  const [subLoading, setSubLoading] = useState(true)
  const [setupMsg,   setSetupMsg]   = useState(false)
  const redirectedRef = useRef(false)

  useEffect(() => {
    if (!loading && !user) {
      router.replace('/login')
    }
  }, [user, loading, router])

  useEffect(() => {
    if (!user) return
    redirectedRef.current = false
    setSetupMsg(false)

    const justSubscribed = typeof window !== 'undefined' && window.location.search.includes('subscribed=true')

    checkSubscription(justSubscribed)

    // Hard timeout — only for non-payment flows
    // Post-payment flow gets a longer grace period for webhook to fire
    const timeoutMs = justSubscribed ? 10000 : 4000
    const timeout = setTimeout(() => {
      if (subLoading && !redirectedRef.current) {
        if (justSubscribed) {
          // Don't redirect — show "setting up" message and keep polling
          setSetupMsg(true)
          console.log('AppShell — post-payment timeout, showing setup message')
        } else {
          console.log('AppShell — hard timeout, redirecting to /subscribe')
          redirectedRef.current = true
          setSubStatus('none')
          setSubLoading(false)
          router.replace('/subscribe')
        }
      }
    }, timeoutMs)

    return () => clearTimeout(timeout)
  }, [user])

  async function checkSubscription(justSubscribed) {
    if (!user?.uid) { setSubLoading(false); return }

    // Admin bypasses subscription check
    if (user.email === process.env.NEXT_PUBLIC_ADMIN_EMAIL) {
      setSubStatus('active')
      setSubLoading(false)
      return
    }

    // Post-payment flow: more retries with longer delays for webhook
    const maxRetries = justSubscribed ? 10 : 3
    const delayMs    = justSubscribed ? 1000 : 500

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      if (!user?.uid || redirectedRef.current) { setSubLoading(false); return }
      try {
        const profile = await getGardenerProfile(user.uid)
        if (profile) {
          const status = profile.subscriptionStatus || 'none'
          if (status === 'active') {
            setSubStatus('active')
            setSubLoading(false)
            return
          }
          // Not active yet — if just subscribed, keep retrying (webhook may not have fired)
          if (!justSubscribed) {
            setSubStatus(status)
            setSubLoading(false)
            redirectedRef.current = true
            router.replace('/subscribe')
            return
          }
        }
      } catch (err) {
        console.error('Subscription check error:', err)
      }
      if (attempt < maxRetries - 1) {
        await new Promise(r => setTimeout(r, delayMs))
      }
    }

    // Retries exhausted
    if (!redirectedRef.current) {
      if (justSubscribed) {
        // Last resort for post-payment: try one final profile check then activate
        // The webhook should have fired by now (10+ seconds)
        try {
          const profile = await getGardenerProfile(user.uid)
          if (profile?.subscriptionStatus === 'active') {
            setSubStatus('active')
            setSubLoading(false)
            return
          }
        } catch {}
        // Still not active — show the app anyway (fail open for paying users)
        console.log('AppShell — post-payment retries exhausted, failing open')
        setSubStatus('active')
        setSubLoading(false)
      } else {
        redirectedRef.current = true
        setSubStatus('none')
        setSubLoading(false)
        router.replace('/subscribe')
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
  if (subStatus !== 'active') return null

  return (
    <div className="min-h-screen bg-gray-100 flex items-start justify-center">
      <div className="flex flex-col h-screen w-full max-w-lg bg-white shadow-xl relative">
        <main className="flex-1 overflow-hidden pb-14">{children}</main>
        <BottomNav />
      </div>
    </div>
  )
}
