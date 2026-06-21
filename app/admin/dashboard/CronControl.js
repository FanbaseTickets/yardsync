'use client'

/**
 * Admin master switch for the daily SMS reminder cron (app/api/cron/sms).
 *
 * While the contractor base is still test data, every cron run bills real
 * Twilio sends. This toggle lets the founder pause/resume all reminder sends
 * from the dashboard with no redeploy. Reads/writes settings/platform via
 * /api/admin/cron-control (admin-verified, firestoreRest). The cron fails safe
 * to OFF, so an unset toggle means "no sends".
 */

import { useState, useEffect } from 'react'
import { useAuth } from '@/context/AuthContext'
import { MessageSquare, Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'

export default function CronControl() {
  const { user } = useAuth()
  const [enabled, setEnabled] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving,  setSaving]  = useState(false)

  useEffect(() => {
    if (!user) return
    let cancelled = false
    ;(async () => {
      try {
        const idToken = await user.getIdToken()
        const res = await fetch('/api/admin/cron-control', { headers: { Authorization: `Bearer ${idToken}` } })
        const data = await res.json()
        if (!cancelled) setEnabled(data?.smsRemindersEnabled === true)
      } catch { /* non-fatal — defaults to OFF */ }
      finally { if (!cancelled) setLoading(false) }
    })()
    return () => { cancelled = true }
  }, [user])

  async function toggle() {
    const next = !enabled
    setSaving(true)
    setEnabled(next) // optimistic
    try {
      const idToken = await user.getIdToken()
      const res = await fetch('/api/admin/cron-control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
        body: JSON.stringify({ smsRemindersEnabled: next }),
      })
      if (!res.ok) throw new Error('save failed')
      toast.success(next ? 'SMS reminders ON — cron will send' : 'SMS reminders OFF — cron paused')
    } catch {
      setEnabled(!next) // revert
      toast.error('Could not update the SMS cron')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-start gap-3 min-w-0">
          <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${enabled ? 'bg-green-50 text-green-600' : 'bg-gray-100 text-gray-400'}`}>
            <MessageSquare size={18} />
          </div>
          <div className="min-w-0">
            <h2 className="text-[15px] font-semibold text-gray-900">Daily SMS reminders</h2>
            <p className="text-[13px] text-gray-500 mt-0.5">
              The 13:00&nbsp;UTC cron texts contractors&rsquo; clients about upcoming jobs. Each run bills real Twilio sends — keep this OFF until launch, flip ON to watch it work.
            </p>
            <p className={`text-[12px] font-medium mt-1 ${enabled ? 'text-green-700' : 'text-gray-500'}`}>
              {loading ? 'Checking…' : enabled ? '● Sending — reminders go out daily' : '○ Paused — no reminders are sent'}
            </p>
          </div>
        </div>

        <button
          onClick={toggle}
          disabled={loading || saving}
          role="switch"
          aria-checked={enabled}
          aria-label="Toggle daily SMS reminders"
          className={`relative inline-flex h-7 w-12 flex-shrink-0 items-center rounded-full transition-colors disabled:opacity-50 ${enabled ? 'bg-green-500' : 'bg-gray-300'}`}
        >
          <span className={`inline-flex h-5 w-5 items-center justify-center transform rounded-full bg-white shadow transition-transform ${enabled ? 'translate-x-6' : 'translate-x-1'}`}>
            {saving && <Loader2 size={12} className="animate-spin text-gray-400" />}
          </span>
        </button>
      </div>
    </div>
  )
}
