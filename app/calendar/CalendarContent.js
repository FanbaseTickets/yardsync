'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import { useLang } from '@/context/LangContext'
import AppShell from '@/components/layout/AppShell'
import PageHeader from '@/components/layout/PageHeader'
import { Card, Button, Badge, Modal, Select, EmptyState, Skeleton, Input } from '@/components/ui'
import { getClients, getSchedules, addSchedule, updateSchedule, deleteSchedule, getServices, updateScheduleMaterials, saveInvoice, getClientInvoices } from '@/lib/db'
import { deleteAllClientSchedules } from '@/lib/db'
import { formatCents } from '@/lib/fee'
import { validatePhone, formatPhone } from '@/lib/phone'
import PhoneInput from '@/components/ui/PhoneInput'
import {
  ChevronLeft, ChevronRight, ChevronDown, Plus, CalendarDays,
  Trash2, CheckCircle2, RefreshCw, AlertTriangle, Zap, DollarSign, Package, X, ArrowUp, ArrowDown, Route
} from 'lucide-react'
import toast from 'react-hot-toast'

import { fmt } from '@/lib/date'
import { formatDateLocalized } from '@/lib/i18n'
function startOfMonth(date)  { return new Date(date.getFullYear(), date.getMonth(), 1) }
function endOfMonth(date)    { return new Date(date.getFullYear(), date.getMonth() + 1, 0) }
function eachDayOfInterval({ start, end }) {
  const days = []; const cur = new Date(start)
  while (cur <= end) { days.push(new Date(cur)); cur.setDate(cur.getDate() + 1) }
  return days
}
function isToday(date) {
  const t = new Date()
  return date.getFullYear() === t.getFullYear() && date.getMonth() === t.getMonth() && date.getDate() === t.getDate()
}
function isSameDay(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}
function addWeeks(date, n)  { const d = new Date(date); d.setDate(d.getDate() + n * 7); return d }
function addMonths(date, n) { const d = new Date(date); d.setMonth(d.getMonth() + n); return d }
function addDays(date, n)   { const d = new Date(date); d.setDate(d.getDate() + n); return d }

const TIMES = [
  '6:00 AM','6:30 AM','7:00 AM','7:30 AM','8:00 AM','8:30 AM','9:00 AM','9:30 AM',
  '10:00 AM','10:30 AM','11:00 AM','11:30 AM','12:00 PM','12:30 PM',
  '1:00 PM','1:30 PM','2:00 PM','2:30 PM','3:00 PM','3:30 PM',
  '4:00 PM','4:30 PM','5:00 PM','5:30 PM','6:00 PM','6:30 PM','7:00 PM',
]

const OCCURRENCE_OPTIONS = [
  { value: '4',  label: '4' },
  { value: '6',  label: '6' },
  { value: '8',  label: '8' },
  { value: '12', label: '12' },
  { value: '24', label: '24' },
  { value: '52', label: '52' },
]


function generateOccurrences(startDate, recurrence, count) {
  const dates = [startDate]
  let current = startDate
  for (let i = 1; i < parseInt(count); i++) {
    switch (recurrence) {
      case 'weekly':    current = addWeeks(current, 1);   break
      case 'biweekly':  current = addWeeks(current, 2);   break
      case '3x_month':  current = addDays(current, 10);   break
      case 'monthly':   current = addMonths(current, 1);  break
      case 'quarterly': current = addMonths(current, 3);  break
      case 'annual':    current = addMonths(current, 12); break
      default:          current = addWeeks(current, 2)
    }
    dates.push(current)
  }
  return dates
}

function toDateStr(date) {
  const d = new Date(date)
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}

