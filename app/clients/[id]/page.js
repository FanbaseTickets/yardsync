'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import { useLang } from '@/context/LangContext'
import AppShell from '@/components/layout/AppShell'
import PageHeader from '@/components/layout/PageHeader'
import { Card, Badge, Button, Skeleton, Modal, Input, Select } from '@/components/ui'
import { getClient, updateClient, deleteClient, getClientInvoices, getServices, saveInvoice, getMostRecentSchedule } from '@/lib/db'
import { formatCents } from '@/lib/fee'
import { Phone, MapPin, Mail, CalendarDays, DollarSign, Pencil, FileText, CheckCircle2, RefreshCw } from 'lucide-react'
import PhoneInput from '@/components/ui/PhoneInput'
import toast from 'react-hot-toast'
import Link from 'next/link'


const RECURRENCE_LABELS_EN = {
  weekly:     'Every week',
  biweekly:   'Every 2 weeks',
  '3x_month': '3x per month',
  monthly:    'Once a month',
  quarterly:  'Once every 3 months',
  annual:     'Once a year',
  onetime:    'One-time only',
}

const RECURRENCE_LABELS_ES = {
  weekly:     'Cada semana',
  biweekly:   'Cada 2 semanas',
  '3x_month': '3 veces al mes',
  monthly:    'Una vez al mes',
  quarterly:  'Una vez cada 3 meses',
  annual:     'Una vez al año',
  onetime:    'Solo una vez',
}

