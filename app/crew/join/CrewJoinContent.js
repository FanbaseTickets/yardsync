'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import { useLang } from '@/context/LangContext'
import { Users, CheckCircle2, AlertCircle } from 'lucide-react'

export default function CrewJoinContent() {
  const { user, loading } = useAuth()
  const { lang } = useLang()
  const es = lang === 'es'
  const router = useRouter()

  const [token, setToken]   = useState(null)
  const [busy, setBusy]     = useState(false)
  const [joined, setJoined] = useState(false)
  const [bizName, setBizName] = useState('')
  const [error, setError]   = useState(null)

  // Read + stash the token (so a not-logged-in invitee can return after auth).
  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get('token')
    setToken(t)
    if (t) { try { sessionStorage.setItem('ys_crew_join_token', t) } catch {} }
  }, [])

  async function accept() {
    if (!token) return
    setBusy(true); setError(null)
    try {
      const idToken = await user.getIdToken()
      const res = await fetch('/api/crew/accept', {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
        body: JSON.stringify({ token }),
      })
      const data = await res.json()
      if (!res.ok) {
        const map = {
          bad_token: es ? 'Invitación no encontrada o vencida.' : 'Invite not found or expired.',
          used:      es ? 'Esta invitación ya fue usada.' : 'This invite was already used.',
          self:      es ? 'No puedes unirte a tu propio negocio.' : "You can't join your own business.",
        }
        setError(map[data.code] || data.error || (es ? 'No se pudo aceptar.' : 'Could not accept.'))
        setBusy(false); return
      }
      try { sessionStorage.removeItem('ys_crew_join_token') } catch {}
      setBizName(data.businessName || '')
      setJoined(true)
    } catch { setError(es ? 'Algo salió mal. Intenta de nuevo.' : 'Something went wrong. Try again.'); setBusy(false) }
  }

  const Shell = ({ children }) => (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <div className="bg-[#0F6E56] px-5 pt-10 pb-5">
        <div className="flex items-center gap-3 justify-center">
          <div className="w-9 h-9 rounded-xl bg-white/15 flex items-center justify-center">
            <img src="/logo-mark-white.png" alt="YardSync" className="w-[18px] h-[18px]" />
          </div>
          <span className="text-white text-lg font-semibold">YardSync</span>
        </div>
      </div>
      <div className="flex-1 px-5 py-10 flex items-start justify-center">
        <div className="w-full" style={{ maxWidth: 420 }}>{children}</div>
      </div>
    </div>
  )

  if (loading) {
    return <div className="min-h-screen bg-gray-50 flex items-center justify-center"><div className="w-8 h-8 rounded-full border-2 border-[#0F6E56] border-t-transparent animate-spin" /></div>
  }

  if (!token) {
    return (
      <Shell>
        <div className="bg-white rounded-2xl border border-gray-100 p-6 text-center">
          <AlertCircle size={28} className="text-amber-500 mx-auto mb-3" />
          <p className="text-sm text-gray-600">{es ? 'Enlace de invitación inválido.' : 'Invalid invite link.'}</p>
        </div>
      </Shell>
    )
  }

  if (joined) {
    return (
      <Shell>
        <div className="bg-white rounded-2xl border border-gray-100 p-6 text-center">
          <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4"><CheckCircle2 size={32} className="text-green-600" /></div>
          <h1 className="text-xl font-bold text-gray-900 mb-1">{es ? '¡Te uniste al equipo!' : "You're on the crew!"}</h1>
          <p className="text-sm text-gray-500 mb-5">{es ? `Ya puedes ver los trabajos asignados${bizName ? ` de ${bizName}` : ''} en tu calendario.` : `You can now see your assigned jobs${bizName ? ` for ${bizName}` : ''} on your calendar.`}</p>
          <button onClick={() => router.push('/calendar')} className="w-full bg-[#0F6E56] text-white font-bold text-[15px] py-4 rounded-2xl hover:bg-[#0B5A46] transition-colors">
            {es ? 'Ir al calendario' : 'Go to my calendar'}
          </button>
        </div>
      </Shell>
    )
  }

  // Not logged in → prompt to log in / sign up (token is stashed so they can
  // reopen this link after). Full lightweight worker-onboarding lands later.
  if (!user) {
    return (
      <Shell>
        <div className="bg-white rounded-2xl border border-gray-100 p-6 text-center">
          <div className="w-14 h-14 rounded-full bg-brand-50 flex items-center justify-center mx-auto mb-4"><Users size={26} className="text-brand-700" /></div>
          <h1 className="text-xl font-bold text-gray-900 mb-1">{es ? 'Te invitaron a un equipo' : "You've been invited to a crew"}</h1>
          <p className="text-sm text-gray-500 mb-5">{es ? 'Inicia sesión o crea una cuenta para aceptar y ver tus trabajos.' : 'Log in or create an account to accept and see your jobs.'}</p>
          <button onClick={() => router.push('/login')} className="w-full bg-[#0F6E56] text-white font-bold text-[15px] py-4 rounded-2xl hover:bg-[#0B5A46] transition-colors mb-2">
            {es ? 'Iniciar sesión' : 'Log in'}
          </button>
          <button onClick={() => router.push('/signup')} className="w-full bg-white text-[#0F6E56] border border-[#0F6E56] font-semibold text-[14px] py-3 rounded-2xl hover:bg-brand-50 transition-colors">
            {es ? 'Crear cuenta' : 'Create account'}
          </button>
        </div>
      </Shell>
    )
  }

  // Logged in → accept.
  return (
    <Shell>
      <div className="bg-white rounded-2xl border border-gray-100 p-6 text-center">
        <div className="w-14 h-14 rounded-full bg-brand-50 flex items-center justify-center mx-auto mb-4"><Users size={26} className="text-brand-700" /></div>
        <h1 className="text-xl font-bold text-gray-900 mb-1">{es ? 'Únete al equipo' : 'Join the crew'}</h1>
        <p className="text-sm text-gray-500 mb-5">{es ? 'Acepta para ver los trabajos que te asignen en tu calendario.' : "Accept to see the jobs you're assigned on your calendar."}</p>
        {error && <div className="flex items-center gap-2 justify-center mb-3 text-red-600"><AlertCircle size={14} /><p className="text-sm">{error}</p></div>}
        <button onClick={accept} disabled={busy} className="w-full bg-[#0F6E56] text-white font-bold text-[15px] py-4 rounded-2xl hover:bg-[#0B5A46] transition-colors disabled:opacity-60 flex items-center justify-center">
          {busy ? <span className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin" /> : (es ? 'Aceptar invitación' : 'Accept invitation')}
        </button>
      </div>
    </Shell>
  )
}
