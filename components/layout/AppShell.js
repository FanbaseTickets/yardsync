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

  const timeoutRef    = useRef(null)
  const hasChecked    = useRef(false)
  const redirectedRef = useRef(false)

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!loading && !user) {
      router.replace('/login')
    }
  }, [user, loading, router])

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
      // Normal flow: 4-second hard timeout → redirect to /subscribe
      timeoutRef.current = setTimeout(() => {
        if (subLoading && !redirectedRef.current) {
          console.log('AppShell — hard timeout, redirecting to /subscribe')
          redirectedRef.current = true
          setSubStatus('none')
          setSubLoading(false)
          router.replace('/subscribe')
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
          if (status === 'active') {
            // Success — clear timeout immediately
            clearTimeout(timeoutRef.current)
            setSubStatus('active')
            setSubLoading(false)
            return
          }
          // Not active
          if (!isPostPayment) {
            clearTimeout(timeoutRef.current)
            setSubStatus(status)
            setSubLoading(false)
            redirectedRef.current = true
            router.replace('/subscribe')
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
