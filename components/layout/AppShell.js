'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import BottomNav from './BottomNav'

export default function AppShell({ children }) {
  const { user, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading && !user) {
      router.replace('/login')
    }
  }, [user, loading, router])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-full border-2 border-brand-600 border-t-transparent animate-spin" />
          <span className="text-sm text-gray-400 font-medium">Loading YardSync...</span>
        </div>
      </div>
    )
  }

  if (!user) return null

  return (
    <div className="flex flex-col h-screen max-w-lg mx-auto">
      <main className="flex-1 overflow-hidden pb-14">
        {children}
      </main>
      <BottomNav />
    </div>
  )
}