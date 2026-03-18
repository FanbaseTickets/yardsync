'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/context/AuthContext'
import AppShell from '@/components/layout/AppShell'
import PageHeader from '@/components/layout/PageHeader'
import { Card, Button, Badge, Modal, Select, EmptyState, Skeleton } from '@/components/ui'
import { getClients, getSchedules, addSchedule, updateSchedule, deleteSchedule } from '@/lib/db'
import { collection, query, where, getDocs, deleteDoc, doc } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import {
  format, startOfMonth, endOfMonth, eachDayOfInterval,
  isToday, isSameDay, addWeeks, addMonths, addDays
} from 'date-fns'
import {
  ChevronLeft, ChevronRight, Plus, CalendarDays,
  Trash2, CheckCircle2, RefreshCw, AlertTriangle
} from 'lucide-react'
import toast from 'react-hot-toast'

const TIMES = [
  '7:00 AM','7:30 AM','8:00 AM','8:30 AM','9:00 AM','9:30 AM',
  '10:00 AM','10:30 AM','11:00 AM','11:30 AM','12:00 PM','12:30 PM',
  '1:00 PM','1:30 PM','2:00 PM','2:30 PM','3:00 PM','3:30 PM',
  '4:00 PM','4:30 PM','5:00 PM',
]

const REPEAT_OPTIONS = [
  { value: 'none',      label: 'Just this once' },
  { value: 'weekly',    label: 'Every week' },
  { value: 'biweekly',  label: 'Every 2 weeks' },
  { value: '3x_month',  label: '3 times per month' },
  { value: 'monthly',   label: 'Once a month' },
  { value: 'quarterly', label: 'Once every 3 months' },
  { value: 'annual',    label: 'Once a year' },
]

