'use client'

import { useState, useRef } from 'react'
import { doc, updateDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { useAuth } from '@/context/AuthContext'
import { useLang } from '@/context/LangContext'
import { CheckCircle2, Star, Zap, Sparkles, Upload, ArrowRight } from 'lucide-react'
import InstallApp from '@/components/InstallApp'
import toast from 'react-hot-toast'

/**
 * First-run welcome carousel — shown to a new member once, gated on
 * `hasSeenRewardsIntro === false` (set at signup). Swipeable cards:
 *   1. Welcome  2. Volume rewards  3. Pro Setup ($99 import)  4. Get started.
 * Replaces the old single-card RewardsIntroModal; same dismiss flag so existing
 * members who already saw the rewards intro don't see it again.
 */
export default function WelcomeModal() {
  const { user, profile, refreshProfile } = useAuth()
  const { lang } = useLang()
  const [step, setStep]   = useState(0)
  const [saving, setSaving] = useState(false)
  const [buying, setBuying] = useState(false)
  const touchX = useRef(null)

  if (profile?.hasSeenRewardsIntro !== false) return null
  if (!user?.uid) return null

  const es = lang === 'es'
  const LAST = 3

  async function dismiss() {
    setSaving(true)
    try {
      await updateDoc(doc(db, 'users', user.uid), { hasSeenRewardsIntro: true })
      await refreshProfile()
    } catch (err) {
      console.error('Failed to dismiss welcome modal:', err)
      toast.error(es ? 'No se pudo cerrar' : 'Could not dismiss')
      setSaving(false)
    }
  }

  function next() { setStep(s => Math.min(LAST, s + 1)) }
  function back() { setStep(s => Math.max(0, s - 1)) }

  function onTouchStart(e) { touchX.current = e.touches[0].clientX }
  function onTouchEnd(e) {
    if (touchX.current == null) return
    const dx = e.changedTouches[0].clientX - touchX.current
    if (dx < -45) next()
    else if (dx > 45) back()
    touchX.current = null
  }

  async function buyProSetup() {
    if (buying) return
    setBuying(true)
    try {
      // Mark the intro seen before leaving for Stripe, so returning to the
      // dashboard (?prosetup=success) doesn't re-show this modal.
      await updateDoc(doc(db, 'users', user.uid), { hasSeenRewardsIntro: true }).catch(() => {})
      const idToken = await user.getIdToken()
      const res = await fetch('/api/stripe/checkout/pro-setup', {
        method: 'POST', headers: { Authorization: `Bearer ${idToken}` },
      })
      const data = await res.json()
      if (res.ok && data.url) { window.location.href = data.url; return }
      toast.error(data?.error || (es ? 'No se pudo iniciar la compra' : 'Could not start checkout'))
      setBuying(false)
    } catch {
      toast.error(es ? 'No se pudo iniciar la compra' : 'Could not start checkout')
      setBuying(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50">
      <div
        className="w-full max-w-sm bg-white rounded-2xl shadow-2xl p-6 sm:p-7 max-h-[92vh] overflow-y-auto"
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        {/* ── Card 1: Welcome ─────────────────────────── */}
        {step === 0 && (
          <>
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-green-100 to-green-200 flex items-center justify-center mb-4">
              <Sparkles size={22} className="text-green-700" />
            </div>
            <h2 className="text-[22px] leading-[1.25] font-serif text-gray-900 mb-2" style={{ fontFamily: 'var(--font-display), serif' }}>
              {es ? <>¡Bienvenido a YardSync!</> : <>Welcome to YardSync!</>}
            </h2>
            <p className="text-[13px] text-gray-500 leading-[1.55] mb-5">
              {es
                ? 'Estás listo para empezar gratis. Construye tu tarjeta, agrega clientes, programa visitas y envía facturas — no pagas nada hasta que tu primer cliente te pague.'
                : "You're set to start free. Build your card, add clients, schedule visits, and send invoices — you pay nothing until your first client pays you."}
            </p>
          </>
        )}

        {/* ── Card 2: Volume rewards ───────────────────── */}
        {step === 1 && (
          <>
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-green-100 to-green-200 flex items-center justify-center text-2xl mb-4">🎯</div>
            <h2 className="text-[20px] leading-[1.25] font-serif text-gray-900 mb-2" style={{ fontFamily: 'var(--font-display), serif' }}>
              {es ? <>Crece más,<br/>paga menos cada mes</> : <>Grow more,<br/>pay less each month</>}
            </h2>
            <p className="text-[13px] text-gray-500 leading-[1.5] mb-4">
              {es ? 'Mientras más facturas a través de YardSync, menos pagas.' : 'The more you invoice through YardSync, the less you pay.'}
            </p>
            <div className="border border-gray-200 rounded-xl overflow-hidden mb-3">
              <div className="flex items-center justify-between px-3.5 py-2 bg-gray-50 border-b border-gray-200">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">{es ? 'Tu Volumen Mensual' : 'Your Monthly Volume'}</span>
                <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">{es ? 'Tú Pagas' : 'You Pay'}</span>
              </div>
              <div className="flex items-center justify-between px-3.5 py-3 bg-green-50 border-b border-gray-100">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-green-50 border-[1.5px] border-green-300 flex items-center justify-center"><CheckCircle2 size={12} className="text-green-600" /></div>
                  <span className="text-[13px] font-medium text-gray-700">{es ? 'Menos de $1,500' : 'Under $1,500'}</span>
                </div>
                <span className="text-[14px] font-semibold text-gray-900">$39/{es ? 'mes' : 'mo'}</span>
              </div>
              <div className="flex items-center justify-between px-3.5 py-3 border-b border-gray-100">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-yellow-50 border-[1.5px] border-yellow-300 flex items-center justify-center"><Star size={12} className="text-yellow-500" /></div>
                  <span className="text-[13px] font-medium text-gray-700">$1,500+</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-green-100 text-green-700">{es ? '50% desc' : '50% off'}</span>
                  <span className="text-[14px] font-semibold text-gray-900">$19.50/{es ? 'mes' : 'mo'}</span>
                </div>
              </div>
              <div className="flex items-center justify-between px-3.5 py-3">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-green-50 border-[1.5px] border-green-500 flex items-center justify-center"><Zap size={12} className="text-green-600" /></div>
                  <span className="text-[13px] font-medium text-gray-700">$3,000+</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-green-100 text-green-700">{es ? '¡Gratis!' : 'Free!'}</span>
                  <span className="text-[14px] font-semibold text-gray-900">$0/{es ? 'mes' : 'mo'}</span>
                </div>
              </div>
            </div>
            <p className="text-[11px] text-amber-800 leading-[1.5] bg-amber-50 rounded-lg px-3 py-2 mb-1">
              {es ? <>Alcanza el umbral <strong>2 meses seguidos</strong> y el descuento se activa solo. La tarifa del 5.5% por factura siempre aplica.</> : <>Hit the threshold <strong>2 months in a row</strong> and the discount kicks in automatically. The 5.5% per-invoice fee always applies.</>}
            </p>
          </>
        )}

        {/* ── Card 3: Pro Setup ────────────────────────── */}
        {step === 2 && (
          <>
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-brand-100 to-brand-200 flex items-center justify-center mb-4">
              <Upload size={22} className="text-brand-700" />
            </div>
            <h2 className="text-[20px] leading-[1.25] font-serif text-gray-900 mb-2" style={{ fontFamily: 'var(--font-display), serif' }}>
              {es ? <>¿Te cambias de otra app?<br/>Lo hacemos por ti</> : <>Switching from another app?<br/>We'll move you over</>}
            </h2>
            <p className="text-[13px] text-gray-500 leading-[1.55] mb-3">
              {es
                ? 'Con la Configuración Pro importamos toda tu cartera de clientes desde Jobber, Yardbook, hojas de cálculo o cualquier lista — con paquetes, precios y visitas recurrentes listos desde el primer día.'
                : "With Pro Setup we import your whole client book from Jobber, Yardbook, spreadsheets, or any list — packages, pricing, and recurring visits ready on day one."}
            </p>
            <div className="flex items-baseline gap-2 mb-4">
              <span className="text-[26px] font-bold text-gray-900">$99</span>
              <span className="text-[12px] text-gray-400">{es ? 'pago único · no reembolsable' : 'one-time · non-refundable'}</span>
            </div>
            <button
              onClick={buyProSetup}
              disabled={buying}
              className="w-full py-3.5 rounded-xl bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white text-[15px] font-semibold transition-colors mb-2 flex items-center justify-center gap-2"
            >
              {buying ? (es ? 'Un momento…' : 'One moment…') : (<>{es ? 'Importar mis clientes' : 'Import my clients'} <ArrowRight size={16} /></>)}
            </button>
            <p className="text-center text-[11px] text-gray-400">
              {es ? 'No tienes clientes que importar? Desliza para continuar.' : 'No clients to import? Swipe to continue.'}
            </p>
          </>
        )}

        {/* ── Card 4: Get started ──────────────────────── */}
        {step === 3 && (
          <>
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-green-100 to-green-200 flex items-center justify-center mb-4">
              <CheckCircle2 size={22} className="text-green-700" />
            </div>
            <h2 className="text-[22px] leading-[1.25] font-serif text-gray-900 mb-2" style={{ fontFamily: 'var(--font-display), serif' }}>
              {es ? <>¡Todo listo!</> : <>You're all set!</>}
            </h2>
            <p className="text-[13px] text-gray-500 leading-[1.55] mb-4">
              {es
                ? 'Empieza conectando tus pagos y agregando tu primer cliente. La Configuración Pro siempre está disponible en Ajustes.'
                : 'Start by connecting your payments and adding your first client. Pro Setup is always available in Settings.'}
            </p>
            {/* Install prompt — older contractors won't know to "Add to Home Screen" */}
            <div className="mb-4"><InstallApp /></div>
            <button
              onClick={dismiss}
              disabled={saving}
              className="w-full py-3.5 rounded-xl bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white text-[15px] font-semibold transition-colors mb-3"
            >
              {saving ? (es ? 'Un momento…' : 'One moment…') : (es ? '¡Vamos!' : "Let's go!")}
            </button>
          </>
        )}

        {/* ── Footer: dots + nav (hidden on last card, which has its own CTA) ── */}
        {step < LAST && (
          <div className="flex items-center justify-between mt-2">
            <button onClick={back} disabled={step === 0} className="text-[13px] text-gray-400 disabled:opacity-0 px-2 py-1">
              {es ? 'Atrás' : 'Back'}
            </button>
            <div className="flex items-center gap-1.5">
              {[0, 1, 2, 3].map(i => (
                <span key={i} className={`h-1.5 rounded-full transition-all ${i === step ? 'w-4 bg-green-600' : 'w-1.5 bg-gray-300'}`} />
              ))}
            </div>
            <button onClick={next} className="text-[13px] font-semibold text-green-700 px-2 py-1">
              {step === 2 ? (es ? 'Saltar' : 'Skip') : (es ? 'Siguiente' : 'Next')}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
