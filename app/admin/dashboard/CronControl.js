'use client'

/**
 * Admin master switches for the money/SMS crons (settings/platform).
 *  - smsRemindersEnabled → app/api/cron/sms
 *  - autoChargeEnabled   → app/api/cron/auto-charge + auto-charge-reminder
 *
 * Each cron fails safe to OFF, so an unset toggle means "do nothing". Auto-charge
 * moves REAL money off-session, so it ships OFF and must be deliberately enabled.
 * Reads/writes via /api/admin/cron-control (admin-verified, firestoreRest).
 */

import { useState, useEffect } from 'react'
import { useAuth } from '@/context/AuthContext'
import { MessageSquare, RefreshCw, Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'

function ToggleRow({ icon: Icon, title, desc, onLabel, offLabel, enabled, loading, saving, onToggle }) {
  return (
    <div className="flex items-center justify-between gap-4 flex-wrap">
      <div className="flex items-start gap-3 min-w-0">
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${enabled ? 'bg-green-50 text-green-600' : 'bg-gray-100 text-gray-400'}`}>
          <Icon size={18} />
        </div>
        <div className="min-w-0">
          <h2 className="text-[15px] font-semibold text-gray-900">{title}</h2>
          <p className="text-[13px] text-gray-500 mt-0.5">{desc}</p>
          <p className={`text-[12px] font-medium mt-1 ${enabled ? 'text-green-700' : 'text-gray-500'}`}>
            {loading ? 'Checking…' : enabled ? `● ${onLabel}` : `○ ${offLabel}`}
          </p>
        </div>
      </div>
      <button
        onClick={onToggle}
        disabled={loading || saving}
        role="switch"
        aria-checked={enabled}
        className={`relative inline-flex h-7 w-12 flex-shrink-0 items-center rounded-full transition-colors disabled:opacity-50 ${enabled ? 'bg-green-500' : 'bg-gray-300'}`}
      >
        <span className={`inline-flex h-5 w-5 items-center justify-center transform rounded-full bg-white shadow transition-transform ${enabled ? 'translate-x-6' : 'translate-x-1'}`}>
          {saving && <Loader2 size={12} className="animate-spin text-gray-400" />}
        </span>
      </button>
    </div>
  )
}

export default function CronControl() {
  const { user } = useAuth()
  const [sms,  setSms]  = useState(false)
  const [auto, setAuto] = useState(false)
  const [loading, setLoading] = useState(true)
  const [savingKey, setSavingKey] = useState(null)

  useEffect(() => {
    if (!user) return
    let cancelled = false
    ;(async () => {
      try {
        const idToken = await user.getIdToken()
        const res = await fetch('/api/admin/cron-control', { headers: { Authorization: `Bearer ${idToken}` } })
        const data = await res.json()
        if (!cancelled) { setSms(data?.smsRemindersEnabled === true); setAuto(data?.autoChargeEnabled === true) }
      } catch { /* non-fatal — defaults OFF */ }
      finally { if (!cancelled) setLoading(false) }
    })()
    return () => { cancelled = true }
  }, [user])

  async function toggle(key, cur, setCur, okMsg) {
    const next = !cur
    setSavingKey(key)
    setCur(next)
    try {
      const idToken = await user.getIdToken()
      const res = await fetch('/api/admin/cron-control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
        body: JSON.stringify({ [key]: next }),
      })
      if (!res.ok) throw new Error('save failed')
      toast.success(next ? okMsg.on : okMsg.off)
    } catch {
      setCur(!next)
      toast.error('Could not update the setting')
    } finally {
      setSavingKey(null)
    }
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-5">
      <ToggleRow
        icon={MessageSquare}
        title="Daily SMS reminders"
        desc="The 13:00 UTC cron texts contractors' clients about upcoming jobs. Each run bills real Twilio sends — keep OFF until launch."
        onLabel="Sending — reminders go out daily"
        offLabel="Paused — no reminders are sent"
        enabled={sms}
        loading={loading}
        saving={savingKey === 'smsRemindersEnabled'}
        onToggle={() => toggle('smsRemindersEnabled', sms, setSms, { on: 'SMS reminders ON', off: 'SMS reminders OFF' })}
      />
      <div className="border-t border-gray-100" />
      <ToggleRow
        icon={RefreshCw}
        title="Recurring auto-charge"
        desc="Charges clients' saved cards automatically on each recurring visit (with a 3-day reminder + cancel). Moves REAL money — keep OFF until fully tested."
        onLabel="Live — cards are charged automatically"
        offLabel="Paused — no automatic charges"
        enabled={auto}
        loading={loading}
        saving={savingKey === 'autoChargeEnabled'}
        onToggle={() => toggle('autoChargeEnabled', auto, setAuto, { on: '⚠️ Auto-charge LIVE — real cards will be charged', off: 'Auto-charge OFF — no automatic charges' })}
      />
    </div>
  )
}