const OCCURRENCE_OPTIONS = [
  { value: '4',  label: '4 visits' },
  { value: '6',  label: '6 visits' },
  { value: '8',  label: '8 visits' },
  { value: '12', label: '12 visits' },
  { value: '24', label: '24 visits' },
  { value: '52', label: '52 visits (1 year weekly)' },
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
  const { user } = useAuth()

  const [currentDate,    setCurrentDate]    = useState(new Date())
  const [clients,        setClients]        = useState([])
  const [schedules,      setSchedules]      = useState([])
  const [loading,        setLoading]        = useState(true)
  const [selectedDay,    setSelectedDay]    = useState(null)
  const [showAddModal,   setShowAddModal]   = useState(false)
  const [selectedClient, setSelectedClient] = useState('')
  const [selectedTime,   setSelectedTime]   = useState('9:00 AM')
  const [repeatMode,     setRepeatMode]     = useState('none')
  const [occurrences,    setOccurrences]    = useState('8')
  const [saving,         setSaving]         = useState(false)
  const [showPreview,    setShowPreview]    = useState(false)

  // Delete confirm state
  const [deleteTarget,   setDeleteTarget]   = useState(null)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deleting,       setDeleting]       = useState(false)

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
      const [c, s] = await Promise.all([
        getClients(user.uid),
        getSchedules(
          user.uid,
          format(monthStart, 'yyyy-MM-dd'),
          format(monthEnd,   'yyyy-MM-dd')
        ),
      ])
      setClients(c)
      setSchedules(s)
    } catch {
      toast.error('Could not load calendar')
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
      const countMap = {
        weekly: '12', biweekly: '8', '3x_month': '6',
        monthly: '6', quarterly: '4', annual: '2',
      }
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
    if (firstClient?.recurrence && firstClient.recurrence !== 'onetime') {
      setRepeatMode(firstClient.recurrence)
      const countMap = {
        weekly: '12', biweekly: '8', '3x_month': '6',
        monthly: '6', quarterly: '4', annual: '2',
      }
      setOccurrences(countMap[firstClient.recurrence] || '8')
    } else {
      setRepeatMode('none')
      setOccurrences('8')
    }
    setShowAddModal(true)
  }

  const previewDates = selectedDay && repeatMode !== 'none'
    ? generateOccurrences(selectedDay, repeatMode, occurrences)
    : selectedDay ? [selectedDay] : []

  async function handleAddSchedule() {
    if (!selectedClient || !selectedDay) return
    setSaving(true)
    try {
      const client     = clients.find(c => c.id === selectedClient)
      const datesToAdd = repeatMode === 'none'
        ? [selectedDay]
        : generateOccurrences(selectedDay, repeatMode, occurrences)

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
          })
        )
      )

      const count = datesToAdd.length
      toast.success(count === 1 ? 'Job added!' : `${count} visits scheduled!`)
      setShowAddModal(false)
      loadData()
    } catch {
      toast.error('Could not add job')
    } finally {
      setSaving(false)
    }
  }

  async function handleComplete(schedule) {
    try {
      await updateSchedule(schedule.id, { status: 'completed' })
      toast.success('Marked complete!')
      loadData()
    } catch {
      toast.error('Could not update')
    }
  }

  // Prompt delete confirmation
  function promptDelete(schedule) {
    setDeleteTarget(schedule)
    setShowDeleteModal(true)
  }

  // Delete just this one visit
  async function handleDeleteOne() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await deleteSchedule(deleteTarget.id)
      toast.success('Visit removed')
      setShowDeleteModal(false)
      setDeleteTarget(null)
      loadData()
    } catch {
      toast.error('Could not remove visit')
    } finally {
      setDeleting(false)
    }
  }

  // Delete all future recurring visits for this client
  async function handleDeleteAll() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      const q = query(
        collection(db, 'schedules'),
        where('gardenerUid', '==', user.uid),
        where('clientId',    '==', deleteTarget.clientId),
        where('status',      '==', 'scheduled')
      )
      const snap = await getDocs(q)
      await Promise.all(snap.docs.map(d => deleteDoc(doc(db, 'schedules', d.id))))
      toast.success(`Removed ${snap.docs.length} scheduled visits`)
      setShowDeleteModal(false)
      setDeleteTarget(null)
      loadData()
    } catch {
      toast.error('Could not remove visits')
    } finally {
      setDeleting(false)
    }
  }

  const selectedDaySchedules = selectedDay ? getSchedulesForDay(selectedDay) : []
  const clientMap             = Object.fromEntries(clients.map(c => [c.id, c]))
  const selectedClientObj     = clients.find(c => c.id === selectedClient)
  const totalJobsThisMonth    = schedules.length

  return (
    <AppShell>
      <div className="page-content">
        <PageHeader
          title="Calendar"
          subtitle={`${totalJobsThisMonth} jobs in ${format(currentDate, 'MMMM')}`}
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
                {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d => (
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
                <Button
                  icon={Plus} size="sm"
                  onClick={openAddModal}
                  disabled={clients.length === 0}
                >
                  Add job
                </Button>
              </div>

              {loading ? (
                <Skeleton className="h-16" />
              ) : selectedDaySchedules.length === 0 ? (
                <Card className="text-center py-6">
                  <CalendarDays size={24} className="text-gray-300 mx-auto mb-2" />
                  <p className="text-[13px] text-gray-400">No jobs scheduled</p>
                  <Button variant="brand" size="sm" className="mt-3"
                    onClick={openAddModal} disabled={clients.length === 0}>
                    Add a job
                  </Button>
                </Card>
              ) : (
                <div className="space-y-2">
                  {selectedDaySchedules.map(schedule => {
                    const client = clientMap[schedule.clientId]
                    const done   = schedule.status === 'completed'
                    return (
                      <Card key={schedule.id} padding={false}>
                        <div className="p-3 flex items-center gap-3">
                          <div className={`w-2 h-2 rounded-full flex-shrink-0 ${done ? 'bg-brand-500' : 'bg-amber-400'}`} />
                          <div className="flex-1 min-w-0">
                            <p className={`text-[13px] font-medium ${done ? 'text-gray-400 line-through' : 'text-gray-900'}`}>
                              {client?.name || schedule.clientName}
                            </p>
                            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                              <span className="text-[11px] text-gray-400">{schedule.time}</span>
                              <Badge label={client?.packageType || 'monthly'} variant={client?.packageType || 'monthly'} />
                              {schedule.isRecurring && (
                                <div className="flex items-center gap-0.5">
                                  <RefreshCw size={9} className="text-brand-400" />
                                  <span className="text-[10px] text-brand-500 font-medium">Recurring</span>
                                </div>
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
              title="Tap a day to view or add jobs"
              description="Dots show scheduled visits · Numbers show multiple jobs"
            />
          )}

        </div>
      </div>

      {/* Add job modal */}
      <Modal
        open={showAddModal}
        onClose={() => setShowAddModal(false)}
        title={`Add job — ${selectedDay ? format(selectedDay, 'MMM d') : ''}`}
        footer={
          <>
            <Button variant="secondary" fullWidth onClick={() => setShowAddModal(false)}>Cancel</Button>
            <Button fullWidth loading={saving} onClick={handleAddSchedule}>
              {repeatMode === 'none' ? 'Add job' : `Schedule ${occurrences} visits`}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Select
            label="Client"
            value={selectedClient}
            onChange={e => handleClientSelect(e.target.value)}
          >
            {clients.map(c => (
              <option key={c.id} value={c.id}>{c.name} — {c.packageType}</option>
            ))}
          </Select>

          <Select label="Time" value={selectedTime} onChange={e => setSelectedTime(e.target.value)}>
            {TIMES.map(t => <option key={t} value={t}>{t}</option>)}
          </Select>

          <Select
            label="Repeat"
            value={repeatMode}
            onChange={e => setRepeatMode(e.target.value)}
            hint={selectedClientObj?.recurrence && selectedClientObj.recurrence !== 'onetime'
              ? `Suggested for ${selectedClientObj.name}: ${REPEAT_OPTIONS.find(o => o.value === selectedClientObj.recurrence)?.label || ''}`
              : undefined}
          >
            {REPEAT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </Select>

          {repeatMode !== 'none' && (
            <Select
              label="Number of visits to schedule"
              value={occurrences}
              onChange={e => setOccurrences(e.target.value)}
            >
              {OCCURRENCE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </Select>
          )}

          {repeatMode !== 'none' && previewDates.length > 0 && (
            <div>
              <button
                onClick={() => setShowPreview(!showPreview)}
                className="text-[12px] text-brand-600 font-medium"
              >
                {showPreview ? 'Hide' : 'Preview'} scheduled dates →
              </button>
              {showPreview && (
                <div className="mt-2 bg-brand-50 rounded-xl p-3 max-h-48 overflow-y-auto">
                  <div className="space-y-1">
                    {previewDates.map((date, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-brand-500 flex-shrink-0" />
                        <p className="text-[12px] text-brand-700">
                          {format(date, 'EEE, MMM d yyyy')}
                          {i === 0 && <span className="text-brand-400 ml-1">(first visit)</span>}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {repeatMode === 'none' && selectedClientObj && (
            <div className="bg-gray-50 rounded-xl p-3">
              <p className="text-[12px] text-gray-500">
                Adding a single visit for <strong>{selectedClientObj.name}</strong> on{' '}
                <strong>{selectedDay ? format(selectedDay, 'MMMM d') : ''}</strong> at{' '}
                <strong>{selectedTime}</strong>.
              </p>
              {selectedClientObj.recurrence && selectedClientObj.recurrence !== 'onetime' && (
                <p className="text-[11px] text-brand-600 mt-1">
                  Tip: This client is on a recurring schedule. Use "Repeat" to auto-schedule all visits at once.
                </p>
              )}
            </div>
          )}
        </div>
      </Modal>

      {/* Delete confirmation modal */}
      <Modal
        open={showDeleteModal}
        onClose={() => { setShowDeleteModal(false); setDeleteTarget(null) }}
        title="Remove visit"
        footer={
          deleteTarget?.isRecurring ? (
            <div className="flex flex-col gap-2 w-full">
              <Button
                variant="secondary"
                fullWidth
                loading={deleting}
                onClick={handleDeleteOne}
              >
                Remove just this visit
              </Button>
              <Button
                variant="danger"
                fullWidth
                loading={deleting}
                onClick={handleDeleteAll}
              >
                Remove all future visits
              </Button>
              <Button
                variant="ghost"
                fullWidth
                onClick={() => { setShowDeleteModal(false); setDeleteTarget(null) }}
              >
                Cancel
              </Button>
            </div>
          ) : (
            <>
              <Button variant="secondary" fullWidth onClick={() => { setShowDeleteModal(false); setDeleteTarget(null) }}>
                Cancel
              </Button>
              <Button variant="danger" fullWidth loading={deleting} onClick={handleDeleteOne}>
                Remove visit
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
                This is a recurring visit for <strong>
                  {clientMap[deleteTarget?.clientId]?.name || deleteTarget?.clientName}
                </strong>. Do you want to remove just this visit or all future scheduled visits?
              </p>
            </div>
            <p className="text-[12px] text-gray-400 text-center">
              Completed visits will not be affected.
            </p>
          </div>
        ) : (
          <p className="text-[14px] text-gray-600">
            Remove this visit for <strong>
              {clientMap[deleteTarget?.clientId]?.name || deleteTarget?.clientName}
            </strong> on <strong>
              {deleteTarget?.serviceDate}
            </strong>?
          </p>
        )}
      </Modal>
    </AppShell>
  )
}