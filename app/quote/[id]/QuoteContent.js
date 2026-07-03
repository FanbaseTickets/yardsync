'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { CheckCircle2, AlertCircle, XCircle, Clock } from 'lucide-react'

const money = (c) => `$${(Number(c || 0) / 100).toFixed(2)}`

// Module-scope so it keeps a stable identity across renders — defining it inside
// the component would remount the subtree each keystroke and drop input focus.
function Shell({ q, children }) {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <div className="bg-[#0F6E56] px-5 pt-10 pb-5">
        <div className="flex items-center gap-3 justify-center">
          {q?.logoUrl ? (
            <img src={q.logoUrl} alt={q.businessName} className="w-9 h-9 rounded-xl object-cover bg-white/15" />
          ) : (
            <div className="w-9 h-9 rounded-xl bg-white/15 flex items-center justify-center">
              <img src="/logo-mark-white.png" alt="YardSync" className="w-[18px] h-[18px]" />
            </div>
          )}
          <span className="text-white text-lg font-semibold">{q?.businessName || 'YardSync'}</span>
        </div>
      </div>
      <div className="flex-1 px-5 py-6" style={{ maxWidth: 480, margin: '0 auto', width: '100%' }}>
        {children}
      </div>
    </div>
  )
}

export default function QuoteContent() {
  const { id } = useParams()
  const [q, setQ] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // accept form
  const [sigName, setSigName] = useState('')
  const [agreed, setAgreed]   = useState(false)
  const [busy, setBusy]       = useState(false)
  const [actionErr, setActionErr] = useState(null)
  const [result, setResult]   = useState(null)   // 'accepted' | 'declined'
  const [declining, setDeclining] = useState(false)
  const [declineReason, setDeclineReason] = useState('')
  const [paying, setPaying] = useState(null)   // 'deposit' | 'full' | null

  const es = q?.language === 'es'

  // Map API error codes to localized client-facing messages (the accept/decline
  // routes return English `error` + a `code`; the client knows the language).
  function localizedErr(data, fb) {
    const code = data?.code
    if (code === 'no_name') return es ? 'Escribe tu nombre completo para firmar' : 'Please type your full name to sign'
    if (code === 'expired') return es ? 'Esta cotización venció — pide una nueva' : 'This quote has expired — ask for a new one'
    if (['accepted', 'declined', 'converted', 'viewed', 'sent', 'void'].includes(code)) {
      return es ? 'Esta cotización ya fue procesada' : 'This quote was already handled'
    }
    return es ? fb.es : fb.en
  }

  useEffect(() => {
    if (!id) return
    ;(async () => {
      try {
        const res = await fetch(`/api/quotes/${id}/public`)
        if (!res.ok) throw new Error('not found')
        setQ(await res.json())
      } catch { setError(true) } finally { setLoading(false) }
    })()
  }, [id])

  async function accept() {
    setBusy(true); setActionErr(null)
    try {
      const res = await fetch(`/api/quotes/${id}/accept`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ signatureName: sigName }),
      })
      const data = await res.json()
      if (!res.ok) { setActionErr(localizedErr(data, { es: 'No se pudo aceptar', en: 'Could not accept' })); setBusy(false); return }
      // Refresh so the accepted screen has current pay options (canCollect,
      // deposit, amountPaid).
      try { const r2 = await fetch(`/api/quotes/${id}/public`); if (r2.ok) setQ(await r2.json()) } catch {}
      setResult('accepted')
    } catch { setActionErr(es ? 'Algo salió mal. Intenta de nuevo.' : 'Something went wrong. Try again.'); setBusy(false) }
  }

  // Create the chosen charge (deposit or full/remaining) and redirect to /pay.
  async function payNow(mode) {
    setPaying(mode); setActionErr(null)
    try {
      const res = await fetch(`/api/quotes/${id}/pay`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode }),
      })
      const data = await res.json()
      if (!res.ok || !data.payUrl) { setActionErr(localizedErr(data, { es: 'No se pudo iniciar el pago', en: 'Could not start payment' })); setPaying(null); return }
      window.location.href = data.payUrl
    } catch { setActionErr(es ? 'Algo salió mal.' : 'Something went wrong.'); setPaying(null) }
  }

  async function decline() {
    setBusy(true); setActionErr(null)
    try {
      const res = await fetch(`/api/quotes/${id}/decline`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: declineReason }),
      })
      const data = await res.json()
      if (!res.ok) { setActionErr(localizedErr(data, { es: 'No se pudo rechazar', en: 'Could not decline' })); setBusy(false); return }
      setResult('declined')
    } catch { setActionErr(es ? 'Algo salió mal.' : 'Something went wrong.'); setBusy(false) }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-[#0F6E56] border-t-transparent animate-spin" />
      </div>
    )
  }
  if (error || !q) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center gap-3 px-6">
        <AlertCircle size={28} className="text-red-500" />
        <p className="text-sm text-gray-600 text-center">No encontramos esta cotización. · This quote could not be found.</p>
      </div>
    )
  }

  // Terminal / result states
  const showAccepted = result === 'accepted' || q.status === 'accepted' || q.status === 'converted'
  const showDeclined = result === 'declined' || q.status === 'declined'
  const showExpired  = q.status === 'expired' && !showAccepted && !showDeclined

  if (showAccepted) {
    const total     = q.totalCents || 0
    const paid      = q.amountPaidCents || 0
    const balance   = Math.max(0, total - paid)
    const depCents  = q.deposit?.depositCents || 0
    const hasDeposit = depCents >= 50
    const fullyPaid = total > 0 && paid >= total
    // Offer deposit only before anything is paid and when it's less than the
    // whole balance (a 100% deposit == paying in full).
    const showDeposit = q.canCollect && hasDeposit && !q.depositPaid && paid === 0 && depCents < balance
    const showFull    = q.canCollect && balance >= 50
    const fullLabel   = paid > 0
      ? (es ? `Pagar saldo ${money(balance)}` : `Pay balance ${money(balance)}`)
      : (es ? `Pagar total ${money(balance)}` : `Pay full ${money(balance)}`)

    return (
      <Shell q={q}>
        <div className="flex flex-col items-center gap-4 py-12 text-center">
          <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center"><CheckCircle2 size={32} className="text-green-600" /></div>
          <h2 className="text-xl font-bold text-gray-900">{es ? '¡Cotización aceptada!' : 'Quote accepted!'}</h2>
          <p className="text-lg font-semibold text-gray-700">{money(total)}</p>

          {fullyPaid ? (
            <p className="text-sm text-green-600 font-medium">{es ? '✓ Pagado en su totalidad. ¡Gracias!' : '✓ Paid in full. Thank you!'}</p>
          ) : (showDeposit || showFull) ? (
            <div className="w-full max-w-xs flex flex-col gap-2">
              {paid > 0 && (
                <p className="text-[13px] text-gray-500">{es ? `Pagado ${money(paid)} · saldo ${money(balance)}` : `Paid ${money(paid)} · balance ${money(balance)}`}</p>
              )}
              {actionErr && <div className="flex items-center gap-2 justify-center text-red-600"><AlertCircle size={14} /><p className="text-sm">{actionErr}</p></div>}
              {showDeposit && (
                <button onClick={() => payNow('deposit')} disabled={!!paying}
                  className="w-full bg-[#0F6E56] text-white font-bold text-[15px] py-4 rounded-2xl shadow-lg hover:bg-[#0B5A46] transition-colors disabled:opacity-60 flex items-center justify-center">
                  {paying === 'deposit' ? <span className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin" /> : (es ? `Pagar depósito ${money(depCents)}` : `Pay deposit ${money(depCents)}`)}
                </button>
              )}
              {showFull && (
                <button onClick={() => payNow('full')} disabled={!!paying}
                  className={`w-full font-bold text-[15px] py-4 rounded-2xl transition-colors disabled:opacity-60 flex items-center justify-center ${showDeposit ? 'bg-white text-[#0F6E56] border border-[#0F6E56]' : 'bg-[#0F6E56] text-white shadow-lg hover:bg-[#0B5A46]'}`}>
                  {paying === 'full' ? <span className={`w-5 h-5 border-2 rounded-full animate-spin ${showDeposit ? 'border-[#0F6E56]/30 border-t-[#0F6E56]' : 'border-white/40 border-t-white'}`} /> : fullLabel}
                </button>
              )}
            </div>
          ) : (
            <p className="text-sm text-gray-500">{es ? `${q.businessName} fue notificado y se pondrá en contacto contigo.` : `${q.businessName} has been notified and will be in touch.`}</p>
          )}
        </div>
      </Shell>
    )
  }
  if (showDeclined) {
    return (
      <Shell q={q}>
        <div className="flex flex-col items-center gap-4 py-12 text-center">
          <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center"><XCircle size={32} className="text-gray-400" /></div>
          <h2 className="text-xl font-bold text-gray-900">{es ? 'Cotización rechazada' : 'Quote declined'}</h2>
          <p className="text-sm text-gray-500">{es ? 'Gracias por avisarnos.' : 'Thanks for letting us know.'}</p>
        </div>
      </Shell>
    )
  }
  if (showExpired) {
    return (
      <Shell q={q}>
        <div className="flex flex-col items-center gap-4 py-12 text-center">
          <div className="w-16 h-16 rounded-full bg-amber-100 flex items-center justify-center"><Clock size={32} className="text-amber-500" /></div>
          <h2 className="text-xl font-bold text-gray-900">{es ? 'Cotización vencida' : 'Quote expired'}</h2>
          <p className="text-sm text-gray-500">{es ? `Pídele a ${q.businessName} una nueva.` : `Ask ${q.businessName} for a new one.`}</p>
        </div>
      </Shell>
    )
  }

  const validLabel = q.validUntil
    ? new Date(q.validUntil).toLocaleDateString(es ? 'es-US' : 'en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : null

  return (
    <Shell q={q}>
      <p className="text-xs uppercase tracking-wide text-gray-400 mb-1">{es ? 'Cotización' : 'Quote'}</p>
      <h1 className="text-lg font-bold text-gray-900 mb-1">{q.title}</h1>
      {q.recipientName && <p className="text-sm text-gray-500 mb-4">{es ? 'Para' : 'For'} {q.recipientName}</p>}

      <div className="bg-white rounded-2xl border border-gray-100 p-4 mb-4">
        {q.lineItems.map((it, i) => (
          <div key={i} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
            <span className="text-sm text-gray-700">{it.label}</span>
            <span className="text-sm font-medium text-gray-900">{money(it.amountCents)}</span>
          </div>
        ))}
        <div className="flex items-center justify-between pt-3 mt-1 border-t border-gray-100">
          <span className="text-base font-bold text-gray-900">{es ? 'Total' : 'Total'}</span>
          <span className="text-base font-bold text-gray-900">{money(q.totalCents)}</span>
        </div>
        <p className="text-[11px] text-gray-400 text-right mt-1">{es ? 'Tarifas incluidas' : 'Fees included'}</p>
      </div>

      {validLabel && <p className="text-xs text-gray-400 mb-3">{es ? 'Válida hasta' : 'Valid until'} {validLabel}</p>}

      {q.deposit?.depositCents >= 50 && (
        <div className="flex items-center justify-between bg-brand-50 border border-brand-100 rounded-xl px-4 py-3 mb-4">
          <span className="text-[13px] text-brand-800">
            {es ? 'Depósito al aceptar' : 'Deposit on acceptance'}
            {q.deposit.required ? (es ? ' (requerido)' : ' (required)') : (es ? ' (opcional)' : ' (optional)')}
          </span>
          <span className="text-[15px] font-bold text-brand-800">{money(q.deposit.depositCents)}</span>
        </div>
      )}

      {!declining ? (
        <>
          <div className="bg-white rounded-2xl border border-gray-100 p-4 mb-3">
            <label className="block text-[12px] font-medium text-gray-600 mb-1">{es ? 'Tu nombre completo (firma)' : 'Your full name (signature)'}</label>
            <input
              value={sigName}
              onChange={(e) => setSigName(e.target.value)}
              placeholder={es ? 'Escribe tu nombre' : 'Type your name'}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-[15px] mb-3 focus:outline-none focus:ring-2 focus:ring-[#0F6E56]/30"
            />
            <label className="flex items-start gap-2.5 cursor-pointer">
              <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} className="mt-0.5 w-4 h-4 accent-[#0F6E56]" />
              <span className="text-[12px] text-gray-600 leading-relaxed">
                {es
                  ? <>Acepto esta cotización y los términos de servicio de <strong>{q.businessName}</strong>, y los <a href="/terms" target="_blank" rel="noreferrer" className="underline">Términos</a> y la <a href="/privacy" target="_blank" rel="noreferrer" className="underline">Política de Privacidad</a> de YardSync. Mi nombre escrito es mi firma electrónica.</>
                  : <>I accept this quote and the service terms of <strong>{q.businessName}</strong>, and YardSync's <a href="/terms" target="_blank" rel="noreferrer" className="underline">Terms</a> and <a href="/privacy" target="_blank" rel="noreferrer" className="underline">Privacy Policy</a>. My typed name is my electronic signature.</>}
              </span>
            </label>
          </div>

          {actionErr && <div className="flex items-center gap-2 mb-3 text-red-600"><AlertCircle size={14} /><p className="text-sm">{actionErr}</p></div>}

          <button
            onClick={accept}
            disabled={busy || !agreed || sigName.trim().length < 2}
            className="w-full bg-[#0F6E56] text-white font-bold text-[15px] py-4 rounded-2xl shadow-lg hover:bg-[#0B5A46] transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {busy ? <span className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin" /> : (es ? 'Aceptar cotización' : 'Accept quote')}
          </button>
          <button onClick={() => setDeclining(true)} disabled={busy} className="w-full text-gray-400 text-[13px] py-3 mt-1 hover:text-gray-600">
            {es ? 'Rechazar' : 'Decline'}
          </button>
        </>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 p-4">
          <p className="text-sm font-medium text-gray-700 mb-2">{es ? '¿Rechazar esta cotización?' : 'Decline this quote?'}</p>
          <textarea
            value={declineReason}
            onChange={(e) => setDeclineReason(e.target.value)}
            placeholder={es ? 'Motivo (opcional)' : 'Reason (optional)'}
            rows={2}
            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-[14px] mb-3 focus:outline-none focus:ring-2 focus:ring-[#0F6E56]/30"
          />
          {actionErr && <div className="flex items-center gap-2 mb-3 text-red-600"><AlertCircle size={14} /><p className="text-sm">{actionErr}</p></div>}
          <div className="flex gap-2">
            <button onClick={() => setDeclining(false)} disabled={busy} className="flex-1 border border-gray-200 text-gray-600 font-semibold text-[14px] py-3 rounded-xl">{es ? 'Cancelar' : 'Back'}</button>
            <button onClick={decline} disabled={busy} className="flex-1 bg-gray-800 text-white font-semibold text-[14px] py-3 rounded-xl disabled:opacity-60">{es ? 'Rechazar' : 'Decline'}</button>
          </div>
        </div>
      )}

      <p className="text-[11px] text-gray-400 text-center mt-4">{es ? 'Cotización segura vía YardSync' : 'Secure quote via YardSync'}</p>
    </Shell>
  )
}