function AddonSelector({ addonServices, lang, fixedAddons, setFixedAddons, variables, setVariables }) {
  if (addonServices.length === 0) return null
  const total = addonServices.filter(s => s.pricingType === 'variable').reduce((s, svc) => {
    const val = variables[svc.id]
    return s + (val && parseFloat(val) > 0 ? Math.round(parseFloat(val) * 100) : 0)
  }, 0) + fixedAddons.reduce((s, a) => s + (a.amountCents || 0), 0)
  return (
    <div>
      <p className="text-[13px] font-medium text-gray-700 mb-2">
        {lang === 'es' ? 'Servicios adicionales' : 'Add-on services'}
      </p>
      <div className="space-y-2">
        {addonServices.map(service => {
          const isFixed   = service.pricingType === 'fixed'
          const isChecked = fixedAddons.find(a => a.id === service.id)
          return (
            <div key={service.id} className="bg-gray-50 rounded-xl p-3">
              {isFixed ? (
                <label className="flex items-center gap-3 cursor-pointer">
                  <input type="checkbox" checked={!!isChecked}
                    onChange={() => setFixedAddons(prev => {
                      const exists = prev.find(a => a.id === service.id)
                      if (exists) return prev.filter(a => a.id !== service.id)
                      return [...prev, { id: service.id, label: service.label, amountCents: service.priceCents }]
                    })}
                    className="w-4 h-4 rounded accent-brand-600" />
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-medium text-gray-800">{service.label}</p>
                    {service.description && <p className="text-[11px] text-gray-400">{service.description}</p>}
                  </div>
                  <p className="text-[13px] font-semibold text-brand-600 flex-shrink-0">{formatCents(service.priceCents)}</p>
                </label>
              ) : (
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <div>
                      <p className="text-[13px] font-medium text-gray-800">{service.label}</p>
                      {service.description && <p className="text-[11px] text-gray-400">{service.description}</p>}
                    </div>
                    <span className="text-[11px] text-gray-400 ml-2">{lang === 'es' ? 'Cotizado' : 'Variable'}</span>
                  </div>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                    <input type="number" placeholder="0.00" value={variables[service.id] || ''}
                      onChange={e => setVariables(prev => ({ ...prev, [service.id]: e.target.value }))}
                      onWheel={e => e.target.blur()}
                      className="w-full pl-7 pr-3 py-2 rounded-lg border border-gray-200 text-[13px] focus:outline-none focus:ring-2 focus:ring-brand-500" />
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
      {total > 0 && (
        <div className="mt-2 flex justify-between text-[12px]">
          <span className="text-gray-500">{lang === 'es' ? 'Total adicionales:' : 'Add-on total:'}</span>
          <span className="font-semibold text-brand-600">{formatCents(total)}</span>
        </div>
      )}
    </div>
  )
}

export default function CalendarPage() {
  const router              = useRouter()
  const { user, profile }   = useAuth()
  const { translate, lang } = useLang()
  const [mounted, setMounted] = useState(false)

  useEffect(() => { setMounted(true) }, [])

  const REPEAT_OPTIONS = [
    { value: 'none',      label: lang === 'es' ? 'Solo esta vez'        : 'Just this once'      },
    { value: 'weekly',    label: lang === 'es' ? 'Cada semana'          : 'Every week'          },
    { value: 'biweekly',  label: lang === 'es' ? 'Cada 2 semanas'       : 'Every 2 weeks'       },
    { value: '3x_month',  label: lang === 'es' ? '3 veces al mes'       : '3 times per month'   },
    { value: 'monthly',   label: lang === 'es' ? 'Una vez al mes'       : 'Once a month'        },
    { value: 'quarterly', label: lang === 'es' ? 'Una vez cada 3 meses' : 'Once every 3 months' },
    { value: 'annual',    label: lang === 'es' ? 'Una vez al año'       : 'Once a year'         },
  ]

  const [currentDate,     setCurrentDate]     = useState(new Date())
  const [clients,         setClients]         = useState([])
  const [addonServices,   setAddonServices]   = useState([])
  const [schedules,       setSchedules]       = useState([])
  const [loading,         setLoading]         = useState(true)
  const [selectedDay,     setSelectedDay]     = useState(null)

  const [showAddModal,    setShowAddModal]    = useState(false)
  const [selectedClient,  setSelectedClient]  = useState('')
  const [selectedTime,    setSelectedTime]    = useState('9:00 AM')
  const [repeatMode,      setRepeatMode]      = useState('none')
  const [occurrences,     setOccurrences]     = useState('8')
  const [saving,          setSaving]          = useState(false)
  const [showPreview,     setShowPreview]     = useState(false)
  const [selectedAddons,  setSelectedAddons]  = useState([])
  const [variableInputs,  setVariableInputs]  = useState({})

  const [showWalkIn,       setShowWalkIn]       = useState(false)
  const [walkInName,       setWalkInName]       = useState('')
  const [walkInPhone,      setWalkInPhone]      = useState('')
  const [walkInEmail,      setWalkInEmail]      = useState('')
  const [walkInPhoneError, setWalkInPhoneError] = useState('')
  const [walkInPrice,      setWalkInPrice]      = useState('')
  const [walkInAddons,     setWalkInAddons]     = useState([])
  const [walkInVariables,  setWalkInVariables]  = useState({})
  const [walkInTime,       setWalkInTime]       = useState('9:00 AM')
  const [savingWalkIn,     setSavingWalkIn]     = useState(false)

  const [showWalkInInvoice,   setShowWalkInInvoice]   = useState(false)
  const [walkInInvoiceTarget, setWalkInInvoiceTarget] = useState(null)
  const [walkInInvAddons,     setWalkInInvAddons]     = useState([])
  const [walkInInvVariables,  setWalkInInvVariables]  = useState({})
  const [invoicingWalkIn,     setInvoicingWalkIn]     = useState(false)

  const [deleteTarget,    setDeleteTarget]    = useState(null)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deleting,        setDeleting]        = useState(false)
  const [materialsTarget, setMaterialsTarget] = useState(null)
  const [materialsRows,   setMaterialsRows]   = useState([])
  const [materialsSaving, setMaterialsSaving] = useState(false)

  const [expandedId, setExpandedId] = useState(null)

  const [extraTarget,      setExtraTarget]      = useState(null)
  const [extraCustomLabel, setExtraCustomLabel] = useState('')
  const [extraCustomPrice, setExtraCustomPrice] = useState('')
  const [extraSaving,      setExtraSaving]      = useState(false)

  const [sendingInvoiceId, setSendingInvoiceId] = useState(null)
  const [invoicePreview,   setInvoicePreview]   = useState(null)
  const [dayFilter,        setDayFilter]        = useState('all') // 'all' | 'pending' | 'completed' | 'route'
  const [completePrompt, setCompletePrompt] = useState(null)
  const [matDisplay,      setMatDisplay]      = useState({})

  const monthStart = startOfMonth(currentDate)
  const monthEnd   = endOfMonth(currentDate)
  const monthDays  = eachDayOfInterval({ start: monthStart, end: monthEnd })
  const startPad   = monthStart.getDay()

  useEffect(() => {
    if (!user) return
    loadData()
  }, [user, currentDate])

  async function loadData() {
    setLoading(true)
    try {
      const [c, s, svc] = await Promise.all([
        getClients(user.uid),
        getSchedules(user.uid, toDateStr(monthStart), toDateStr(monthEnd)),
        getServices(user.uid),
      ])
      setClients(c)
      setSchedules(s)
      setAddonServices(svc.filter(sv => sv.serviceType === 'addon'))
    } catch {
      toast.error(translate('common', 'error'))
    } finally {
      setLoading(false)
    }
  }

  function getSchedulesForDay(date) {
    return schedules.filter(s => s.serviceDate === toDateStr(date))
  }

  function handleClientSelect(clientId) {
    setSelectedClient(clientId)
    const client = clients.find(c => c.id === clientId)
    if (client?.recurrence && client.recurrence !== 'onetime') {
      setRepeatMode(client.recurrence)
      const countMap = { weekly: '12', biweekly: '8', '3x_month': '6', monthly: '6', quarterly: '4', annual: '2' }
      setOccurrences(countMap[client.recurrence] || '8')
    } else {
      setRepeatMode('none')
    }
  }

  function openAddModal() {
    if (!selectedDay) return
    if (clients.length === 0) {
      toast.error(lang === 'es' ? 'Agrega un cliente antes de programar un trabajo' : 'Add a client first before scheduling a job')
      return
    }
    const firstClient = clients[0]
    setSelectedClient(firstClient?.id || '')
    setSelectedTime('9:00 AM')
    setShowPreview(false)
    setSelectedAddons([])
    setVariableInputs({})
    if (firstClient?.recurrence && firstClient.recurrence !== 'onetime') {
      setRepeatMode(firstClient.recurrence)
      const countMap = { weekly: '12', biweekly: '8', '3x_month': '6', monthly: '6', quarterly: '4', annual: '2' }
      setOccurrences(countMap[firstClient.recurrence] || '8')
    } else {
      setRepeatMode('none')
      setOccurrences('8')
    }
    setShowAddModal(true)
  }

  function openExtraModal(schedule) {
    setExtraTarget(schedule)
    setExtraCustomLabel('')
    setExtraCustomPrice('')
    setExpandedId(null)
  }

  async function appendExtraToSchedule(schedule, newExtra) {
    setExtraSaving(true)
    try {
      const currentAddons = schedule.addons || []
      const updatedAddons = [...currentAddons, newExtra]
      await updateSchedule(schedule.id, { addons: updatedAddons })
      toast.success(lang === 'es' ? 'Servicio agregado ✓' : 'Service added ✓')
      setExtraTarget(null)
      loadData()
    } catch (e) {
      toast.error(lang === 'es' ? 'Error al guardar' : 'Failed to save')
    } finally {
      setExtraSaving(false)
    }
  }

  function addSavedExtra(service) {
    if (!extraTarget) return
    const amountCents = service.priceCents || 0
    if (service.pricingType === 'variable') {
      const val = prompt(lang === 'es' ? `Ingresa el precio para ${service.label}:` : `Enter price for ${service.label}:`)
      if (!val || parseFloat(val) <= 0) return
      appendExtraToSchedule(extraTarget, {
        id: `${service.id}-${Date.now()}`,
        label: service.label,
        amountCents: Math.round(parseFloat(val) * 100),
      })
    } else {
      appendExtraToSchedule(extraTarget, {
        id: `${service.id}-${Date.now()}`,
        label: service.label,
        amountCents,
      })
    }
  }

  function addCustomExtra() {
    if (!extraTarget) return
    const label = extraCustomLabel.trim()
    const price = parseFloat(extraCustomPrice)
    if (!label || !price || price <= 0) {
      toast.error(lang === 'es' ? 'Ingresa nombre y precio' : 'Enter label and price')
      return
    }
    appendExtraToSchedule(extraTarget, {
      id: `custom-${Date.now()}`,
      label,
      amountCents: Math.round(price * 100),
    })
  }

  function handleSendInvoice(schedule) {
    const isWalkIn  = !!schedule.isWalkIn
    const c         = isWalkIn ? null : clientMap[schedule.clientId]
    const clientName  = isWalkIn ? (schedule.clientName || 'Walk-in') : (c?.name || schedule.clientName || '')
    const clientEmail = (isWalkIn ? schedule.clientEmail : c?.email) || ''
    const clientPhone = (isWalkIn ? schedule.clientPhone : c?.phone) || ''

    if (!profile?.stripeAccountId) {
      toast.error(lang === 'es' ? 'Conecta Stripe primero' : 'Connect Stripe first')
      return
    }

    // Recurring clients have base already covered by their monthly/annual plan —
    // the calendar invoice only bills per-visit extras + materials. Walk-ins bill the base too.
    const baseCents = isWalkIn ? (schedule.basePrice || 0) : 0
    const baseLabel = isWalkIn ? (clientName || 'Walk-in service') : ''
    const extras    = schedule.addons || []
    const materials = schedule.materials || []
    const extrasSum = extras.reduce((s, a) => s + (a.amountCents || 0), 0)
    const matsSum   = materials.reduce((s, m) => s + (m.totalCents || 0), 0)
    const totalCents = baseCents + extrasSum + matsSum

    if (totalCents <= 0) {
      toast.error(
        isWalkIn
          ? (lang === 'es' ? 'El total debe ser mayor a $0' : 'Total must be greater than $0')
          : (lang === 'es' ? 'Sin extras ni materiales — la base ya está cubierta por el plan' : 'No extras or materials to bill — base is already covered by the plan')
      )
      return
    }

    if (!clientPhone && !clientEmail) {
      toast.error(lang === 'es' ? 'Falta teléfono o correo del cliente' : 'Client needs a phone or email')
      return
    }

    const lineItems = [
      ...(baseCents > 0 ? [{ label: baseLabel, amountCents: baseCents, category: 'base' }] : []),
      ...extras.map(a => ({ label: a.label, amountCents: a.amountCents, category: 'addon' })),
      ...materials.map(m => ({ label: m.name, amountCents: m.totalCents || 0, category: 'material' })),
    ]

    setInvoicePreview({
      schedule, isWalkIn, clientName, clientEmail, clientPhone,
      baseLabel, baseCents, extras, materials, totalCents, lineItems,
    })
  }

  async function confirmSendInvoice() {
    const p = invoicePreview
    if (!p) return
    const { schedule, isWalkIn, clientName, clientEmail, clientPhone, totalCents, lineItems } = p
    setSendingInvoiceId(schedule.id)
    try {
      const res = await fetch('/api/stripe/invoice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stripeAccountId: profile.stripeAccountId,
          totalCents,
          lineItems,
          clientName,
          clientEmail,
          clientPhone,
          description: `YardSync invoice — ${clientName}`,
          gardenerUid: user.uid,
          clientId: schedule.clientId || null,
          invoiceType: isWalkIn ? 'addon' : 'recurring',
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Invoice failed')

      if (clientPhone && data.paymentUrl) {
        const smsBody = lang === 'es'
          ? `Hola ${clientName}! Tu factura de $${(totalCents / 100).toFixed(2)} está lista. Paga aquí: ${data.paymentUrl}`
          : `Hi ${clientName}! Your invoice for $${(totalCents / 100).toFixed(2)} is ready. Pay here: ${data.paymentUrl}`
        fetch('/api/twilio/send', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ clientPhone, message: smsBody }),
        }).catch(err => console.error('Invoice SMS failed (non-fatal):', err))
        toast.success(lang === 'es' ? 'Factura enviada ✓' : 'Invoice sent ✓')
      } else {
        toast.success(lang === 'es' ? 'Factura creada ✓' : 'Invoice created ✓')
      }
      setExpandedId(null)
      setInvoicePreview(null)
      loadData()
    } catch (e) {
      toast.error(e.message || (lang === 'es' ? 'Error al enviar' : 'Failed to send'))
    } finally {
      setSendingInvoiceId(null)
    }
  }

  function openWalkInForClient(schedule) {
    const c = clientMap[schedule.clientId]
    setWalkInName(c?.name || schedule.clientName || '')
    setWalkInPhone(c?.phone || schedule.clientPhone || '')
    setWalkInEmail(c?.email || schedule.clientEmail || '')
    setWalkInPhoneError('')
    setWalkInPrice(''); setWalkInAddons([]); setWalkInVariables({})
    setWalkInTime('9:00 AM')
    setExpandedId(null)
    setShowWalkIn(true)
  }

  function openWalkInModal() {
    if (!selectedDay) return
    setWalkInName(''); setWalkInPhone(''); setWalkInEmail(''); setWalkInPhoneError('')
    setWalkInPrice(''); setWalkInAddons([]); setWalkInVariables({})
    setWalkInTime('9:00 AM')
    setShowWalkIn(true)
  }

  function openWalkInInvoice(schedule) {
    setWalkInInvoiceTarget(schedule)
    setWalkInInvAddons([]); setWalkInInvVariables({})
    setShowWalkInInvoice(true)
  }

  function buildFinalAddons(fixedAddons, variableVals) {
    const result = [...fixedAddons]
    addonServices.filter(s => s.pricingType === 'variable').forEach(s => {
      const val = variableVals[s.id]
      if (val && parseFloat(val) > 0) result.push({ id: s.id, label: s.label, amountCents: Math.round(parseFloat(val) * 100) })
    })
    return result
  }

  function getAddonTotal(fixedAddons, variableVals) {
    const fixed    = fixedAddons.reduce((s, a) => s + (a.amountCents || 0), 0)
    const variable = addonServices.filter(s => s.pricingType === 'variable').reduce((s, svc) => {
      const val = variableVals[svc.id]
      return s + (val && parseFloat(val) > 0 ? Math.round(parseFloat(val) * 100) : 0)
    }, 0)
    return fixed + variable
  }

  const previewDates = selectedDay && repeatMode !== 'none'
    ? generateOccurrences(selectedDay, repeatMode, occurrences)
    : selectedDay ? [selectedDay] : []

  async function handleAddSchedule() {
    if (!selectedClient || !selectedDay) return
    setSaving(true)
    try {
      const client      = clients.find(c => c.id === selectedClient)
      const datesToAdd  = repeatMode === 'none' ? [selectedDay] : generateOccurrences(selectedDay, repeatMode, occurrences)
      const finalAddons = buildFinalAddons(selectedAddons, variableInputs)
      await Promise.all(datesToAdd.map(date => addSchedule(user.uid, {
        clientId: selectedClient, clientName: client?.name || '',
        serviceDate: toDateStr(date), time: selectedTime,
        status: 'scheduled', recurrence: repeatMode, isRecurring: repeatMode !== 'none', addons: finalAddons,
      })))
      toast.success(datesToAdd.length === 1
        ? `${translate('calendar', 'add_job')} ✓`
        : `${datesToAdd.length} ${translate('calendar', 'visits')} ${lang === 'es' ? 'programadas para' : 'scheduled for'} ${client?.name || ''}!`)
      setShowAddModal(false); loadData()
    } catch { toast.error(translate('common', 'error')) }
    finally { setSaving(false) }
  }

  async function handleAddWalkIn() {
    if (!walkInName.trim()) {
      toast.error(lang === 'es' ? 'El nombre es requerido' : 'Name is required')
      return
    }
    if (!selectedDay) return
    if (walkInPhone.trim() && !validatePhone(walkInPhone)) {
      setWalkInPhoneError(lang === 'es' ? 'Ingresa un número válido (10 dígitos)' : 'Enter a valid phone number (10 digits)')
      return
    }
    setWalkInPhoneError('')
    setSavingWalkIn(true)
    try {
      const finalAddons    = buildFinalAddons(walkInAddons, walkInVariables)
      const basePrice      = walkInPrice && parseFloat(walkInPrice) > 0 ? Math.round(parseFloat(walkInPrice) * 100) : 0
      const formattedPhone = walkInPhone.trim() ? formatPhone(walkInPhone) : ''
      await addSchedule(user.uid, {
        clientId: null, clientName: walkInName.trim(), clientPhone: formattedPhone,
        clientEmail: walkInEmail.trim(),
        serviceDate: toDateStr(selectedDay), time: walkInTime,
        status: 'scheduled', isWalkIn: true, isRecurring: false, basePrice, addons: finalAddons,
      })
      if (!formattedPhone) {
        toast.success(lang === 'es' ? 'Trabajo agregado — agrega teléfono para enviar factura' : 'Job added but no payment link sent — add a phone number to send the invoice')
      } else {
        toast.success(lang === 'es' ? 'Cliente ocasional agregado ✓' : 'Walk-in added ✓')
      }
      setShowWalkIn(false); loadData()
    } catch { toast.error(translate('common', 'error')) }
    finally { setSavingWalkIn(false) }
  }

  async function handleWalkInInvoice() {
    if (!walkInInvoiceTarget) return
    setInvoicingWalkIn(true)
    try {
      const basePrice   = walkInInvoiceTarget.basePrice || 0
      const finalAddons = buildFinalAddons(walkInInvAddons, walkInInvVariables)
      const materials   = walkInInvoiceTarget.materials || []
      const materialsTotalCents = materials.reduce((s, m) => s + (m.totalCents || 0), 0)
      const lineItems = [
        { label: walkInInvoiceTarget.clientName || 'Walk-in service', amountCents: basePrice, category: 'base' },
        ...finalAddons.map(a => ({ label: a.label, amountCents: a.amountCents, category: 'addon' })),
        ...materials.map(m => ({ label: m.name, amountCents: m.totalCents || 0, category: 'material' })),
      ]
      const totalCents = basePrice + finalAddons.reduce((s, a) => s + a.amountCents, 0) + materialsTotalCents
      const res = await fetch('/api/stripe/invoice', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stripeAccountId: profile?.stripeAccountId,
          totalCents,
          lineItems,
          clientName:  walkInInvoiceTarget.clientName,
          clientEmail: walkInInvoiceTarget.clientEmail || '',
          clientPhone: walkInInvoiceTarget.clientPhone || '',
          description: 'YardSync walk-in service invoice',
          gardenerUid: user.uid,
          clientId:    null,
          invoiceType: 'addon',
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Invoice failed')

      // Send payment link via SMS
      if (walkInInvoiceTarget.clientPhone && data.paymentUrl) {
        const smsBody = lang === 'es'
          ? `Hola ${walkInInvoiceTarget.clientName}! Tu factura de $${(totalCents / 100).toFixed(2)} está lista. Paga aquí: ${data.paymentUrl}`
          : `Hi ${walkInInvoiceTarget.clientName}! Your invoice for $${(totalCents / 100).toFixed(2)} is ready. Pay here: ${data.paymentUrl}`
        fetch('/api/twilio/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ clientPhone: walkInInvoiceTarget.clientPhone, message: smsBody }),
        }).catch(err => console.error('Walk-in SMS failed (non-fatal):', err))
        toast.success(lang === 'es' ? 'Factura enviada ✓' : 'Invoice sent ✓')
      } else {
        toast.success(lang === 'es' ? 'Factura creada. Agrega teléfono para enviar link de pago.' : 'Invoice created. Add client\'s phone number to send payment link.')
      }
      setShowWalkInInvoice(false); loadData()
    } catch (err) { toast.error(err.message || translate('common', 'error')) }
    finally { setInvoicingWalkIn(false) }
  }

  async function handleComplete(schedule) {
    try {
      await updateSchedule(schedule.id, { status: 'completed' })
      loadData()

      // For walk-in or no clientId — just show toast
      if (!schedule.clientId || schedule.isWalkIn) {
        toast.success('✓')
        return
      }

      // Check if a paid invoice already exists this billing period
      const client = clientMap[schedule.clientId]
      const pkg = client?.packageType || 'onetime'
      const now = new Date()

      let periodStart = null
      if (pkg === 'monthly') {
        periodStart = new Date(now.getFullYear(), now.getMonth(), 1)
      } else if (pkg === 'quarterly') {
        periodStart = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1)
      } else if (pkg === 'annual') {
        periodStart = new Date(now.getFullYear(), 0, 1)
      } else if (pkg === 'weekly') {
        periodStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay())
      }
      // onetime or unknown: periodStart stays null — always show prompt

      try {
        const clientInvoices = await getClientInvoices(schedule.clientId)
        const hasPaidInPeriod = periodStart && clientInvoices.some(inv => {
          if (inv.status !== 'paid') return false
          const d = inv.createdAt?.toDate ? inv.createdAt.toDate() : new Date(inv.createdAt || 0)
          return d >= periodStart
        })

        if (hasPaidInPeriod) {
          toast.success(lang === 'es' ? 'Trabajo completo — ya facturado ✓' : 'Job complete — already invoiced ✓')
        } else {
          setCompletePrompt(schedule)
        }
      } catch {
        // If invoice check fails, still show prompt
        setCompletePrompt(schedule)
      }
    } catch { toast.error(translate('common', 'error')) }
  }

  function promptDelete(schedule) { setDeleteTarget(schedule); setShowDeleteModal(true) }

  async function handleDeleteOne() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await deleteSchedule(deleteTarget.id)
      toast.success(translate('calendar', 'remove_visit') + ' ✓')
      setShowDeleteModal(false); setDeleteTarget(null); loadData()
    } catch { toast.error(translate('common', 'error')) }
    finally { setDeleting(false) }
  }

  async function handleDeleteAll() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      const count = await deleteAllClientSchedules(user.uid, deleteTarget.clientId)
      toast.success(`${count} ${translate('calendar', 'visits')} ✓`)
      setShowDeleteModal(false); setDeleteTarget(null); loadData()
    } catch { toast.error(translate('common', 'error')) }
    finally { setDeleting(false) }
  }

  function openMaterials(schedule) {
    setMaterialsTarget(schedule)
    const rows = schedule.materials?.length > 0
      ? schedule.materials.map(m => ({ ...m }))
      : [{ id: Date.now().toString(), name: '', qty: 1, unitCostCents: 0, totalCents: 0 }]
    setMaterialsRows(rows)
    const display = {}
    rows.forEach(r => {
      display[r.id] = { qty: String(r.qty || 1), cost: ((r.unitCostCents || 0) / 100).toFixed(2) }
    })
    setMatDisplay(display)
  }

  function addMaterialRow() {
    const newId = `${Date.now()}-${Math.random().toString(36).slice(2)}`
    setMaterialsRows(prev => [...prev, { id: newId, name: '', qty: 1, unitCostCents: 0, totalCents: 0 }])
    setMatDisplay(prev => ({ ...prev, [newId]: { qty: '1', cost: '0.00' } }))
  }

  function updateMaterialRow(id, field, value) {
    setMaterialsRows(prev => prev.map(r => {
      if (r.id !== id) return r
      const updated = { ...r, [field]: value }
      updated.totalCents = (updated.qty || 0) * (updated.unitCostCents || 0)
      return updated
    }))
  }

  function removeMaterialRow(id) {
    setMaterialsRows(prev => prev.filter(r => r.id !== id))
  }

  async function handleSaveMaterials() {
    if (!materialsTarget) return
    setMaterialsSaving(true)
    try {
      const cleaned = materialsRows.filter(r => r.name.trim()).map(r => ({
        ...r, name: r.name.trim(), totalCents: (r.qty || 0) * (r.unitCostCents || 0),
      }))
      await updateScheduleMaterials(materialsTarget.id, cleaned)
      toast.success(translate('materials', 'saved'))
      setMaterialsTarget(null)
      loadData()
    } catch {
      toast.error(translate('common', 'error'))
    } finally {
      setMaterialsSaving(false)
    }
  }

  const materialsSubtotal = materialsRows.reduce((s, r) => s + ((r.qty || 0) * (r.unitCostCents || 0)), 0)

  const rawDaySchedules = selectedDay ? getSchedulesForDay(selectedDay) : []
  const dayCounts = {
    all:       rawDaySchedules.length,
    pending:   rawDaySchedules.filter(s => s.status !== 'completed').length,
    completed: rawDaySchedules.filter(s => s.status === 'completed').length,
  }
  const inRouteMode = dayFilter === 'route'
  const selectedDaySchedules = (() => {
    if (inRouteMode) {
      return [...rawDaySchedules].sort((a, b) => {
        const ai = a.routeIndex ?? 9999
        const bi = b.routeIndex ?? 9999
        if (ai !== bi) return ai - bi
        return (a.time || '').localeCompare(b.time || '')
      })
    }
    if (dayFilter === 'pending')   return rawDaySchedules.filter(s => s.status !== 'completed')
    if (dayFilter === 'completed') return rawDaySchedules.filter(s => s.status === 'completed')
    return rawDaySchedules
  })()

  async function moveRouteIndex(schedule, direction) {
    const ordered = [...rawDaySchedules].sort((a, b) => (a.routeIndex ?? 9999) - (b.routeIndex ?? 9999) || (a.time || '').localeCompare(b.time || ''))
    const idx = ordered.findIndex(s => s.id === schedule.id)
    const swapIdx = idx + direction
    if (idx < 0 || swapIdx < 0 || swapIdx >= ordered.length) return
    const [a, b] = [ordered[idx], ordered[swapIdx]]
    ordered[idx] = b
    ordered[swapIdx] = a
    try {
      await Promise.all(ordered.map((s, i) => updateSchedule(s.id, { routeIndex: i })))
      loadData()
    } catch {
      toast.error(translate('common', 'error'))
    }
  }
  const clientMap             = Object.fromEntries(clients.map(c => [c.id, c]))
  const selectedClientObj     = clients.find(c => c.id === selectedClient)
  const totalJobsThisMonth    = schedules.length

  const walkInBase           = walkInInvoiceTarget?.basePrice || 0
  const walkInInvAddonTotal  = getAddonTotal(walkInInvAddons, walkInInvVariables)
  const walkInMaterialsList  = walkInInvoiceTarget?.materials || []
  const walkInMaterialsTotal = walkInMaterialsList.reduce((s, m) => s + (m.totalCents || 0), 0)
  const walkInInvoiceTotal   = walkInBase + walkInInvAddonTotal + walkInMaterialsTotal

  if (!mounted) return null

  return (
    <AppShell>
      <div className="page-content">
        <PageHeader
          title={translate('calendar', 'title')}
          subtitle={`${totalJobsThisMonth} ${translate('calendar', 'jobs_in')} ${formatDateLocalized(currentDate, 'month_year', lang).split(' ')[0]}`}
        />

        <div className="px-4 py-4 max-w-lg mx-auto space-y-4">

          <div className="flex items-center justify-between">
            <button onClick={() => { setCurrentDate(d => new Date(d.getFullYear(), d.getMonth() - 1)); setSelectedDay(null) }} aria-label="Previous month" className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors">
              <ChevronLeft size={18} className="text-gray-600" />
            </button>
            <h2 className="text-[16px] font-semibold text-gray-900">{formatDateLocalized(currentDate, 'MMMM yyyy', lang)}</h2>
            <button onClick={() => { setCurrentDate(d => new Date(d.getFullYear(), d.getMonth() + 1)); setSelectedDay(null) }} aria-label="Next month" className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors">
              <ChevronRight size={18} className="text-gray-600" />
            </button>
          </div>

          <Card padding={false}>
            <div className="p-3">
              <div className="grid grid-cols-7 mb-1">
                {(lang === 'es' ? ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'] : ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']).map(d => (
                  <div key={d} className="text-center text-[10px] font-medium text-gray-400 py-1">{d}</div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-y-1">
                {[...Array(startPad)].map((_, i) => <div key={`pad-${i}`} />)}
                {monthDays.map(date => {
                  const daySchedules = getSchedulesForDay(date)
                  const hasJobs      = daySchedules.length > 0
                  const isSelected   = selectedDay && isSameDay(date, selectedDay)
                  const todayDate    = isToday(date)
                  const jobCount     = daySchedules.length
                  return (
                    <button key={date.toISOString()} onClick={() => setSelectedDay(date)}
                      className={`relative flex flex-col items-center justify-start pt-1 pb-1 rounded-xl transition-all h-10 ${isSelected ? 'bg-brand-600 text-white' : ''} ${todayDate && !isSelected ? 'bg-brand-50 text-brand-700 font-semibold' : ''} ${!isSelected && !todayDate ? 'hover:bg-gray-50 text-gray-700' : ''}`}>
                      <span className="text-[12px] font-medium leading-none">{fmt(date, 'd')}</span>
                      {hasJobs && (
                        <div className="flex items-center gap-0.5 mt-0.5">
                          {jobCount <= 3
                            ? [...Array(jobCount)].map((_, i) => <div key={i} className={`w-1 h-1 rounded-full ${isSelected ? 'bg-white' : 'bg-brand-500'}`} />)
                            : <span className={`text-[9px] font-bold ${isSelected ? 'text-white' : 'text-brand-500'}`}>{jobCount}</span>}
                        </div>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>
          </Card>

          {selectedDay && (
            <div className="animate-fade-up">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-[14px] font-semibold text-gray-800">{formatDateLocalized(selectedDay, 'EEEE, MMMM d', lang)}</h3>
                <div className="flex items-center gap-2">
                  <Button icon={Zap} size="sm" variant="secondary" onClick={openWalkInModal}>
                    {lang === 'es' ? 'Ocasional' : 'Walk-in'}
                  </Button>
                  <Button icon={Plus} size="sm" onClick={openAddModal} disabled={clients.length === 0}>
                    {translate('calendar', 'add_job')}
                  </Button>
                </div>
              </div>

              <div className="flex items-center gap-1.5 mb-3 overflow-x-auto -mx-1 px-1 pb-1">
                {[
                  { key: 'all',       labelEn: 'All',       labelEs: 'Todos',       count: dayCounts.all },
                  { key: 'pending',   labelEn: 'Pending',   labelEs: 'Pendientes',  count: dayCounts.pending },
                  { key: 'completed', labelEn: 'Completed', labelEs: 'Completados', count: dayCounts.completed },
                  { key: 'route',     labelEn: 'Set route', labelEs: 'Ruta',        icon: Route },
                ].map(chip => {
                  const active = dayFilter === chip.key
                  const Icon = chip.icon
                  return (
                    <button
                      key={chip.key}
                      type="button"
                      onClick={() => setDayFilter(chip.key)}
                      className={`flex items-center gap-1 whitespace-nowrap px-3 py-1.5 rounded-full text-[12px] font-medium transition-colors border ${active ? 'bg-brand-600 text-white border-brand-600' : 'bg-white text-gray-600 border-gray-200 hover:border-brand-300'}`}
                    >
                      {Icon && <Icon size={12} />}
                      <span>{lang === 'es' ? chip.labelEs : chip.labelEn}</span>
                      {typeof chip.count === 'number' && (
                        <span className={`text-[10px] font-semibold ${active ? 'text-white/80' : 'text-gray-400'}`}>{chip.count}</span>
                      )}
                    </button>
                  )
                })}
              </div>

              {inRouteMode && rawDaySchedules.length > 0 && (
                <p className="text-[11px] text-gray-500 mb-2">
                  {lang === 'es' ? 'Reordena con las flechas para crear tu ruta del día.' : 'Use the arrows to reorder jobs into your driving route.'}
                </p>
              )}

              {loading ? <Skeleton className="h-16" /> : selectedDaySchedules.length === 0 ? (
                <Card className="text-center py-6">
                  <CalendarDays size={24} className="text-gray-300 mx-auto mb-2" />
                  <p className="text-[13px] text-gray-400">{translate('calendar', 'no_jobs')}</p>
                </Card>
              ) : (
                <div className="space-y-2">
                  {selectedDaySchedules.map((schedule, idx) => {
                    const client    = clientMap[schedule.clientId]
                    const done      = schedule.status === 'completed'
                    const hasAddons = schedule.addons?.length > 0
                    const isOpen    = expandedId === schedule.id
                    return (
                      <Card key={schedule.id} padding={false}>
                        <div className="flex items-center">
                        {inRouteMode && (
                          <div className="flex flex-col items-center gap-0.5 pl-2">
                            <button type="button" disabled={idx === 0} onClick={(e) => { e.stopPropagation(); moveRouteIndex(schedule, -1) }} className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-gray-100 disabled:opacity-30">
                              <ArrowUp size={14} className="text-gray-600" />
                            </button>
                            <span className="text-[10px] font-bold text-brand-600">{idx + 1}</span>
                            <button type="button" disabled={idx === selectedDaySchedules.length - 1} onClick={(e) => { e.stopPropagation(); moveRouteIndex(schedule, 1) }} className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-gray-100 disabled:opacity-30">
                              <ArrowDown size={14} className="text-gray-600" />
                            </button>
                          </div>
                        )}
                        <button
                          type="button"
                          onClick={() => setExpandedId(isOpen ? null : schedule.id)}
                          className="flex-1 w-full p-3 flex items-center gap-3 text-left"
                        >
                          <div className={`w-2 h-2 rounded-full flex-shrink-0 ${done ? 'bg-brand-500' : 'bg-amber-400'}`} />
                          <div className="flex-1 min-w-0">
                            <p className={`text-[13px] font-medium ${done ? 'text-gray-400 line-through' : 'text-gray-900'}`}>
                              {client?.name || schedule.clientName}
                              {schedule.isWalkIn && (
                                <span className="ml-1.5 text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full font-medium">
                                  {lang === 'es' ? 'Ocasional' : 'Walk-in'}
                                </span>
                              )}
                            </p>
                            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                              <span className="text-[11px] text-gray-400">{schedule.time}</span>
                              {!schedule.isWalkIn && <Badge label={translate('packages', client?.packageType || 'monthly') || client?.packageType || 'monthly'} variant={client?.packageType || 'monthly'} />}
                              {schedule.isWalkIn && schedule.basePrice > 0 && <span className="text-[11px] text-brand-600 font-medium">{formatCents(schedule.basePrice)}</span>}
                              {schedule.isRecurring && (
                                <div className="flex items-center gap-0.5">
                                  <RefreshCw size={9} className="text-brand-400" />
                                  <span className="text-[10px] text-brand-500 font-medium">{translate('calendar', 'recurring')}</span>
                                </div>
                              )}
                              {hasAddons && <span className="text-[10px] bg-brand-50 text-brand-700 px-1.5 py-0.5 rounded-full font-medium">+{schedule.addons.length} {lang === 'es' ? 'adicionales' : 'add-ons'}</span>}
                              {schedule.materials?.length > 0 && (
                                <span className="text-[10px] bg-amber-50 text-amber-700 px-1.5 py-0.5 rounded-full font-medium">
                                  📦 {translate('materials', 'attachedBadge')}: {formatCents(schedule.materialsTotal || 0)}
                                </span>
                              )}
                              {schedule.smsSent && <span className="text-[11px] text-brand-600 font-medium">SMS ✓</span>}
                            </div>
                          </div>
                          <ChevronDown size={16} className={`text-gray-400 flex-shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                        </button>
                        </div>

                        {isOpen && (
                          <div className="px-3 pb-3 pt-1 border-t border-gray-100 space-y-2">
                            {client?.notes && (
                              <div className="bg-gray-50 rounded-lg px-3 py-2">
                                <p className="text-[10px] text-gray-400 font-medium uppercase mb-0.5">{translate('calendar_extra', 'notes')}</p>
                                <p className="text-[12px] text-gray-500 italic">{client.notes}</p>
                              </div>
                            )}
                            {!done && (
                              <>
                                <div className="grid grid-cols-2 gap-2">
                                  <Button icon={DollarSign} size="sm" loading={sendingInvoiceId === schedule.id} onClick={() => handleSendInvoice(schedule)}>
                                    {lang === 'es' ? 'Enviar factura' : 'Send invoice'}
                                  </Button>
                                  <Button icon={Package} size="sm" variant="secondary" onClick={() => { setExpandedId(null); openMaterials(schedule) }}>
                                    {lang === 'es' ? 'Materiales' : 'Add material'}
                                  </Button>
                                  <Button icon={CheckCircle2} size="sm" variant="secondary" onClick={() => { setExpandedId(null); handleComplete(schedule) }}>
                                    {lang === 'es' ? 'Completar' : 'Mark complete'}
                                  </Button>
                                  <Button icon={Plus} size="sm" variant="secondary" onClick={() => openExtraModal(schedule)}>
                                    {lang === 'es' ? 'Servicio extra' : 'Add extra service'}
                                  </Button>
                                </div>
                                <Button icon={Trash2} size="sm" variant="ghost" fullWidth onClick={() => { setExpandedId(null); promptDelete(schedule) }}>
                                  {lang === 'es' ? 'Eliminar' : 'Delete'}
                                </Button>
                              </>
                            )}
                            {done && (
                              <Button icon={Trash2} size="sm" variant="ghost" fullWidth onClick={() => { setExpandedId(null); promptDelete(schedule) }}>
                                {lang === 'es' ? 'Eliminar' : 'Delete'}
                              </Button>
                            )}
                            {schedule.clientId && (
                              <button onClick={() => router.push(`/clients/${schedule.clientId}`)} className="w-full text-[11px] text-brand-600 hover:underline pt-1">
                                {lang === 'es' ? 'Ver perfil del cliente →' : 'View client profile →'}
                              </button>
                            )}
                          </div>
                        )}
                      </Card>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {!selectedDay && <EmptyState icon={CalendarDays} title={translate('calendar', 'tap_day')} description={translate('calendar', 'dots_show')} />}
        </div>
      </div>

      {/* Add job modal */}
      <Modal
        open={showAddModal} onClose={() => setShowAddModal(false)}
        title={`${translate('calendar', 'add_job')} — ${selectedDay ? fmt(selectedDay, 'MMM d') : ''}`}
        footer={<>
          <Button variant="secondary" fullWidth onClick={() => setShowAddModal(false)}>{translate('common', 'cancel')}</Button>
          <Button fullWidth loading={saving} onClick={handleAddSchedule}>
            {repeatMode === 'none' ? translate('calendar', 'add_job') : `${translate('calendar', 'schedule')} ${occurrences} ${translate('calendar', 'visits')}`}
          </Button>
        </>}
      >
        <div className="space-y-4">
          <Select label={translate('calendar', 'client')} value={selectedClient} onChange={e => handleClientSelect(e.target.value)}>
            {clients.map(c => <option key={c.id} value={c.id}>{c.name} — {translate('packages', c.packageType) || c.packageType}</option>)}
          </Select>
          <Select label={translate('calendar', 'time')} value={selectedTime} onChange={e => setSelectedTime(e.target.value)}>
            {TIMES.map(t => <option key={t} value={t}>{t}</option>)}
          </Select>
          <Select label={translate('calendar', 'repeat')} value={repeatMode} onChange={e => setRepeatMode(e.target.value)}
            hint={selectedClientObj?.recurrence && selectedClientObj.recurrence !== 'onetime'
              ? `${selectedClientObj.name}: ${REPEAT_OPTIONS.find(o => o.value === selectedClientObj.recurrence)?.label || ''}`
              : undefined}>
            {REPEAT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </Select>
          {repeatMode !== 'none' && (
            <Select label={translate('calendar', 'occurrences')} value={occurrences} onChange={e => setOccurrences(e.target.value)}>
              {OCCURRENCE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label} {translate('calendar', 'visits')}</option>)}
            </Select>
          )}
          {repeatMode !== 'none' && previewDates.length > 0 && (
            <div>
              <button onClick={() => setShowPreview(!showPreview)} className="text-[12px] text-brand-600 font-medium">
                {showPreview ? translate('calendar', 'hide') : translate('calendar', 'preview')}
              </button>
              {showPreview && (
                <div className="mt-2 bg-brand-50 rounded-xl p-3 max-h-40 overflow-y-auto">
                  {previewDates.map((date, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-brand-500 flex-shrink-0" />
                      <p className="text-[12px] text-brand-700">{fmt(date, 'EEE, MMM d yyyy')}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
          <div className="border-t border-gray-100 pt-3">
            <AddonSelector addonServices={addonServices} lang={lang} fixedAddons={selectedAddons} setFixedAddons={setSelectedAddons} variables={variableInputs} setVariables={setVariableInputs} />
          </div>
        </div>
      </Modal>

      {/* Walk-in modal */}
      <Modal
        open={showWalkIn} onClose={() => setShowWalkIn(false)}
        title={lang === 'es' ? `Cliente ocasional — ${selectedDay ? fmt(selectedDay, 'MMM d') : ''}` : `Walk-in client — ${selectedDay ? fmt(selectedDay, 'MMM d') : ''}`}
        footer={<>
          <Button variant="secondary" fullWidth onClick={() => setShowWalkIn(false)}>{translate('common', 'cancel')}</Button>
          <Button fullWidth loading={savingWalkIn} onClick={handleAddWalkIn} disabled={!walkInName.trim()}>{lang === 'es' ? 'Agregar trabajo' : 'Add job'}</Button>
        </>}
      >
        <div className="space-y-4">
          <div className="bg-amber-50 border border-amber-100 rounded-xl p-3">
            <p className="text-[12px] text-amber-700">
              {lang === 'es' ? 'Para trabajos únicos o servicios adicionales. Para clientes recurrentes, agrégalos en Clientes primero.' : 'For one-off jobs or add-on services for existing clients. For new recurring clients, add them in Clients first.'}
            </p>
          </div>
          <Input label={lang === 'es' ? 'Nombre del cliente *' : 'Client name *'} placeholder={lang === 'es' ? 'Juan García' : 'John Smith'} value={walkInName} onChange={e => setWalkInName(e.target.value)} />
          <div>
            <PhoneInput
              label={lang === 'es' ? 'Teléfono *' : 'Phone number *'}
              value={walkInPhone}
              onChange={val => { setWalkInPhone(val); setWalkInPhoneError('') }}
              error={walkInPhoneError}
            />
            <p className="text-[11px] text-gray-400 mt-1">{lang === 'es' ? 'Requerido para enviar el link de pago' : 'Required to send payment link'}</p>
          </div>
          <Input
            label={lang === 'es' ? 'Email (opcional — solo para recibo)' : 'Email (optional — for receipt only)'}
            placeholder="client@example.com"
            type="email"
            value={walkInEmail}
            onChange={e => setWalkInEmail(e.target.value)}
          />
          <Input label={lang === 'es' ? 'Precio base' : 'Base job price'} placeholder="65" type="number" prefix="$" value={walkInPrice} onChange={e => setWalkInPrice(e.target.value)}
            hint={lang === 'es' ? 'Tarifa YardSync 5.5% aplica' : '5.5% YardSync fee applies'} />
          <Select label={translate('calendar', 'time')} value={walkInTime} onChange={e => setWalkInTime(e.target.value)}>
            {TIMES.map(t => <option key={t} value={t}>{t}</option>)}
          </Select>
          <div className="border-t border-gray-100 pt-3">
            <AddonSelector addonServices={addonServices} lang={lang} fixedAddons={walkInAddons} setFixedAddons={setWalkInAddons} variables={walkInVariables} setVariables={setWalkInVariables} />
          </div>
        </div>
      </Modal>

      {/* Walk-in invoice modal */}
      <Modal
        open={showWalkInInvoice} onClose={() => setShowWalkInInvoice(false)}
        title={lang === 'es' ? `Factura — ${walkInInvoiceTarget?.clientName || ''}` : `Invoice — ${walkInInvoiceTarget?.clientName || ''}`}
        footer={<>
          <Button variant="secondary" fullWidth onClick={() => setShowWalkInInvoice(false)}>{translate('common', 'cancel')}</Button>
          <Button fullWidth loading={invoicingWalkIn} onClick={handleWalkInInvoice}>
            {lang === 'es' ? `Enviar · ${formatCents(walkInInvoiceTotal)}` : `Send · ${formatCents(walkInInvoiceTotal)}`}
          </Button>
        </>}
      >
        <div className="space-y-4">
          <div className="bg-gray-50 rounded-xl p-3 space-y-1.5">
            <p className="text-[11px] font-medium text-gray-500 uppercase tracking-wide mb-2">{lang === 'es' ? 'Resumen' : 'Summary'}</p>
            <div className="flex justify-between text-[13px]">
              <span className="text-gray-600">{walkInInvoiceTarget?.clientName}</span>
              <span className="font-medium">{formatCents(walkInBase)}</span>
            </div>
            {walkInInvoiceTarget?.clientPhone && <p className="text-[11px] text-gray-400">{walkInInvoiceTarget.clientPhone}</p>}
            {walkInInvoiceTarget?.clientEmail && <p className="text-[11px] text-gray-400">{walkInInvoiceTarget.clientEmail}</p>}
            <div className="flex justify-between text-[12px]">
              <span className="text-gray-400">{lang === 'es' ? 'Tarifa YardSync (5.5%)' : 'YardSync fee (5.5%)'}</span>
              <span className="text-brand-600">{lang === 'es' ? 'deducido del pago' : 'deducted from payout'}</span>
            </div>
          </div>
          <AddonSelector addonServices={addonServices} lang={lang} fixedAddons={walkInInvAddons} setFixedAddons={setWalkInInvAddons} variables={walkInInvVariables} setVariables={setWalkInInvVariables} />
          <div className="bg-brand-50 border border-brand-100 rounded-xl p-4 space-y-1.5">
            <p className="text-[11px] font-medium text-brand-700 uppercase tracking-wide mb-2">{lang === 'es' ? 'Total de factura' : 'Invoice total'}</p>
            <div className="flex justify-between text-[13px]">
              <span className="text-brand-700">{lang === 'es' ? 'Base' : 'Base'}</span>
              <span className="font-medium text-brand-900">{formatCents(walkInBase)}</span>
            </div>
            {walkInInvAddonTotal > 0 && (
              <div className="flex justify-between text-[13px]">
                <span className="text-brand-700">{lang === 'es' ? 'Adicionales' : 'Add-ons'}</span>
                <span className="font-medium text-brand-900">{formatCents(walkInInvAddonTotal)}</span>
              </div>
            )}
            {walkInMaterialsTotal > 0 && (
              <div className="flex justify-between text-[13px]">
                <span className="text-amber-700">{lang === 'es' ? 'Materiales' : 'Materials'}</span>
                <span className="font-medium text-amber-800">{formatCents(walkInMaterialsTotal)}</span>
              </div>
            )}
            <div className="flex justify-between text-[15px] border-t border-brand-200 pt-2 mt-1">
              <span className="font-bold text-brand-900">{lang === 'es' ? 'Cliente paga' : 'Client pays'}</span>
              <span className="font-bold text-brand-900">{formatCents(walkInInvoiceTotal)}</span>
            </div>
          </div>
        </div>
      </Modal>

      {/* Delete modal */}
      <Modal
        open={showDeleteModal} onClose={() => { setShowDeleteModal(false); setDeleteTarget(null) }}
        title={translate('calendar', 'remove_visit')}
        footer={deleteTarget?.isRecurring ? (
          <div className="flex flex-col gap-2 w-full">
            <Button variant="secondary" fullWidth loading={deleting} onClick={handleDeleteOne}>{translate('calendar', 'remove_one')}</Button>
            <Button variant="danger" fullWidth loading={deleting} onClick={handleDeleteAll}>{translate('calendar', 'remove_all')}</Button>
            <Button variant="ghost" fullWidth onClick={() => { setShowDeleteModal(false); setDeleteTarget(null) }}>{translate('common', 'cancel')}</Button>
          </div>
        ) : <>
          <Button variant="secondary" fullWidth onClick={() => { setShowDeleteModal(false); setDeleteTarget(null) }}>{translate('common', 'cancel')}</Button>
          <Button variant="danger" fullWidth loading={deleting} onClick={handleDeleteOne}>{translate('common', 'remove')}</Button>
        </>}
      >
        {deleteTarget?.isRecurring ? (
          <div className="space-y-3">
            <div className="flex items-start gap-3 bg-amber-50 border border-amber-100 rounded-xl p-3">
              <AlertTriangle size={16} className="text-amber-600 flex-shrink-0 mt-0.5" />
              <p className="text-[13px] text-amber-700">{translate('calendar', 'recurring_warning')} <strong>{clientMap[deleteTarget?.clientId]?.name || deleteTarget?.clientName}</strong>.</p>
            </div>
            <p className="text-[12px] text-gray-400 text-center">{translate('calendar', 'completed_note')}</p>
          </div>
        ) : (
          <p className="text-[14px] text-gray-600">{translate('calendar', 'remove_visit')} — <strong>{clientMap[deleteTarget?.clientId]?.name || deleteTarget?.clientName}</strong>?</p>
        )}
      </Modal>

      {/* Materials modal */}
      <Modal
        open={!!materialsTarget}
        onClose={() => setMaterialsTarget(null)}
        title={`${translate('materials', 'title')} — ${clientMap[materialsTarget?.clientId]?.name || materialsTarget?.clientName || ''}`}
        footer={
          <>
            <Button variant="secondary" fullWidth onClick={() => setMaterialsTarget(null)}>
              {translate('common', 'cancel')}
            </Button>
            <Button fullWidth loading={materialsSaving} onClick={handleSaveMaterials}>
              {translate('materials', 'save')}
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          {materialsRows.length === 0 ? (
            <p className="text-[13px] text-gray-400 text-center py-4">{translate('materials', 'noMaterials')}</p>
          ) : (
            materialsRows.map((row, i) => (
              <div key={row.id} className="bg-gray-50 rounded-xl p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-[11px] text-gray-400 font-medium">#{i + 1}</p>
                  <button onClick={() => removeMaterialRow(row.id)} className="text-red-400 hover:text-red-500 transition-colors" aria-label={translate('materials', 'remove')}>
                    <X size={14} />
                  </button>
                </div>
                <Input
                  label={translate('materials', 'materialName')}
                  placeholder={translate('materials', 'placeholder')}
                  value={row.name}
                  onChange={e => updateMaterialRow(row.id, 'name', e.target.value)}
                />
                <div className="grid grid-cols-3 gap-2">
                  <Input
                    label={translate('materials', 'qty')}
                    type="text"
                    inputMode="numeric"
                    value={matDisplay[row.id]?.qty ?? String(row.qty || 1)}
                    onChange={e => {
                      const val = e.target.value.replace(/[^0-9]/g, '')
                      setMatDisplay(prev => ({ ...prev, [row.id]: { ...prev[row.id], qty: val } }))
                    }}
                    onBlur={() => {
                      const parsed = Math.max(1, parseInt(matDisplay[row.id]?.qty) || 1)
                      setMatDisplay(prev => ({ ...prev, [row.id]: { ...prev[row.id], qty: String(parsed) } }))
                      updateMaterialRow(row.id, 'qty', parsed)
                    }}
                    onWheel={e => e.target.blur()}
                  />
                  <Input
                    label={translate('materials', 'unitCost')}
                    type="text"
                    inputMode="decimal"
                    value={matDisplay[row.id]?.cost ?? ((row.unitCostCents || 0) / 100).toFixed(2)}
                    onChange={e => {
                      const val = e.target.value.replace(/[^0-9.]/g, '')
                      setMatDisplay(prev => ({ ...prev, [row.id]: { ...prev[row.id], cost: val } }))
                    }}
                    onBlur={() => {
                      const parsed = Math.max(0, parseFloat(matDisplay[row.id]?.cost) || 0)
                      setMatDisplay(prev => ({ ...prev, [row.id]: { ...prev[row.id], cost: parsed.toFixed(2) } }))
                      updateMaterialRow(row.id, 'unitCostCents', Math.round(parsed * 100))
                    }}
                    onWheel={e => e.target.blur()}
                  />
                  <div>
                    <p className="text-[13px] font-medium text-gray-700 mb-1">{translate('materials', 'total')}</p>
                    <p className="text-[14px] font-semibold text-gray-900 bg-white border border-gray-200 rounded-xl px-3 py-2.5">
                      {formatCents((row.qty || 0) * (row.unitCostCents || 0))}
                    </p>
                  </div>
                </div>
              </div>
            ))
          )}
          <button
            onClick={addMaterialRow}
            className="w-full text-[13px] text-brand-600 font-medium bg-brand-50 hover:bg-brand-100 rounded-xl py-2.5 transition-colors"
          >
            {translate('materials', 'addMaterial')}
          </button>
          {materialsSubtotal > 0 && (
            <div className="flex justify-between items-center bg-amber-50 border border-amber-100 rounded-xl px-4 py-3">
              <span className="text-[13px] font-medium text-amber-800">{translate('materials', 'subtotal')}</span>
              <span className="text-[15px] font-bold text-amber-900">{formatCents(materialsSubtotal)}</span>
            </div>
          )}
        </div>
      </Modal>

      {/* Complete → invoice prompt */}
      <Modal
        open={!!completePrompt}
        onClose={() => { setCompletePrompt(null); toast.success('✓') }}
        title={lang === 'es' ? 'Trabajo completo! 🎉' : 'Job complete! 🎉'}
        footer={<>
          <Button variant="secondary" fullWidth onClick={() => { setCompletePrompt(null); toast.success('✓') }}>
            {lang === 'es' ? 'Omitir' : 'Skip for now'}
          </Button>
          <Button fullWidth onClick={() => {
            const cid = completePrompt?.clientId
            setCompletePrompt(null)
            if (cid) router.push(`/clients/${cid}?openInvoice=true`)
          }}>
            {lang === 'es' ? 'Enviar factura' : 'Send invoice'}
          </Button>
        </>}
      >
        <p className="text-[14px] text-gray-600">
          {lang === 'es'
            ? `¿Enviar factura a ${clientMap[completePrompt?.clientId]?.name || ''} ahora?`
            : `Send invoice to ${clientMap[completePrompt?.clientId]?.name || ''} now?`}
        </p>
      </Modal>

      {/* Invoice preview / confirm modal */}
      <Modal
        open={!!invoicePreview}
        onClose={() => !sendingInvoiceId && setInvoicePreview(null)}
        title={lang === 'es' ? 'Confirmar factura' : 'Confirm invoice'}
      >
        {invoicePreview && (() => {
          const fee = Math.round(invoicePreview.totalCents * 0.055)
          const net = invoicePreview.totalCents - fee
          return (
            <div className="space-y-3">
              <p className="text-[12px] text-gray-500">
                {lang === 'es' ? 'Para' : 'To'} <span className="font-medium text-gray-700">{invoicePreview.clientName}</span>
                {invoicePreview.clientPhone && <> · {invoicePreview.clientPhone}</>}
              </p>
              {!invoicePreview.isWalkIn && (
                <div className="rounded-lg bg-brand-50 border border-brand-100 px-3 py-2 text-[12px] text-brand-700">
                  {lang === 'es'
                    ? 'El servicio base ya está cubierto por el plan recurrente — esta factura solo cobra los extras y materiales de esta visita.'
                    : 'Base service is already covered by the recurring plan — this invoice only charges the extras and materials for this visit.'}
                </div>
              )}
              <div className="rounded-lg border border-gray-200 divide-y divide-gray-100">
                {invoicePreview.baseCents > 0 && (
                  <div className="flex justify-between px-3 py-2 text-[13px]">
                    <span className="text-gray-700">{invoicePreview.baseLabel}</span>
                    <span className="font-medium">{formatCents(invoicePreview.baseCents)}</span>
                  </div>
                )}
                {invoicePreview.extras.map((a, i) => (
                  <div key={`e${i}`} className="flex justify-between px-3 py-2 text-[13px]">
                    <span className="text-gray-700">+ {a.label}</span>
                    <span className="font-medium">{formatCents(a.amountCents || 0)}</span>
                  </div>
                ))}
                {invoicePreview.materials.map((m, i) => (
                  <div key={`m${i}`} className="flex justify-between px-3 py-2 text-[13px] bg-amber-50">
                    <span className="text-amber-800">📦 {m.name}</span>
                    <span className="font-medium text-amber-800">{formatCents(m.totalCents || 0)}</span>
                  </div>
                ))}
                <div className="flex justify-between px-3 py-2 text-[13px] bg-gray-50">
                  <span className="text-gray-500">{lang === 'es' ? 'Cliente paga' : 'Client pays'}</span>
                  <span className="font-bold text-gray-900">{formatCents(invoicePreview.totalCents)}</span>
                </div>
                <div className="flex justify-between px-3 py-1.5 text-[11px] text-gray-500">
                  <span>{lang === 'es' ? 'Comisión Stripe (5.5%)' : 'Stripe fee (5.5%)'}</span>
                  <span>−{formatCents(fee)}</span>
                </div>
                <div className="flex justify-between px-3 py-2 text-[13px] bg-brand-50">
                  <span className="text-brand-700 font-medium">{lang === 'es' ? 'Tú recibes' : 'You receive'}</span>
                  <span className="font-bold text-brand-700">{formatCents(net)}</span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 pt-1">
                <Button variant="secondary" onClick={() => setInvoicePreview(null)} disabled={!!sendingInvoiceId}>
                  {lang === 'es' ? 'Cancelar' : 'Cancel'}
                </Button>
                <Button icon={DollarSign} loading={!!sendingInvoiceId} onClick={confirmSendInvoice}>
                  {lang === 'es' ? 'Enviar ahora' : 'Send now'}
                </Button>
              </div>
            </div>
          )
        })()}
      </Modal>

      {/* Add extra service modal */}
      <Modal
        open={!!extraTarget}
        onClose={() => { setExtraTarget(null); setExtraCustomLabel(''); setExtraCustomPrice('') }}
        title={lang === 'es' ? 'Agregar servicio extra' : 'Add extra service'}
      >
        {extraTarget && (
          <div className="space-y-4">
            <p className="text-[12px] text-gray-500">
              {lang === 'es' ? 'Se agrega a esta visita —' : 'Adds to this visit —'} <span className="font-medium text-gray-700">{clientMap[extraTarget.clientId]?.name || extraTarget.clientName}</span>
            </p>

            {addonServices.length > 0 && (
              <div>
                <p className="text-[11px] uppercase font-medium text-gray-400 mb-2">{lang === 'es' ? 'Servicios guardados' : 'Saved services'}</p>
                <div className="space-y-1.5">
                  {addonServices.map(svc => (
                    <button
                      key={svc.id}
                      type="button"
                      onClick={() => addSavedExtra(svc)}
                      disabled={extraSaving}
                      className="w-full flex items-center justify-between p-3 rounded-lg border border-gray-200 hover:border-brand-400 hover:bg-brand-50 text-left disabled:opacity-50"
                    >
                      <span className="text-[13px] text-gray-800">{svc.label}</span>
                      <span className="text-[12px] text-brand-600 font-medium">
                        {svc.pricingType === 'variable' ? (lang === 'es' ? 'Variable' : 'Variable') : formatCents(svc.priceCents || 0)}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="border-t border-gray-100 pt-3">
              <p className="text-[11px] uppercase font-medium text-gray-400 mb-2">{lang === 'es' ? 'Personalizado' : 'Custom one-off'}</p>
              <div className="space-y-2">
                <Input
                  placeholder={lang === 'es' ? 'Descripción (ej. Pintar garaje)' : 'Description (e.g. Paint garage)'}
                  value={extraCustomLabel}
                  onChange={e => setExtraCustomLabel(e.target.value)}
                />
                <Input
                  type="number"
                  placeholder={lang === 'es' ? 'Precio en dólares' : 'Price in dollars'}
                  value={extraCustomPrice}
                  onChange={e => setExtraCustomPrice(e.target.value)}
                />
                <Button size="sm" fullWidth icon={Plus} onClick={addCustomExtra} loading={extraSaving} disabled={!extraCustomLabel.trim() || !extraCustomPrice}>
                  {lang === 'es' ? 'Agregar personalizado' : 'Add custom'}
                </Button>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </AppShell>
  )
}