'use client'

import { useEffect, useState } from 'react'

// Public return page after a client saves their card for auto-billing (Stripe
// Checkout mode:'setup' success/cancel URL). No auth — it's the client's device.
export default function CardSavedPage() {
  const [ok, setOk] = useState(true)
  const [es, setEs] = useState(false)

  useEffect(() => {
    try {
      const p = new URLSearchParams(window.location.search)
      setOk(p.get('ok') !== '0')
      setEs((navigator.language || '').toLowerCase().startsWith('es'))
    } catch {}
  }, [])

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8faf9', padding: 24, fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <div style={{ maxWidth: 420, textAlign: 'center' }}>
        <div style={{ fontSize: 44, marginBottom: 12 }}>{ok ? '✅' : '↩️'}</div>
        <h1 style={{ fontSize: 22, color: '#0B5A46', margin: '0 0 8px' }}>
          {ok
            ? (es ? '¡Tarjeta guardada!' : 'Card saved!')
            : (es ? 'No se guardó la tarjeta' : 'Card not saved')}
        </h1>
        <p style={{ fontSize: 14, color: '#3F6F60', lineHeight: 1.5, margin: 0 }}>
          {ok
            ? (es
              ? 'Tu servicio recurrente se cobrará automáticamente. Te avisaremos antes de cada cobro y puedes cancelar en cualquier momento respondiendo al mensaje.'
              : "Your recurring service will be charged automatically. We'll remind you before each charge, and you can cancel anytime by replying to the message.")
            : (es
              ? 'No se guardó ninguna tarjeta. Puedes cerrar esta página.'
              : 'No card was saved. You can close this page.')}
        </p>
      </div>
    </div>
  )
}
