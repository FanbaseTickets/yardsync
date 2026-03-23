'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import BottomNav from './BottomNav'
import { getGardenerProfile } from '@/lib/db'
import { Leaf } from 'lucide-react'

export default function AppShell({ children }) {
  const { user, loading } = useAuth()
  const router   = useRouter()
  const pathname = usePathname()

  const [subStatus,  setSubStatus]  = useState(null)
  const [subLoading, setSubLoading] = useState(true)
  const redirectedRef = useRef(false)

  useEffect(() => {
    if (!loading && !user) {
      router.replace('/login')
    }
  }, [user, loading, router])

  useEffect(() => {
    if (!user) return
    redirectedRef.current = false
    checkSubscription()

    // Hard timeout — never show loading for more than 4 seconds
    const timeout = setTimeout(() => {
      if (subLoading && !redirectedRef.current) {
        console.log('AppShell — hard timeout reached, redirecting to /subscribe')
        redirectedRef.current = true
        setSubStatus('none')
        setSubLoading(false)
        router.replace('/subscribe')
      }
    }, 4000)

    return () => clearTimeout(timeout)
  }, [user])

  async function checkSubscription() {
    if (!user?.uid) { setSubLoading(false); return }

    // Admin email bypasses subscription check
    if (user.email === process.env.NEXT_PUBLIC_ADMIN_EMAIL) {
      setSubStatus('active')
      setSubLoading(false)
      return
    }

    // Retry up to 3 times with 500ms delay
    for (let attempt = 0; attempt < 3; attempt++) {
      if (!user?.uid || redirectedRef.current) { setSubLoading(false); return }
      try {
        const profile = await getGardenerProfile(user.uid)
        if (profile) {
          const status = profile.subscriptionStatus || 'none'
          setSubStatus(status)
          setSubLoading(false)
          if (status !== 'active') {
            redirectedRef.current = true
            router.replace('/subscribe')
          }
          return
        }
      } catch (err) {
        console.error('Subscription check error:', err)
      }
      // Wait 500ms before next retry
      if (attempt < 2) {
        await new Promise(r => setTimeout(r, 500))
      }
    }

    // All retries exhausted, profile still null — redirect to subscribe
    if (!redirectedRef.current) {
      console.log('AppShell — retries exhausted, redirecting to /subscribe')
      redirectedRef.current = true
      setSubStatus('none')
      setSubLoading(false)
      router.replace('/subscribe')
    }
  }

  // Show branded spinner while loading auth or subscription status
  if (loading || subLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-brand-600 flex items-center justify-center">
            <Leaf size={22} className="text-white" />
          </div>
          <div className="w-8 h-8 rounded-full border-2 border-brand-600 border-t-transparent animate-spin" />
          <span className="text-sm text-gray-400 font-medium">Loading YardSync...</span>
        </div>
      </div>
    )
  }

  // If not authenticated, show nothing (redirect to /login is firing)
  if (!user) return null

  // If subscription is not active, show nothing (redirect to /subscribe is firing)
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