export default function ClientDetailPage() {
  const { id }              = useParams()
  const router              = useRouter()
  const { user, profile }   = useAuth()
  const { translate, lang } = useLang()

  const STATUS_OPTIONS = [
    { value: 'active',    label: lang === 'es' ? 'Activo'    : 'Active'    },
    { value: 'paused',    label: lang === 'es' ? 'Pausado'   : 'Paused'   },
    { value: 'cancelled', label: lang === 'es' ? 'Cancelado' : 'Cancelled' },
  ]

  const BILLING_OPTIONS = [
    { value: 'upfront',   label: lang === 'es' ? 'Por adelantado (factura antes de la visita)' : 'Upfront (invoice before visit)'   },
    { value: 'postvisit', label: lang === 'es' ? 'Después de la visita (factura después)'      : 'Post-visit (invoice after visit)' },
  ]

  const RECURRENCE_LABELS = lang === 'es' ? RECURRENCE_LABELS_ES : RECURRENCE_LABELS_EN

  const [client,        setClient]        = useState(null)
  const [invoices,      setInvoices]      = useState([])
  const [services,      setServices]      = useState([])
  const [addonServices, setAddonServices] = useState([])
  const [loading,       setLoading]       = useState(true)
  const [showEdit,      setShowEdit]      = useState(false)
  const [showDelete,    setShowDelete]    = useState(false)
  const [showInvoice,   setShowInvoice]   = useState(false)
  const [jobMaterials,  setJobMaterials]  = useState([])
  const [form,          setForm]          = useState({})
  const [saving,        setSaving]        = useState(false)
  const [deleting,      setDeleting]      = useState(false)
  const [invoicing,     setInvoicing]     = useState(false)

  // Add-on state for invoice modal
  const [selectedAddons,  setSelectedAddons]  = useState([]) // fixed addons
  const [variableInputs,  setVariableInputs]  = useState({}) // {serviceId: dollarString}

  useEffect(() => {
    if (!id || !user) return
    loadData()
  }, [id, user])

  async function loadData() {
    if (!user) return
    setLoading(true)
    try {
      const [c, inv, svc] = await Promise.all([
        getClient(id),
        getClientInvoices(id),
        getServices(user.uid),
      ])
      setClient(c)
      setInvoices(inv)
      setServices(svc.filter(s => s.serviceType === 'base'))
      setAddonServices(svc.filter(s => s.serviceType === 'addon'))
      if (c) {
        setForm({
          name:        c.name        || '',
          phone:       c.phone       || '',
          email:       c.email       || '',
          address:     c.address     || '',
          serviceId:   c.serviceId   || '',
          billingMode: c.billingMode || 'upfront',
          language:    c.language    || 'en',
          status:      c.status      || 'active',
          notes:       c.notes       || '',
        })
      }
    } catch {
      toast.error(translate('common', 'error'))
    } finally {
      setLoading(false)
    }
  }

  function setField(key, val) {
    setForm(prev => ({ ...prev, [key]: val }))
  }

  const selectedService = services.find(s => s.id === form.serviceId)

  // Toggle fixed add-on
  function toggleAddon(service) {
    setSelectedAddons(prev => {
      const exists = prev.find(a => a.id === service.id)
      if (exists) return prev.filter(a => a.id !== service.id)
      return [...prev, { id: service.id, label: service.label, amountCents: service.priceCents }]
    })
  }

  // Build final addons including variable ones
  function buildFinalAddons() {
    const result = [...selectedAddons]
    addonServices
      .filter(s => s.pricingType === 'variable')
      .forEach(s => {
        const val = variableInputs[s.id]
        if (val && parseFloat(val) > 0) {
          result.push({
            id:          s.id,
            label:       s.label,
            amountCents: Math.round(parseFloat(val) * 100),
          })
        }
      })
    return result
  }

  // Calculate add-on subtotal for display
  function getAddonSubtotal() {
    const fixed = selectedAddons.reduce((s, a) => s + (a.amountCents || 0), 0)
    const variable = addonServices
      .filter(s => s.pricingType === 'variable')
      .reduce((s, svc) => {
        const val = variableInputs[svc.id]
        return s + (val && parseFloat(val) > 0 ? Math.round(parseFloat(val) * 100) : 0)
      }, 0)
    return fixed + variable
  }

  async function openInvoiceModal() {
    setSelectedAddons([])
    setVariableInputs({})
    setJobMaterials([])
    // Fetch materials from most recent scheduled job
    try {
      const recentJob = await getMostRecentSchedule(user.uid, id)
      if (recentJob?.materials?.length > 0) {
        setJobMaterials(recentJob.materials)
      }
    } catch {}
    setShowInvoice(true)
  }

  async function handleSave() {
    setSaving(true)
    try {
      const updateData = {
        name:        form.name        || client.name,
        phone:       form.phone       || client.phone,
        email:       form.email       || '',
        address:     form.address     || client.address,
        billingMode: form.billingMode,
        language:    form.language    || 'en',
        status:      form.status,
        notes:       form.notes       || '',
      }

      if (form.serviceId && form.serviceId !== client.serviceId) {
        const svc = services.find(s => s.id === form.serviceId)
        if (svc) {
          updateData.serviceId        = svc.id
          updateData.packageType      = svc.packageType   || 'monthly'
          updateData.basePriceCents   = svc.priceCents    || 6500
          updateData.packageLabel     = svc.label         || ''
          updateData.packageDesc      = svc.description   || ''
          updateData.packageIncludes  = svc.includes      || ''
          updateData.recurrence       = svc.recurrence    || 'biweekly'
          updateData.preferredDay     = svc.preferredDay  || ''
        }
      }

      await updateClient(id, updateData)
      toast.success(translate('client_detail', 'save_changes') + ' ✓')
      setShowEdit(false)
      loadData()
    } catch (err) {
      console.error(err)
      toast.error(translate('common', 'error'))
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    setDeleting(true)
    try {
      await deleteClient(id)
      toast.success(translate('common', 'remove') + ' ✓')
      router.replace('/clients')
    } catch {
      toast.error(translate('common', 'error'))
      setDeleting(false)
    }
  }

async function handleSendInvoice() {
  setInvoicing(true)
  try {
    const finalAddons = buildFinalAddons()
    // Build line items — base + addons + materials (no flat fees, 5.5% deducted from payout)
    const lineItems = [
      { label: client.packageLabel || 'Lawn Care Service', amountCents: baseCents, category: 'base' },
      ...finalAddons.map(a => ({ label: a.label, amountCents: a.amountCents, category: 'addon' })),
    ]
    const materialLineItems = jobMaterials.map(m => ({
      label: m.name, amountCents: m.totalCents || 0, category: 'material',
    }))
    const allLineItems = [...lineItems, ...materialLineItems]
    const grandTotal = invoiceTotal

    const res = await fetch('/api/stripe/invoice', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        stripeAccountId: profile?.stripeAccountId,
        totalCents: grandTotal,
        lineItems: allLineItems,
        clientName: client.name,
        clientEmail: client.email || '',
        clientPhone: client.phone || '',
        description: `YardSync invoice — ${client.name}`,
        gardenerUid: user.uid,
        clientId: id,
      }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Invoice failed')

    // Invoice doc is written server-side by /api/stripe/invoice

    // Send payment link via SMS to client
    if (client.phone && data.paymentUrl) {
      const smsBody = lang === 'es'
        ? `Hola ${client.name}! Tu factura de $${(grandTotal / 100).toFixed(2)} está lista. Paga aquí: ${data.paymentUrl}`
        : `Hi ${client.name}! Your invoice for $${(grandTotal / 100).toFixed(2)} is ready. Pay here: ${data.paymentUrl}`
      fetch('/api/twilio/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientPhone: client.phone,
          message: smsBody,
        }),
      }).catch(err => console.error('Invoice SMS failed (non-fatal):', err))
    }

    toast.success(lang === 'es' ? 'Factura enviada ✓' : 'Invoice sent!')
    setShowInvoice(false)
    loadData()
  } catch (err) {
    toast.error(err.message || translate('common', 'error'))
  } finally {
    setInvoicing(false)
  }
}
  if (loading) {
    return (
      <AppShell>
        <PageHeader title={translate('client_detail', 'edit')} back />
        <div className="px-4 py-4 space-y-3 max-w-lg mx-auto">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-20" />)}
        </div>
      </AppShell>
    )
  }

  if (!client) {
    return (
      <AppShell>
        <PageHeader title={lang === 'es' ? 'Cliente no encontrado' : 'Client not found'} back />
        <div className="px-4 py-8 text-center">
          <p className="text-gray-400">
            {lang === 'es' ? 'Este cliente ya no existe.' : 'This client no longer exists.'}
          </p>
        </div>
      </AppShell>
    )
  }

  const baseCents   = client.basePriceCents || 6500
  const isOnetime   = client.packageType === 'onetime'

  const recurrenceLabel = client.recurrence
    ? RECURRENCE_LABELS[client.recurrence] || client.recurrence
    : null

  const scheduleDisplay = recurrenceLabel
    ? recurrenceLabel + (client.preferredDay
        ? ` · ${client.preferredDay.charAt(0).toUpperCase() + client.preferredDay.slice(1)}s`
        : '')
    : null

  // Live invoice total preview — client pays base + addons + materials
  // YardSync 5.5% is deducted from contractor payout, not added to client total
  const addonSubtotal  = getAddonSubtotal()
  const jobMaterialsTotal = jobMaterials.reduce((s, m) => s + (m.totalCents || 0), 0)
  const invoiceTotal   = baseCents + addonSubtotal + jobMaterialsTotal

  return (
    <AppShell>
      <div className="page-content">
        <PageHeader
          title={client.name}
          subtitle={`${client.packageType} · ${client.status}`}
          back
          actions={
            <button
              onClick={() => setShowEdit(true)}
              className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors"
            >
              <Pencil size={16} className="text-gray-500" />
            </button>
          }
        />

        <div className="px-4 py-4 max-w-lg mx-auto space-y-4">

          {/* Profile card */}
          <Card>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-full bg-brand-100 flex items-center justify-center text-brand-700 font-semibold text-[15px] flex-shrink-0">
                {client.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0,2)}
              </div>
              <div>
                <p className="text-[16px] font-semibold text-gray-900">{client.name}</p>
                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                  <Badge label={translate('packages', client.packageType) || client.packageType} variant={client.packageType} />
                  <Badge label={translate('status', client.status) || client.status} variant={client.status} />
                </div>
              </div>
            </div>

            <div className="space-y-2.5 border-t border-gray-100 pt-3">
              <div className="flex items-center gap-2.5">
                <Phone size={14} className="text-gray-400 flex-shrink-0" />
                <p className="text-[13px] text-gray-700">{client.phone}</p>
              </div>
              {client.email && (
                <div className="flex items-center gap-2.5">
                  <Mail size={14} className="text-gray-400 flex-shrink-0" />
                  <p className="text-[13px] text-gray-700">{client.email}</p>
                </div>
              )}
              <a
                href={`https://maps.google.com/?q=${encodeURIComponent(client.address)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-start gap-2.5 group"
              >
                <MapPin size={14} className="text-brand-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-[13px] text-brand-600 group-hover:underline">{client.address}</p>
                  <p className="text-[10px] text-gray-400">{translate('calendar_extra', 'open_maps')}</p>
                </div>
              </a>
              {scheduleDisplay && !isOnetime && (
                <div className="flex items-center gap-2.5">
                  <CalendarDays size={14} className="text-gray-400 flex-shrink-0" />
                  <p className="text-[13px] text-gray-700">{scheduleDisplay}</p>
                </div>
              )}
              {client.packageLabel && (
                <div className="flex items-start gap-2.5">
                  <FileText size={14} className="text-gray-400 flex-shrink-0 mt-0.5" />
                  <p className="text-[13px] font-medium text-gray-700">{client.packageLabel}</p>
                </div>
              )}
              {client.packageDesc && (
                <div className="pl-5">
                  <p className="text-[12px] text-gray-500">{client.packageDesc}</p>
                </div>
              )}
              {client.packageIncludes && (
                <div className="pl-5 space-y-1">
                  {client.packageIncludes.split(',').map((item, i) => (
                    <div key={i} className="flex items-center gap-1.5">
                      <CheckCircle2 size={11} className="text-brand-500 flex-shrink-0" />
                      <p className="text-[12px] text-gray-500">{item.trim()}</p>
                    </div>
                  ))}
                </div>
              )}
              {client.notes && (
                <div className="flex items-start gap-2.5 pt-1 border-t border-gray-100">
                  <FileText size={14} className="text-gray-400 flex-shrink-0 mt-0.5" />
                  <p className="text-[13px] text-gray-500 italic">{client.notes}</p>
                </div>
              )}
            </div>
          </Card>

          {/* Billing card */}
          <Card>
            <p className="text-[11px] font-medium text-gray-400 uppercase tracking-wide mb-3">
              {translate('client_detail', 'billing')}
            </p>
            <div className="space-y-2">
              <div className="flex justify-between text-[13px]">
                <span className="text-gray-500">{translate('client_detail', 'base_price')}</span>
                <span className="font-medium text-gray-900">{formatCents(baseCents)}</span>
              </div>
              <div className="flex justify-between text-[13px]">
                <span className="text-gray-500">{lang === 'es' ? 'Tarifa YardSync' : 'YardSync fee'}</span>
                <span className="font-medium text-brand-600">{lang === 'es' ? '5.5% por factura' : '5.5% per invoice'}</span>
              </div>
              <div className="flex justify-between text-[13px] border-t border-gray-100 pt-2">
                <span className="font-medium text-gray-800">{translate('client_detail', 'client_pays')}</span>
                <span className="font-semibold text-gray-900">{formatCents(baseCents)}</span>
              </div>
            </div>

            <Button
              fullWidth
              className="mt-4"
              icon={isOnetime ? DollarSign : RefreshCw}
              onClick={openInvoiceModal}
            >
              {isOnetime
                ? translate('client_detail', 'send_invoice_one')
                : translate('client_detail', 'send_invoice')}
            </Button>

            {isOnetime && (
              <p className="text-[11px] text-center text-gray-400 mt-2">
                {lang === 'es'
                  ? 'Trabajo único — factura se envía una vez'
                  : 'One-time job — invoice sends once'}
              </p>
            )}
          </Card>

          {/* Invoice history */}
          <div>
            <p className="text-[11px] font-medium text-gray-400 uppercase tracking-wide mb-2">
              {translate('client_detail', 'invoice_history')}
            </p>
            {invoices.length === 0 ? (
              <Card className="text-center py-6">
                <FileText size={24} className="text-gray-300 mx-auto mb-2" />
                <p className="text-[13px] text-gray-400">{translate('client_detail', 'no_invoices')}</p>
              </Card>
            ) : (
              <div className="space-y-2">
                {invoices.map(inv => (
                  <Card key={inv.id} padding={false}>
                    <div className="p-3 flex items-center gap-3">
                      {inv.status === 'paid'
                        ? <CheckCircle2 size={16} className="text-green-600" />
                        : <FileText size={16} className="text-amber-400" />
                      }
                      <div className="flex-1">
                        <p className="text-[13px] font-medium text-gray-900">
                          {formatCents(inv.totalCents || 0)}
                        </p>
                        <p className="text-[11px] text-gray-400">
                          {inv.createdAt?.toDate?.().toLocaleDateString() || '—'}
                        </p>
                        {inv.stripePaymentUrl && inv.status === 'sent' && (
                          <a
                            href={inv.stripePaymentUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[11px] text-brand-600 hover:underline"
                          >
                            {lang === 'es' ? 'Link de pago ↗' : 'Payment link ↗'}
                          </a>
                        )}
                      </div>
                      <Badge
                        label={inv.status === 'paid' ? (lang === 'es' ? 'Pagado' : 'Paid') : inv.status === 'sent' ? (lang === 'es' ? 'Enviado' : 'Sent') : inv.status || 'sent'}
                        variant={inv.status === 'paid' ? 'active' : inv.status === 'sent' ? 'scheduled' : 'default'}
                      />
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>

          {/* Remove client */}
          <button
            onClick={() => setShowDelete(true)}
            className="w-full text-center text-[13px] text-red-400 hover:text-red-500 py-2 transition-colors"
          >
            {translate('client_detail', 'remove')}
          </button>

        </div>
      </div>

      {/* ── Invoice modal with add-ons ── */}
      <Modal
        open={showInvoice}
        onClose={() => setShowInvoice(false)}
        title={lang === 'es' ? `Factura — ${client.name}` : `Invoice — ${client.name}`}
        footer={
          <>
            <Button variant="secondary" fullWidth onClick={() => setShowInvoice(false)}>
              {translate('common', 'cancel')}
            </Button>
            <Button fullWidth loading={invoicing} onClick={handleSendInvoice}>
              {lang === 'es'
                ? `Enviar · ${formatCents(invoiceTotal)}`
                : `Send · ${formatCents(invoiceTotal)}`}
            </Button>
          </>
        }
      >
        <div className="space-y-4">

          {/* Base summary */}
          <div className="bg-gray-50 rounded-xl p-3 space-y-1.5">
            <p className="text-[11px] font-medium text-gray-500 uppercase tracking-wide mb-2">
              {lang === 'es' ? 'Resumen base' : 'Base summary'}
            </p>
            <div className="flex justify-between text-[13px]">
              <span className="text-gray-600">{client.packageLabel || client.packageType}</span>
              <span className="font-medium">{formatCents(baseCents)}</span>
            </div>
            <div className="flex justify-between text-[12px]">
              <span className="text-gray-400">{lang === 'es' ? 'Tarifa YardSync' : 'YardSync fee'}</span>
              <span className="text-brand-600">{lang === 'es' ? '5.5% deducido del pago' : '5.5% deducted from payout'}</span>
            </div>
          </div>

          {/* Add-on selector */}
          {addonServices.length > 0 && (
            <div>
              <p className="text-[13px] font-medium text-gray-700 mb-2">
                {lang === 'es' ? 'Servicios adicionales' : 'Add-on services'}
                <span className="text-[11px] text-gray-400 font-normal ml-1">
                  {lang === 'es' ? '(opcional)' : '(optional)'}
                </span>
              </p>
              <div className="space-y-2">
                {addonServices.map(service => {
                  const isFixed   = service.pricingType === 'fixed'
                  const isChecked = selectedAddons.find(a => a.id === service.id)
                  return (
                    <div key={service.id} className="bg-gray-50 rounded-xl p-3">
                      {isFixed ? (
                        <label className="flex items-center gap-3 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={!!isChecked}
                            onChange={() => toggleAddon(service)}
                            className="w-4 h-4 rounded accent-brand-600"
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-[13px] font-medium text-gray-800">{service.label}</p>
                            {service.description && (
                              <p className="text-[11px] text-gray-400">{service.description}</p>
                            )}
                          </div>
                          <div className="text-right flex-shrink-0">
                            <p className="text-[13px] font-semibold text-brand-600">
                              {formatCents(service.priceCents)}
                            </p>
                          </div>
                        </label>
                      ) : (
                        <div>
                          <div className="flex items-center justify-between mb-1.5">
                            <div>
                              <p className="text-[13px] font-medium text-gray-800">{service.label}</p>
                              {service.description && (
                                <p className="text-[11px] text-gray-400">{service.description}</p>
                              )}
                            </div>
                            <span className="text-[11px] text-gray-400 ml-2">
                              {lang === 'es' ? 'Cotizado' : 'Variable'}
                            </span>
                          </div>
                          <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                            <input
                              type="number"
                              placeholder="0.00"
                              value={variableInputs[service.id] || ''}
                              onChange={e => setVariableInputs(prev => ({ ...prev, [service.id]: e.target.value }))}
                              onWheel={e => e.target.blur()}
                              className="w-full pl-7 pr-3 py-2 rounded-lg border border-gray-200 text-[13px] focus:outline-none focus:ring-2 focus:ring-brand-500"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Live invoice total */}
          <div className="bg-brand-50 border border-brand-100 rounded-xl p-4 space-y-1.5">
            <p className="text-[11px] font-medium text-brand-700 uppercase tracking-wide mb-2">
              {lang === 'es' ? 'Total de factura' : 'Invoice total'}
            </p>
            {addonSubtotal > 0 && (
              <>
                <div className="flex justify-between text-[13px]">
                  <span className="text-brand-700">
                    {lang === 'es' ? 'Servicio base' : 'Base service'}
                  </span>
                  <span className="font-medium text-brand-900">{formatCents(baseCents)}</span>
                </div>
                <div className="flex justify-between text-[13px]">
                  <span className="text-brand-700">
                    {lang === 'es' ? 'Adicionales' : 'Add-ons'}
                  </span>
                  <span className="font-medium text-brand-900">{formatCents(addonSubtotal)}</span>
                </div>
              </>
            )}
            {jobMaterials.length > 0 && (
              <>
                <div className="flex justify-between text-[12px] pt-1">
                  <span className="text-amber-700 font-medium">{translate('materials', 'title')}</span>
                </div>
                {jobMaterials.map(m => (
                  <div key={m.id} className="flex justify-between text-[12px]">
                    <span className="text-amber-600">{m.name} ({m.qty} × {formatCents(m.unitCostCents)})</span>
                    <span className="text-amber-700">{formatCents(m.totalCents)}</span>
                  </div>
                ))}
                <div className="flex justify-between text-[12px]">
                  <span className="text-amber-700 font-medium">{translate('materials', 'subtotal')}</span>
                  <span className="text-amber-700 font-medium">{formatCents(jobMaterialsTotal)}</span>
                </div>
              </>
            )}
            <div className="flex justify-between text-[15px] border-t border-brand-200 pt-2 mt-1">
              <span className="font-bold text-brand-900">
                {lang === 'es' ? 'Cliente paga' : 'Client pays'}
              </span>
              <span className="font-bold text-brand-900">{formatCents(invoiceTotal)}</span>
            </div>
          </div>

        </div>
      </Modal>

      {/* ── Edit modal ── */}
      <Modal
        open={showEdit}
        onClose={() => setShowEdit(false)}
        title={translate('client_detail', 'edit')}
        footer={
          <>
            <Button variant="secondary" fullWidth onClick={() => setShowEdit(false)}>
              {translate('common', 'cancel')}
            </Button>
            <Button fullWidth loading={saving} onClick={handleSave}>
              {translate('client_detail', 'save_changes')}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input label={translate('clients', 'full_name')} value={form.name}    onChange={e => setField('name', e.target.value)}    />
          <PhoneInput
            label={translate('clients', 'phone')}
            value={form.phone}
            onChange={val => setField('phone', val)}
          />
          <Input label={translate('clients', 'email')}     value={form.email}   onChange={e => setField('email', e.target.value)}   type="email" />
          <Input label={translate('clients', 'address')}   value={form.address} onChange={e => setField('address', e.target.value)} />

          {services.length > 0 ? (
            <>
              <Select
                label={translate('client_detail', 'package')}
                value={form.serviceId}
                onChange={e => setField('serviceId', e.target.value)}
                hint={lang === 'es'
                  ? 'Cambiar el paquete actualiza el precio automáticamente'
                  : 'Changing the package updates pricing automatically'}
              >
                <option value="">{translate('client_detail', 'keep_current')}</option>
                {services.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.label} · {formatCents(s.priceCents || 0)}
                  </option>
                ))}
              </Select>

              {selectedService && selectedService.id !== client.serviceId && (
                <div className="bg-brand-50 border border-brand-100 rounded-xl p-3 space-y-1">
                  <p className="text-[11px] font-medium text-brand-700">
                    {lang === 'es' ? 'Vista previa del nuevo paquete:' : 'New package preview:'}
                  </p>
                  <div className="flex items-center gap-2">
                    <Badge label={translate('packages', selectedService.packageType) || selectedService.packageType} variant={selectedService.packageType} />
                    <p className="text-[12px] text-brand-800">{selectedService.label}</p>
                  </div>
                  {selectedService.description && (
                    <p className="text-[11px] text-brand-600">{selectedService.description}</p>
                  )}
                  <p className="text-[12px] font-semibold text-brand-800">
                    {translate('clients', 'client_pays')} {formatCents(
                      (selectedService.priceCents || 0) +
                      (PACKAGE_FEE_MAP[selectedService.packageType] || 1000)
                    )} / {selectedService.packageType}
                  </p>
                </div>
              )}
            </>
          ) : (
            <div className="bg-amber-50 border border-amber-100 rounded-xl p-3">
              <p className="text-[13px] text-amber-800 font-medium">{translate('clients', 'no_packages')}</p>
              <Link href="/services">
                <span className="text-[12px] text-amber-700 font-medium underline">
                  {translate('clients', 'go_to_services')}
                </span>
              </Link>
            </div>
          )}

          <Select
            label={lang === 'es' ? 'Idioma para SMS' : 'SMS Language'}
            value={form.language || 'en'}
            onChange={e => setField('language', e.target.value)}
          >
            <option value="en">English</option>
            <option value="es">Español</option>
          </Select>

          <Select
            label={translate('client_detail', 'billing_mode')}
            value={form.billingMode}
            onChange={e => setField('billingMode', e.target.value)}
          >
            {BILLING_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </Select>

          <Select
            label={translate('client_detail', 'status')}
            value={form.status}
            onChange={e => setField('status', e.target.value)}
          >
            {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </Select>

          <Input
            label={translate('client_detail', 'notes')}
            value={form.notes}
            onChange={e => setField('notes', e.target.value)}
            placeholder={translate('clients', 'notes_hint')}
          />
        </div>
      </Modal>

      {/* ── Delete confirm ── */}
      <Modal
        open={showDelete}
        onClose={() => setShowDelete(false)}
        title={lang === 'es' ? '¿Eliminar cliente?' : 'Remove client?'}
        footer={
          <>
            <Button variant="secondary" fullWidth onClick={() => setShowDelete(false)}>
              {translate('common', 'cancel')}
            </Button>
            <Button variant="danger" fullWidth loading={deleting} onClick={handleDelete}>
              {translate('common', 'remove')}
            </Button>
          </>
        }
      >
        <p className="text-[14px] text-gray-600">
          {translate('client_detail', 'remove_confirm')} <strong>{client.name}</strong>? {translate('client_detail', 'cannot_undo')}
        </p>
      </Modal>
    </AppShell>
  )
}