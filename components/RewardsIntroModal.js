'use client'

import { useState } from 'react'
import { doc, updateDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { useAuth } from '@/context/AuthContext'
import { useLang } from '@/context/LangContext'
import { CheckCircle2, Star, Zap } from 'lucide-react'
import toast from 'react-hot-toast'

/**
 * First-login rewards introduction modal.
 *
 * Renders when the authenticated user's profile has
 * `hasSeenRewardsIntro === false` (explicit false, not missing/undefined —
 * existing users without the flag do NOT see this).
 *
 * Written to Firestore via client SDK on dismiss; refreshes the profile
 * in AuthContext so the modal unmounts immediately.
 */
export default function RewardsIntroModal() {
  const { user, profile, refreshProfile } = useAuth()
  const { lang } = useLang()
  const [saving, setSaving] = useState(false)

  // Gate: show only if the flag is explicitly false on the user doc.
  if (profile?.hasSeenRewardsIntro !== false) return null
  if (!user?.uid) return null

  const es = lang === 'es'

  async function handleDismiss() {
    setSaving(true)
    try {
      await updateDoc(doc(db, 'users', user.uid), { hasSeenRewardsIntro: true })
      await refreshProfile()
    } catch (err) {
      console.error('Failed to dismiss rewards intro:', err)
      toast.error(es ? 'No se pudo cerrar' : 'Could not dismiss')
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-2xl p-6 sm:p-7 max-h-[92vh] overflow-y-auto">

        {/* Icon */}
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-green-100 to-green-200 flex items-center justify-center text-2xl mb-4">
          🎯
        </div>

        {/* Title */}
        <h2 className="text-[22px] leading-[1.25] font-serif text-gray-900 mb-2" style={{ fontFamily: 'var(--font-display), serif' }}>
          {es ? (
            <>Haz Crecer Tu Negocio,<br/>Reduce Tu Suscripción</>
          ) : (
            <>Grow Your Business,<br/>Shrink Your Subscription</>
          )}
        </h2>

        {/* Subtitle */}
        <p className="text-[13px] text-gray-500 leading-[1.5] mb-5">
          {es
            ? 'Mientras más facturas a través de YardSync, menos pagas cada mes.'
            : 'The more you invoice through YardSync, the less you pay each month.'}
        </p>

        {/* Tier table */}
        <div className="border border-gray-200 rounded-xl overflow-hidden mb-4">
          {/* Header row */}
          <div className="flex items-center justify-between px-3.5 py-2 bg-gray-50 border-b border-gray-200">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">
              {es ? 'Tu Volumen Mensual' : 'Your Monthly Volume'}
            </span>
            <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">
              {es ? 'Tú Pagas' : 'You Pay'}
            </span>
          </div>

          {/* Base tier */}
          <div className="flex items-center justify-between px-3.5 py-3 bg-green-50 border-b border-gray-100">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-green-50 border-[1.5px] border-green-300 flex items-center justify-center">
                <CheckCircle2 size={12} className="text-green-600" />
              </div>
              <span className="text-[13px] font-medium text-gray-700">
                {es ? 'Menos de $1,500' : 'Under $1,500'}
              </span>
            </div>
            <span className="text-[14px] font-semibold text-gray-900">
              $39/{es ? 'mes' : 'mo'}
            </span>
          </div>

          {/* Half tier */}
          <div className="flex items-center justify-between px-3.5 py-3 border-b border-gray-100">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-yellow-50 border-[1.5px] border-yellow-300 flex items-center justify-center">
                <Star size={12} className="text-yellow-500" />
              </div>
              <span className="text-[13px] font-medium text-gray-700">$1,500+</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-green-100 text-green-700">
                {es ? '50% desc' : '50% off'}
              </span>
              <span className="text-[14px] font-semibold text-gray-900">
                $19/{es ? 'mes' : 'mo'}
              </span>
            </div>
          </div>

          {/* Free tier */}
          <div className="flex items-center justify-between px-3.5 py-3">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-green-50 border-[1.5px] border-green-500 flex items-center justify-center">
                <Zap size={12} className="text-green-600" />
              </div>
              <span className="text-[13px] font-medium text-gray-700">$3,000+</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-green-100 text-green-700">
                {es ? '¡Gratis!' : 'Free!'}
              </span>
              <span className="text-[14px] font-semibold text-gray-900">
                $0/{es ? 'mes' : 'mo'}
              </span>
            </div>
          </div>
        </div>

        {/* Note */}
        <div className="flex items-start gap-2 px-3.5 py-3 bg-amber-50 rounded-xl mb-5">
          <span className="text-[14px] flex-shrink-0 mt-0.5">💡</span>
          <p className="text-[12px] text-amber-800 leading-[1.5]">
            {es ? (
              <>Alcanza el umbral <strong>2 meses seguidos</strong> y el descuento se activa automáticamente. La tarifa del 5.5% por factura siempre aplica.</>
            ) : (
              <>Hit the threshold <strong>2 months in a row</strong> and the discount kicks in automatically. The 5.5% per-invoice fee always applies.</>
            )}
          </p>
        </div>

        {/* CTA */}
        <button
          onClick={handleDismiss}
          disabled={saving}
          className="w-full py-3.5 rounded-xl bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white text-[15px] font-semibold transition-colors mb-3"
        >
          {saving
            ? (es ? 'Un momento...' : 'One moment...')
            : (es ? '¡Entendido, vamos!' : "Got it, let's go!")}
        </button>

        {/* Footer */}
        <p className="text-center text-[11px] text-gray-400 leading-[1.4]">
          {es ? (
            <>Siempre puedes encontrar esto en<br/><strong>Ajustes → Recompensas YardSync Pay</strong></>
          ) : (
            <>You can always find this in<br/><strong>Settings → YardSync Pay Rewards</strong></>
          )}
        </p>
      </div>
    </div>
  )
}
