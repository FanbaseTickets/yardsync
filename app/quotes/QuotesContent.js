'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect } from 'react'
import { useAuth } from '@/context/AuthContext'
import { useLang } from '@/context/LangContext'
import AppShell from '@/components/layout/AppShell'
import PageHeader from '@/components/layout/PageHeader'
import { Button, Input, Select, Modal, EmptyState, Skeleton } from '@/components/ui'
import { getClients, getServices } from '@/lib/db'
import { formatCents, grossUpForFees } from '@/lib/fee'
import { FileText, Plus, Trash2, Copy, ExternalLink, CalendarDays } from 'lucide-react'
import toast from 'react-hot-toast'

// Status → pill colors + bilingual labels.
const STATUS = {
  sent:      { en: 'Sent',      es: 'Enviada',   cls: 'bg-blue-50 text-blue-700' },
  viewed:    { en: 'Viewed',    es: 'Vista',     cls: 'bg-indigo-50 text-indigo-700' },
  accepted:  { en: 'Accepted',  es: 'Aceptada',  cls: 'bg-green-50 text-green-700' },
  converted: { en: 'Converted', es: 'Convertida',cls: 'bg-green-50 text-green-700' },
  declined:  { en: 'Declined',  es: 'Rechazada', cls: 'bg-gray-100 text-gray-500' },
  expired:   { en: 'Expired',   es: 'Vencida',   cls: 'bg-amber-50 text-amber-700' },
  void:      { en: 'Void',      es: 'Anulada',   cls: 'bg-gray-100 text-gray-400' },
}

const EMPTY_LINE = () => ({ label: '', price: '' })

