'use client'

import { useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { Sparkles, Send, Copy, Check } from 'lucide-react'
import { Card, Button, Input } from '@/components/ui'

function tomorrowYmd() {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

function ymdToIso(ymd) {
  // Treat YYYY-MM-DD as local midnight to avoid TZ surprises in the prompt
  return new Date(`${ymd}T09:00:00`).toISOString()
}

const T = {
  en: {
    title:        'Appointment reminder',
    subtitle:     'Draft a friendly SMS reminder with AI, then send or copy.',
    date:         'Date',
    time:         'Time',
    timeHint:     'e.g. 9:00 AM',
    service:      'Service',
    serviceHint:  'e.g. lawn mowing',
    notes:        'Notes (optional)',
    notesHint:    'Anything extra to include — weather, items to bring, etc.',
    language:     'Language',
    draftBtn:     'Draft with AI',
    drafting:     'Drafting…',
    draftLabel:   'Draft (editable)',
    fitsOne:      'fits in one SMS',
    twoSms:       'will send as 2 SMS',
    sendSms:      'Send via SMS',
    sending:      'Sending…',
    copy:         'Copy',
    copied:       'Copied',
    smsSent:      'SMS sent',
    noPhone:      'No phone on file — copy and send manually',
    fillFirst:    'Add a date, time, and service before drafting',
    draftFailed:  'Could not draft message — please try again',
  },
  es: {
    title:        'Recordatorio de cita',
    subtitle:     'Redacta un SMS con IA, luego envíalo o cópialo.',
    date:         'Fecha',
    time:         'Hora',
    timeHint:     'ej. 9:00 AM',
    service:      'Servicio',
    serviceHint:  'ej. corte de césped',
    notes:        'Notas (opcional)',
    notesHint:    'Algo extra que incluir — clima, herramientas, etc.',
    language:     'Idioma',
    draftBtn:     'Redactar con IA',
    drafting:     'Redactando…',
    draftLabel:   'Borrador (editable)',
    fitsOne:      'cabe en un SMS',
    twoSms:       'se enviará como 2 SMS',
    sendSms:      'Enviar por SMS',
    sending:      'Enviando…',
    copy:         'Copiar',
    copied:       'Copiado',
    smsSent:      'SMS enviado',
    noPhone:      'Sin teléfono — copia y envía manualmente',
    fillFirst:    'Agrega fecha, hora y servicio antes de redactar',
    draftFailed:  'No se pudo redactar — intenta de nuevo',
  },
}

export default function AiReminderDrafter({ client, contractorName, lang = 'en' }) {
  const t = T[lang] || T.en

  const [date,        setDate]        = useState(tomorrowYmd())
  const [time,        setTime]        = useState('9:00 AM')
  const [serviceType, setServiceType] = useState(client?.packageLabel || '')
  const [notes,       setNotes]       = useState('')
  const [language,    setLanguage]    = useState(client?.language === 'es' ? 'es' : 'en')

  const [draft,       setDraft]       = useState('')
  const [drafting,    setDrafting]    = useState(false)
  const [sending,     setSending]     = useState(false)
  const [copied,      setCopied]      = useState(false)

  const charCount = draft.length
  const charClass = charCount === 0
    ? 'text-gray-400'
    : charCount <= 160
      ? 'text-emerald-600'
      : charCount <= 320
        ? 'text-amber-600'
        : 'text-red-600'

  const charLabel = useMemo(() => {
    if (charCount === 0) return null
    if (charCount <= 160) return `${charCount} / 160 — ${t.fitsOne}`
    return `${charCount} / 320 — ${t.twoSms}`
  }, [charCount, t])

  async function handleDraft() {
    if (!date || !time.trim() || !serviceType.trim()) {
      toast.error(t.fillFirst)
      return
    }
    setDrafting(true)
    setCopied(false)
    try {
      const res = await fetch('/api/ai/draft-message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientName: client.name,
          appointmentDate: ymdToIso(date),
          appointmentTime: time.trim(),
          serviceType: serviceType.trim(),
          language,
          contractorName: contractorName || 'Your contractor',
          additionalNotes: notes.trim() || undefined,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error || t.draftFailed)
      setDraft(data.draft || '')
    } catch (err) {
      toast.error(err.message || t.draftFailed)
    } finally {
      setDrafting(false)
    }
  }

  async function handleSendSms() {
    if (!client?.phone || !draft.trim()) return
    setSending(true)
    try {
      // TODO(v2): when this drafter is reached from a scheduled appointment,
      // pass scheduleId + clientId so /api/twilio/send appends the calendar link.
      const res = await fetch('/api/twilio/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientPhone: client.phone,
          message: draft.trim(),
          language,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error || 'SMS failed')
      toast.success(`${t.smsSent} ✓`)
      setDraft('')
    } catch (err) {
      toast.error(err.message || 'SMS failed')
    } finally {
      setSending(false)
    }
  }

  async function handleCopy() {
    if (!draft.trim()) return
    try {
      await navigator.clipboard.writeText(draft)
      setCopied(true)
      toast.success(`${t.copied} ✓`)
      setTimeout(() => setCopied(false), 1800)
    } catch {
      toast.error('Copy failed')
    }
  }

  const hasPhone = !!client?.phone

  return (
    <Card>
      <div className="flex items-start gap-2 mb-3">
        <div className="w-8 h-8 rounded-full bg-brand-50 flex items-center justify-center flex-shrink-0">
          <Sparkles size={15} className="text-brand-600" />
        </div>
        <div>
          <p className="text-[14px] font-semibold text-gray-900">{t.title}</p>
          <p className="text-[12px] text-gray-500">{t.subtitle}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Input
          label={t.date}
          type="date"
          value={date}
          onChange={e => setDate(e.target.value)}
        />
        <Input
          label={t.time}
          value={time}
          onChange={e => setTime(e.target.value)}
          placeholder={t.timeHint}
        />
      </div>

      <div className="mt-3">
        <Input
          label={t.service}
          value={serviceType}
          onChange={e => setServiceType(e.target.value)}
          placeholder={t.serviceHint}
        />
      </div>

      <div className="mt-3">
        <label className="text-[13px] font-medium text-gray-700">{t.notes}</label>
        <textarea
          value={notes}
          onChange={e => setNotes(e.target.value)}
          placeholder={t.notesHint}
          maxLength={500}
          rows={2}
          className="mt-1 w-full rounded-xl border border-gray-200 bg-white text-gray-900 text-[14px] px-3 py-2.5 placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
        />
      </div>

      <div className="mt-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-[12px] text-gray-500">{t.language}:</span>
          <div className="inline-flex rounded-lg border border-gray-200 overflow-hidden text-[12px]">
            {['en', 'es'].map(code => (
              <button
                key={code}
                type="button"
                onClick={() => setLanguage(code)}
                className={`px-3 py-1.5 transition-colors ${language === code ? 'bg-brand-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
              >
                {code === 'en' ? 'EN' : 'ES'}
              </button>
            ))}
          </div>
        </div>

        <Button
          icon={Sparkles}
          loading={drafting}
          onClick={handleDraft}
          size="sm"
        >
          {drafting ? t.drafting : t.draftBtn}
        </Button>
      </div>

      {draft && (
        <div className="mt-4 pt-4 border-t border-gray-100">
          <label className="text-[13px] font-medium text-gray-700">{t.draftLabel}</label>
          <textarea
            value={draft}
            onChange={e => setDraft(e.target.value.slice(0, 320))}
            rows={4}
            maxLength={320}
            className="mt-1 w-full rounded-xl border border-gray-200 bg-white text-gray-900 text-[14px] px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
          />
          {charLabel && (
            <p className={`mt-1 text-[12px] ${charClass}`}>{charLabel}</p>
          )}

          <div className="mt-3 grid grid-cols-2 gap-2">
            <Button
              icon={Send}
              loading={sending}
              disabled={!hasPhone || sending || !draft.trim()}
              onClick={handleSendSms}
            >
              {sending ? t.sending : t.sendSms}
            </Button>
            <Button
              variant="secondary"
              icon={copied ? Check : Copy}
              onClick={handleCopy}
              disabled={!draft.trim()}
            >
              {copied ? t.copied : t.copy}
            </Button>
          </div>
          {!hasPhone && (
            <p className="mt-2 text-[11px] text-gray-400 text-center">{t.noPhone}</p>
          )}
        </div>
      )}
    </Card>
  )
}
