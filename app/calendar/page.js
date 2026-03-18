'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/context/AuthContext'
import { useLang } from '@/context/LangContext'
import AppShell from '@/components/layout/AppShell'
import PageHeader from '@/components/layout/PageHeader'
import { Card, Button, Badge, Modal, Select, EmptyState, Skeleton, Input } from '@/components/ui'
import { getClients, getSchedules, addSchedule, updateSchedule, deleteSchedule, getServices } from '@/lib/db'
import { collection, query, where, getDocs, deleteDoc, doc } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { formatCents } from '@/lib/fee'
import {
  format, startOfMonth, endOfMonth, eachDayOfInterval,
  isToday, isSameDay, addWeeks, addMonths, addDays
} from 'date-fns'
import {
  ChevronLeft, ChevronRight, Plus, CalendarDays,
  Trash2, CheckCircle2, RefreshCw, AlertTriangle, Zap
} from 'lucide-react'
import toast from 'react-hot-toast'

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

export default function CalendarPage() {
  const { user }            = useAuth()
  const { translate, lang } = useLang()

  const REPEAT_OPTIONS = [
    { value: 'none',      label: lang === 'es' ? 'Solo esta vez'        : 'Just this once'       },
    { value: 'weekly',    label: lang === 'es' ? 'Cada semana'          : 'Every week'           },
    { value: 'biweekly',  label: lang === 'es' ? 'Cada 2 semanas'       : 'Every 2 weeks'        },
    { value: '3x_month',  label: lang === 'es' ? '3 veces al mes'       : '3 times per month'    },
    { value: 'monthly',   label: lang === 'es' ? 'Una vez al mes'       : 'Once a month'         },
    { value: 'quarterly', label: lang === 'es' ? 'Una vez cada 3 meses' : 'Once every 3 months'  },
    { value: 'annual',    label: lang === 'es' ? 'Una vez al año'       : 'Once a year'          },
  ]

  const [currentDate,     setCurrentDate]     = useState(new Date())
  const [clients,         setClients]         = useState([])
  const [addonServices,   setAddonServices]   = useState([])
  const [schedules,       setSchedules]       = useState([])
  const [loading,         setLoading]         = useState(true)
  const [selectedDay,     setSelectedDay]     = useState(null)

  // Add job modal
  const [showAddModal,    setShowAddModal]    = useState(false)
  const [selectedClient,  setSelectedClient]  = useState('')
  const [selectedTime,    setSelectedTime]    = useState('9:00 AM')
  const [repeatMode,      setRepeatMode]      = useState('none')
  const [occurrences,     setOccurrences]     = useState('8')
  const [saving,          setSaving]          = useState(false)
  const [showPreview,     setShowPreview]     = useState(false)
  const [selectedAddons,  setSelectedAddons]  = useState([]) // [{id, label, amountCents}]
  const [variableInputs,  setVariableInputs]  = useState({}) // {serviceId: dollarString}

  // Walk-in modal
  const [showWalkIn,      setShowWalkIn]      = useState(false)
  const [walkInName,      setWalkInName]      = useState('')
  const [walkInPhone,     setWalkInPhone]     = useState('')
  const [walkInPrice,     setWalkInPrice]     = useState('')
  const [walkInAddons,    setWalkInAddons]    = useState([])
  const [walkInVariables, setWalkInVariables] = useState({})
  const [walkInTime,      setWalkInTime]      = useState('9:00 AM')
  const [savingWalkIn,    setSavingWalkIn]    = useState(false)

  // Delete modal
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
        getSchedules(
          user.uid,
          format(monthStart, 'yyyy-MM-dd'),
          format(monthEnd,   'yyyy-MM-dd')
        ),
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
    const dateStr = format(date, 'yyyy-MM-dd')
    return schedules.filter(s => s.serviceDate === dateStr)
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
    setWalkInName('')
    setWalkInPhone('')
    setWalkInPrice('')
    setWalkInAddons([])
    setWalkInVariables({})
    setWalkInTime('9:00 AM')
    setShowWalkIn(true)
  }

  // Toggle fixed add-on checkbox
  function toggleAddon(service, isWalkIn = false) {
    const setter = isWalkIn ? setWalkInAddons : setSelectedAddons
    setter(prev => {
      const exists = prev.find(a => a.id === service.id)
      if (exists) return prev.filter(a => a.id !== service.id)
      return [...prev, { id: service.id, label: service.label, amountCents: service.priceCents }]
    })
  }

  // Set variable addon amount
  function setVariableAmount(serviceId, value, isWalkIn = false) {
    const setter = isWalkIn ? setWalkInVariables : setVariableInputs
    setter(prev => ({ ...prev, [serviceId]: value }))
  }

  // Build final addons array including variable ones
  function buildFinalAddons(fixedAddons, variableVals, services) {
    const result = [...fixedAddons]
    services
      .filter(s => s.pricingType === 'variable')
      .forEach(s => {
        const val = variableVals[s.id]
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

  const previewDates = selectedDay && repeatMode !== 'none'
    ? generateOccurrences(selectedDay, repeatMode, occurrences)
    : selectedDay ? [selectedDay] : []

  // Calculate add-on total for display
  function getAddonTotal(fixedAddons, variableVals, services) {
    const fixed    = fixedAddons.reduce((s, a) => s + (a.amountCents || 0), 0)
    const variable = services
      .filter(s => s.pricingType === 'variable')
      .reduce((s, svc) => {
        const val = variableVals[svc.id]
        return s + (val && parseFloat(val) > 0 ? Math.round(parseFloat(val) * 100) : 0)
      }, 0)
    return fixed + variable
  }

  async function handleAddSchedule() {
    if (!selectedClient || !selectedDay) return
    setSaving(true)
    try {
      const client     = clients.find(c => c.id === selectedClient)
      const datesToAdd = repeatMode === 'none'
        ? [selectedDay]
        : generateOccurrences(selectedDay, repeatMode, occurrences)

      const finalAddons = buildFinalAddons(selectedAddons, variableInputs, addonServices)

      await Promise.all(
        datesToAdd.map(date =>
          addSchedule(user.uid, {
            clientId:    selectedClient,
            clientName:  client?.name || '',
            serviceDate: format(date, 'yyyy-MM-dd'),
            time:        selectedTime,
            status:      'scheduled',
            recurrence:  repeatMode,
            isRecurring: repeatMode !== 'none',
            addons:      finalAddons,
          })
        )
      )

      const count = datesToAdd.length
      toast.success(count === 1
        ? translate('calendar', 'add_job') + ' ✓'
        : `${count} ${translate('calendar', 'visits')} ✓`
      )
      setShowAddModal(false)
      loadData()
    } catch {
      toast.error(translate('common', 'error'))
    } finally {
      setSaving(false)
    }
  }

  async function handleAddWalkIn() {
    if (!walkInName.trim() || !selectedDay) return
    setSavingWalkIn(true)
    try {
      const finalAddons = buildFinalAddons(walkInAddons, walkInVariables, addonServices)
      const basePrice   = walkInPrice && parseFloat(walkInPrice) > 0
        ? Math.round(parseFloat(walkInPrice) * 100)
        : 0

      await addSchedule(user.uid, {
        clientId:    null,
        clientName:  walkInName.trim(),
        clientPhone: walkInPhone.trim(),
        serviceDate: format(selectedDay, 'yyyy-MM-dd'),
        time:        walkInTime,
        status:      'scheduled',
        isWalkIn:    true,
        isRecurring: false,
        basePrice,
        addons:      finalAddons,
      })

      toast.success(lang === 'es' ? 'Cliente ocasional agregado ✓' : 'Walk-in client added ✓')
      setShowWalkIn(false)
      loadData()
    } catch {
      toast.error(translate('common', 'error'))
    } finally {
      setSavingWalkIn(false)
    }
  }

  async function handleComplete(schedule) {
    try {
      await updateSchedule(schedule.id, { status: 'completed' })
      toast.success('✓')
      loadData()
    } catch {
      toast.error(translate('common', 'error'))
    }
  }

  function promptDelete(schedule) {
    setDeleteTarget(schedule)
    setShowDeleteModal(true)
  }

  async function handleDeleteOne() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await deleteSchedule(deleteTarget.id)
      toast.success(translate('calendar', 'remove_visit') + ' ✓')
      setShowDeleteModal(false)
      setDeleteTarget(null)
      loadData()
    } catch {
      toast.error(translate('common', 'error'))
    } finally {
      setDeleting(false)
    }
  }

  async function handleDeleteAll() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      const q    = query(
        collection(db, 'schedules'),
        where('gardenerUid', '==', user.uid),
        where('clientId',    '==', deleteTarget.clientId),
        where('status',      '==', 'scheduled')
      )
      const snap = await getDocs(q)
      await Promise.all(snap.docs.map(d => deleteDoc(doc(db, 'schedules', d.id))))
      toast.success(`${snap.docs.length} ${translate('calendar', 'visits')} ✓`)
      setShowDeleteModal(false)
      setDeleteTarget(null)
      loadData()
    } catch {
      toast.error(translate('common', 'error'))
    } finally {
      setDeleting(false)
    }
  }

  const selectedDaySchedules = selectedDay ? getSchedulesForDay(selectedDay) : []
  const clientMap             = Object.fromEntries(clients.map(c => [c.id, c]))
  const selectedClientObj     = clients.find(c => c.id === selectedClient)
  const totalJobsThisMonth    = schedules.length

  // Addon selector component (reusable for both modals)
  function AddonSelector({ fixed, setFixed, variables, setVariables, isWalkIn = false }) {
    if (addonServices.length === 0) return null
    const addonTotal = getAddonTotal(fixed, variables, addonServices)
    return (
      <div>
        <p className="text-[13px] font-medium text-gray-700 mb-2">
          {lang === 'es' ? 'Servicios adicionales' : 'Add-on services'}
        </p>
        <div className="space-y-2">
          {addonServices.map(service => {
            const isFixed    = service.pricingType === 'fixed'
            const isChecked  = fixed.find(a => a.id === service.id)
            return (
              <div key={service.id} className="bg-gray-50 rounded-xl p-3">
                {isFixed ? (
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={!!isChecked}
                      onChange={() => toggleAddon(service, isWalkIn)}
                      className="w-4 h-4 rounded accent-brand-600"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-medium text-gray-800">{service.label}</p>
                      {service.description && (
                        <p className="text-[11px] text-gray-400">{service.description}</p>
                      )}
                    </div>
                    <p className="text-[13px] font-semibold text-brand-600 flex-shrink-0">
                      {formatCents(service.priceCents)}
                    </p>
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
                      <span className="text-[11px] text-gray-400">
                        {lang === 'es' ? 'Cotizado' : 'Variable'}
                      </span>
                    </div>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                      <input
                        type="number"
                        placeholder="0.00"
                        value={variables[service.id] || ''}
                        onChange={e => setVariableAmount(service.id, e.target.value, isWalkIn)}
                        className="w-full pl-7 pr-3 py-2 rounded-lg border border-gray-200 text-[13px] focus:outline-none focus:ring-2 focus:ring-brand-500"
                      />
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
        {addonTotal > 0 && (
          <div className="mt-2 flex justify-between text-[12px]">
            <span className="text-gray-500">
              {lang === 'es' ? 'Total adicionales:' : 'Add-on total:'}
            </span>
            <span className="font-semibold text-brand-600">{formatCents(addonTotal)}</span>
          </div>
        )}
      </div>
    )
  }

  return (
    <AppShell>
      <div className="page-content">
        <PageHeader
          title={translate('calendar', 'title')}
          subtitle={`${totalJobsThisMonth} ${translate('calendar', 'jobs_in')} ${format(currentDate, 'MMMM')}`}
        />

        <div className="px-4 py-4 max-w-lg mx-auto space-y-4">

          {/* Month navigation */}
          <div className="flex items-center justify-between">
            <button
              onClick={() => setCurrentDate(d => new Date(d.getFullYear(), d.getMonth() - 1))}
              className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors"
            >
              <ChevronLeft size={18} className="text-gray-600" />
            </button>
            <h2 className="text-[16px] font-semibold text-gray-900">
              {format(currentDate, 'MMMM yyyy')}
            </h2>
            <button
              onClick={() => setCurrentDate(d => new Date(d.getFullYear(), d.getMonth() + 1))}
              className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors"
            >
              <ChevronRight size={18} className="text-gray-600" />
            </button>
          </div>

          {/* Calendar grid */}
          <Card padding={false}>
            <div className="p-3">
              <div className="grid grid-cols-7 mb-1">
                {(lang === 'es'
                  ? ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb']
                  : ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']
                ).map(d => (
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
                    <button
                      key={date.toISOString()}
                      onClick={() => setSelectedDay(date)}
                      className={`
                        relative flex flex-col items-center justify-start pt-1 pb-1 rounded-xl transition-all h-10
                        ${isSelected   ? 'bg-brand-600 text-white' : ''}
                        ${todayDate && !isSelected ? 'bg-brand-50 text-brand-700 font-semibold' : ''}
                        ${!isSelected && !todayDate ? 'hover:bg-gray-50 text-gray-700' : ''}
                      `}
                    >
                      <span className="text-[12px] font-medium leading-none">
                        {format(date, 'd')}
                      </span>
                      {hasJobs && (
                        <div className="flex items-center gap-0.5 mt-0.5">
                          {jobCount <= 3
                            ? [...Array(jobCount)].map((_, i) => (
                                <div key={i} className={`w-1 h-1 rounded-full ${isSelected ? 'bg-white' : 'bg-brand-500'}`} />
                              ))
                            : <span className={`text-[9px] font-bold ${isSelected ? 'text-white' : 'text-brand-500'}`}>{jobCount}</span>
                          }
                        </div>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>
          </Card>

          {/* Selected day panel */}
          {selectedDay && (
            <div className="animate-fade-up">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-[14px] font-semibold text-gray-800">
                  {format(selectedDay, 'EEEE, MMMM d')}
                </h3>
                <div className="flex items-center gap-2">
                  <Button
                    icon={Zap}
                    size="sm"
                    variant="secondary"
                    onClick={openWalkInModal}
                  >
                    {lang === 'es' ? 'Ocasional' : 'Walk-in'}
                  </Button>
                  <Button
                    icon={Plus}
                    size="sm"
                    onClick={openAddModal}
                    disabled={clients.length === 0}
                  >
                    {translate('calendar', 'add_job')}
                  </Button>
                </div>
              </div>

              {loading ? (
                <Skeleton className="h-16" />
              ) : selectedDaySchedules.length === 0 ? (
                <Card className="text-center py-6">
                  <CalendarDays size={24} className="text-gray-300 mx-auto mb-2" />
                  <p className="text-[13px] text-gray-400">{translate('calendar', 'no_jobs')}</p>
                  <div className="flex items-center justify-center gap-2 mt-3">
                    <Button variant="secondary" size="sm" icon={Zap} onClick={openWalkInModal}>
                      {lang === 'es' ? 'Ocasional' : 'Walk-in'}
                    </Button>
                    <Button variant="brand" size="sm" onClick={openAddModal} disabled={clients.length === 0}>
                      {translate('calendar', 'add_job')}
                    </Button>
                  </div>
                </Card>
              ) : (
                <div className="space-y-2">
                  {selectedDaySchedules.map(schedule => {
                    const client = clientMap[schedule.clientId]
                    const done   = schedule.status === 'completed'
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
                              {!schedule.isWalkIn && (
                                <Badge label={client?.packageType || 'monthly'} variant={client?.packageType || 'monthly'} />
                              )}
                              {schedule.isRecurring && (
                                <div className="flex items-center gap-0.5">
                                  <RefreshCw size={9} className="text-brand-400" />
                                  <span className="text-[10px] text-brand-500 font-medium">
                                    {translate('calendar', 'recurring')}
                                  </span>
                                </div>
                              )}
                              {hasAddons && (
                                <span className="text-[10px] bg-brand-50 text-brand-700 px-1.5 py-0.5 rounded-full font-medium">
                                  +{schedule.addons.length} {lang === 'es' ? 'adicionales' : 'add-ons'}
                                </span>
                              )}
                              {schedule.smsSent && (
                                <span className="text-[11px] text-brand-600 font-medium">SMS ✓</span>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-1">
                            {!done && (
                              <button
                                onClick={() => handleComplete(schedule)}
                                className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-brand-50 transition-colors"
                              >
                                <CheckCircle2 size={16} className="text-brand-600" />
                              </button>
                            )}
                            <button
                              onClick={() => promptDelete(schedule)}
                              className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-red-50 transition-colors"
                            >
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

          {!selectedDay && (
            <EmptyState
              icon={CalendarDays}
              title={translate('calendar', 'tap_day')}
              description={translate('calendar', 'dots_show')}
            />
          )}
        </div>
      </div>

      {/* ── Add job modal ── */}
      <Modal
        open={showAddModal}
        onClose={() => setShowAddModal(false)}
        title={`${translate('calendar', 'add_job')} — ${selectedDay ? format(selectedDay, 'MMM d') : ''}`}
        footer={
          <>
            <Button variant="secondary" fullWidth onClick={() => setShowAddModal(false)}>
              {translate('common', 'cancel')}
            </Button>
            <Button fullWidth loading={saving} onClick={handleAddSchedule}>
              {repeatMode === 'none'
                ? translate('calendar', 'add_job')
                : `${translate('calendar', 'schedule')} ${occurrences} ${translate('calendar', 'visits')}`}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Select
            label={translate('calendar', 'client')}
            value={selectedClient}
            onChange={e => handleClientSelect(e.target.value)}
          >
            {clients.map(c => (
              <option key={c.id} value={c.id}>{c.name} — {c.packageType}</option>
            ))}
          </Select>

          <Select
            label={translate('calendar', 'time')}
            value={selectedTime}
            onChange={e => setSelectedTime(e.target.value)}
          >
            {TIMES.map(t => <option key={t} value={t}>{t}</option>)}
          </Select>

          <Select
            label={translate('calendar', 'repeat')}
            value={repeatMode}
            onChange={e => setRepeatMode(e.target.value)}
            hint={selectedClientObj?.recurrence && selectedClientObj.recurrence !== 'onetime'
              ? `${selectedClientObj.name}: ${REPEAT_OPTIONS.find(o => o.value === selectedClientObj.recurrence)?.label || ''}`
              : undefined}
          >
            {REPEAT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </Select>

          {repeatMode !== 'none' && (
            <Select
              label={translate('calendar', 'occurrences')}
              value={occurrences}
              onChange={e => setOccurrences(e.target.value)}
            >
              {OCCURRENCE_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>
                  {o.label} {translate('calendar', 'visits')}
                </option>
              ))}
            </Select>
          )}

          {repeatMode !== 'none' && previewDates.length > 0 && (
            <div>
              <button
                onClick={() => setShowPreview(!showPreview)}
                className="text-[12px] text-brand-600 font-medium"
              >
                {showPreview ? translate('calendar', 'hide') : translate('calendar', 'preview')}
              </button>
              {showPreview && (
                <div className="mt-2 bg-brand-50 rounded-xl p-3 max-h-40 overflow-y-auto">
                  <div className="space-y-1">
                    {previewDates.map((date, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-brand-500 flex-shrink-0" />
                        <p className="text-[12px] text-brand-700">{format(date, 'EEE, MMM d yyyy')}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Add-on selector */}
          <div className="border-t border-gray-100 pt-3">
            <AddonSelector
              fixed={selectedAddons}
              setFixed={setSelectedAddons}
              variables={variableInputs}
              setVariables={setVariableInputs}
              isWalkIn={false}
            />
          </div>
        </div>
      </Modal>

      {/* ── Walk-in modal ── */}
      <Modal
        open={showWalkIn}
        onClose={() => setShowWalkIn(false)}
        title={lang === 'es' ? `Cliente ocasional — ${selectedDay ? format(selectedDay, 'MMM d') : ''}` : `Walk-in client — ${selectedDay ? format(selectedDay, 'MMM d') : ''}`}
        footer={
          <>
            <Button variant="secondary" fullWidth onClick={() => setShowWalkIn(false)}>
              {translate('common', 'cancel')}
            </Button>
            <Button fullWidth loading={savingWalkIn} onClick={handleAddWalkIn} disabled={!walkInName.trim()}>
              {lang === 'es' ? 'Agregar trabajo' : 'Add job'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="bg-amber-50 border border-amber-100 rounded-xl p-3">
            <p className="text-[12px] text-amber-700">
              {lang === 'es'
                ? 'Cliente sin perfil — solo para trabajos ocasionales. Para clientes recurrentes, agrégalos en la sección Clientes primero.'
                : 'No profile needed — for one-off jobs only. For recurring clients, add them in the Clients section first.'}
            </p>
          </div>

          <Input
            label={lang === 'es' ? 'Nombre del cliente *' : 'Client name *'}
            placeholder={lang === 'es' ? 'Juan García' : 'John Smith'}
            value={walkInName}
            onChange={e => setWalkInName(e.target.value)}
          />
          <Input
            label={lang === 'es' ? 'Teléfono (opcional)' : 'Phone (optional)'}
            placeholder="(210) 555-0100"
            type="tel"
            value={walkInPhone}
            onChange={e => setWalkInPhone(e.target.value)}
          />
          <Input
            label={lang === 'es' ? 'Precio base del trabajo' : 'Base job price'}
            placeholder="65"
            type="number"
            prefix="$"
            value={walkInPrice}
            onChange={e => setWalkInPrice(e.target.value)}
            hint={lang === 'es' ? 'Se aplica tarifa de 8% (mín $10)' : '8% YardSync fee applies (min $10)'}
          />
          <Select
            label={translate('calendar', 'time')}
            value={walkInTime}
            onChange={e => setWalkInTime(e.target.value)}
          >
            {TIMES.map(t => <option key={t} value={t}>{t}</option>)}
          </Select>

          {/* Add-ons for walk-in */}
          <div className="border-t border-gray-100 pt-3">
            <AddonSelector
              fixed={walkInAddons}
              setFixed={setWalkInAddons}
              variables={walkInVariables}
              setVariables={setWalkInVariables}
              isWalkIn={true}
            />
          </div>
        </div>
      </Modal>

      {/* ── Delete confirmation modal ── */}
      <Modal
        open={showDeleteModal}
        onClose={() => { setShowDeleteModal(false); setDeleteTarget(null) }}
        title={translate('calendar', 'remove_visit')}
        footer={
          deleteTarget?.isRecurring ? (
            <div className="flex flex-col gap-2 w-full">
              <Button variant="secondary" fullWidth loading={deleting} onClick={handleDeleteOne}>
                {translate('calendar', 'remove_one')}
              </Button>
              <Button variant="danger" fullWidth loading={deleting} onClick={handleDeleteAll}>
                {translate('calendar', 'remove_all')}
              </Button>
              <Button variant="ghost" fullWidth onClick={() => { setShowDeleteModal(false); setDeleteTarget(null) }}>
                {translate('common', 'cancel')}
              </Button>
            </div>
          ) : (
            <>
              <Button variant="secondary" fullWidth onClick={() => { setShowDeleteModal(false); setDeleteTarget(null) }}>
                {translate('common', 'cancel')}
              </Button>
              <Button variant="danger" fullWidth loading={deleting} onClick={handleDeleteOne}>
                {translate('common', 'remove')}
              </Button>
            </>
          )
        }
      >
        {deleteTarget?.isRecurring ? (
          <div className="space-y-3">
            <div className="flex items-start gap-3 bg-amber-50 border border-amber-100 rounded-xl p-3">
              <AlertTriangle size={16} className="text-amber-600 flex-shrink-0 mt-0.5" />
              <p className="text-[13px] text-amber-700">
                {translate('calendar', 'recurring_warning')} <strong>
                  {clientMap[deleteTarget?.clientId]?.name || deleteTarget?.clientName}
                </strong>.
              </p>
            </div>
            <p className="text-[12px] text-gray-400 text-center">
              {translate('calendar', 'completed_note')}
            </p>
          </div>
        ) : (
          <p className="text-[14px] text-gray-600">
            {translate('calendar', 'remove_visit')} — <strong>
              {clientMap[deleteTarget?.clientId]?.name || deleteTarget?.clientName}
            </strong>?
          </p>
        )}
      </Modal>
    </AppShell>
  )
}