export default function QuotesContent() {
  const { user, profile } = useAuth()
  const { lang } = useLang()
  const es = lang === 'es'

  const [quotes, setQuotes]     = useState([])
  const [clients, setClients]   = useState([])
  const [services, setServices] = useState([])
  const [loading, setLoading]   = useState(true)
  const [showBuilder, setShowBuilder] = useState(false)
  const [sending, setSending]   = useState(false)

  // builder form
  const [mode, setMode]         = useState('client')   // 'client' | 'prospect'
  const [clientId, setClientId] = useState('')
  const [prospect, setProspect] = useState({ name: '', phone: '', email: '', language: 'en' })
  const [title, setTitle]       = useState('')
  const [lines, setLines]       = useState([EMPTY_LINE()])
  const [coverFees, setCoverFees] = useState(false)
  const [validDays, setValidDays] = useState(30)
  const [channels, setChannels] = useState('both')
  const [depositType, setDepositType] = useState('none')     // 'none' | 'amount' | 'percent'
  const [depositValue, setDepositValue] = useState('')
  const [depositRequired, setDepositRequired] = useState(false)

  useEffect(() => { if (user) loadAll() }, [user])
  useEffect(() => { setCoverFees(profile?.coverFees === true) }, [profile?.coverFees])

  // Deep-link entry from a client/lead ("Send a quote" button →
  // /quotes?clientId=X): open the builder prefilled to that client. Uses
  // window.location.search (not useSearchParams) to avoid the Suspense gate.
  // Runs once clients are loaded so the select has the option to select.
  useEffect(() => {
    if (loading || clients.length === 0) return
    const cid = new URLSearchParams(window.location.search).get('clientId')
    if (cid && clients.some(c => c.id === cid)) {
      resetBuilder()
      setMode('client')
      setClientId(cid)
      setShowBuilder(true)
      // Strip the param so a refresh / re-render doesn't reopen it.
      window.history.replaceState(null, '', '/quotes')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, clients])

  async function loadAll() {
    setLoading(true)
    try {
      const [c, s] = await Promise.all([getClients(user.uid), getServices(user.uid)])
      setClients(c)
      setServices(s.filter(sv => sv.serviceType === 'base'))
      const idToken = await user.getIdToken()
      const res = await fetch('/api/quotes', { headers: { Authorization: `Bearer ${idToken}` } })
      if (res.ok) { const d = await res.json(); setQuotes(d.quotes || []) }
    } catch { toast.error(es ? 'No se pudieron cargar las cotizaciones' : 'Could not load quotes') }
    finally { setLoading(false) }
  }

  function resetBuilder() {
    setMode('client'); setClientId(''); setProspect({ name: '', phone: '', email: '', language: 'en' })
    setTitle(''); setLines([EMPTY_LINE()]); setValidDays(30); setChannels('both')
    setDepositType('none'); setDepositValue(''); setDepositRequired(false)
    setCoverFees(profile?.coverFees === true)
  }

  // Preview the resolved deposit in cents (mirrors the server clamp).
  function depositPreviewCents() {
    const total = coverFees ? grossUpForFees(subtotalCents) : subtotalCents
    const v = parseFloat(depositValue)
    if (depositType === 'none' || !Number.isFinite(v) || v <= 0 || total < 50) return 0
    const c = depositType === 'percent' ? Math.round(total * Math.min(v, 100) / 100) : Math.round(v * 100)
    return Math.max(50, Math.min(c, total))
  }

  function setLine(i, key, val) { setLines(prev => prev.map((l, idx) => idx === i ? { ...l, [key]: val } : l)) }
  function addLine() { setLines(prev => [...prev, EMPTY_LINE()]) }
  function removeLine(i) { setLines(prev => prev.length > 1 ? prev.filter((_, idx) => idx !== i) : prev) }
  function addFromPackage(serviceId) {
    const svc = services.find(s => s.id === serviceId)
    if (!svc) return
    const label = svc.name || svc.label || (es ? 'Servicio' : 'Service')
    const price = ((svc.priceCents || 0) / 100).toFixed(2)
    setLines(prev => {
      const next = [...prev]
      const blank = next.findIndex(l => !l.label && !l.price)
      if (blank >= 0) next[blank] = { label, price }
      else next.push({ label, price })
      return next
    })
  }

  const lineItems = lines
    .map(l => ({ label: l.label.trim(), category: 'service', amountCents: Math.round(parseFloat(l.price) * 100) }))
    .filter(l => l.label && Number.isFinite(l.amountCents) && l.amountCents > 0)
  const subtotalCents = lineItems.reduce((s, l) => s + l.amountCents, 0)

  const recipientValid = mode === 'client'
    ? !!clientId
    : !!(prospect.name.trim() && (prospect.phone.trim() || prospect.email.trim()))
  const canSend = recipientValid && lineItems.length > 0 && !sending

  async function send() {
    if (!canSend) return
    setSending(true)
    try {
      const idToken = await user.getIdToken()
      const body = {
        gardenerUid: user.uid,
        clientId: mode === 'client' ? clientId : null,
        prospect: mode === 'prospect' ? prospect : null,
        title: title.trim(),
        lineItems,
        coverFees,
        validUntilDays: Number(validDays) || 30,
        channels,
        depositType,
        depositValue: parseFloat(depositValue) || 0,
        depositRequired,
        contractorName:  profile?.businessName || profile?.displayName || user?.displayName || '',
        contractorEmail: user?.email || '',
        lang,
      }
      const res = await fetch('/api/quotes', {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error || (es ? 'No se pudo enviar' : 'Could not send')); setSending(false); return }
      try { await navigator.clipboard.writeText(data.quoteUrl) } catch {}
      toast.success(es ? 'Cotización enviada · enlace copiado' : 'Quote sent · link copied')
      setShowBuilder(false); resetBuilder(); loadAll()
    } catch { toast.error(es ? 'Algo salió mal' : 'Something went wrong') }
    finally { setSending(false) }
  }

  function copyLink(q) {
    const url = `${window.location.origin}/quote/${q.id}`
    navigator.clipboard.writeText(url).then(
      () => toast.success(es ? 'Enlace copiado' : 'Link copied'),
      () => toast.error(es ? 'No se pudo copiar' : 'Could not copy')
    )
  }

  return (
    <AppShell>
      <div className="page-content">
        <PageHeader
          title={es ? 'Cotizaciones' : 'Quotes'}
          subtitle={es ? 'Envía cotizaciones que los clientes firman' : 'Send quotes clients can e-sign'}
          actions={<Button icon={Plus} size="sm" onClick={() => { resetBuilder(); setShowBuilder(true) }}>{es ? 'Nueva' : 'New'}</Button>}
        />

        <div className="px-4 py-4 max-w-lg mx-auto space-y-3">
          {loading ? (
            <>{[0, 1, 2].map(i => <Skeleton key={i} className="h-20 rounded-2xl" />)}</>
          ) : quotes.length === 0 ? (
            <EmptyState
              icon={FileText}
              title={es ? 'Aún no hay cotizaciones' : 'No quotes yet'}
              description={es ? 'Crea una cotización para que un cliente la revise y la firme.' : 'Create a quote for a client to review and e-sign.'}
              action={<Button icon={Plus} onClick={() => { resetBuilder(); setShowBuilder(true) }}>{es ? 'Nueva cotización' : 'New quote'}</Button>}
            />
          ) : (
            quotes.map(q => {
              const st = STATUS[q.status] || STATUS.sent
              return (
                <div key={q.id} className="bg-white rounded-2xl border border-gray-100 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[15px] font-semibold text-gray-900 truncate">{q.recipientName || (es ? 'Cliente' : 'Client')}</p>
                      <p className="text-[13px] text-gray-500 truncate">{q.title}</p>
                    </div>
                    <span className={`flex-shrink-0 text-[11px] font-medium px-2 py-1 rounded-full ${st.cls}`}>{es ? st.es : st.en}</span>
                  </div>
                  <div className="flex items-center justify-between mt-3">
                    <span className="text-[17px] font-bold text-gray-900">{formatCents(q.totalCents)}</span>
                    <div className="flex items-center gap-1">
                      <button onClick={() => copyLink(q)} className="inline-flex items-center gap-1 text-[12px] text-gray-500 hover:text-gray-800 px-2 py-1.5 rounded-lg hover:bg-gray-50">
                        <Copy size={13} /> {es ? 'Copiar' : 'Copy'}
                      </button>
                      <a href={`/quote/${q.id}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[12px] text-gray-500 hover:text-gray-800 px-2 py-1.5 rounded-lg hover:bg-gray-50">
                        <ExternalLink size={13} /> {es ? 'Ver' : 'View'}
                      </a>
                    </div>
                  </div>
                  {(q.deposit?.depositCents >= 50 || (q.status === 'converted' && q.convertedClientId)) && (
                    <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-50">
                      <span className="text-[12px] text-gray-500">
                        {q.deposit?.depositCents >= 50
                          ? (q.depositPaid
                              ? `${es ? 'Depósito pagado' : 'Deposit paid'} ${formatCents(q.deposit.depositCents)}`
                              : `${es ? 'Depósito' : 'Deposit'} ${formatCents(q.deposit.depositCents)}${es ? ' · pendiente' : ' · pending'}`)
                          : (es ? 'Convertido en cliente' : 'Converted to client')}
                      </span>
                      {q.status === 'converted' && q.convertedClientId && (
                        <a href={`/calendar?client=${q.convertedClientId}`} className="inline-flex items-center gap-1 text-[12px] font-medium text-brand-700 hover:text-brand-800 px-2 py-1 rounded-lg hover:bg-brand-50">
                          <CalendarDays size={13} /> {es ? 'Programar' : 'Schedule'}
                        </a>
                      )}
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>
      </div>

      <Modal
        open={showBuilder}
        onClose={() => !sending && setShowBuilder(false)}
        title={es ? 'Nueva cotización' : 'New quote'}
        footer={
          <div className="flex gap-2">
            <Button variant="secondary" fullWidth onClick={() => setShowBuilder(false)} disabled={sending}>{es ? 'Cancelar' : 'Cancel'}</Button>
            <Button fullWidth onClick={send} loading={sending} disabled={!canSend}>
              {es ? 'Enviar' : 'Send'}{subtotalCents > 0 ? ` · ${formatCents(coverFees ? grossUpForFees(subtotalCents) : subtotalCents)}` : ''}
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          {/* Recipient */}
          <div className="flex gap-2">
            {['client', 'prospect'].map(m => (
              <button key={m} onClick={() => setMode(m)}
                className={`flex-1 text-[13px] font-medium py-2 rounded-xl border transition-colors ${mode === m ? 'bg-brand-600 text-white border-brand-600' : 'bg-white text-gray-600 border-gray-200'}`}>
                {m === 'client' ? (es ? 'Cliente existente' : 'Existing client') : (es ? 'Nuevo prospecto' : 'New prospect')}
              </button>
            ))}
          </div>

          {mode === 'client' ? (
            <Select label={es ? 'Cliente' : 'Client'} value={clientId} onChange={e => setClientId(e.target.value)}>
              <option value="">{es ? 'Elige un cliente…' : 'Choose a client…'}</option>
              {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
          ) : (
            <div className="space-y-2">
              <Input label={es ? 'Nombre' : 'Name'} value={prospect.name} onChange={e => setProspect(p => ({ ...p, name: e.target.value }))} placeholder={es ? 'Nombre del prospecto' : 'Prospect name'} />
              <div className="grid grid-cols-2 gap-2">
                <Input label={es ? 'Teléfono' : 'Phone'} value={prospect.phone} onChange={e => setProspect(p => ({ ...p, phone: e.target.value }))} placeholder="(210) 555-0100" />
                <Input label="Email" value={prospect.email} onChange={e => setProspect(p => ({ ...p, email: e.target.value }))} placeholder="name@email.com" />
              </div>
              <Select label={es ? 'Idioma del cliente' : 'Client language'} value={prospect.language} onChange={e => setProspect(p => ({ ...p, language: e.target.value }))}>
                <option value="en">English</option>
                <option value="es">Español</option>
              </Select>
            </div>
          )}

          <Input label={es ? 'Título (opcional)' : 'Title (optional)'} value={title} onChange={e => setTitle(e.target.value)} placeholder={es ? 'p. ej. Limpieza de primavera' : 'e.g. Spring cleanup'} />

          {/* Line items */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[13px] font-medium text-gray-700">{es ? 'Conceptos' : 'Line items'}</label>
              {services.length > 0 && (
                <select onChange={e => { if (e.target.value) { addFromPackage(e.target.value); e.target.value = '' } }} defaultValue=""
                  className="text-[12px] text-brand-700 bg-brand-50 rounded-lg px-2 py-1 border-0 focus:outline-none">
                  <option value="">{es ? '+ Desde paquete' : '+ From package'}</option>
                  {services.map(s => <option key={s.id} value={s.id}>{s.name || s.label}</option>)}
                </select>
              )}
            </div>
            <div className="space-y-2">
              {lines.map((l, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Input containerClassName="flex-1" value={l.label} onChange={e => setLine(i, 'label', e.target.value)} placeholder={es ? 'Descripción' : 'Description'} />
                  <Input containerClassName="w-24" type="number" inputMode="decimal" min="0" prefix="$" value={l.price} onChange={e => setLine(i, 'price', e.target.value)} placeholder="0.00" />
                  <button onClick={() => removeLine(i)} className="text-gray-300 hover:text-red-500 p-1" aria-label="remove"><Trash2 size={16} /></button>
                </div>
              ))}
            </div>
            <button onClick={addLine} className="mt-2 text-[13px] text-brand-700 font-medium inline-flex items-center gap-1">
              <Plus size={14} /> {es ? 'Agregar concepto' : 'Add line item'}
            </button>
          </div>

          {/* Fee toggle + validity + channels */}
          <label className="flex items-start gap-2.5 cursor-pointer">
            <input type="checkbox" checked={coverFees} onChange={e => setCoverFees(e.target.checked)} className="mt-0.5 w-4 h-4 accent-[#0F6E56]" />
            <span className="text-[12.5px] text-gray-600 leading-relaxed">
              {es ? 'Incluir la tarifa en el precio (el cliente ve un total inclusivo).' : 'Build the fee into the price (client sees one inclusive total).'}
            </span>
          </label>
          {/* Deposit — collected instantly when the client accepts */}
          <div>
            <label className="text-[13px] font-medium text-gray-700">{es ? 'Depósito (opcional)' : 'Deposit (optional)'}</label>
            <div className="grid grid-cols-2 gap-2 mt-1">
              <Select value={depositType} onChange={e => setDepositType(e.target.value)}>
                <option value="none">{es ? 'Sin depósito' : 'No deposit'}</option>
                <option value="amount">{es ? 'Monto fijo $' : 'Fixed $ amount'}</option>
                <option value="percent">{es ? '% del total' : '% of total'}</option>
              </Select>
              {depositType !== 'none' && (
                <Input
                  type="number" inputMode="decimal" min="0"
                  prefix={depositType === 'amount' ? '$' : undefined}
                  suffix={depositType === 'percent' ? '%' : undefined}
                  value={depositValue} onChange={e => setDepositValue(e.target.value)}
                  placeholder={depositType === 'percent' ? '20' : '50.00'}
                />
              )}
            </div>
            {depositType !== 'none' && (
              <label className="flex items-center gap-2 mt-2 cursor-pointer">
                <input type="checkbox" checked={depositRequired} onChange={e => setDepositRequired(e.target.checked)} className="w-4 h-4 accent-[#0F6E56]" />
                <span className="text-[12.5px] text-gray-600">{es ? 'Requerir el depósito para aceptar' : 'Require the deposit to accept'}</span>
              </label>
            )}
            {depositPreviewCents() > 0 && (
              <p className="text-[11px] text-gray-400 mt-1">{es ? 'Se cobra al aceptar' : 'Charged instantly on acceptance'} · {formatCents(depositPreviewCents())}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Input label={es ? 'Válida por (días)' : 'Valid for (days)'} type="number" min="1" max="365" value={validDays} onChange={e => setValidDays(e.target.value)} />
            <Select label={es ? 'Enviar por' : 'Send via'} value={channels} onChange={e => setChannels(e.target.value)}>
              <option value="both">{es ? 'SMS y Email' : 'SMS & Email'}</option>
              <option value="sms">SMS</option>
              <option value="email">Email</option>
            </Select>
          </div>
        </div>
      </Modal>
    </AppShell>
  )
}
