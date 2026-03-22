'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect } from 'react'
import { useAuth } from '@/context/AuthContext'
import { useLang } from '@/context/LangContext'
import AppShell from '@/components/layout/AppShell'
import PageHeader from '@/components/layout/PageHeader'
import { Card, Button, Badge, Modal, Input, Select, EmptyState, Skeleton } from '@/components/ui'
import { getServices, addService, updateService, deleteService } from '@/lib/db'
import { dollarsToCents, formatCents, getAddonFee } from '@/lib/fee'
import { Wrench, Plus, Trash2, Pencil, DollarSign, Package, CheckCircle2, Calendar } from 'lucide-react'
import toast from 'react-hot-toast'

const PACKAGE_FEE_MAP = {
  monthly:   1500,
  quarterly: 3500,
  annual:    10000,
  weekly:    500,
  onetime:   1000,
}

const DEFAULT_FORM = {
  serviceType:   'base',
  packageType:   'monthly',
  recurrence:    'biweekly',
  preferredDay:  '',
  label:         '',
  description:   '',
  includes:      '',
  pricingType:   'fixed',
  priceCents:    '',
}

export default function ServicesPage() {
  const { user }            = useAuth()
  const { translate, lang } = useLang()

  const SERVICE_TYPE_OPTIONS = [
    { value: 'base',  label: lang === 'es' ? 'Paquete base — servicio recurrente principal'     : 'Base package — your core recurring service' },
    { value: 'addon', label: lang === 'es' ? 'Servicio adicional — trabajo extra por separado'  : 'Add-on service — extra work billed separately' },
  ]

  const BASE_PACKAGE_OPTIONS = [
    { value: 'monthly',   label: lang === 'es' ? 'Mensual'    : 'Monthly'   },
    { value: 'quarterly', label: lang === 'es' ? 'Trimestral' : 'Quarterly' },
    { value: 'annual',    label: lang === 'es' ? 'Anual'      : 'Annual'    },
    { value: 'weekly',    label: lang === 'es' ? 'Semanal'    : 'Weekly'    },
    { value: 'onetime',   label: lang === 'es' ? 'Una vez'    : 'One-time'  },
  ]

  const RECURRENCE_OPTIONS = [
    { value: 'weekly',    label: lang === 'es' ? 'Cada semana (1x/semana)'       : 'Every week (1x/week)'         },
    { value: 'biweekly',  label: lang === 'es' ? 'Cada 2 semanas (2x/mes)'       : 'Every 2 weeks (2x/month)'     },
    { value: '3x_month',  label: lang === 'es' ? '3 veces al mes'                : '3 times per month'            },
    { value: 'monthly',   label: lang === 'es' ? 'Una vez al mes'                : 'Once a month'                 },
    { value: 'quarterly', label: lang === 'es' ? 'Una vez cada 3 meses'          : 'Once every 3 months'          },
    { value: 'annual',    label: lang === 'es' ? 'Una vez al año'                : 'Once a year'                  },
    { value: 'onetime',   label: lang === 'es' ? 'Solo una vez (sin recurrencia)': 'One-time only (no recurrence)'},
  ]

  const DAY_OPTIONS = [
    { value: '',          label: lang === 'es' ? 'Sin preferencia' : 'No preference' },
    { value: 'sunday',    label: lang === 'es' ? 'Domingo'   : 'Sunday'    },
    { value: 'monday',    label: lang === 'es' ? 'Lunes'     : 'Monday'    },
    { value: 'tuesday',   label: lang === 'es' ? 'Martes'    : 'Tuesday'   },
    { value: 'wednesday', label: lang === 'es' ? 'Miércoles' : 'Wednesday' },
    { value: 'thursday',  label: lang === 'es' ? 'Jueves'    : 'Thursday'  },
    { value: 'friday',    label: lang === 'es' ? 'Viernes'   : 'Friday'    },
    { value: 'saturday',  label: lang === 'es' ? 'Sábado'    : 'Saturday'  },
  ]

  const PRICING_TYPE_OPTIONS = [
    { value: 'fixed',    label: lang === 'es' ? 'Precio fijo'             : 'Fixed price'               },
    { value: 'variable', label: lang === 'es' ? 'Variable / cotizado'     : 'Variable / quoted per job' },
  ]

  const [services,  setServices]  = useState([])
  const [loading,   setLoading]   = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editing,   setEditing]   = useState(null)
  const [form,      setForm]      = useState(DEFAULT_FORM)
  const [errors,    setErrors]    = useState({})
  const [saving,    setSaving]    = useState(false)
  const [deleting,  setDeleting]  = useState(null)

  useEffect(() => {
    if (!user) return
    loadServices()
  }, [user])

  async function loadServices() {
    setLoading(true)
    try {
      setServices(await getServices(user.uid))
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

  function openAdd() {
    setEditing(null)
    setForm(DEFAULT_FORM)
    setErrors({})
    setShowModal(true)
  }

  function openEdit(service) {
    setEditing(service)
    setForm({
      serviceType:  service.serviceType  || 'addon',
      packageType:  service.packageType  || 'monthly',
      recurrence:   service.recurrence   || 'biweekly',
      preferredDay: service.preferredDay || '',
      label:        service.label        || '',
      description:  service.description  || '',
      includes:     service.includes     || '',
      pricingType:  service.pricingType  || 'fixed',
      priceCents:   service.pricingType === 'fixed' && service.priceCents
        ? (service.priceCents / 100).toString() : '',
    })
    setErrors({})
    setShowModal(true)
  }

  function validate() {
    const e = {}
    if (!form.label.trim()) e.label = translate('services', 'service_name') + ' *'
    if (form.serviceType === 'base') {
      if (!form.description.trim()) e.description = translate('services', 'description') + ' *'
      if (!form.priceCents || isNaN(parseFloat(form.priceCents))) e.priceCents = translate('services', 'base_price') + ' *'
    }
    if (form.serviceType === 'addon' && form.pricingType === 'fixed') {
      if (!form.priceCents || isNaN(parseFloat(form.priceCents))) e.priceCents = translate('services', 'price') + ' *'
    }
    setErrors(e)
    return Object.keys(e).length === 0
  }

  async function handleSave() {
    if (!validate()) return
    setSaving(true)
    try {
      const data = {
        serviceType:   form.serviceType,
        packageType:   form.serviceType === 'base' ? form.packageType   : null,
        recurrence:    form.serviceType === 'base' ? form.recurrence    : null,
        preferredDay:  form.serviceType === 'base' ? form.preferredDay  : null,
        label:         form.label.trim(),
        description:   form.description.trim(),
        includes:      form.includes.trim(),
        pricingType:   form.serviceType === 'base' ? 'fixed' : form.pricingType,
        priceCents:    (form.serviceType === 'base' || form.pricingType === 'fixed')
          ? dollarsToCents(form.priceCents) : null,
      }
      if (editing) {
        await updateService(editing.id, data)
        toast.success(translate('services', 'save_changes') + ' ✓')
      } else {
        await addService(user.uid, data)
        toast.success(translate('services', 'add_service') + ' ✓')
      }
      setShowModal(false)
      loadServices()
    } catch {
      toast.error(translate('common', 'error'))
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(service) {
    setDeleting(service.id)
    try {
      await deleteService(service.id)
      toast.success(translate('common', 'remove') + ' ✓')
      loadServices()
    } catch {
      toast.error(translate('common', 'error'))
    } finally {
      setDeleting(null)
    }
  }

  const baseServices  = services.filter(s => s.serviceType === 'base')
  const addonServices = services.filter(s => s.serviceType === 'addon')

  function getRecurrenceLabel(val) {
    return RECURRENCE_OPTIONS.find(o => o.value === val)?.label || val
  }

  return (
    <AppShell>
      <div className="page-content">
        <PageHeader
          title={translate('services', 'title')}
          subtitle={translate('services', 'subtitle')}
          actions={
            <Button icon={Plus} size="sm" onClick={openAdd}>
              {translate('services', 'add')}
            </Button>
          }
        />

        <div className="px-4 py-4 max-w-lg mx-auto space-y-5">

          {/* Base packages */}
          <section>
            <div className="flex items-center gap-2 mb-2">
              <Package size={13} className="text-brand-600" />
              <p className="text-[11px] font-medium text-gray-400 uppercase tracking-wide">
                {translate('services', 'base_packages')}
              </p>
            </div>

            {loading ? (
              <div className="space-y-2">{[...Array(2)].map((_, i) => <Skeleton key={i} className="h-24" />)}</div>
            ) : baseServices.length === 0 ? (
              <Card className="text-center py-6">
                <Package size={22} className="text-gray-300 mx-auto mb-2" />
                <p className="text-[13px] text-gray-400 mb-3">{translate('services', 'no_base')}</p>
                <Button icon={Plus} size="sm" variant="brand" onClick={openAdd}>
                  {translate('services', 'add_base')}
                </Button>
              </Card>
            ) : (
              <div className="space-y-3">
                {baseServices.map((service, i) => {
                  const fee   = PACKAGE_FEE_MAP[service.packageType] || 1000
                  const total = service.priceCents ? service.priceCents + fee : null
                  const includesList = service.includes
                    ? service.includes.split(',').map(s => s.trim()).filter(Boolean)
                    : []
                  return (
                    <Card key={service.id} padding={false}>
                      <div className="p-4">
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-[14px] font-semibold text-gray-900">{service.label}</p>
                            <Badge label={service.packageType} variant={service.packageType} />
                          </div>
                          <div className="flex items-center gap-1 flex-shrink-0">
                            <button onClick={() => openEdit(service)}
                              className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors">
                              <Pencil size={13} className="text-gray-400" />
                            </button>
                            <button onClick={() => handleDelete(service)}
                              disabled={deleting === service.id}
                              className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-red-50 transition-colors">
                              <Trash2 size={13} className="text-red-400" />
                            </button>
                          </div>
                        </div>

                        {service.recurrence && service.recurrence !== 'onetime' && (
                          <div className="flex items-center gap-1.5 mb-2">
                            <Calendar size={12} className="text-brand-500" />
                            <p className="text-[11px] text-brand-600 font-medium">
                              {getRecurrenceLabel(service.recurrence)}
                              {service.preferredDay && ` · ${service.preferredDay.charAt(0).toUpperCase() + service.preferredDay.slice(1)}s`}
                            </p>
                          </div>
                        )}

                        {service.description && (
                          <p className="text-[12px] text-gray-500 mb-2">{service.description}</p>
                        )}

                        {includesList.length > 0 && (
                          <div className="space-y-0.5 mb-3">
                            {includesList.map((item, j) => (
                              <div key={j} className="flex items-center gap-1.5">
                                <CheckCircle2 size={11} className="text-brand-500 flex-shrink-0" />
                                <p className="text-[11px] text-gray-500">{item}</p>
                              </div>
                            ))}
                          </div>
                        )}

                        <div className="flex items-center gap-3 pt-2 border-t border-gray-50">
                          {service.priceCents && (
                            <p className="text-[12px] font-semibold text-gray-800">{formatCents(service.priceCents)}</p>
                          )}
                          <p className="text-[11px] text-brand-600">+{formatCents(fee)} YardSync fee</p>
                          {total && (
                            <p className="text-[11px] text-gray-400">= {formatCents(total)}</p>
                          )}
                        </div>
                      </div>
                    </Card>
                  )
                })}
              </div>
            )}
          </section>

          {/* Add-on services */}
          <section>
            <div className="flex items-center gap-2 mb-2">
              <Wrench size={13} className="text-brand-600" />
              <p className="text-[11px] font-medium text-gray-400 uppercase tracking-wide">
                {translate('services', 'addons')}
              </p>
            </div>

            {loading ? (
              <div className="space-y-2">{[...Array(2)].map((_, i) => <Skeleton key={i} className="h-14" />)}</div>
            ) : addonServices.length === 0 ? (
              <Card className="text-center py-6">
                <Wrench size={22} className="text-gray-300 mx-auto mb-2" />
                <p className="text-[13px] text-gray-400 mb-3">{translate('services', 'no_addons')}</p>
                <Button icon={Plus} size="sm" variant="brand" onClick={openAdd}>
                  {translate('services', 'add_first')}
                </Button>
              </Card>
            ) : (
              <div className="space-y-2">
                {addonServices.map(service => {
                  const fee = service.pricingType === 'fixed' && service.priceCents
                    ? getAddonFee(service.priceCents) : null
                  return (
                    <Card key={service.id} padding={false}>
                      <div className="p-4 flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-gray-50 flex items-center justify-center flex-shrink-0">
                          <DollarSign size={15} className="text-gray-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-[14px] font-medium text-gray-900">{service.label}</p>
                            <Badge label={service.pricingType} variant={service.pricingType} />
                          </div>
                          {service.description && (
                            <p className="text-[12px] text-gray-400 truncate">{service.description}</p>
                          )}
                          <div className="flex items-center gap-2 mt-0.5">
                            {service.pricingType === 'fixed' ? (
                              <>
                                <p className="text-[12px] text-brand-600 font-medium">{formatCents(service.priceCents)}</p>
                                {fee && <p className="text-[11px] text-gray-400">+{formatCents(fee)} fee</p>}
                              </>
                            ) : (
                              <p className="text-[12px] text-gray-400">
                                {lang === 'es' ? 'Cotizado · +10% tarifa' : 'Quoted per job · +10% fee'}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          <button onClick={() => openEdit(service)}
                            className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors">
                            <Pencil size={13} className="text-gray-400" />
                          </button>
                          <button onClick={() => handleDelete(service)}
                            disabled={deleting === service.id}
                            className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-red-50 transition-colors">
                            <Trash2 size={13} className="text-red-400" />
                          </button>
                        </div>
                      </div>
                    </Card>
                  )
                })}
              </div>
            )}
          </section>

          {/* Fee info */}
          <Card className="bg-brand-50 border-brand-100">
            <p className="text-[12px] font-medium text-brand-800 mb-1">
              {translate('services', 'fee_structure')}
            </p>
            <p className="text-[11px] text-brand-600">
              {lang === 'es'
                ? 'Mensual +$15 · Trimestral +$35 · Anual +$100 · Semanal +$5 · Una vez 8% (mín $10)'
                : 'Monthly +$15 · Quarterly +$35 · Annual +$100 · Weekly +$5 · One-time 8% (min $10)'}
            </p>
            <p className="text-[11px] text-brand-600 mt-0.5">
              {lang === 'es'
                ? 'Adicionales: +10% incluido automáticamente en cada factura'
                : 'Add-ons: +10% automatically embedded in every invoice'}
            </p>
          </Card>

        </div>
      </div>

      {/* Modal */}
      <Modal
        open={showModal}
        onClose={() => setShowModal(false)}
        title={editing ? translate('services', 'edit_service') : translate('services', 'add_service')}
        footer={
          <>
            <Button variant="secondary" fullWidth onClick={() => setShowModal(false)}>
              {translate('common', 'cancel')}
            </Button>
            <Button fullWidth loading={saving} onClick={handleSave}>
              {editing ? translate('services', 'save_changes') : translate('services', 'add_service')}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Select
            label={translate('services', 'service_type')}
            value={form.serviceType}
            onChange={e => setField('serviceType', e.target.value)}
          >
            {SERVICE_TYPE_OPTIONS.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </Select>

          {form.serviceType === 'base' && (
            <>
              <Select label={translate('services', 'package_type')} value={form.packageType} onChange={e => setField('packageType', e.target.value)}>
                {BASE_PACKAGE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </Select>
              <Select
                label={translate('services', 'visit_schedule')}
                value={form.recurrence}
                onChange={e => setField('recurrence', e.target.value)}
              >
                {RECURRENCE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </Select>
              {form.recurrence !== 'onetime' && (
                <Select label={translate('services', 'preferred_day')} value={form.preferredDay} onChange={e => setField('preferredDay', e.target.value)}>
                  {DAY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </Select>
              )}
              <Input
                label={translate('services', 'package_name') + ' *'}
                placeholder={lang === 'es' ? 'Mensual Estándar...' : 'Standard Monthly...'}
                value={form.label}
                onChange={e => setField('label', e.target.value)}
                error={errors.label}
              />
              <div className="flex flex-col gap-1">
                <label className="text-[13px] font-medium text-gray-700">
                  {translate('services', 'description')} *
                </label>
                <textarea
                  placeholder={lang === 'es' ? 'Corte de césped, bordeado...' : 'Full lawn mow, edge trimming...'}
                  value={form.description}
                  onChange={e => setField('description', e.target.value)}
                  rows={3}
                  className="w-full rounded-xl border border-gray-200 bg-white text-[14px] px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none placeholder:text-gray-300"
                />
                {errors.description && <p className="text-[12px] text-red-500">{errors.description}</p>}
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[13px] font-medium text-gray-700">
                  {translate('services', 'whats_included')}
                </label>
                <input
                  placeholder={lang === 'es' ? 'Corte, Bordeado, Soplado...' : 'Lawn mow, Edge trim, Blow off...'}
                  value={form.includes}
                  onChange={e => setField('includes', e.target.value)}
                  className="w-full rounded-xl border border-gray-200 bg-white text-[14px] px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-brand-500 placeholder:text-gray-300"
                />
              </div>
              <Input
                label={translate('services', 'base_price') + ' *'}
                placeholder="65"
                type="number"
                prefix="$"
                value={form.priceCents}
                onChange={e => setField('priceCents', e.target.value)}
                error={errors.priceCents}
              />
            </>
          )}

          {form.serviceType === 'addon' && (
            <>
              <Input
                label={translate('services', 'service_name') + ' *'}
                placeholder={lang === 'es' ? 'Limpieza de hojas, Poda...' : 'Leaf removal, Hedge trimming...'}
                value={form.label}
                onChange={e => setField('label', e.target.value)}
                error={errors.label}
              />
              <Input
                label={translate('services', 'description')}
                placeholder={lang === 'es' ? 'Descripción breve...' : 'Brief description...'}
                value={form.description}
                onChange={e => setField('description', e.target.value)}
              />
              <Select label={translate('services', 'pricing_type')} value={form.pricingType} onChange={e => setField('pricingType', e.target.value)}>
                {PRICING_TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </Select>
              {form.pricingType === 'fixed' && (
                <Input
                  label={translate('services', 'price') + ' *'}
                  placeholder="45"
                  type="number"
                  prefix="$"
                  value={form.priceCents}
                  onChange={e => setField('priceCents', e.target.value)}
                  error={errors.priceCents}
                />
              )}
            </>
          )}
        </div>
      </Modal>
    </AppShell>
  )
}