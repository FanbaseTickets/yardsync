'use client'

/**
 * Admin Settings — houses platform config that doesn't belong on the
 * at-a-glance dashboard: the founder referral card and the SMS-cron master
 * switch. Reached via the "Settings" button in the dashboard header so the
 * homepage stays centered on high-level metrics.
 *
 * Admin-gated identically to /admin/dashboard.
 */

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/context/AuthContext'
import { Shield, ArrowLeft, LogOut } from 'lucide-react'
import toast from 'react-hot-toast'
import ReferralCardEditor from '../dashboard/ReferralCardEditor'
import CronControl from '../dashboard/CronControl'

export default function AdminSettings() {
  const { user, loading, signOut } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (loading) return
    if (!user) { router.replace('/admin'); return }
    if (user.email !== process.env.NEXT_PUBLIC_ADMIN_EMAIL) {
      toast.error('Not authorized')
      router.replace('/login')
    }
  }, [user, loading])

  async function handleSignOut() {
    try { await signOut() } catch { /* no-op */ }
    router.replace('/admin')
  }

  if (loading || !user || user.email !== process.env.NEXT_PUBLIC_ADMIN_EMAIL) {
    return <div className="min-h-screen bg-gray-950" />
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Header */}
      <div className="bg-gray-900 border-b border-gray-800 px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-brand-600 flex items-center justify-center">
              <Shield size={16} className="text-white" />
            </div>
            <div>
              <h1 className="text-[16px] font-bold text-white">YardSync Admin</h1>
              <p className="text-[11px] text-gray-400">JNew Technologies · Settings</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <Link
              href="/admin/dashboard"
              className="flex items-center gap-1.5 text-[12px] text-gray-400 hover:text-white transition-colors"
            >
              <ArrowLeft size={13} />
              Dashboard
            </Link>
            <button
              onClick={handleSignOut}
              className="flex items-center gap-1.5 text-[12px] text-gray-400 hover:text-red-400 transition-colors"
            >
              <LogOut size={13} />
              Sign out
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-8 space-y-8">
        {/* Founder referral card — shareable /grow card + editable founder details. */}
        <ReferralCardEditor />

        {/* SMS cron master switch — pause/resume daily Twilio reminder sends. */}
        <CronControl />
      </div>
    </div>
  )
}
