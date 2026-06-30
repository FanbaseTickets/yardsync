'use client'

import { useEffect, useState } from 'react'

// Public page reached from the email cancel link (?c=clientId&t=token). Calls the
// token-verified cancel endpoint and shows the result. No auth — it's the client.
export default function CancelAutoPage() {
  const [state, setState] = useState('loading') // loading | ok | error
  const [es, setEs] = useState(false)

  useEffect(() => {
    try { setEs((navigator.language || '').toLowerCase().startsWith('es')) } catch {}
    let clientId, token
    try {
      const p = new URLSearchParams(window.location.search)
      clientId = p.get('c'); token = p.get('t')
    } catch {}
    if (!clientId || !token) { setState('error'); return }
    fetch('/api/auto-charge/cancel', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientId, token }),
    }).then(r => setState(r.ok ? 'ok' : 'error')).catch(() => setState('error'))
  }, [])

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8faf9', padding: 24, fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <div style={{ maxWidth: 420, textAlign: 'center' }}>
        <div style={{ fontSize: 44, marginBottom: 12 }}>{state === 'ok' ? '✅' : state === 'error' ? '⚠️' : '⏳'}</div>
        <h1 style={{ fontSize: 22, color: state === 'error' ? '#9a3412' : '#0B5A46', margin: '0 0 8px' }}>
          {state === 'loading' && (es ? 'Cancelando…' : 'Cancelling…')}
          {state === 'ok' && (es ? 'Cobro automático cancelado' : 'Auto-billing cancelled')}
          {state === 'error' && (es ? 'No se pudo cancelar' : "Couldn't cancel")}
        </h1>
        <p style={{ fontSize: 14, color: '#3F6F60', lineHeight: 1.5, margin: 0 }}>
          {state === 'ok' && (es
            ? 'No se te cobrará automáticamente. Si fue un error, contacta a tu proveedor de servicio.'
            : "You won't be charged automatically. If this was a mistake, contact your service provider.")}
          {state === 'error' && (es
            ? 'El enlace no es válido o ya venció. Responde CANCELAR al mensaje de texto, o contacta a tu proveedor de servicio.'
            : 'This link is invalid or expired. Reply CANCEL to the text message, or contact your service provider.')}
        </p>
      </div>
    </div>
  )
}
