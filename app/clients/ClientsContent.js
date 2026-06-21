'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import { useLang } from '@/context/LangContext'
import AppShell from '@/components/layout/AppShell'
import PageHeader from '@/components/layout/PageHeader'
import { Card, Badge, Button, EmptyState, Skeleton, Modal, Input, Select } from '@/components/ui'
import { getClients, addClient, getServices, updateClient, addService } from '@/lib/db'
import { formatCents } from '@/lib/fee'
import { validatePhone, formatPhone } from '@/lib/phone'
import { isValidEmail, suggestEmailCorrection } from '@/lib/emailHelpers'
import PhoneInput from '@/components/ui/PhoneInput'
import { Users, Plus, Search, MapPin, AlertCircle, Sparkles, Phone, Mail, MessageSquare, Check, X } from 'lucide-react'
import toast from 'react-hot-toast'
import Link from 'next/link'

const BILLING_OPTIONS_EN = [
  { value: 'upfront',   label: 'Upfront (invoice before visit)' },
  { value: 'postvisit', label: 'Post-visit (invoice after)' },
]
const BILLING_OPTIONS_ES = [
  { value: 'upfront',   label: 'Por adelantado (factura antes de la visita)' },
  { value: 'postvisit', label: 'Después de la visita (factura después)' },
]

const AVATAR_COLORS = [
  'bg-brand-100 text-brand-800',
  'bg-blue-100 text-blue-800',
  'bg-amber-100 text-amber-800',
  'bg-purple-100 text-purple-800',
  'bg-pink-100 text-pink-800',
]


const RECURRENCE_LABELS_EN = {
  weekly:    'Every week',
  biweekly:  'Every 2 weeks',
  '3x_month':'3x per month',
  monthly:   'Once a month',
  quarterly: 'Once every 3 months',
  annual:    'Once a year',
  onetime:   'One-time only',
}

const RECURRENCE_LABELS_ES = {
  weekly:    'Cada semana',
  biweekly:  'Cada 2 semanas',
  '3x_month':'3 veces al mes',
  monthly:   'Una vez al mes',
  quarterly: 'Una vez cada 3 meses',
  annual:    'Una vez al año',
  onetime:   'Solo una vez',
}

const DEFAULT_FORM = {
  name:        '',
  phone:       '',
  email:       '',
  address:     '',
  serviceId:   '',
  billingMode: 'upfront',
  notes:       '',
  language:    'en',
  // Per-client price override (dollars string). Pre-filled from the selected
  // package's price; blank means "use the package price as-is".
  customPrice: '',
  // Inline "+ New package" creator (active when serviceId === NEW_PACKAGE).
  newPkgLabel:  '',
  newPkgType:   'monthly',
  newPkgPrice:  '',
  savePackage:  true,   // also write it to /services for reuse
}

// Sentinel serviceId for the inline "+ New package" option in the dropdown.
const NEW_PACKAGE = '__new__'

const PACKAGE_TYPE_OPTIONS = [
  { value: 'weekly',    en: 'Weekly',    es: 'Semanal'    },
  { value: 'monthly',   en: 'Monthly',   es: 'Mensual'    },
  { value: 'quarterly', en: 'Quarterly', es: 'Trimestral' },
  { value: 'annual',    en: 'Annual',    es: 'Anual'      },
  { value: 'onetime',   en: 'One-time',  es: 'Una vez'    },
]

