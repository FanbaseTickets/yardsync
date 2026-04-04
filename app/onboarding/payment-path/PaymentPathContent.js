'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import { useLang } from '@/context/LangContext'
import { doc, setDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { Leaf, CreditCard, Store, Check } from 'lucide-react'

export default function PaymentPathContent() {
  const { user } = useAuth()
  const router = useRouter()

  let langCtx = null
  try { langCtx = useLang() } catch {}
  const lang = langCtx?.lang || 'en'
  const es = lang === 'es'

  const [selected, setSelected] = useState('stripe')
  const [loading, setLoading] = useState(false)

  async function handleContinue() {
    if (!user?.uid) return
    setLoading(true)
    try {
      if (selected === 'square') {
        await setDoc(doc(db, 'users', user.uid), { paymentPath: 'square' }, { merge: true })
        router.push('/dashboard')
      } else {
        router.push('/onboarding/connect-stripe')
      }
    } catch {
      setLoading(false)
    }
  }

  async function handleSkip() {
    if (!user?.uid) return
    setLoading(true)
    try {
      await setDoc(doc(db, 'users', user.uid), { paymentPath: 'pending' }, { merge: true })
      router.push('/dashboard')
    } catch {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <div className="bg-[#0F6E56] px-5 pt-12 pb-6">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-9 h-9 rounded-xl bg-white/15 flex items-center justify-center">
            <Leaf size={18} className="text-white" />
          </div>
          <span className="text-white/70 text-sm font-medium">YardSync</span>
        </div>
        <h1 className="text-white text-xl font-bold mt-3">
          {es ? '¿Cómo recibes pagos?' : 'How do you get paid?'}
        </h1>
        {/* Progress dots — step 3 of 4 */}
        <div className="flex gap-1.5 mt-4">
          {[1, 2, 3, 4].map(s => (
            <div
              key={s}
              className={`h-1.5 rounded-full flex-1 ${s <= 3 ? 'bg-white' : 'bg-white/30'}`}
            />
          ))}
        </div>
      </div>

      {/* Cards */}
      <div className="flex-1 px-5 py-6 space-y-3">
        {/* YardSync Pay card */}
        <button
          onClick={() => setSelected('stripe')}
          className={`w-full rounded-2xl p-4 text-left transition-all border-2 ${
            selected === 'stripe'
              ? 'border-[#0F6E56] bg-[#E1F5EE]'
              : 'border-gray-200 bg-white'
          }`}
        >
          <div className="flex items-start gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
              selected === 'stripe' ? 'bg-[#0F6E56]' : 'bg-gray-100'
            }`}>
              <CreditCard size={18} className={selected === 'stripe' ? 'text-white' : 'text-gray-500'} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-[15px] font-bold text-gray-900">YardSync Pay</p>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#0F6E56] text-white">
                  {es ? 'Recomendado' : 'Recommended'}
                </span>
              </div>
              <p className="text-[13px] text-gray-500 mt-1">
                {es
                  ? 'Conecta tu banco. Clientes pagan en línea.'
                  : 'Connect your bank. Clients pay online.'}
              </p>
              <p className="text-[12px] text-gray-400 mt-1">
                {es
                  ? '5.5% por factura — sin cobros trimestrales'
                  : '5.5% per invoice — no quarterly bills, no chasing payments'}
              </p>
            </div>
            {selected === 'stripe' && (
              <div className="w-5 h-5 rounded-full bg-[#0F6E56] flex items-center justify-center flex-shrink-0 mt-0.5">
                <Check size={12} className="text-white" />
              </div>
            )}
          </div>
        </button>

        {/* Square card */}
        <button
          onClick={() => setSelected('square')}
          className={`w-full rounded-2xl p-4 text-left transition-all border-2 ${
            selected === 'square'
              ? 'border-[#0F6E56] bg-[#E1F5EE]'
              : 'border-gray-200 bg-white'
          }`}
        >
          <div className="flex items-start gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
              selected === 'square' ? 'bg-[#0F6E56]' : 'bg-gray-100'
            }`}>
              <Store size={18} className={selected === 'square' ? 'text-white' : 'text-gray-500'} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[15px] font-bold text-gray-900">
                {es ? 'Ya tengo Square' : 'I already have Square'}
              </p>
              <p className="text-[13px] text-gray-500 mt-1">
                {es
                  ? 'Sigue usando Square para facturas'
                  : 'Keep using Square for invoices'}
              </p>
              <p className="text-[12px] text-gray-400 mt-1">
                {es
                  ? 'Cobros trimestrales como antes'
                  : 'Fees collected quarterly as before'}
              </p>
            </div>
            {selected === 'square' && (
              <div className="w-5 h-5 rounded-full bg-[#0F6E56] flex items-center justify-center flex-shrink-0 mt-0.5">
                <Check size={12} className="text-white" />
              </div>
            )}
          </div>
        </button>

        {/* Continue button */}
        <button
          onClick={handleContinue}
          disabled={loading}
          className="w-full bg-[#0F6E56] text-white font-bold text-[15px] py-4 rounded-2xl shadow-lg hover:bg-[#0B5A46] transition-colors disabled:opacity-60 flex items-center justify-center gap-2 mt-4"
        >
          {loading ? (
            <span className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
          ) : (
            <span>{es ? 'Continuar' : 'Continue'}</span>
          )}
        </button>

        {/* Skip link */}
        <button
          onClick={handleSkip}
          disabled={loading}
          className="w-full text-center text-gray-400 text-[13px] hover:text-gray-600 transition-colors py-2"
        >
          {es ? 'Omitir por ahora' : 'Skip for now'}
        </button>
      </div>
    </div>
  )
}
