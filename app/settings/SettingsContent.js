'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect } from 'react'
import { useAuth } from '@/context/AuthContext'
import { useLang } from '@/context/LangContext'
import AppShell from '@/components/layout/AppShell'
import PageHeader from '@/components/layout/PageHeader'
import { Card, Button, Input, Select } from '@/components/ui'
import { saveGardenerProfile } from '@/lib/db'
import { Bell, Globe, User, Clock } from 'lucide-react'
import toast from 'react-hot-toast'

const REMINDER_OPTIONS = [
  { value: '24',  label: '24 hours before / 24 horas antes' },
  { value: '48',  label: '48 hours before / 48 horas antes' },
  { value: '72',  label: '72 hours before / 72 horas antes' },
  { value: '0',   label: 'Day of visit / Día de la visita' },
  { value: 'all', label: 'All of the above / Todos' },
]

const LANGUAGE_OPTIONS = [
  { value: 'en', label: '🇺🇸 English' },
  { value: 'es', label: '🇲🇽 Español' },
]

export default function SettingsPage() {
  const { user, profile, refreshProfile } = useAuth()
  const { translate, lang } = useLang()

  const [form,    setForm]    = useState({
    name:           '',
    businessName:   '',
    phone:          '',
    reminderTiming: '48',
    language:       'en',
    smsTemplate:    '',
    smsTemplateEs:  '',
  })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (profile) {
      setForm({
        name:           profile.name           || '',
        businessName:   profile.businessName   || '',
        phone:          profile.phone          || '',
        reminderTiming: profile.reminderTiming || '48',
        language:       profile.language       || 'en',
        smsTemplate:    profile.smsTemplate    || 'Hi {name}! Your yard service is scheduled for {date} at {time}. See you then! — {business}',
        smsTemplateEs:  profile.smsTemplateEs  || 'Hola {name}! Su servicio de jardín está programado para {date} a las {time}. ¡Hasta pronto! — {business}',
      })
    }
  }, [profile])

  function setField(key, val) {
    setForm(prev => ({ ...prev, [key]: val }))
  }

  async function handleSave() {
    setSaving(true)
    try {
      await saveGardenerProfile(user.uid, form)
      await refreshProfile()
      toast.success(translate('settings', 'save') + ' ✓')
    } catch {
      toast.error(translate('common', 'error'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <AppShell>
      <div className="page-content">
        <PageHeader
          title={translate('settings', 'title')}
          subtitle={translate('settings', 'subtitle')}
        />

        <div className="px-4 py-4 max-w-lg mx-auto space-y-5">

          {/* Profile */}
          <section>
            <div className="flex items-center gap-2 mb-3">
              <User size={14} className="text-brand-600" />
              <p className="text-[11px] font-medium text-gray-400 uppercase tracking-wide">
                {translate('settings', 'profile')}
              </p>
            </div>
            <Card>
              <div className="space-y-4">
                <Input
                  label={translate('settings', 'your_name')}
                  value={form.name}
                  onChange={e => setField('name', e.target.value)}
                  placeholder="Marco Rodriguez"
                />
                <Input
                  label={translate('settings', 'business_name')}
                  value={form.businessName}
                  onChange={e => setField('businessName', e.target.value)}
                  placeholder="Rodriguez Lawn Care"
                />
                <Input
                  label={translate('settings', 'phone')}
                  value={form.phone}
                  onChange={e => {
                    const digits = e.target.value.replace(/\D/g, '').slice(0, 10)
                    let formatted = digits
                    if (digits.length > 6) {
                      formatted = `(${digits.slice(0,3)}) ${digits.slice(3,6)}-${digits.slice(6)}`
                    } else if (digits.length > 3) {
                      formatted = `(${digits.slice(0,3)}) ${digits.slice(3)}`
                    } else if (digits.length > 0) {
                      formatted = `(${digits}`
                    }
                    setField('phone', formatted)
                  }}
                  placeholder="(210) 555-0100"
                  type="tel"
                />
                <p className="text-[11px] text-brand-600 -mt-2">
                  {lang === 'es'
                    ? '📲 Agrega tu número para recibir un resumen de tus trabajos cada mañana por SMS'
                    : '📲 Add your number to receive a daily morning SMS summary of your jobs'}
                </p>
              </div>
            </Card>
          </section>

          {/* Language */}
          <section>
            <div className="flex items-center gap-2 mb-3">
              <Globe size={14} className="text-brand-600" />
              <p className="text-[11px] font-medium text-gray-400 uppercase tracking-wide">
                {translate('settings', 'language')}
              </p>
            </div>
            <Card>
              <Select
                label={translate('settings', 'app_language')}
                value={form.language}
                onChange={e => setField('language', e.target.value)}
              >
                {LANGUAGE_OPTIONS.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </Select>
              <p className="text-[11px] text-gray-400 mt-2">
                {translate('settings', 'sms_note')}
              </p>
            </Card>
          </section>

          {/* SMS Reminders */}
          <section>
            <div className="flex items-center gap-2 mb-3">
              <Bell size={14} className="text-brand-600" />
              <p className="text-[11px] font-medium text-gray-400 uppercase tracking-wide">
                {translate('settings', 'reminders')}
              </p>
            </div>
            <Card>
              <div className="space-y-4">
                <Select
                  label={translate('settings', 'send_reminders')}
                  value={form.reminderTiming}
                  onChange={e => setField('reminderTiming', e.target.value)}
                >
                  {REMINDER_OPTIONS.map(o => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </Select>

                <div>
                  <p className="text-[13px] font-medium text-gray-700 mb-1">
                    {translate('settings', 'english_template')}
                  </p>
                  <textarea
                    value={form.smsTemplate}
                    onChange={e => setField('smsTemplate', e.target.value)}
                    rows={3}
                    className="w-full rounded-xl border border-gray-200 bg-white text-[13px] px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none"
                  />
                </div>

                <div>
                  <p className="text-[13px] font-medium text-gray-700 mb-1">
                    {translate('settings', 'spanish_template')}
                  </p>
                  <textarea
                    value={form.smsTemplateEs}
                    onChange={e => setField('smsTemplateEs', e.target.value)}
                    rows={3}
                    className="w-full rounded-xl border border-gray-200 bg-white text-[13px] px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none"
                  />
                </div>

                <p className="text-[11px] text-gray-400">
                  {translate('settings', 'variables')} {'{name}'} {'{date}'} {'{time}'} {'{business}'}
                </p>
              </div>
            </Card>
          </section>

          {/* Subscription */}
          <section>
            <div className="flex items-center gap-2 mb-3">
              <Clock size={14} className="text-brand-600" />
              <p className="text-[11px] font-medium text-gray-400 uppercase tracking-wide">
                {translate('settings', 'subscription')}
              </p>
            </div>
            <Card className="bg-brand-50 border-brand-100">
              <p className="text-[13px] font-medium text-brand-800">
                {translate('settings', 'active')}
              </p>
              <p className="text-[12px] text-brand-600 mt-1">
                {translate('settings', 'fee_note')}
              </p>
              <div className="mt-3 space-y-1">
                <div className="flex justify-between text-[12px]">
                  <span className="text-brand-700">Monthly / Mensual</span>
                  <span className="text-brand-800 font-medium">+$15/invoice</span>
                </div>
                <div className="flex justify-between text-[12px]">
                  <span className="text-brand-700">Quarterly / Trimestral</span>
                  <span className="text-brand-800 font-medium">+$35/invoice</span>
                </div>
                <div className="flex justify-between text-[12px]">
                  <span className="text-brand-700">Annual / Anual</span>
                  <span className="text-brand-800 font-medium">+$100/invoice</span>
                </div>
                <div className="flex justify-between text-[12px]">
                  <span className="text-brand-700">Weekly / Semanal</span>
                  <span className="text-brand-800 font-medium">+$5/invoice</span>
                </div>
                <div className="flex justify-between text-[12px]">
                  <span className="text-brand-700">One-time / Una vez</span>
                  <span className="text-brand-800 font-medium">+8% (min $10)</span>
                </div>
                <div className="flex justify-between text-[12px]">
                  <span className="text-brand-700">Add-ons / Adicionales</span>
                  <span className="text-brand-800 font-medium">+10%</span>
                </div>
              </div>
            </Card>
          </section>

          <Button fullWidth size="lg" loading={saving} onClick={handleSave}>
            {translate('settings', 'save')}
          </Button>

          <p className="text-center text-[11px] text-gray-300 pb-4">
            {translate('settings', 'footer')}
          </p>

        </div>
      </div>
    </AppShell>
  )
}