export default function ClientsPage() {
  const { user }            = useAuth()
  const { translate, lang } = useLang()
  const router              = useRouter()

  const [clients,  setClients]  = useState([])
  const [services, setServices] = useState([])
  const [loading,  setLoading]  = useState(true)
  const [search,   setSearch]   = useState('')
  const [filter,   setFilter]   = useState('all')
  const [showAdd,  setShowAdd]  = useState(false)
  const [form,     setForm]     = useState(DEFAULT_FORM)
  const [errors,   setErrors]   = useState({})
  const [saving,   setSaving]   = useState(false)
  // When set, the Add-client modal is in "accept lead" mode: it edits this
  // existing lead doc (assigning a package) instead of creating a new client.
  const [acceptingLeadId, setAcceptingLeadId] = useState(null)

  const BILLING_OPTIONS   = lang === 'es' ? BILLING_OPTIONS_ES : BILLING_OPTIONS_EN
  const RECURRENCE_LABELS = lang === 'es' ? RECURRENCE_LABELS_ES : RECURRENCE_LABELS_EN

  useEffect(() => {
    if (!user) return
    loadData()
  }, [user])

  async function loadData() {
    setLoading(true)
    try {
      const [c, s] = await Promise.all([
        getClients(user.uid),
        getServices(user.uid),
      ])
      setClients(c)
      setServices(s.filter(sv => sv.serviceType === 'base'))
    } catch {
      toast.error(translate('common', 'error'))
    } finally {
      setLoading(false)
    }
  }

  function setField(key, val) {
    setForm(prev => ({ ...prev, [key]: val }))
    if (errors[key]) setErrors(prev => ({ ...prev, [key]: null }))
  }

  const selectedService = services.find(s => s.id === form.serviceId)
  const isNewPackage    = form.serviceId === NEW_PACKAGE

  // Choosing an existing package pre-fills the per-client price with its price
  // (so the contractor can tweak it for a bigger/smaller lot). "+ New package"
  // opens the inline creator instead.
  function handlePackageSelect(value) {
    if (value && value !== NEW_PACKAGE) {
      const svc = services.find(s => s.id === value)
      setForm(prev => ({ ...prev, serviceId: value, customPrice: svc ? ((svc.priceCents || 0) / 100).toFixed(2) : '' }))
    } else {
      setForm(prev => ({ ...prev, serviceId: value, customPrice: '' }))
    }
    if (errors.serviceId) setErrors(prev => ({ ...prev, serviceId: null }))
  }

  // Resolve the package fields written to the client doc. Existing package →
  // honor the per-client price override; "+ New package" → use the inline
  // fields. basePriceCents is a snapshot, so an override never touches the
  // catalog service.
  function resolvePackage() {
    if (isNewPackage) {
      return {
        serviceId:       '',
        packageType:     form.newPkgType,
        basePriceCents:  Math.round(parseFloat(form.newPkgPrice || '0') * 100),
        packageLabel:    form.newPkgLabel.trim(),
        packageDesc:     '',
        packageIncludes: '',
        recurrence:      form.newPkgType,
        preferredDay:    '',
      }
    }
    const svc      = selectedService
    const override = form.customPrice.trim()
    return {
      serviceId:       svc?.id || '',
      packageType:     svc?.packageType  || 'monthly',
      basePriceCents:  override !== '' ? Math.round(parseFloat(override) * 100) : (svc?.priceCents ?? 6500),
      packageLabel:    svc?.label        || '',
      packageDesc:     svc?.description  || '',
      packageIncludes: svc?.includes     || '',
      recurrence:      svc?.recurrence   || 'biweekly',
      preferredDay:    svc?.preferredDay || '',
    }
  }

  // When "+ New package" + "save for reuse", persist it as a base service so it
  // joins the catalog. Non-fatal — the client still gets the snapshot if it fails.
  async function maybePersistNewPackage(pkg) {
    if (!isNewPackage || !form.savePackage) return
    try {
      await addService(user.uid, {
        serviceType: 'base',
        packageType: pkg.packageType,
        recurrence:  pkg.packageType,
        label:       pkg.packageLabel,
        description: '',
        priceCents:  pkg.basePriceCents,
        pricingType: 'fixed',
      })
    } catch (err) {
      console.error('Could not save new package to catalog:', err)
    }
  }

  function validate() {
    const e = {}
    if (!form.name.trim()) e.name = translate('clients', 'full_name') + ' required'

    // Phone is OPTIONAL — only validate format if something was entered.
    if (form.phone.trim() && !validatePhone(form.phone)) {
      e.phone = lang === 'es'
        ? 'Ingresa un número válido (10 dígitos)'
        : 'Enter a valid phone number (10 digits)'
    }

    // Email is OPTIONAL — only validate format if something was entered.
    if (form.email.trim() && !isValidEmail(form.email)) {
      e.email = lang === 'es'
        ? 'Ingresa un email válido'
        : 'Enter a valid email address'
    }

    // At-least-one-of: phone OR email must be present so we can actually
    // send invoices. Show the error on whichever field is empty (preferring email,
    // since it's the field with the helper text).
    if (!form.phone.trim() && !form.email.trim()) {
      e.email = lang === 'es'
        ? 'Teléfono o email requerido'
        : 'Phone or email required'
    }

    if (!form.address.trim()) e.address   = translate('clients', 'address') + ' required'

    if (!form.serviceId) {
      e.serviceId = translate('clients', 'select_package')
    } else if (isNewPackage) {
      if (!form.newPkgLabel.trim()) {
        e.newPkgLabel = lang === 'es' ? 'Nombre del paquete requerido' : 'Package name required'
      }
      const p = parseFloat(form.newPkgPrice)
      if (!form.newPkgPrice.trim() || isNaN(p) || p <= 0) {
        e.newPkgPrice = lang === 'es' ? 'Ingresa un precio válido' : 'Enter a valid price'
      }
    } else if (form.customPrice.trim()) {
      const p = parseFloat(form.customPrice)
      if (isNaN(p) || p < 0) {
        e.customPrice = lang === 'es' ? 'Precio inválido' : 'Invalid price'
      }
    }

    setErrors(e)
    return Object.keys(e).length === 0
  }

  async function handleAdd() {
    if (!validate()) return
    setSaving(true)
    try {
      const pkg = resolvePackage()
      await maybePersistNewPackage(pkg)
      await addClient(user.uid, {
        name:            form.name.trim(),
        phone:           formatPhone(form.phone.trim()),
        email:           form.email.trim(),
        address:         form.address.trim(),
        notes:           form.notes.trim(),
        billingMode:     form.billingMode,
        language:        form.language,
        ...pkg,
      })
      toast.success(`${form.name} ${translate('clients', 'add_client')} ✓`)
      setShowAdd(false)
      setForm(DEFAULT_FORM)
      loadData()
    } catch {
      toast.error(translate('common', 'error'))
    } finally {
      setSaving(false)
    }
  }

  // ── Lead isolation ─────────────────────────────────────────────────
  // Per docs/SMART_BUSINESS_CARD_SPEC.md §1.2, any client with
  // leadStatus === 'new' is a pending intake submission — they appear
  // in their own "New leads" section at the top, NOT mixed into the
  // regular client list (which would also bleed them into the daily
  // SMS reminder cron and Volume Rewards math).
  //
  // Dismissed leads (leadStatus === 'dismissed') are kept in Firestore
  // for audit + future duplicate-detection but are invisible to the
  // contractor — they should NOT appear in the regular client list as
  // "inactive" (the prior bug: a dismissed lead with status=undefined
  // got counted as inactive and showed up in the list).
  const pendingLeads = clients
    .filter(c => c.leadStatus === 'new')
    .sort((a, b) => {
      const da = new Date(a.leadSubmittedAt || a.createdAt || 0).getTime()
      const db = new Date(b.leadSubmittedAt || b.createdAt || 0).getTime()
      return db - da
    })
  const nonLeadClients = clients.filter(
    c => c.leadStatus !== 'new' && c.leadStatus !== 'dismissed'
  )

  // If the contractor is focused on the New Leads chip and clears the last
  // lead (Accept/Dismiss), the chip vanishes from the row — fall back to the
  // full list so we never strand them on a blank view.
  useEffect(() => {
    if (filter === 'leads' && pendingLeads.length === 0) setFilter('all')
  }, [filter, pendingLeads.length])

  const filtered = (() => {
    let list = nonLeadClients.filter(c =>
      c.name?.toLowerCase().includes(search.toLowerCase()) ||
      c.address?.toLowerCase().includes(search.toLowerCase())
    )
    // Apply package filter
    if (['monthly', 'quarterly', 'annual', 'weekly'].includes(filter)) {
      list = list.filter(c => c.packageType === filter)
    }
    // Apply sort
    if (filter === 'recent') {
      list = [...list].sort((a, b) => {
        const da = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt || 0)
        const db = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt || 0)
        return db - da
      })
    } else {
      list = [...list].sort((a, b) => (a.name || '').localeCompare(b.name || ''))
    }
    return list
  })()
  const activeCount   = nonLeadClients.filter(c => c.status === 'active').length
  const inactiveCount = nonLeadClients.filter(c => c.status !== 'active').length

  // ── Lead actions ───────────────────────────────────────────────────
  // Accept: graduate the lead to an active client. We REQUIRE a package to
  // be assigned first (otherwise the client has no price and silently
  // defaults to $65 everywhere), so Accept opens the add-client modal in
  // "accept" mode, pre-filled from the lead, and saves into the existing
  // lead doc. Dismiss: soft-delete (kept for audit + duplicate detection).
  function handleAcceptLead(lead) {
    // Guard against double-accept (stale UI / second tab): only brand-new
    // leads can be accepted, so trust-state counters are never reset on a
    // client who has already started paying.
    if (lead.leadStatus !== 'new') return
    // Fold the intake's free-text service interest + note into the client
    // notes so that context isn't lost when the lead graduates.
    const leadContext = [lead.serviceInterest, lead.note].filter(Boolean).join(' — ')
    setForm({
      ...DEFAULT_FORM,
      name:        lead.name || '',
      phone:       lead.phone ? formatPhone(lead.phone) : '',
      email:       lead.email || '',
      address:     lead.address || '',
      notes:       leadContext,
      language:    lead.language === 'es' ? 'es' : 'en',
    })
    setErrors({})
    setAcceptingLeadId(lead.id)
    setShowAdd(true)
  }

  // Save handler for "accept" mode — assigns the chosen package and flips the
  // lead to an active client with first-time-upfront trust state.
  async function handleAcceptSave() {
    if (!acceptingLeadId) return
    if (!validate()) return
    setSaving(true)
    try {
      const pkg = resolvePackage()
      await maybePersistNewPackage(pkg)
      await updateClient(acceptingLeadId, {
        name:            form.name.trim(),
        phone:           formatPhone(form.phone.trim()),
        email:           form.email.trim(),
        address:         form.address.trim(),
        notes:           form.notes.trim(),
        billingMode:     form.billingMode,
        language:        form.language,
        ...pkg,
        leadStatus:          'accepted',
        leadAcceptedAt:      new Date().toISOString(),
        status:              'active',
        completedJobsCount:  0,
        billingModePrompted: false,
      })
      toast.success(lang === 'es' ? `${form.name} aceptado ✓` : `${form.name} accepted ✓`)
      closeAddModal()
      loadData()
    } catch (err) {
      console.error('Failed to accept lead:', err)
      toast.error(translate('common', 'error'))
    } finally {
      setSaving(false)
    }
  }

  function closeAddModal() {
    setShowAdd(false)
    setForm(DEFAULT_FORM)
    setErrors({})
    setAcceptingLeadId(null)
  }

  async function handleDismissLead(lead) {
    if (!window.confirm(
      lang === 'es'
        ? `¿Descartar la solicitud de ${lead.name}?`
        : `Dismiss ${lead.name}'s request?`
    )) return
    try {
      await updateClient(lead.id, {
        leadStatus:      'dismissed',
        leadDismissedAt: new Date().toISOString(),
      })
      toast.success(lang === 'es' ? 'Descartado' : 'Dismissed')
      loadData()
    } catch (err) {
      console.error('Failed to dismiss lead:', err)
      toast.error(translate('common', 'error'))
    }
  }

  function formatLeadAge(iso) {
    if (!iso) return ''
    const ms = Date.now() - new Date(iso).getTime()
    const mins = Math.floor(ms / 60000)
    if (mins < 1)    return lang === 'es' ? 'ahora' : 'just now'
    if (mins < 60)   return lang === 'es' ? `hace ${mins} min` : `${mins}m ago`
    const hours = Math.floor(mins / 60)
    if (hours < 24)  return lang === 'es' ? `hace ${hours} h` : `${hours}h ago`
    const days = Math.floor(hours / 24)
    return lang === 'es' ? `hace ${days} d` : `${days}d ago`
  }

  function getInitials(name) {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
  }

  return (
    <AppShell>
      <div className="page-content">
        <PageHeader
          title={translate('clients', 'title')}
          subtitle={`${activeCount} ${activeCount !== 1 && lang === 'es' ? translate('common', 'active_pl') : translate('clients', 'active')}${inactiveCount > 0 ? ` · ${inactiveCount} ${translate('clients', 'inactive')}` : ''}`}
          actions={
            <Button icon={Plus} size="sm" onClick={() => {
              if (services.length === 0 && !loading) {
                toast.error(lang === 'es' ? 'Primero crea un paquete de servicio' : 'Create a service package first')
                return
              }
              setShowAdd(true)
            }}>
              {translate('clients', 'add')}
            </Button>
          }
        />

        <div className="px-4 py-4 max-w-lg mx-auto space-y-4">
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="search"
              placeholder={translate('clients', 'search')}
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-gray-200 bg-white text-[14px] focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>

          {/* Filter chips — wrap so nothing is cut off on narrow screens
              (the prior horizontal-scroll row hid its scrollbar and stranded
              the last chips off-screen). */}
          <div className="flex flex-wrap gap-2">
            {[
              // New Leads chip leads the row (only when there are pending
              // leads) so contractors can jump straight to intake submissions.
              ...(pendingLeads.length > 0
                ? [{ value: 'leads', label: lang === 'es' ? 'Nuevas solicitudes' : 'New leads', count: pendingLeads.length }]
                : []),
              { value: 'all',       label: lang === 'es' ? 'Todos (A-Z)' : 'All (A-Z)' },
              { value: 'recent',    label: lang === 'es' ? 'Recientes' : 'Recent' },
              { value: 'monthly',   label: lang === 'es' ? 'Mensual' : 'Monthly' },
              { value: 'quarterly', label: lang === 'es' ? 'Trimestral' : 'Quarterly' },
              { value: 'annual',    label: lang === 'es' ? 'Anual' : 'Annual' },
              { value: 'weekly',    label: lang === 'es' ? 'Semanal' : 'Weekly' },
            ].map(chip => {
              const isLeads  = chip.value === 'leads'
              const selected = filter === chip.value
              return (
                <button
                  key={chip.value}
                  onClick={() => setFilter(chip.value)}
                  className={`flex-shrink-0 inline-flex items-center gap-1.5 text-[12px] font-medium px-3 py-1.5 rounded-full transition-colors ${
                    selected
                      ? 'bg-brand-600 text-white'
                      : isLeads
                        ? 'bg-brand-50 text-brand-700 hover:bg-brand-100'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {chip.label}
                  {chip.count != null && (
                    <span className={`text-[10px] font-semibold leading-none px-1.5 py-0.5 rounded-full ${
                      selected ? 'bg-white/25 text-white' : 'bg-brand-600 text-white'
                    }`}>
                      {chip.count}
                    </span>
                  )}
                </button>
              )
            })}
          </div>

          {/* ── New Leads section (above the regular client list) ────
              Shows on the default "All" view (prominent alert) and when the
              New Leads chip is selected (focused view). Package/Recent filters
              stay decluttered. */}
          {!loading && (filter === 'all' || filter === 'leads') && pendingLeads.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 px-1">
                <Sparkles size={14} className="text-brand-600" />
                <h2 className="text-[13px] font-semibold text-gray-800">
                  {lang === 'es' ? 'Nuevas solicitudes' : 'New leads'}
                </h2>
                <span className="text-[11px] font-medium text-brand-700 bg-brand-50 px-2 py-0.5 rounded-full">
                  {pendingLeads.length}
                </span>
              </div>

              {pendingLeads.map(lead => (
                <Card key={lead.id} padding={false} className="border-brand-200 bg-brand-50/30">
                  <div className="p-4 space-y-3">
                    {/* Header row */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-[14px] font-semibold text-gray-900 truncate">
                          {lead.name}
                        </p>
                        <p className="text-[11px] text-gray-500">
                          {formatLeadAge(lead.leadSubmittedAt || lead.createdAt)}
                          {lead.language === 'es' && (
                            <span className="ml-2 inline-block px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-100 text-blue-700">
                              ES
                            </span>
                          )}
                          {lead.intakeSmsConsent && (
                            <span className="ml-1.5 inline-block px-1.5 py-0.5 rounded text-[10px] font-medium bg-green-100 text-green-700">
                              {lang === 'es' ? 'SMS OK' : 'SMS OK'}
                            </span>
                          )}
                        </p>
                      </div>
                    </div>

                    {/* Contact + details */}
                    <div className="space-y-1.5 text-[12px] text-gray-700">
                      {lead.phone && (
                        <a
                          href={`tel:${lead.phone.replace(/\D/g, '')}`}
                          className="flex items-center gap-1.5 hover:text-brand-700"
                        >
                          <Phone size={12} className="text-gray-400" />
                          {formatPhone(lead.phone)}
                        </a>
                      )}
                      {lead.email && (
                        <a
                          href={`mailto:${lead.email}`}
                          className="flex items-center gap-1.5 hover:text-brand-700"
                        >
                          <Mail size={12} className="text-gray-400" />
                          {lead.email}
                        </a>
                      )}
                      {lead.address && (
                        <div className="flex items-start gap-1.5">
                          <MapPin size={12} className="text-gray-400 mt-0.5 flex-shrink-0" />
                          <span>{lead.address}</span>
                        </div>
                      )}
                      {lead.serviceInterest && (
                        <div className="text-[11px] text-gray-600 bg-white border border-gray-200 rounded px-2 py-1 inline-block">
                          {lead.serviceInterest}
                        </div>
                      )}
                      {lead.note && (
                        <div className="flex items-start gap-1.5 text-[11px] text-gray-600 italic">
                          <MessageSquare size={12} className="text-gray-400 mt-0.5 flex-shrink-0" />
                          <span>"{lead.note}"</span>
                        </div>
                      )}
                    </div>

                    {/* Possible-duplicate hint */}
                    {lead.possibleDuplicateOf && (
                      <div className="flex items-start gap-1.5 text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1.5">
                        <AlertCircle size={12} className="mt-0.5 flex-shrink-0" />
                        <span>
                          {lang === 'es'
                            ? `Posible duplicado de ${lead.possibleDuplicateOf}`
                            : `Possible duplicate of ${lead.possibleDuplicateOf}`}
                        </span>
                      </div>
                    )}

                    {/* Action buttons */}
                    <div className="flex gap-2 pt-1">
                      <button
                        onClick={() => handleAcceptLead(lead)}
                        className="flex-1 flex items-center justify-center gap-1.5 bg-brand-600 text-white text-[13px] font-semibold py-2 rounded-lg hover:bg-brand-700 transition-colors"
                      >
                        <Check size={14} />
                        {lang === 'es' ? 'Aceptar' : 'Accept'}
                      </button>
                      <button
                        onClick={() => handleDismissLead(lead)}
                        className="flex items-center justify-center gap-1.5 bg-white text-gray-600 text-[13px] font-medium py-2 px-4 rounded-lg border border-gray-200 hover:border-gray-300 transition-colors"
                      >
                        <X size={14} />
                        {lang === 'es' ? 'Descartar' : 'Dismiss'}
                      </button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}

          {/* Active client list — hidden when the New Leads chip is focused */}
          {filter !== 'leads' && (loading ? (
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-20" />)}
            </div>
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={Users}
              title={search ? translate('clients', 'no_match') : translate('clients', 'no_clients')}
              description={search ? translate('clients', 'try_different') : translate('clients', 'add_first')}
              action={!search && (
                <Button icon={Plus} onClick={() => setShowAdd(true)}>
                  {translate('clients', 'add_first_btn')}
                </Button>
              )}
            />
          ) : (
            <div className="space-y-2">
              {filtered.map((client, i) => (
                <Card
                  key={client.id}
                  onClick={() => router.push(`/clients/${client.id}`)}
                  padding={false}
                  className={`animate-fade-up stagger-${Math.min(i+1,4)}`}
                >
                  <div className="p-4 flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-[13px] font-semibold flex-shrink-0 ${AVATAR_COLORS[i % AVATAR_COLORS.length]}`}>
                      {getInitials(client.name)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-[14px] font-medium text-gray-900">{client.name}</p>
                        <Badge label={translate('packages', client.packageType) || client.packageType} variant={client.packageType} />
                      </div>
                      <div className="flex items-center gap-1 mt-0.5">
                        <MapPin size={10} className="text-gray-300 flex-shrink-0" />
                        <p className="text-[12px] text-gray-400 truncate">{client.address}</p>
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <p className="text-[12px] text-brand-600 font-medium">
                          {formatCents(client.basePriceCents || 0)}/{translate('clients', 'base')}
                        </p>
                        {client.recurrence && client.packageType !== 'onetime' && (
                          <p className="text-[11px] text-gray-400">
                            · {RECURRENCE_LABELS[client.recurrence] || client.recurrence}
                          </p>
                        )}
                      </div>
                    </div>
                    <Badge label={translate('status', client.status) || client.status} variant={client.status} />
                  </div>
                </Card>
              ))}
            </div>
          ))}
        </div>
      </div>

      <Modal
        open={showAdd}
        onClose={closeAddModal}
        title={acceptingLeadId
          ? (lang === 'es' ? 'Aceptar solicitud' : 'Accept lead')
          : translate('clients', 'add_client')}
        footer={
          <>
            <Button variant="secondary" fullWidth onClick={closeAddModal}>
              {translate('common', 'cancel')}
            </Button>
            <Button
              fullWidth
              loading={saving}
              onClick={acceptingLeadId ? handleAcceptSave : handleAdd}
            >
              {acceptingLeadId
                ? (lang === 'es' ? 'Aceptar' : 'Accept')
                : translate('clients', 'add_client')}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {services.length === 0 && (
            <div className="flex items-start gap-2.5 bg-brand-50 border border-brand-100 rounded-xl p-3">
              <AlertCircle size={16} className="text-brand-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-[13px] font-medium text-brand-800">
                  {lang === 'es'
                    ? 'Aún no tienes paquetes. Elige “+ Nuevo paquete” abajo para crear uno aquí mismo,'
                    : 'No packages yet. Pick “+ New package” below to create one right here,'}
                  {' '}
                  <Link href="/services">
                    <span className="text-brand-700 font-medium underline">
                      {lang === 'es' ? 'o ve a Servicios.' : 'or head to Services.'}
                    </span>
                  </Link>
                </p>
              </div>
            </div>
          )}

          <Input
            label={translate('clients', 'full_name') + ' *'}
            placeholder="Sarah Martinez"
            value={form.name}
            onChange={e => setField('name', e.target.value)}
            error={errors.name}
          />
          <div>
            <PhoneInput
              label={translate('clients', 'phone')}
              value={form.phone}
              onChange={val => setField('phone', val)}
              error={errors.phone}
            />
            {!errors.phone && form.phone && validatePhone(form.phone) && (
              <p className="text-[11px] text-brand-600 mt-1">
                ✓ {formatPhone(form.phone)}
              </p>
            )}
          </div>
          <div>
            <Input
              label={translate('clients', 'email')}
              placeholder="sarah@example.com"
              type="email"
              value={form.email}
              onChange={e => setField('email', e.target.value)}
              error={errors.email}
              hint={!errors.email ? (lang === 'es' ? 'Teléfono o email requerido' : 'Phone or email required') : undefined}
            />
            {(() => {
              const suggestion = suggestEmailCorrection(form.email)
              if (!suggestion || errors.email) return null
              return (
                <button
                  type="button"
                  onClick={() => setField('email', suggestion)}
                  className="text-[11px] text-brand-600 mt-1 underline"
                >
                  {lang === 'es' ? '¿Quisiste decir' : 'Did you mean'} {suggestion}?
                </button>
              )
            })()}
          </div>
          <Input
            label={translate('clients', 'address') + ' *'}
            placeholder={lang === 'es' ? 'Calle, Ciudad, Estado CP' : 'Street, City, State ZIP'}
            value={form.address}
            onChange={e => setField('address', e.target.value)}
            error={errors.address}
          />

          <Select
            label={translate('clients', 'package') + ' *'}
            value={form.serviceId}
            onChange={e => handlePackageSelect(e.target.value)}
            error={errors.serviceId}
          >
            <option value="">{translate('clients', 'select_package')}</option>
            {services.map(s => (
              <option key={s.id} value={s.id}>
                {s.label} · {formatCents(s.priceCents || 0)}
              </option>
            ))}
            <option value={NEW_PACKAGE}>
              {lang === 'es' ? '+ Nuevo paquete…' : '+ New package…'}
            </option>
          </Select>

          {/* Existing package — show summary + an editable per-client price so a
              bigger/smaller lot can be priced without a new package. */}
          {selectedService && (
            <div className="bg-brand-50 border border-brand-100 rounded-xl p-3 space-y-2.5">
              <div className="flex items-center gap-2">
                <Badge label={translate('packages', selectedService.packageType) || selectedService.packageType} variant={selectedService.packageType} />
                <p className="text-[12px] font-medium text-brand-800">{selectedService.label}</p>
              </div>
              {selectedService.description && (
                <p className="text-[12px] text-brand-600">{selectedService.description}</p>
              )}
              <Input
                label={lang === 'es' ? 'Precio para este cliente' : 'Price for this client'}
                type="number"
                min="0"
                step="0.01"
                inputMode="decimal"
                prefix="$"
                value={form.customPrice}
                onChange={e => setField('customPrice', e.target.value)}
                error={errors.customPrice}
                hint={lang === 'es'
                  ? `Precio del paquete: ${formatCents(selectedService.priceCents || 0)}. Ajústalo para lotes más grandes.`
                  : `Package price: ${formatCents(selectedService.priceCents || 0)}. Adjust it for bigger lots.`}
              />
              <p className="text-[12px] font-semibold text-brand-800">
                {translate('clients', 'client_pays')} {formatCents(resolvePackage().basePriceCents)} / {selectedService.packageType}
              </p>
              <p className="text-[10px] text-gray-400">
                {lang === 'es' ? '5.5% deducido de tu pago por factura' : '5.5% deducted from your payout per invoice'}
              </p>
            </div>
          )}

          {/* "+ New package" — create a custom package on the fly, optionally
              saving it to the catalog for reuse. Also the path a brand-new
              contractor with zero services takes to accept their first client. */}
          {isNewPackage && (
            <div className="bg-brand-50 border border-brand-100 rounded-xl p-3 space-y-3">
              <p className="text-[12px] font-semibold text-brand-800">
                {lang === 'es' ? 'Nuevo paquete' : 'New package'}
              </p>
              <Input
                label={(lang === 'es' ? 'Nombre del paquete' : 'Package name') + ' *'}
                placeholder={lang === 'es' ? 'Ej. Lote grande — quincenal' : 'e.g. Big lot — biweekly'}
                value={form.newPkgLabel}
                onChange={e => setField('newPkgLabel', e.target.value)}
                error={errors.newPkgLabel}
              />
              <Select
                label={lang === 'es' ? 'Frecuencia' : 'Frequency'}
                value={form.newPkgType}
                onChange={e => setField('newPkgType', e.target.value)}
              >
                {PACKAGE_TYPE_OPTIONS.map(o => (
                  <option key={o.value} value={o.value}>{lang === 'es' ? o.es : o.en}</option>
                ))}
              </Select>
              <Input
                label={(lang === 'es' ? 'Precio' : 'Price') + ' *'}
                type="number"
                min="0"
                step="0.01"
                inputMode="decimal"
                prefix="$"
                placeholder="120.00"
                value={form.newPkgPrice}
                onChange={e => setField('newPkgPrice', e.target.value)}
                error={errors.newPkgPrice}
              />
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.savePackage}
                  onChange={e => setField('savePackage', e.target.checked)}
                  className="w-4 h-4 accent-brand-600"
                />
                <span className="text-[12px] text-brand-800">
                  {lang === 'es' ? 'Guardar en mis paquetes para reutilizar' : 'Save to my packages for reuse'}
                </span>
              </label>
              <p className="text-[10px] text-gray-400">
                {lang === 'es' ? '5.5% deducido de tu pago por factura' : '5.5% deducted from your payout per invoice'}
              </p>
            </div>
          )}

          <Select
            label={translate('clients', 'billing_mode')}
            value={form.billingMode}
            onChange={e => setField('billingMode', e.target.value)}
          >
            {BILLING_OPTIONS.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </Select>

          <Select
            label={lang === 'es' ? 'Idioma para SMS' : 'SMS Language'}
            value={form.language}
            onChange={e => setField('language', e.target.value)}
          >
            <option value="en">English</option>
            <option value="es">Español</option>
          </Select>

          <Input
            label={translate('clients', 'notes')}
            placeholder={translate('clients', 'notes_hint')}
            value={form.notes}
            onChange={e => setField('notes', e.target.value)}
          />
        </div>
      </Modal>
    </AppShell>
  )
}