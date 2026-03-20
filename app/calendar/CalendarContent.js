'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect } from 'react'
import { useAuth } from '@/context/AuthContext'
import { useLang } from '@/context/LangContext'
import AppShell from '@/components/layout/AppShell'
import PageHeader from '@/components/layout/PageHeader'
import { Card, Button, Badge, Modal, Select, EmptyState, Skeleton, Input } from '@/components/ui'
import { getClients, getSchedules, addSchedule, updateSchedule, deleteSchedule, getServices } from '@/lib/db'
import { deleteAllClientSchedules } from '@/lib/db'
import { formatCents, buildInvoiceLineItems } from '@/lib/fee'
import {
  ChevronLeft, ChevronRight, Plus, CalendarDays,
  Trash2, CheckCircle2, RefreshCw, AlertTriangle, Zap, DollarSign
} from 'lucide-react'
import toast from 'react-hot-toast'

function fmt(date, str) {
  const d = new Date(date)
  const pad = n => String(n).padStart(2, '0')
  const MONTHS  = ['January','February','March','April','May','June','July','August','September','October','November','December']
  const MONTHS3 = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  const DAYS    = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']
  const DAYS3   = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']
  return str
    .replace('MMMM',  MONTHS[d.getMonth()])
    .replace('MMM',   MONTHS3[d.getMonth()])
    .replace('EEEE',  DAYS[d.getDay()])
    .replace('EEE',   DAYS3[d.getDay()])
    .replace('yyyy',  d.getFullYear())
    .replace('MM',    pad(d.getMonth() + 1))
    .replace('dd',    pad(d.getDate()))
    .replace(/\bd\b/, d.getDate())
}
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
  '7:00 AM','7:30 AM','8:00 AM','8:30 AM','9:00 AM','9:30 AM',
  '10:00 AM','10:30 AM','11:00 AM','11:30 AM','12:00 PM','12:30 PM',
  '1:00 PM','1:30 PM','2:00 PM','2:30 PM','3:00 PM','3:30 PM',
  '4:00 PM','4:30 PM','5:00 PM',
]

const OCCURRENCE_OPTIONS = [
  { value: '4',  label: '4' },
  { value: '6',  label: '6' },
  { value: '8',  label: '8' },
  { value: '12', label: '12' },
  { value: '24', label: '24' },
  { value: '52', label: '52' },
]

function validatePhone(phone) {
  return phone.replace(/\D/g, '').length >= 10
}

