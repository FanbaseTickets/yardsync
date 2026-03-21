'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect } from 'react'
import { useAuth } from '@/context/AuthContext'
import { useLang } from '@/context/LangContext'
import AppShell from '@/components/layout/AppShell'
import PageHeader from '@/components/layout/PageHeader'
import { Card, Button, Skeleton, EmptyState } from '@/components/ui'
import { getClients } from '@/lib/db'
import { getSchedulesFromToday } from '@/lib/db'
import { MessageSquare, CheckCircle2, Clock, Send } from 'lucide-react'
import toast from 'react-hot-toast'

function format(date, str) {
  const d      = new Date(date)
  const pad    = n => String(n).padStart(2, '0')
  const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']
  const DAYS   = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']
  return str
    .replace('MMMM', MONTHS[d.getMonth()])
    .replace('EEEE', DAYS[d.getDay()])
    .replace('yyyy', d.getFullYear())
    .replace('MM',   pad(d.getMonth() + 1))
    .replace('dd',   pad(d.getDate()))
    .replace(/\bd\b/, d.getDate())
}

function parseISO(str) {
  return new Date(str + 'T12:00:00')
}

export default function SMSPage() {
  const { user, profile } = useAuth()
  const { translate } = useLang()

  const [schedules,  setSchedules]  = useState([])
  const [clients,    setClients]    = useState([])
  const [loading,    setLoading]    = useState(true)
  const [template,   setTemplate]   = useState('')
  const [editingTpl, setEditingTpl] = useState(false)
  const [sending,    setSending]    = useState(null)

  useEffect(() => {
    if (!user) return
    loadData()
  }, [user])

  useEffect(() => {
    if (profile?.smsTemplate) {
      setTemplate(profile.smsTemplate)
    } else {
      setTemplate('Hi {name}! Your yard service is scheduled for {date} at {time}. See you then! — {business}')
    }
  }, [profile])

async function loadData() {
  setLoading(true)
  try {
    const today = format(new Date(), 'yyyy-MM-dd')
    const [allSchedules, c] = await Promise.all([
      getSchedulesFromToday(user.uid, today),
      getClients(user.uid),
    ])
    setSchedules(allSchedules)
    setClients(c)
  } catch {
    toast.error(translate('common', 'error'))
  } finally {
    setLoading(false)
  }
}

  function getClient(clientId) {
    return clients.find(c => c.id === clientId)
  }

  function resolveClientName(schedule) {
    if (schedule.clientId) {
      return getClient(schedule.clientId)?.name || schedule.clientName || 'there'
    }
    return schedule.clientName || 'there'
  }

  function resolveClientPhone(schedule) {
    if (schedule.clientId) {
      return getClient(schedule.clientId)?.phone || ''
    }
    return schedule.clientPhone || ''
  }

  function formatServiceDate(dateStr) {
    try {
      return format(parseISO(dateStr), 'MMMM d, yyyy')
    } catch {
      return dateStr
    }
  }

  function resolveClientLanguage(schedule) {
    if (schedule.clientId) {
      return getClient(schedule.clientId)?.language || 'en'
    }
    return 'en'
  }

  function buildPreview(schedule) {
    const clientName = resolveClientName(schedule)
    const clientLang = resolveClientLanguage(schedule)
    const tpl = clientLang === 'es'
      ? (profile?.smsTemplateEs || 'Hola {name}! Su servicio de jardín está programado para {date} a las {time}. ¡Hasta pronto! — {business}')
      : (profile?.smsTemplate   || 'Hi {name}! Your yard service is scheduled for {date} at {time}. See you then! — {business}')
    return tpl
      .replace('{name}',     clientName.split(' ')[0])
      .replace('{date}',     formatServiceDate(schedule.serviceDate))
      .replace('{time}',     schedule.time || 'TBD')
      .replace('{business}', profile?.businessName || 'YardSync')
  }

  async function handleSendSMS(schedule) {
    const phone = resolveClientPhone(schedule)
    if (!phone) {
      toast.error('No phone number on file for this client')
      return
    }
    setSending(schedule.id)
    try {
      const res = await fetch('/api/twilio/send', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          scheduleId:  schedule.id,
          clientId:    schedule.clientId || null,
          clientPhone: phone,
          message:     buildPreview(schedule),
          language:    resolveClientLanguage(schedule),
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'SMS failed')
      }
      toast.success(translate('sms', 'sms_sent_check'))
      loadData()
    } catch (err) {
      const isConnectionError = !err.message || err.message === 'Failed to fetch'
      toast.error(isConnectionError ? translate('sms', 'not_connected') : err.message)
    } finally {
      setSending(null)
    }
  }

  const smsSentCount  = schedules.filter(s => s.smsSent).length
  const upcomingCount = schedules.filter(s => !s.smsSent && s.status !== 'completed').length
  const upcoming      = schedules.filter(s => s.status !== 'completed').slice(0, 30)

  const grouped = upcoming.reduce((acc, s) => {
    const date = s.serviceDate
    if (!acc[date]) acc[date] = []
    acc[date].push(s)
    return acc
  }, {})

  return (
    <AppShell>
      <div className="page-content">
        <PageHeader
          title={translate('sms', 'title')}
          subtitle={translate('sms', 'subtitle')}
        />

        <div className="px-4 py-4 max-w-lg mx-auto space-y-4">

          {/* Stats */}
          <div className="grid grid-cols-2 gap-3">
            <Card className="text-center py-3">
              <p className="text-[22px] font-semibold text-brand-600">{smsSentCount}</p>
              <p className="text-[11px] text-gray-400 mt-0.5">{translate('sms', 'sms_sent')}</p>
            </Card>
            <Card className="text-center py-3">
              <p className="text-[22px] font-semibold text-gray-800">{upcomingCount}</p>
              <p className="text-[11px] text-gray-400 mt-0.5">{translate('sms', 'pending')}</p>
            </Card>
          </div>

          {/* Twilio status */}
          <Card className="flex items-center gap-3">
            <div className="w-2.5 h-2.5 rounded-full flex-shrink-0 bg-green-400" />
            <div className="flex-1">
              <p className="text-[13px] font-medium text-gray-800">Twilio SMS</p>
              <p className="text-[11px] text-gray-400">{translate('sms', 'connected')}</p>
            </div>
          </Card>

          {/* Message template */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-[11px] font-medium text-gray-400 uppercase tracking-wide">
                {translate('sms', 'message_template')}
              </p>
              <button
                onClick={() => setEditingTpl(!editingTpl)}
                className="text-[12px] text-brand-600 font-medium"
              >
                {editingTpl ? translate('sms', 'done') : translate('sms', 'edit')}
              </button>
            </div>
            {editingTpl ? (
              <textarea
                value={template}
                onChange={e => setTemplate(e.target.value)}
                rows={4}
                className="w-full rounded-xl border border-gray-200 bg-white text-[13px] px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none"
              />
            ) : (
              <Card className="bg-gray-50">
                <p className="text-[13px] text-gray-600 leading-relaxed">{template}</p>
              </Card>
            )}
            <p className="text-[11px] text-gray-400 mt-1">
              {translate('sms', 'variables')} {'{name}'} {'{date}'} {'{time}'} {'{business}'}
            </p>
          </div>

          {/* Upcoming visits */}
          <div>
            <p className="text-[11px] font-medium text-gray-400 uppercase tracking-wide mb-2">
              {translate('sms', 'upcoming')}
            </p>

            {loading ? (
              <div className="space-y-2">
                {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-16" />)}
              </div>
            ) : upcoming.length === 0 ? (
              <EmptyState
                icon={MessageSquare}
                title={translate('sms', 'no_upcoming')}
                description={translate('sms', 'add_jobs')}
              />
            ) : (
              <div className="space-y-4">
                {Object.entries(grouped).slice(0, 10).map(([date, daySchedules]) => (
                  <div key={date}>
                    <p className="text-[12px] font-semibold text-gray-500 mb-2">
                      {format(parseISO(date), 'EEEE, MMMM d')}
                    </p>
                    <div className="space-y-2">
                      {daySchedules.map(schedule => {
                        const displayName = resolveClientName(schedule)
                        const hasPhone    = !!resolveClientPhone(schedule)
                        return (
                          <Card key={schedule.id} padding={false}>
                            <div className="p-3 flex items-center gap-3">
                              {schedule.smsSent ? (
                                <CheckCircle2 size={18} className="text-brand-500 flex-shrink-0" />
                              ) : (
                                <Clock size={18} className="text-amber-400 flex-shrink-0" />
                              )}
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1.5">
                                  <p className="text-[13px] font-medium text-gray-900">{displayName}</p>
                                  {schedule.isWalkIn && (
                                    <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full font-medium">
                                      Walk-in
                                    </span>
                                  )}
                                </div>
                                <p className="text-[11px] text-gray-400">
                                  {schedule.time || 'TBD'} · {schedule.smsSent
                                    ? translate('sms', 'sms_sent_check')
                                    : !hasPhone
                                    ? 'No phone number'
                                    : translate('sms', 'sms_pending')}
                                </p>
                                <p className="text-[11px] text-gray-500 mt-0.5 truncate italic">
                                  &quot;{buildPreview(schedule)}&quot;
                                </p>
                              </div>
                              <Button
                                size="sm"
                                variant={schedule.smsSent ? 'secondary' : 'brand'}
                                loading={sending === schedule.id}
                                onClick={() => handleSendSMS(schedule)}
                                icon={Send}
                                disabled={!hasPhone}
                              >
                                {schedule.smsSent
                                  ? translate('sms', 'resend')
                                  : translate('sms', 'send')}
                              </Button>
                            </div>
                          </Card>
                        )
                      })}
                    </div>
                  </div>
                ))}

                {Object.keys(grouped).length > 10 && (
                  <p className="text-[12px] text-center text-gray-400">
                    {translate('sms', 'showing_next')}
                  </p>
                )}
              </div>
            )}
          </div>

        </div>
      </div>
    </AppShell>
  )
}