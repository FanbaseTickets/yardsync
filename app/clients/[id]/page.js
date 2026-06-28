'use client'

import { useState, useEffect, useRef } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import { useLang } from '@/context/LangContext'
import AppShell from '@/components/layout/AppShell'
import PageHeader from '@/components/layout/PageHeader'
import { Card, Badge, Button, Skeleton, Modal, Input, Select } from '@/components/ui'
import { getClient, updateClient, deleteClient, getClientInvoices, getServices, saveInvoice, getMostRecentSchedule } from '@/lib/db'
import { formatCents, grossUpForFees, calcApplicationFee, isFeeCapped } from '@/lib/fee'
import { badgePackageType } from '@/lib/clientBadge'
import { buildInvoiceSms } from '@/lib/invoiceSms'
import { validatePhone } from '@/lib/phone'
import { Phone, MapPin, Mail, CalendarDays, DollarSign, Pencil, FileText, CheckCircle2, RefreshCw, Clock, ShieldAlert, Sparkles, X } from 'lucide-react'
import PhoneInput from '@/components/ui/PhoneInput'
import AiReminderDrafter from '@/components/AiReminderDrafter'
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
  const searchParams        = useSearchParams()
  const { user, profile, refreshProfile } = useAuth()
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
  const [viewInvoice,   setViewInvoice]   = useState(null)
  const [refunding,     setRefunding]     = useState(false)
  const [refundConfirm, setRefundConfirm] = useState(false)
  const [respondingDispute, setRespondingDispute] = useState(false)
  const [duplicateWarn, setDuplicateWarn] = useState(null)
  const [jobMaterials,  setJobMaterials]  = useState([])
  const [form,          setForm]          = useState({})
  const [saving,        setSaving]        = useState(false)
  const [deleting,      setDeleting]      = useState(false)
  const [invoicing,     setInvoicing]     = useState(false)
  // Fee pass-through: per-invoice toggle, seeded from the contractor's global
  // default (Settings → Billing). When on, the client is billed a grossed-up
  // total so the contractor nets their listed price.
  const [coverFees,     setCoverFees]     = useState(false)
  const invoiceInFlight = useRef(false)   // synchronous double-send guard

  // Add-on state for invoice modal
  const [selectedAddons,  setSelectedAddons]  = useState([]) // fixed addons
  const [variableInputs,  setVariableInputs]  = useState({}) // {serviceId: dollarString}

  useEffect(() => {
    if (!id || !user) return
    loadData()
  }, [id, user])

  // Seed the per-invoice fee-pass-through toggle from the contractor's global
  // default once the profile loads. Their per-invoice choice isn't clobbered
  // afterward (profile.coverFees only changes from the Settings page).
  useEffect(() => {
    setCoverFees(profile?.coverFees === true)
  }, [profile?.coverFees])

  // Auto-open invoice modal if ?openInvoice=true
  useEffect(() => {
    if (client && searchParams?.get('openInvoice') === 'true') {
      openInvoiceModal()
      router.replace(`/clients/${id}`)
    }
  }, [client, searchParams])

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
          billingMode:      c.billingMode      || 'upfront',
          language:         c.language         || 'en',
          status:           c.status           || 'active',
          notes:            c.notes            || '',
          preferredChannel: c.preferredChannel || 'both',
          // Per-client deadline override (spec §12). Empty string means
          // "use the contractor's global default from Settings".
          upfrontDeadlineHours: c.upfrontDeadlineHours == null ? '' : String(c.upfrontDeadlineHours),
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
    setDuplicateWarn(null)

    // Fetch materials from most recent scheduled job
    try {
      const recentJob = await getMostRecentSchedule(user.uid, id)
      if (recentJob?.materials?.length > 0) {
        setJobMaterials(recentJob.materials)
      }
    } catch {}

    // Check for duplicate invoices in current billing period
    try {
      const now = new Date()
      let periodStart
      const pkg = client.packageType || 'monthly'
      if (pkg === 'weekly') {
        const day = now.getDay()
        periodStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - day)
      } else if (pkg === 'monthly') {
        periodStart = new Date(now.getFullYear(), now.getMonth(), 1)
      } else if (pkg === 'quarterly') {
        const qMonth = Math.floor(now.getMonth() / 3) * 3
        periodStart = new Date(now.getFullYear(), qMonth, 1)
      } else if (pkg === 'annual') {
        periodStart = new Date(now.getFullYear(), 0, 1)
      }
      // onetime: no restriction
      if (periodStart && pkg !== 'onetime') {
        const existing = invoices.find(inv => {
          if (inv.status !== 'sent' && inv.status !== 'paid') return false
          const d = inv.createdAt?.toDate ? inv.createdAt.toDate() : new Date(inv.createdAt)
          return d >= periodStart
        })
        if (existing) {
          const d = existing.createdAt?.toDate ? existing.createdAt.toDate() : new Date(existing.createdAt)
          setDuplicateWarn({
            amount: existing.totalCents,
            date: d.toLocaleDateString(lang === 'es' ? 'es-US' : 'en-US', { month: 'short', day: 'numeric' }),
          })
        }
      }
    } catch {}

    setShowInvoice(true)
  }

  async function handleSave() {
    // Validation (matches Add Client) — don't let an edit leave a client with
    // no contact channel or a malformed one, which would silently break
    // invoicing for them later.
    const phone = form.phone.trim()
    const email = form.email.trim()
    if (!phone && !email) {
      toast.error(lang === 'es' ? 'Teléfono o email requerido' : 'Phone or email required')
      return
    }
    if (phone && !validatePhone(phone)) {
      toast.error(lang === 'es' ? 'Ingresa un número válido (10 dígitos)' : 'Enter a valid phone number (10 digits)')
      return
    }
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast.error(lang === 'es' ? 'Ingresa un email válido' : 'Enter a valid email address')
      return
    }
    setSaving(true)
    try {
      // Explicit handling: empty string means "clear the field", not "keep old value"
      const updateData = {
        name:        form.name.trim()    || client.name,
        phone:       form.phone.trim(),
        email:       form.email.trim(),
        address:     form.address.trim() || client.address,
        billingMode:      form.billingMode,
        language:         form.language         || 'en',
        status:           form.status,
        notes:            form.notes            || '',
        preferredChannel: form.preferredChannel || 'both',
      }

      // Per-client deadline override: empty/invalid → null (use the
      // contractor's global Settings default); 1-168 → save as a number.
      const deadlineRaw = String(form.upfrontDeadlineHours ?? '').trim()
      if (deadlineRaw === '') {
        updateData.upfrontDeadlineHours = null
      } else {
        const n = Number(deadlineRaw)
        if (Number.isFinite(n) && n >= 1 && n <= 168) {
          updateData.upfrontDeadlineHours = Math.round(n)
        }
        // If out of range, silently keep prior value (the input has min/max)
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

  // Trust-state handlers (spec §6): after the first paid invoice on an
  // upfront client, prompt the contractor once to switch them to
  // post-visit billing. Either answer marks billingModePrompted=true so
  // the prompt never shows again.
  async function handleSwitchToPostvisit() {
    try {
      await updateClient(id, {
        billingMode:         'postvisit',
        billingModePrompted: true,
      })
      toast.success(lang === 'es' ? 'Cambiado a facturación después de la visita' : 'Switched to post-visit billing')
      loadData()
    } catch (err) {
      console.error(err)
      toast.error(translate('common', 'error'))
    }
  }

  async function handleKeepUpfront() {
    try {
      await updateClient(id, { billingModePrompted: true })
      loadData()
    } catch (err) {
      console.error(err)
      toast.error(translate('common', 'error'))
    }
  }

async function handleSendInvoice(channels = 'both', opts = {}) {
  // Synchronous in-flight guard — a fast double-tap (or tapping two channel
  // buttons) would otherwise fire two POSTs and create two PaymentIntents
  // before the `invoicing` state disables the buttons.
  if (invoiceInFlight.current) return
  invoiceInFlight.current = true
  setInvoicing(true)
  try {
    const finalAddons = buildFinalAddons()
    const lineItems = [
      { label: client.packageLabel || 'Lawn Care Service', amountCents: baseCents, category: 'base' },
      ...finalAddons.map(a => ({ label: a.label, amountCents: a.amountCents, category: 'addon' })),
    ]
    const materialLineItems = jobMaterials.map(m => ({
      label: m.name, amountCents: m.totalCents || 0, category: 'material',
    }))
    const allLineItems = [...lineItems, ...materialLineItems]
    const grandTotal = invoiceTotal

    const idToken = await user.getIdToken()
    const res = await fetch('/api/stripe/invoice', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
      body: JSON.stringify({
        stripeAccountId: profile?.stripeAccountId,
        totalCents: grandTotal,
        lineItems: allLineItems,
        clientName: client.name,
        clientEmail: client.email || '',
        clientPhone: client.phone || '',
        description: `${profile?.businessName || 'YardSync'} — invoice for ${client.name}`,
        gardenerUid: user.uid,
        clientId: id,
        // invoiceType is computed server-side from lineItem categories
        contractorName:  profile?.businessName || profile?.displayName || user?.displayName || '',
        contractorEmail: user?.email || '',
        lang,
        channels,
        // On a resume after billing-setup, use the choice captured at send time
        // (the page remounted, so the live `coverFees` state is stale/default).
        coverFees: opts.coverFees ?? coverFees,
      }),
    })
    const data = await res.json()
    if (!res.ok) {
      if (data.code === 'card_required') {
        // During an auto-resume, just report it so the resume loop can retry
        // while the pmOnFile webhook lands — don't bounce back to billing-setup.
        if (opts.resuming) return 'card_required'
        // Free-access model: no card on file yet. Stash the send intent, then
        // send them to the billing-setup confirmation (plan choice + $0-today
        // disclosure + card-on-file authorization). On return (?card=saved) the
        // resume effect finishes the send automatically — no second tap.
        try { sessionStorage.setItem('ys_resume_invoice', JSON.stringify({ clientId: id, channels, coverFees })) } catch {}
        router.push(`/billing-setup?return=${encodeURIComponent(window.location.pathname)}`)
        return
      }
      if (data.code === 'no_connect') {
        toast.error(lang === 'es'
          ? 'Completa la configuración de pagos en Ajustes antes de enviar facturas'
          : 'Finish payment setup in Settings before sending invoices')
        router.push('/settings')
        return
      }
      throw new Error(data.error || 'Invoice failed')
    }

    // Send payment link via SMS to client — AWAIT it so the toast reflects
    // whether Twilio actually accepted the text, not merely that one was
    // requested. (smsSent stays false if the send errors or is rejected.)
    const smsTried = !!(data.smsRequested && client.phone && data.paymentUrl)
    let smsSent = false
    if (smsTried) {
      const smsBody = buildInvoiceSms({
        client,
        contractor: profile,
        // Use the server-returned amount (grossed up when fees are covered) so
        // the texted figure matches what the client is actually charged.
        totalCents: data.amount ?? grandTotal,
        paymentUrl: data.paymentUrl,
        lang,
      })
      try {
        const smsRes = await fetch('/api/twilio/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ clientPhone: client.phone, message: smsBody, gardenerUid: user?.uid }),
        })
        smsSent = smsRes.ok
      } catch (err) {
        console.error('Invoice SMS failed (non-fatal):', err)
      }
    }

    const parts = []
    if (data.emailNotified) parts.push('email')
    if (smsSent) parts.push(lang === 'es' ? 'SMS' : 'text')
    const via = parts.length === 2 ? parts.join(' + ') : parts[0]
    toast.success(via
      ? (lang === 'es' ? `Factura enviada por ${via} ✓` : `Invoice sent via ${via} ✓`)
      : (smsTried
          ? (lang === 'es' ? 'Factura creada — no se pudo enviar el texto' : "Invoice created — couldn't text the link")
          : (lang === 'es' ? 'Factura creada — sin notificación' : 'Invoice created — no notification sent'))
    )
    setShowInvoice(false)
    loadData()
    return 'sent'
  } catch (err) {
    toast.error(err.message || translate('common', 'error'))
  } finally {
    setInvoicing(false)
    invoiceInFlight.current = false
  }
}

  // Auto-resume: after the card-on-file is saved (returning with ?card=saved),
  // finish sending the invoice the contractor was trying to send — no second
  // "Send" tap. Retries briefly to ride out the webhook that sets pmOnFile.
  async function resumePendingInvoice(channels, coverFeesChoice) {
    for (let attempt = 0; attempt < 5; attempt++) {
      if (attempt > 0) await new Promise(r => setTimeout(r, 1500))
      const result = await handleSendInvoice(channels, { resuming: true, coverFees: coverFeesChoice })
      if (result !== 'card_required') return
    }
    toast(lang === 'es' ? 'Tarjeta guardada. Toca "Enviar" para terminar.' : 'Card saved. Tap "Send" to finish.')
  }

  const resumeTriedRef = useRef(false)
  useEffect(() => {
    if (resumeTriedRef.current || !client || !user) return
    if (new URLSearchParams(window.location.search).get('card') !== 'saved') return
    let stash = null
    try { stash = JSON.parse(sessionStorage.getItem('ys_resume_invoice') || 'null') } catch {}
    if (!stash || stash.clientId !== id) return
    resumeTriedRef.current = true
    sessionStorage.removeItem('ys_resume_invoice')
    // Clean the URL so a manual refresh can't re-trigger a send.
    window.history.replaceState({}, '', `/clients/${id}`)
    toast.loading(lang === 'es' ? 'Tarjeta guardada — enviando factura…' : 'Card saved — sending invoice…', { id: 'resume' })
    resumePendingInvoice(stash.channels || 'both', stash.coverFees === true).finally(() => toast.dismiss('resume'))
  }, [client, user, id])

  // Refund a paid invoice in-app (keeps YardSync's 5.5% per Terms; the
  // charge.refunded webhook flips status + reverses trust-state).
  async function handleRefund(inv) {
    if (!inv || refunding) return
    setRefunding(true)
    try {
      const idToken = await user.getIdToken()
      const res = await fetch('/api/stripe/refund', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
        body:    JSON.stringify({ gardenerUid: user.uid, invoiceId: inv.id }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Refund failed')
      toast.success(lang === 'es' ? 'Reembolso emitido ✓' : 'Refund issued ✓')
      setRefundConfirm(false)
      setViewInvoice(null)
      loadData()
    } catch (err) {
      toast.error(err.message || translate('common', 'error'))
    } finally {
      setRefunding(false)
    }
  }

  // Open the contractor's Stripe Express dashboard (one-time login link) to
  // respond to a dispute — submitting evidence is the best way to NOT lose it.
  async function openStripeDispute() {
    if (respondingDispute) return
    setRespondingDispute(true)
    // Open the tab synchronously within the click gesture so mobile browsers
    // don't block it as a non-user-gesture popup; redirect it once we have the
    // URL (login links are one-time, so we can't pre-build it).
    const win = window.open('', '_blank')
    try {
      const idToken = await user.getIdToken()
      const res = await fetch('/api/stripe/connect/login-link', {
        method: 'POST', headers: { Authorization: `Bearer ${idToken}` },
      })
      const data = await res.json()
      if (res.ok && data.url) {
        if (win) win.location = data.url
        else window.open(data.url, '_blank')
      } else {
        // Couldn't mint a one-time login link (e.g. createLoginLink state
        // requirements). Don't dead-end: send them to the Stripe Express login
        // page, where they sign in to their own dashboard to respond.
        console.error('login-link failed:', res.status, data)
        if (win) win.location = 'https://connect.stripe.com/express_login'
        else window.open('https://connect.stripe.com/express_login', '_blank')
        toast(lang === 'es'
          ? 'Inicia sesión en Stripe para responder a la disputa.'
          : 'Sign in to Stripe to respond to the dispute.')
      }
    } catch (err) {
      console.error('openStripeDispute error:', err)
      if (win) win.location = 'https://connect.stripe.com/express_login'
      else window.open('https://connect.stripe.com/express_login', '_blank')
    } finally {
      setRespondingDispute(false)
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
          subtitle={`${client.packageType ? translate('packages', badgePackageType(client)) || badgePackageType(client) : (lang === 'es' ? 'Sin paquete' : 'No package')} · ${client.status || 'active'}`}
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
                  <Badge label={translate('packages', badgePackageType(client)) || badgePackageType(client)} variant={badgePackageType(client)} />
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
              {client.createdAt && (() => {
                try {
                  const d = client.createdAt?.toDate ? client.createdAt.toDate() : new Date(client.createdAt)
                  if (isNaN(d.getTime())) return null
                  const label = d.toLocaleDateString(lang === 'es' ? 'es-US' : 'en-US', { month: 'short', year: 'numeric' })
                  return (
                    <div className="flex items-center gap-2.5">
                      <Clock size={14} className="text-gray-400 flex-shrink-0" />
                      <p className="text-[13px] text-gray-500">
                        {lang === 'es' ? `Miembro desde ${label}` : `Member since ${label}`}
                      </p>
                    </div>
                  )
                } catch { return null }
              })()}
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

          {/* ── Trust-state banners (spec §6) ──────────────────────────
              On a first-time client in 'upfront' mode the contractor
              sees a yellow heads-up: payment must be received before
              service. After the first paid invoice the banner is
              replaced by a one-time prompt offering to switch the
              client to post-visit billing. Either button on the prompt
              writes billingModePrompted=true so it never shows again. */}
          {client.billingMode === 'upfront' && (client.completedJobsCount || 0) === 0 && (
            <Card className="bg-amber-50 border-amber-200">
              <div className="flex items-start gap-3">
                <ShieldAlert size={18} className="text-amber-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-[13px] font-semibold text-amber-900 mb-0.5">
                    {lang === 'es' ? 'Cliente nuevo — pago por adelantado' : 'First-time client — upfront billing'}
                  </p>
                  <p className="text-[12px] text-amber-800 leading-relaxed">
                    {lang === 'es'
                      ? 'La factura requiere pago antes del servicio. Avísele al cliente que pague por adelantado, o no se puede prestar el servicio.'
                      : "Invoice will require payment before service. Let them know to pay ahead, or service can't be rendered."}
                  </p>
                </div>
              </div>
            </Card>
          )}

          {client.billingMode === 'upfront'
            && (client.completedJobsCount || 0) >= 1
            && !client.billingModePrompted && (
            <Card className="bg-brand-50 border-brand-200">
              <div className="flex items-start gap-3 mb-3">
                <Sparkles size={18} className="text-brand-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-[13px] font-semibold text-brand-900 mb-0.5">
                    {lang === 'es' ? 'Han pagado su primera factura' : 'They paid their first invoice'}
                  </p>
                  <p className="text-[12px] text-brand-800 leading-relaxed">
                    {lang === 'es'
                      ? `${client.name} demostró que paga. ¿Cambiarlo a facturación después de la visita?`
                      : `${client.name} has shown they pay. Switch them to post-visit billing?`}
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleSwitchToPostvisit}
                  className="flex-1 flex items-center justify-center gap-1.5 bg-brand-600 text-white text-[13px] font-semibold py-2 rounded-lg hover:bg-brand-700 transition-colors"
                >
                  <CheckCircle2 size={14} />
                  {lang === 'es' ? 'Sí, cambiar' : 'Yes, switch'}
                </button>
                <button
                  onClick={handleKeepUpfront}
                  className="flex items-center justify-center gap-1.5 bg-white text-gray-600 text-[13px] font-medium py-2 px-4 rounded-lg border border-gray-200 hover:border-gray-300 transition-colors"
                >
                  <X size={14} />
                  {lang === 'es' ? 'Mantener' : 'Keep upfront'}
                </button>
              </div>
            </Card>
          )}

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

            {!isOnetime && (
              <Button
                fullWidth
                variant="secondary"
                className="mt-2"
                icon={CalendarDays}
                onClick={() => router.push(`/calendar?client=${id}`)}
              >
                {lang === 'es' ? 'Programar visitas' : 'Schedule visits'}
              </Button>
            )}

            {isOnetime && (
              <p className="text-[11px] text-center text-gray-400 mt-2">
                {lang === 'es'
                  ? 'Trabajo único — factura se envía una vez'
                  : 'One-time job — invoice sends once'}
              </p>
            )}
          </Card>

          {/* AI appointment reminder drafter */}
          <AiReminderDrafter
            client={client}
            contractorName={profile?.businessName || profile?.displayName || user?.displayName || 'Your contractor'}
            businessName={profile?.businessName || profile?.displayName || user?.displayName || 'Your contractor'}
            lang={lang}
            gardenerUid={user?.uid}
            onSent={() => { if (refreshProfile) refreshProfile().catch(() => {}) }}
          />

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
                {invoices.map((inv, i) => {
                  const dateStr = (() => {
                    const raw = inv.createdAt || inv.paidAt
                    if (!raw) return lang === 'es' ? 'Fecha no disponible' : 'Date unavailable'
                    try {
                      const d = raw?.toDate ? raw.toDate() : new Date(raw)
                      if (isNaN(d.getTime())) return lang === 'es' ? 'Fecha no disponible' : 'Date unavailable'
                      return d.toLocaleDateString(lang === 'es' ? 'es-US' : 'en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                    } catch { return lang === 'es' ? 'Fecha no disponible' : 'Date unavailable' }
                  })()
                  const paidDateStr = (() => {
                    if (inv.status !== 'paid' || !inv.paidAt) return null
                    try {
                      const d = inv.paidAt?.toDate ? inv.paidAt.toDate() : new Date(inv.paidAt)
                      if (isNaN(d.getTime())) return null
                      return d.toLocaleDateString(lang === 'es' ? 'es-US' : 'en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                    } catch { return null }
                  })()
                  return (
                    <Card key={inv.id} padding={false} onClick={() => setViewInvoice(inv)}>
                      <div className="p-3 flex items-start gap-3">
                        {inv.status === 'paid'
                          ? <CheckCircle2 size={16} className="text-green-600 mt-0.5 flex-shrink-0" />
                          : <FileText size={16} className="text-amber-400 mt-0.5 flex-shrink-0" />
                        }
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1.5">
                              <p className="text-[13px] font-medium text-gray-900">
                                {formatCents(inv.totalCents || 0)}
                              </p>
                              {inv.invoiceType === 'addon' && (
                                <span className="text-[9px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full font-medium">
                                  {lang === 'es' ? 'Adicional' : 'Add-on'}
                                </span>
                              )}
                              {inv.invoiceType === 'combined' && (
                                <span className="text-[9px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full font-medium">
                                  {lang === 'es' ? 'Combinado' : 'Combined'}
                                </span>
                              )}
                            </div>
                            <Badge
                              label={
                                inv.status === 'paid' ? (lang === 'es' ? 'Pagado' : 'Paid')
                                : inv.status === 'sent' ? (lang === 'es' ? 'Enviado' : 'Sent')
                                : inv.status === 'disputed' ? (lang === 'es' ? 'En disputa' : 'Disputed')
                                : inv.status === 'dispute_lost' ? (lang === 'es' ? 'Disputa perdida' : 'Dispute lost')
                                : inv.status === 'refunded' ? (lang === 'es' ? 'Reembolsado' : 'Refunded')
                                : inv.status || 'sent'
                              }
                              variant={
                                inv.status === 'paid' ? 'active'
                                : inv.status === 'sent' ? 'scheduled'
                                : (inv.status === 'disputed' || inv.status === 'dispute_lost') ? 'cancelled'
                                : 'default'
                              }
                            />
                          </div>
                          <p className="text-[11px] text-gray-400 mt-0.5">{dateStr}</p>
                          {inv.status === 'paid' && paidDateStr && (
                            <p className="text-[11px] text-green-600 mt-0.5">
                              {lang === 'es' ? `Pagado el ${paidDateStr}` : `Paid on ${paidDateStr}`}
                            </p>
                          )}
                        </div>
                        <span className="text-gray-300 text-[11px] mt-1 flex-shrink-0">›</span>
                      </div>
                    </Card>
                  )
                })}
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
            {(() => {
              const pref = client.preferredChannel || 'both'
              const has = { sms: !!client.phone, email: !!client.email, both: !!client.phone && !!client.email }
              const order = ['both', 'sms', 'email'].filter(c => has[c])
              if (order.length === 0) return null
              const labels = { both: lang === 'es' ? 'Ambos' : 'Both', sms: lang === 'es' ? 'Texto' : 'Text', email: 'Email' }
              // Sort so preferred channel comes first
              order.sort((a, b) => (a === pref ? -1 : b === pref ? 1 : 0))
              return (
                <div className={`grid gap-2 w-full ${order.length === 1 ? 'grid-cols-1' : order.length === 2 ? 'grid-cols-2' : 'grid-cols-3'}`}>
                  {order.map((ch, i) => (
                    <Button key={ch} variant={i === 0 ? 'primary' : 'secondary'} loading={invoicing} onClick={() => handleSendInvoice(ch)}>
                      {labels[ch]}
                    </Button>
                  ))}
                </div>
              )
            })()}
            <p className="text-[11px] text-gray-500 text-center mt-1">{lang === 'es' ? 'Total' : 'Total'}: {formatCents(invoiceTotal)}</p>
          </>
        }
      >
        <div className="space-y-4">

          {/* Duplicate warning */}
          {duplicateWarn && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-start gap-2">
              <span className="text-amber-600 flex-shrink-0 mt-0.5">⚠️</span>
              <p className="text-[12px] text-amber-800">
                {lang === 'es'
                  ? `Una factura de ${formatCents(duplicateWarn.amount)} ya fue enviada el ${duplicateWarn.date}. Enviar otra cobrará al cliente de nuevo. Solo continúa si cubre servicios adicionales.`
                  : `A ${formatCents(duplicateWarn.amount)} invoice was already sent on ${duplicateWarn.date}. Sending another will charge the client again. Only continue if this covers additional services.`}
              </p>
            </div>
          )}

          {/* Base summary */}
          <div className="bg-gray-50 rounded-xl p-3 space-y-1.5">
            <p className="text-[11px] font-medium text-gray-500 uppercase tracking-wide mb-2">
              {lang === 'es' ? 'Resumen base' : 'Base summary'}
            </p>
            <div className="flex justify-between text-[13px]">
              <span className="text-gray-600">{client.packageLabel || client.packageType}</span>
              <span className="font-medium">{formatCents(baseCents)}</span>
            </div>
            {jobMaterials.length > 0 && (
              <>
                <div className="border-t border-gray-200 pt-1.5 mt-1.5">
                  <p className="text-[11px] text-amber-700 font-medium mb-1">
                    {lang === 'es' ? 'Materiales del trabajo' : 'Job materials'}
                  </p>
                </div>
                {jobMaterials.map(m => (
                  <div key={m.id} className="flex justify-between text-[12px]">
                    <span className="text-amber-600">{m.name} ({m.qty} × {formatCents(m.unitCostCents)})</span>
                    <span className="text-amber-700">{formatCents(m.totalCents)}</span>
                  </div>
                ))}
              </>
            )}
            <div className="flex justify-between text-[12px] pt-1">
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
            {/* Fee pass-through toggle — when on, the client is billed a
                grossed-up total so the contractor keeps their listed price. */}
            <label className="flex items-start gap-2 cursor-pointer border-t border-brand-200 pt-2 mt-1">
              <input
                type="checkbox"
                checked={coverFees}
                onChange={(e) => setCoverFees(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500"
              />
              <span className="text-[12px] leading-tight text-gray-700">
                <span className="font-semibold text-gray-900">
                  {lang === 'es' ? 'Incluir la comisión en mi precio' : 'Build the fee into my price'}
                </span>
                <br />
                {lang === 'es'
                  ? 'El cliente paga un poco más para que tú recibas tu precio completo.'
                  : 'Client pays a bit more so you keep your full price.'}
              </span>
            </label>
            {(() => {
              const billed     = coverFees ? grossUpForFees(invoiceTotal) : invoiceTotal
              const ysFee      = calcApplicationFee(billed)
              const stripeFee  = Math.round(billed * 0.029) + 30
              const youReceive = billed - ysFee - stripeFee
              return (
                <>
                  <div className="flex justify-between text-[15px] pt-2">
                    <span className="font-bold text-brand-900">
                      {lang === 'es' ? 'Cliente paga' : 'Client pays'}
                    </span>
                    <span className="font-bold text-brand-900">{formatCents(billed)}</span>
                  </div>
                  {/* What the contractor actually nets — shown BEFORE sending so the
                      fees (incl. the Stripe fee they bear on direct charges) are never
                      a surprise. */}
                  <div className="flex justify-between text-[11px] text-brand-600 pt-1">
                    <span>{isFeeCapped(billed)
                      ? (lang === 'es' ? 'Comisión YardSync (con tope)' : 'YardSync fee (capped)')
                      : (lang === 'es' ? 'Comisión YardSync (5.5%)' : 'YardSync fee (5.5%)')}</span>
                    <span>−{formatCents(ysFee)}</span>
                  </div>
                  <div className="flex justify-between text-[11px] text-brand-600">
                    <span>{lang === 'es' ? 'Comisión de procesamiento de Stripe' : 'Stripe processing fee'}</span>
                    <span>−{formatCents(stripeFee)}</span>
                  </div>
                  <div className="flex justify-between text-[14px] font-bold border-t border-brand-200 pt-2 mt-1">
                    <span className="text-brand-700">{lang === 'es' ? 'Tú recibes' : 'You receive'}</span>
                    <span className="text-brand-700">{formatCents(youReceive)}</span>
                  </div>
                </>
              )
            })()}
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
                    {translate('clients', 'client_pays')} {formatCents(selectedService.priceCents || 0)} / {selectedService.packageType}
                  </p>
                  <p className="text-[10px] text-gray-400">
                    {lang === 'es' ? '5.5% deducido de tu pago por factura' : '5.5% deducted from your payout per invoice'}
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

          {/* Per-client deadline override (visible only for upfront billing).
              Blank = inherit the contractor's Settings default. */}
          {form.billingMode === 'upfront' && (
            <div>
              <label className="text-[12px] font-medium text-gray-700 block mb-1">
                {lang === 'es' ? 'Plazo de pago (horas)' : 'Payment deadline (hours)'}
              </label>
              <input
                type="number"
                min={1}
                max={168}
                value={form.upfrontDeadlineHours ?? ''}
                onChange={e => setField('upfrontDeadlineHours', e.target.value)}
                placeholder={String(profile?.upfrontDeadlineHours || 24)}
                className="w-full rounded-xl border border-gray-200 bg-white text-[13px] px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
              <p className="text-[10px] text-gray-400 mt-1">
                {lang === 'es'
                  ? `Vacío = usar el valor predeterminado de Ajustes (${profile?.upfrontDeadlineHours || 24}h).`
                  : `Blank = use Settings default (${profile?.upfrontDeadlineHours || 24}h).`}
              </p>
            </div>
          )}

          <div>
            <p className="text-[13px] font-medium text-gray-700 mb-2">{lang === 'es' ? 'Enviar facturas por' : 'Send invoices by'}</p>
            <div className="flex gap-3">
              {[
                { value: 'both', label: lang === 'es' ? 'Ambos' : 'Both' },
                { value: 'sms', label: lang === 'es' ? 'Texto (SMS)' : 'Text (SMS)' },
                { value: 'email', label: 'Email' },
              ].map(opt => (
                <label key={opt.value} className="flex items-center gap-1.5 text-[13px] text-gray-600 cursor-pointer">
                  <input type="radio" name="preferredChannel" value={opt.value} checked={form.preferredChannel === opt.value} onChange={e => setField('preferredChannel', e.target.value)} className="accent-brand-600" />
                  {opt.label}
                </label>
              ))}
            </div>
          </div>

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

      {/* ── Invoice detail modal ── */}
      {viewInvoice && (() => {
        const inv = viewInvoice
        const fmtDate = (raw) => {
          if (!raw) return null
          try {
            const d = raw?.toDate ? raw.toDate() : new Date(raw)
            if (isNaN(d.getTime())) return null
            return d.toLocaleDateString(lang === 'es' ? 'es-US' : 'en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })
          } catch { return null }
        }
        const items = Array.isArray(inv.lineItems) ? inv.lineItems : []
        const baseItems = items.filter(li => li.category === 'base')
        const addonItems = items.filter(li => li.category === 'addon')
        const materialItems = items.filter(li => li.category === 'material')
        return (
          <Modal
            open={true}
            onClose={() => { setRefundConfirm(false); setViewInvoice(null) }}
            title={lang === 'es' ? 'Detalle de factura' : 'Invoice details'}
            footer={
              <>
                {inv.status === 'sent' && inv.stripePaymentUrl && (
                  <Button fullWidth onClick={() => { navigator.clipboard.writeText(inv.stripePaymentUrl); toast.success(lang === 'es' ? 'Link copiado' : 'Link copied') }}>
                    {lang === 'es' ? 'Copiar link de pago' : 'Copy payment link'}
                  </Button>
                )}
                {inv.status === 'disputed' && (
                  <Button fullWidth loading={respondingDispute} onClick={openStripeDispute}>
                    {lang === 'es' ? 'Responder en Stripe' : 'Respond in Stripe'}
                  </Button>
                )}
                {inv.status === 'paid' && (
                  refundConfirm ? (
                    <Button variant="danger" fullWidth loading={refunding} onClick={() => handleRefund(inv)}>
                      {lang === 'es' ? `Confirmar reembolso de ${formatCents(inv.totalCents || 0)}` : `Confirm refund of ${formatCents(inv.totalCents || 0)}`}
                    </Button>
                  ) : (
                    <Button variant="secondary" fullWidth onClick={() => setRefundConfirm(true)}>
                      {lang === 'es' ? 'Reembolsar al cliente' : 'Refund client'}
                    </Button>
                  )
                )}
                <Button variant="secondary" fullWidth onClick={() => { if (refundConfirm) setRefundConfirm(false); else setViewInvoice(null) }}>
                  {translate('common', 'cancel')}
                </Button>
              </>
            }
          >
            <div className="space-y-4">
              {/* Status + amount */}
              <div className="flex items-center justify-between">
                <p className="text-[20px] font-bold text-gray-900">{formatCents(inv.totalCents || 0)}</p>
                <Badge
                  label={
                    inv.status === 'paid' ? (lang === 'es' ? 'Pagado' : 'Paid')
                    : inv.status === 'sent' ? (lang === 'es' ? 'Enviado' : 'Sent')
                    : inv.status === 'refunded' ? (lang === 'es' ? 'Reembolsado' : 'Refunded')
                    : (inv.status === 'disputed' || inv.status === 'dispute_lost') ? (lang === 'es' ? 'En disputa' : 'Disputed')
                    : inv.status || 'sent'
                  }
                  variant={inv.status === 'paid' ? 'active' : inv.status === 'sent' ? 'scheduled' : 'default'}
                />
              </div>

              {/* Dispute guidance — responding with evidence is how you avoid
                  losing the money (and a clawback that could land on the platform). */}
              {(inv.status === 'disputed' || inv.status === 'dispute_lost') && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-[12px] text-red-800">
                  {inv.status === 'disputed'
                    ? (lang === 'es'
                      ? 'El cliente disputó este pago. Eres el comercio responsable — responde en Stripe con evidencia (fotos del trabajo, registro del servicio) antes de la fecha límite o perderás el pago.'
                      : "The client disputed this payment. You're the merchant of record — respond in Stripe with evidence (job photos, service record) before the deadline or you'll lose the payment.")
                    : (lang === 'es'
                      ? 'Esta disputa se perdió y el banco retiró el pago.'
                      : 'This dispute was lost and the bank pulled the payment back.')}
                  {inv.disputeReason && (
                    <span className="block mt-1 text-red-600">
                      {lang === 'es' ? 'Motivo' : 'Reason'}: {inv.disputeReason}
                    </span>
                  )}
                </div>
              )}

              {refundConfirm && inv.status === 'paid' && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-[12px] text-amber-800">
                  {lang === 'es'
                    ? `Esto reembolsa ${formatCents(inv.totalCents || 0)} al cliente. La tarifa del 5.5% de YardSync no es reembolsable.`
                    : `This refunds ${formatCents(inv.totalCents || 0)} to the client. YardSync's 5.5% fee is non-refundable.`}
                </div>
              )}

              {/* Dates */}
              <div className="bg-gray-50 rounded-xl p-3 space-y-1.5">
                {fmtDate(inv.createdAt) && (
                  <div className="flex justify-between text-[12px]">
                    <span className="text-gray-500">{lang === 'es' ? 'Enviado' : 'Sent'}</span>
                    <span className="text-gray-700">{fmtDate(inv.createdAt)}</span>
                  </div>
                )}
                {inv.status === 'paid' && fmtDate(inv.paidAt) && (
                  <div className="flex justify-between text-[12px]">
                    <span className="text-gray-500">{lang === 'es' ? 'Pagado' : 'Paid'}</span>
                    <span className="text-green-600 font-medium">{fmtDate(inv.paidAt)}</span>
                  </div>
                )}
              </div>

              {/* Line items */}
              <div className="space-y-2">
                <p className="text-[11px] font-medium text-gray-400 uppercase tracking-wide">
                  {lang === 'es' ? 'Detalle de servicios' : 'Service breakdown'}
                </p>

                {baseItems.map((li, i) => (
                  <div key={`base-${i}`} className="flex justify-between text-[13px]">
                    <span className="text-gray-700">{li.label}</span>
                    <span className="font-medium text-gray-900">{formatCents(li.amountCents || 0)}</span>
                  </div>
                ))}

                {addonItems.length > 0 && (
                  <>
                    <p className="text-[11px] text-gray-400 mt-2">{lang === 'es' ? 'Adicionales' : 'Add-ons'}</p>
                    {addonItems.map((li, i) => (
                      <div key={`addon-${i}`} className="flex justify-between text-[12px]">
                        <span className="text-gray-600">{li.label}</span>
                        <span className="text-gray-800">{formatCents(li.amountCents || 0)}</span>
                      </div>
                    ))}
                  </>
                )}

                {materialItems.length > 0 && (
                  <>
                    <p className="text-[11px] text-gray-400 mt-2">{lang === 'es' ? 'Materiales' : 'Materials'}</p>
                    {materialItems.map((li, i) => (
                      <div key={`mat-${i}`} className="flex justify-between text-[12px]">
                        <span className="text-amber-700">{li.label}</span>
                        <span className="text-amber-800">{formatCents(li.amountCents || 0)}</span>
                      </div>
                    ))}
                  </>
                )}

                <div className="border-t border-gray-100 pt-2 mt-2">
                  <div className="flex justify-between text-[13px]">
                    <span className="font-medium text-gray-800">{lang === 'es' ? 'Total facturado' : 'Invoice total'}</span>
                    <span className="font-bold text-gray-900">{formatCents(inv.totalCents || 0)}</span>
                  </div>
                </div>
              </div>

              {/* Fee breakdown — contractor view */}
              <div className="bg-brand-50 border border-brand-100 rounded-xl p-3 space-y-1.5">
                <p className="text-[11px] font-medium text-brand-700 uppercase tracking-wide mb-1">
                  {lang === 'es' ? 'Tu recibo' : 'Your earnings'}
                </p>
                <div className="flex justify-between text-[12px]">
                  <span className="text-brand-600">{lang === 'es' ? 'Tarifa YardSync (5.5%)' : 'YardSync fee (5.5%)'}</span>
                  <span className="text-brand-600">-{formatCents(inv.applicationFee || 0)}</span>
                </div>
                <div className="flex justify-between text-[12px]">
                  <span className="text-brand-600">{lang === 'es' ? 'Tarifa de procesamiento Stripe' : 'Stripe processing fee'}</span>
                  <span className="text-brand-600">-{formatCents(inv.stripeProcessingFee || (Math.round((inv.totalCents || 0) * 0.029) + 30))}</span>
                </div>
                <div className="flex justify-between text-[13px] font-medium">
                  <span className="text-brand-800">{lang === 'es' ? 'Tú recibes' : 'You receive'}</span>
                  <span className="text-brand-900">{formatCents(inv.contractorReceives ?? ((inv.totalCents || 0) - (inv.applicationFee || 0) - (inv.stripeProcessingFee || (Math.round((inv.totalCents || 0) * 0.029) + 30))))}</span>
                </div>
              </div>

              {/* Transaction ID */}
              {inv.stripePaymentIntentId && (
                <p className="text-[10px] text-gray-300 text-center">
                  ID: {inv.stripePaymentIntentId}
                </p>
              )}
            </div>
          </Modal>
        )
      })()}
    </AppShell>
  )
}