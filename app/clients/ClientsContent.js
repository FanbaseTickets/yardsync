'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import { useLang } from '@/context/LangContext'
import AppShell from '@/components/layout/AppShell'
import PageHeader from '@/components/layout/PageHeader'
import { Card, Badge, Button, EmptyState, Skeleton, Modal, Input, Select } from '@/components/ui'
import { getClients, addClient, getServices } from '@/lib/db'
import { formatCents } from '@/lib/fee'
import { validatePhone, formatPhone } from '@/lib/phone'
import PhoneInput from '@/components/ui/PhoneInput'
import { Users, Plus, Search, MapPin, AlertCircle } from 'lucide-react'
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

const PACKAGE_FEE_MAP = {
  monthly:   1500,
  quarterly: 3500,
  annual:    10000,
  weekly:    500,
  onetime:   1000,
}

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
}

export default function ClientsPage() {
  const { user }            = useAuth()
  const { translate, lang } = useLang()
  const router              = useRouter()

  const [clients,  setClients]  = useState([])
  const [services, setServices] = useState([])
  const [loading,  setLoading]  = useState(true)
  const [search,   setSearch]   = useState('')
  const [showAdd,  setShowAdd]  = useState(false)
  const [form,     setForm]     = useState(DEFAULT_FORM)
  const [errors,   setErrors]   = useState({})
  const [saving,   setSaving]   = useState(false)

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

  function validate() {
    const e = {}
    if (!form.name.trim())    e.name      = translate('clients', 'full_name') + ' required'
    if (!form.phone.trim()) {
      e.phone = lang === 'es' ? 'Teléfono requerido' : 'Phone required'
    } else if (!validatePhone(form.phone)) {
      e.phone = lang === 'es'
        ? 'Ingresa un número válido (10 dígitos)'
        : 'Enter a valid phone number (10 digits)'
    }
    if (!form.address.trim()) e.address   = translate('clients', 'address') + ' required'
    if (!form.serviceId)      e.serviceId = translate('clients', 'select_package')
    setErrors(e)
    return Object.keys(e).length === 0
  }

  async function handleAdd() {
    if (!validate()) return
    setSaving(true)
    try {
      await addClient(user.uid, {
        name:            form.name.trim(),
        phone:           formatPhone(form.phone.trim()),
        email:           form.email.trim(),
        address:         form.address.trim(),
        notes:           form.notes.trim(),
        billingMode:     form.billingMode,
        language:        form.language,
        serviceId:       form.serviceId,
        packageType:     selectedService?.packageType    || 'monthly',
        basePriceCents:  selectedService?.priceCents     || 6500,
        packageLabel:    selectedService?.label          || '',
        packageDesc:     selectedService?.description    || '',
        packageIncludes: selectedService?.includes       || '',
        recurrence:      selectedService?.recurrence     || 'biweekly',
        preferredDay:    selectedService?.preferredDay   || '',
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

  const filtered      = clients.filter(c =>
    c.name?.toLowerCase().includes(search.toLowerCase()) ||
    c.address?.toLowerCase().includes(search.toLowerCase())
  )
  const activeCount   = clients.filter(c => c.status === 'active').length
  const inactiveCount = clients.filter(c => c.status !== 'active').length

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

          {loading ? (
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
          )}
        </div>
      </div>

      <Modal
        open={showAdd}
        onClose={() => { setShowAdd(false); setForm(DEFAULT_FORM); setErrors({}) }}
        title={translate('clients', 'add_client')}
        footer={
          <>
            <Button variant="secondary" fullWidth onClick={() => setShowAdd(false)}>
              {translate('common', 'cancel')}
            </Button>
            <Button fullWidth loading={saving} onClick={handleAdd} disabled={services.length === 0}>
              {translate('clients', 'add_client')}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {services.length === 0 && (
            <div className="flex items-start gap-2.5 bg-amber-50 border border-amber-100 rounded-xl p-3">
              <AlertCircle size={16} className="text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-[13px] font-medium text-amber-800">
                  {translate('clients', 'no_packages')}
                </p>
                <Link href="/services">
                  <span className="text-[12px] text-amber-700 font-medium underline">
                    {translate('clients', 'go_to_services')}
                  </span>
                </Link>
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
              label={translate('clients', 'phone') + ' *'}
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
          <Input
            label={translate('clients', 'email')}
            placeholder="sarah@example.com"
            value={form.email}
            onChange={e => setField('email', e.target.value)}
          />
          <Input
            label={translate('clients', 'address') + ' *'}
            placeholder="4821 Maple Dr..."
            value={form.address}
            onChange={e => setField('address', e.target.value)}
            error={errors.address}
          />

          <Select
            label={translate('clients', 'package') + ' *'}
            value={form.serviceId}
            onChange={e => setField('serviceId', e.target.value)}
            error={errors.serviceId}
            disabled={services.length === 0}
          >
            <option value="">{translate('clients', 'select_package')}</option>
            {services.map(s => (
              <option key={s.id} value={s.id}>
                {s.label} · {formatCents(s.priceCents || 0)}
              </option>
            ))}
          </Select>

          {selectedService && (
            <div className="bg-brand-50 border border-brand-100 rounded-xl p-3 space-y-1.5">
              <div className="flex items-center gap-2">
                <Badge label={translate('packages', selectedService.packageType) || selectedService.packageType} variant={selectedService.packageType} />
                <p className="text-[12px] font-medium text-brand-800">{selectedService.label}</p>
              </div>
              {selectedService.description && (
                <p className="text-[12px] text-brand-600">{selectedService.description}</p>
              )}
              <p className="text-[12px] font-semibold text-brand-800 pt-1">
                {translate('clients', 'client_pays')} {formatCents(
                  (selectedService.priceCents || 0) +
                  (PACKAGE_FEE_MAP[selectedService.packageType] || 1000)
                )} / {selectedService.packageType}
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