'use client'

import { useEffect, useState } from 'react'
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

  useEffect(() => {
    if (!loading && !user) {
      router.replace('/login')
    }
  }, [user, loading, router])

  useEffect(() => {
    if (!user) return
    checkSubscription()
  }, [user])

  async function checkSubscription() {
    // Admin email bypasses subscription check
    if (user.email === process.env.NEXT_PUBLIC_ADMIN_EMAIL) {
      setSubStatus('active')
      setSubLoading(false)
      return
    }

    try {
      const profile = await getGardenerProfile(user.uid)
      const status  = profile?.subscriptionStatus || 'none'
      setSubStatus(status)
      if (status !== 'active') {
        router.replace('/subscribe')
      }
    } catch (err) {
      console.error('Subscription check failed:', err)
      setSubStatus('active') // fail open so app doesn't brick
    } finally {
      setSubLoading(false)
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
          <span className="text-sm text-gray-400 font-medium">Loading YardSync...</span>
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