function formatPhone(phone) {
  const d = phone.replace(/\D/g, '')
  if (d.length === 10) return `(${d.slice(0,3)}) ${d.slice(3,6)}-${d.slice(6)}`
  if (d.length === 11 && d[0] === '1') return `(${d.slice(1,4)}) ${d.slice(4,7)}-${d.slice(7)}`
  return phone
}

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
  const { user }            = useAuth()
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
      toast.success(datesToAdd.length === 1 ? translate('calendar', 'add_job') + ' ✓' : `${datesToAdd.length} ${translate('calendar', 'visits')} ✓`)
      setShowAddModal(false); loadData()
    } catch { toast.error(translate('common', 'error')) }
    finally { setSaving(false) }
  }

  async function handleAddWalkIn() {
    if (!walkInName.trim() || !selectedDay) return
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
      toast.success(lang === 'es' ? 'Cliente ocasional agregado ✓' : 'Walk-in added ✓')
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
      const { lineItems, totalCents } = buildInvoiceLineItems({ baseAmountCents: basePrice, packageType: 'onetime', addons: finalAddons })
      const res = await fetch('/api/square/invoice', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId: null, lineItems, totalCents,
          clientName:  walkInInvoiceTarget.clientName,
          clientEmail: walkInInvoiceTarget.clientEmail || '',
          clientPhone: walkInInvoiceTarget.clientPhone || '',
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Invoice failed')
      toast.success(lang === 'es' ? 'Factura enviada ✓' : 'Invoice sent ✓')
      setShowWalkInInvoice(false); loadData()
    } catch (err) { toast.error(err.message || translate('common', 'error')) }
    finally { setInvoicingWalkIn(false) }
  }

  async function handleComplete(schedule) {
    try { await updateSchedule(schedule.id, { status: 'completed' }); toast.success('✓'); loadData() }
    catch { toast.error(translate('common', 'error')) }
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

  const selectedDaySchedules = selectedDay ? getSchedulesForDay(selectedDay) : []
  const clientMap             = Object.fromEntries(clients.map(c => [c.id, c]))
  const selectedClientObj     = clients.find(c => c.id === selectedClient)
  const totalJobsThisMonth    = schedules.length

  const walkInBase          = walkInInvoiceTarget?.basePrice || 0
  const walkInBaseFee       = Math.max(Math.round(walkInBase * 0.08), 1000)
  const walkInInvAddonTotal = getAddonTotal(walkInInvAddons, walkInInvVariables)
  const walkInInvAddonFee   = Math.round(walkInInvAddonTotal * 0.10)
  const walkInInvoiceTotal  = walkInBase + walkInBaseFee + walkInInvAddonTotal + walkInInvAddonFee

  if (!mounted) return null

  return (
    <AppShell>
      <div className="page-content">
        <PageHeader
          title={translate('calendar', 'title')}
          subtitle={`${totalJobsThisMonth} ${translate('calendar', 'jobs_in')} ${fmt(currentDate, 'MMMM')}`}
        />

        <div className="px-4 py-4 max-w-lg mx-auto space-y-4">

          <div className="flex items-center justify-between">
            <button onClick={() => setCurrentDate(d => new Date(d.getFullYear(), d.getMonth() - 1))} className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors">
              <ChevronLeft size={18} className="text-gray-600" />
            </button>
            <h2 className="text-[16px] font-semibold text-gray-900">{fmt(currentDate, 'MMMM yyyy')}</h2>
            <button onClick={() => setCurrentDate(d => new Date(d.getFullYear(), d.getMonth() + 1))} className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors">
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
                <h3 className="text-[14px] font-semibold text-gray-800">{fmt(selectedDay, 'EEEE, MMMM d')}</h3>
                <div className="flex items-center gap-2">
                  <Button icon={Zap} size="sm" variant="secondary" onClick={openWalkInModal}>
                    {lang === 'es' ? 'Ocasional' : 'Walk-in'}
                  </Button>
                  <Button icon={Plus} size="sm" onClick={openAddModal} disabled={clients.length === 0}>
                    {translate('calendar', 'add_job')}
                  </Button>
                </div>
              </div>

              {loading ? <Skeleton className="h-16" /> : selectedDaySchedules.length === 0 ? (
                <Card className="text-center py-6">
                  <CalendarDays size={24} className="text-gray-300 mx-auto mb-2" />
                  <p className="text-[13px] text-gray-400">{translate('calendar', 'no_jobs')}</p>
                  <div className="flex items-center justify-center gap-2 mt-3">
                    <Button variant="secondary" size="sm" icon={Zap} onClick={openWalkInModal}>{lang === 'es' ? 'Ocasional' : 'Walk-in'}</Button>
                    <Button variant="brand" size="sm" onClick={openAddModal} disabled={clients.length === 0}>{translate('calendar', 'add_job')}</Button>
                  </div>
                </Card>
              ) : (
                <div className="space-y-2">
                  {selectedDaySchedules.map(schedule => {
                    const client    = clientMap[schedule.clientId]
                    const done      = schedule.status === 'completed'
                    const hasAddons = schedule.addons?.length > 0
                    return (
                      <Card key={schedule.id} padding={false}>
                        <div className="p-3 flex items-center gap-3">
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
                              {!schedule.isWalkIn && <Badge label={client?.packageType || 'monthly'} variant={client?.packageType || 'monthly'} />}
                              {schedule.isWalkIn && schedule.basePrice > 0 && <span className="text-[11px] text-brand-600 font-medium">{formatCents(schedule.basePrice)}</span>}
                              {schedule.isRecurring && (
                                <div className="flex items-center gap-0.5">
                                  <RefreshCw size={9} className="text-brand-400" />
                                  <span className="text-[10px] text-brand-500 font-medium">{translate('calendar', 'recurring')}</span>
                                </div>
                              )}
                              {hasAddons && <span className="text-[10px] bg-brand-50 text-brand-700 px-1.5 py-0.5 rounded-full font-medium">+{schedule.addons.length} {lang === 'es' ? 'adicionales' : 'add-ons'}</span>}
                              {schedule.smsSent && <span className="text-[11px] text-brand-600 font-medium">SMS ✓</span>}
                            </div>
                          </div>
                          <div className="flex items-center gap-1">
                            {schedule.isWalkIn && !done && (
                              <button onClick={() => openWalkInInvoice(schedule)} className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-brand-50 transition-colors">
                                <DollarSign size={14} className="text-brand-600" />
                              </button>
                            )}
                            {!done && (
                              <button onClick={() => handleComplete(schedule)} className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-brand-50 transition-colors">
                                <CheckCircle2 size={16} className="text-brand-600" />
                              </button>
                            )}
                            <button onClick={() => promptDelete(schedule)} className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-red-50 transition-colors">
                              <Trash2 size={14} className="text-red-400" />
                            </button>
                          </div>
                        </div>
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
            {clients.map(c => <option key={c.id} value={c.id}>{c.name} — {c.packageType}</option>)}
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
              {lang === 'es' ? 'Cliente sin perfil — solo para trabajos ocasionales.' : 'No profile needed — for one-off jobs only. For recurring clients, add them in Clients first.'}
            </p>
          </div>
          <Input label={lang === 'es' ? 'Nombre del cliente *' : 'Client name *'} placeholder={lang === 'es' ? 'Juan García' : 'John Smith'} value={walkInName} onChange={e => setWalkInName(e.target.value)} />
          <div>
            <Input
              label={lang === 'es' ? 'Teléfono (opcional)' : 'Phone (optional)'}
              placeholder="(210) 555-0100"
              type="tel"
              value={walkInPhone}
              onChange={e => { setWalkInPhone(e.target.value.replace(/\D/g, '').slice(0, 10)); setWalkInPhoneError('') }}
            />
            {walkInPhoneError && <p className="text-[12px] text-red-500 mt-1">{walkInPhoneError}</p>}
            <p className="text-[11px] text-gray-400 mt-1">{lang === 'es' ? 'Necesario para SMS o factura' : 'Needed to send SMS or invoice'}</p>
          </div>
          <Input
            label={lang === 'es' ? 'Email (para enviar factura)' : 'Email (to send invoice)'}
            placeholder="client@example.com"
            type="email"
            value={walkInEmail}
            onChange={e => setWalkInEmail(e.target.value)}
          />
          <Input label={lang === 'es' ? 'Precio base' : 'Base job price'} placeholder="65" type="number" prefix="$" value={walkInPrice} onChange={e => setWalkInPrice(e.target.value)}
            hint={lang === 'es' ? 'Tarifa 8% (mín $10)' : '8% YardSync fee applies (min $10)'} />
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
              <span className="text-gray-400">{lang === 'es' ? 'Tarifa YardSync (8%, mín $10)' : 'YardSync fee (8%, min $10)'}</span>
              <span className="text-brand-600">+{formatCents(walkInBaseFee)}</span>
            </div>
            <div className="flex justify-between text-[13px] border-t border-gray-200 pt-1.5">
              <span className="font-medium text-gray-700">{lang === 'es' ? 'Subtotal base' : 'Base subtotal'}</span>
              <span className="font-semibold">{formatCents(walkInBase + walkInBaseFee)}</span>
            </div>
          </div>
          <AddonSelector addonServices={addonServices} lang={lang} fixedAddons={walkInInvAddons} setFixedAddons={setWalkInInvAddons} variables={walkInInvVariables} setVariables={setWalkInInvVariables} />
          <div className="bg-brand-50 border border-brand-100 rounded-xl p-4 space-y-1.5">
            <p className="text-[11px] font-medium text-brand-700 uppercase tracking-wide mb-2">{lang === 'es' ? 'Total de factura' : 'Invoice total'}</p>
            <div className="flex justify-between text-[13px]">
              <span className="text-brand-700">{lang === 'es' ? 'Base' : 'Base'}</span>
              <span className="font-medium text-brand-900">{formatCents(walkInBase + walkInBaseFee)}</span>
            </div>
            {walkInInvAddonTotal > 0 && <>
              <div className="flex justify-between text-[13px]">
                <span className="text-brand-700">{lang === 'es' ? 'Adicionales' : 'Add-ons'}</span>
                <span className="font-medium text-brand-900">{formatCents(walkInInvAddonTotal)}</span>
              </div>
              <div className="flex justify-between text-[12px]">
                <span className="text-brand-600">{lang === 'es' ? 'Tarifa (+10%)' : 'Add-on fee (+10%)'}</span>
                <span className="text-brand-600">+{formatCents(walkInInvAddonFee)}</span>
              </div>
            </>}
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
    </AppShell>
  )
}