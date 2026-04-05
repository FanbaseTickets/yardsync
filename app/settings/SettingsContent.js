'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect } from 'react'
import { useAuth } from '@/context/AuthContext'
import { useLang } from '@/context/LangContext'
import AppShell from '@/components/layout/AppShell'
import PageHeader from '@/components/layout/PageHeader'
import { Card, Button, Input, Select } from '@/components/ui'
import PhoneInput from '@/components/ui/PhoneInput'
import { saveGardenerProfile, getGardenerProfile, getFeePayments, saveFeePayment, markQuarterFeesCollected, getQuarterlyFeesOwed } from '@/lib/db'
import { formatCents } from '@/lib/fee'
import { Bell, Globe, User, Clock, BarChart2, CreditCard, Link2, AlertTriangle, Wallet, CheckCircle2, ArrowUpCircle, TrendingUp, Lock, Zap } from 'lucide-react'
import { useSearchParams } from 'next/navigation'
import toast from 'react-hot-toast'

function getReminderOptions(translate) {
  return [
    { value: '24',  label: translate('settings', 'reminder_24') },
    { value: '48',  label: translate('settings', 'reminder_48') },
    { value: '72',  label: translate('settings', 'reminder_72') },
    { value: '0',   label: translate('settings', 'reminder_0') },
    { value: 'all', label: translate('settings', 'reminder_all') },
  ]
}

const LANGUAGE_OPTIONS = [
  { value: 'en', label: 'English (US)' },
  { value: 'es', label: 'Español (MX)' },
]

export default function SettingsPage() {
  const { user, profile, refreshProfile } = useAuth()
  const { translate, lang } = useLang()
  const searchParams = useSearchParams()
  const [disconnecting, setDisconnecting] = useState(false)
  const [showDisconnectConfirm, setShowDisconnectConfirm] = useState(false)
  const [cardLoading,    setCardLoading]    = useState(false)
  const [showCardModal,  setShowCardModal]  = useState(false)
  const [cardError,      setCardError]      = useState('')
  const [squareRedirecting, setSquareRedirecting] = useState(false)
  const [payingQuarter, setPayingQuarter] = useState(null)
  const [quarterFees,   setQuarterFees]   = useState([])
  const [showUpgradeModal, setShowUpgradeModal] = useState(false)
  const [upgrading,        setUpgrading]        = useState(false)
  const [monthlyVolume,    setMonthlyVolume]    = useState(0)
  const [showCancelModal,  setShowCancelModal]  = useState(false)
  const [canceling,        setCanceling]        = useState(false)

  // Handle Square OAuth callback redirect
  useEffect(() => {
    if (!user || !searchParams) return
    if (searchParams.get('squareConnected') === 'true') {
      const squareData = {
        squareAccessToken:  searchParams.get('squareAccessToken')  || '',
        squareRefreshToken: searchParams.get('squareRefreshToken') || '',
        squareMerchantId:   searchParams.get('squareMerchantId')   || '',
        squareMerchantName: searchParams.get('squareMerchantName') || '',
        squareLocationId:   searchParams.get('squareLocationId')   || '',
        squareLocationName: searchParams.get('squareLocationName') || '',
        squareExpiresAt:    searchParams.get('squareExpiresAt')    || '',
        squareConnected:    true,
        squareConnectedAt:  new Date().toISOString(),
      }
      saveGardenerProfile(user.uid, squareData).then(() => {
        refreshProfile()
        toast.success(lang === 'es' ? 'Square conectado exitosamente!' : 'Square account connected!')
        window.history.replaceState({}, '', '/settings')
      })
    }
    if (searchParams.get('squareError')) {
      toast.error(`Square connection failed: ${searchParams.get('squareError')}`)
      window.history.replaceState({}, '', '/settings')
    }
  }, [user, searchParams])

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

  useEffect(() => {
    if (user) {
      loadFeeData()
      loadMonthlyVolume()
    }
  }, [user])

  async function loadFeeData() {
    try {
      const payments = await getFeePayments(user.uid)
      const now = new Date()
      const year = now.getFullYear()
      const fees = []
      for (let q = 1; q <= 4; q++) {
        const label = `Q${q}`
        const { totalFees, invoiceCount } = await getQuarterlyFeesOwed(user.uid, label, year)
        const paid = payments.find(p => p.quarter === label && p.year === year && (p.status === 'paid' || p.status === 'auto_charged'))
        fees.push({ label, year, totalFees, invoiceCount, paid: !!paid, paidAt: paid?.paidAt })
      }
      setQuarterFees(fees)
    } catch (err) {
      console.error('Failed to load fee data:', err)
    }
  }

  async function loadMonthlyVolume() {
    try {
      const allInvoices = await getInvoices(user.uid)
      const now = new Date()
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
      const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59)
      let total = 0
      allInvoices.forEach(inv => {
        if (inv.status !== 'paid') return
        const d = inv.createdAt?.toDate?.() || new Date(inv.createdAt)
        if (d >= monthStart && d <= monthEnd) {
          total += inv.totalCents || 0
        }
      })
      setMonthlyVolume(total)
    } catch (err) {
      console.error('Failed to load monthly volume:', err)
    }
  }

  async function handleSetupCard() {
    setCardLoading(true)
    setCardError('')
    try {
      // Step 1: Get SetupIntent from our API
      const res = await fetch('/api/stripe/setup-intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gardenerUid: user.uid,
          email: profile?.email || user.email,
          name: profile?.name || '',
          stripeCustomerId: profile?.stripeCustomerId || null,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to create setup intent')

      // Save Stripe customer ID if new
      if (!profile?.stripeCustomerId && data.stripeCustomerId) {
        await saveGardenerProfile(user.uid, { stripeCustomerId: data.stripeCustomerId })
        await refreshProfile()
      }

      // Step 2: Load Stripe.js and confirm with card details
      const { loadStripe } = await import('@stripe/stripe-js')
      const stripe = await loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY)
      if (!stripe) throw new Error('Stripe failed to load')

      // Create a card element for secure collection
      const elements = stripe.elements({ clientSecret: data.clientSecret })
      const cardElement = elements.create('card', {
        style: {
          base: { fontSize: '14px', color: '#1f2937', '::placeholder': { color: '#9ca3af' } },
        },
      })

      // Mount into the modal's card container
      const container = document.getElementById('stripe-card-element')
      if (!container) throw new Error('Card container not found')
      cardElement.mount(container)

      // Wait for user to submit via the modal's confirm button
      setCardLoading(false)
      window.__stripeCardElement = cardElement
      window.__stripeInstance = stripe
      window.__setupClientSecret = data.clientSecret
      window.__stripeCustomerId = data.stripeCustomerId || profile?.stripeCustomerId
    } catch (err) {
      toast.error(err.message || 'Could not set up payment method. Please try again.')
      setCardLoading(false)
      setShowCardModal(false)
    }
  }

  async function handleConfirmCard() {
    setCardLoading(true)
    setCardError('')
    try {
      const stripe = window.__stripeInstance
      const cardElement = window.__stripeCardElement
      const clientSecret = window.__setupClientSecret

      if (!stripe || !cardElement || !clientSecret) throw new Error('Card session expired. Please try again.')

      const { error, setupIntent } = await stripe.confirmCardSetup(clientSecret, {
        payment_method: { card: cardElement },
      })

      if (error) throw new Error(error.message)

      if (setupIntent.status === 'succeeded' && setupIntent.payment_method) {
        // Step 3: Save the payment method via our API
        const saveRes = await fetch('/api/stripe/payment-method', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            stripeCustomerId: window.__stripeCustomerId,
            paymentMethodId: setupIntent.payment_method,
          }),
        })
        const saveData = await saveRes.json()
        if (!saveRes.ok) throw new Error(saveData.error || 'Failed to save card')

        // Save card display info to Firestore (safe — not sensitive data)
        await saveGardenerProfile(user.uid, {
          stripePaymentMethodId: saveData.paymentMethodId,
          cardLast4: saveData.last4,
          cardBrand: saveData.brand,
        })
        await refreshProfile()
        toast.success(lang === 'es' ? 'Tarjeta guardada!' : 'Card saved!')
        setShowCardModal(false)
      } else {
        throw new Error('Card setup did not complete')
      }
    } catch (err) {
      setCardError(err.message)
      toast.error(err.message || 'Could not set up payment method. Please try again.')
    } finally {
      setCardLoading(false)
      window.__stripeCardElement = null
      window.__stripeInstance = null
      window.__setupClientSecret = null
      window.__stripeCustomerId = null
    }
  }

  async function handleRemoveCard() {
    if (!profile?.stripePaymentMethodId) return
    setCardLoading(true)
    try {
      const res = await fetch('/api/stripe/payment-method', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paymentMethodId: profile.stripePaymentMethodId }),
      })
      if (!res.ok) throw new Error('Failed to remove card')
      await saveGardenerProfile(user.uid, {
        stripePaymentMethodId: null,
        cardLast4: null,
        cardBrand: null,
      })
      await refreshProfile()
      toast.success(lang === 'es' ? 'Tarjeta eliminada' : 'Card removed')
    } catch (err) {
      toast.error(err.message)
    } finally {
      setCardLoading(false)
    }
  }

  async function handlePayQuarter(qFee) {
    if (!profile?.stripeCustomerId || !profile?.stripePaymentMethodId) {
      toast.error(lang === 'es' ? 'Agrega una tarjeta primero' : 'Add a card first')
      return
    }
    setPayingQuarter(qFee.label)
    try {
      const res = await fetch('/api/stripe/charge-fees', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gardenerUid: user.uid,
          quarter: qFee.label,
          year: qFee.year,
          amountCents: qFee.totalFees,
          stripeCustomerId: profile.stripeCustomerId,
          stripePaymentMethodId: profile.stripePaymentMethodId,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)

      // Save fee payment + mark invoices collected (client-side)
      await saveFeePayment({
        gardenerUid: user.uid,
        quarter: qFee.label,
        year: qFee.year,
        amountCents: qFee.totalFees,
        stripePaymentIntentId: data.paymentIntentId,
        status: 'paid',
        chargeMethod: 'manual',
        paidAt: new Date().toISOString(),
      })
      await markQuarterFeesCollected(user.uid, qFee.label, qFee.year, data.paymentIntentId)

      toast.success(lang === 'es'
        ? `Pago de ${formatCents(qFee.totalFees)} procesado para ${qFee.label}`
        : `Payment of ${formatCents(qFee.totalFees)} processed for ${qFee.label}`)
      loadFeeData()
    } catch (err) {
      toast.error(err.message || 'Payment failed')
    } finally {
      setPayingQuarter(null)
    }
  }

  async function handleUpgradeToAnnual() {
    console.log('upgrade step 1 — handler fired', { uid: user?.uid })
    setUpgrading(true)
    try {
      console.log('upgrade step 2 — profile fields', {
        stripeSubscriptionId: profile?.stripeSubscriptionId || 'NULL',
        stripeCustomerId: profile?.stripeCustomerId || 'NULL',
      })

      // If stripeSubscriptionId is missing, retry refreshProfile up to 3 times
      let subId = profile?.stripeSubscriptionId || null
      let custId = profile?.stripeCustomerId || null

      if (!subId || !custId) {
        console.log('upgrade step 2b — fields missing, retrying profile...')
        for (let i = 0; i < 3; i++) {
          console.log(`upgrade retry ${i + 1}/3 — waiting 1s...`)
          await new Promise(r => setTimeout(r, 1000))
          await refreshProfile()
          try {
            const fresh = await getGardenerProfile(user.uid)
            subId  = fresh?.stripeSubscriptionId || null
            custId = fresh?.stripeCustomerId || null
            console.log(`upgrade retry ${i + 1} result:`, { subId: subId || 'NULL', custId: custId || 'NULL' })
            if (subId && custId) break
          } catch (fetchErr) {
            console.error(`upgrade retry ${i + 1} fetch error:`, fetchErr)
          }
        }
      }

      console.log('upgrade step 3 — after retries', { subId: subId || 'NULL', custId: custId || 'NULL' })

      if (!subId || !custId) {
        console.log('upgrade BLOCKED — fields still null after all retries')
        toast.error(lang === 'es'
          ? 'Datos de suscripción no encontrados. Intenta de nuevo en unos segundos.'
          : 'Subscription details not found. Please try again in a few seconds.')
        return
      }

      // Attempt upgrade with auto-retry on 422
      for (let attempt = 0; attempt < 3; attempt++) {
        console.log(`upgrade step 4 — calling API (attempt ${attempt + 1}/3)`)
        const res = await fetch('/api/stripe/upgrade', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ stripeSubscriptionId: subId, gardenerUid: user.uid }),
        })
        const data = await res.json()
        console.log('upgrade step 5 — API response', { status: res.status, data })

        if (res.ok) {
          console.log('upgrade step 6 — SUCCESS, updating Firestore')
          await saveGardenerProfile(user.uid, { subscriptionPlan: 'annual' })
          await refreshProfile()
          toast.success(translate('settings', 'upgrade_success'))
          setShowUpgradeModal(false)
          return
        }

        if (res.status === 422 && data.retry) {
          console.log(`upgrade API returned 422 — retrying in 2s (attempt ${attempt + 1})`)
          await new Promise(r => setTimeout(r, 2000))
          await refreshProfile()
          try {
            const fresh = await getGardenerProfile(user.uid)
            if (fresh?.stripeSubscriptionId) subId = fresh.stripeSubscriptionId
          } catch {}
          continue
        }

        // Non-retryable error
        throw new Error(data.error || 'Upgrade failed')
      }

      throw new Error('Upgrade failed after all retry attempts')
    } catch (err) {
      console.error('upgrade CATCH:', err)
      toast.error(err.message || (lang === 'es' ? 'Error al cambiar de plan' : 'Upgrade failed. Please try again.'))
    } finally {
      console.log('upgrade FINALLY — resetting state')
      setUpgrading(false)
    }
  }

  async function handleDisconnectSquare() {
    setDisconnecting(true)
    try {
      await fetch('/api/square/disconnect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accessToken: profile?.squareAccessToken || '',
          merchantId:  profile?.squareMerchantId || '',
        }),
      })
      await saveGardenerProfile(user.uid, {
        squareAccessToken:  null,
        squareRefreshToken: null,
        squareMerchantId:   null,
        squareMerchantName: null,
        squareLocationId:   null,
        squareLocationName: null,
        squareExpiresAt:    null,
        squareConnected:    false,
      })
      await refreshProfile()
      toast.success(lang === 'es' ? 'Square desconectado' : 'Square disconnected')
      setShowDisconnectConfirm(false)
    } catch {
      toast.error(lang === 'es' ? 'Error al desconectar' : 'Failed to disconnect')
    } finally {
      setDisconnecting(false)
    }
  }

  async function handleCancelSubscription() {
    setCanceling(true)
    try {
      const res = await fetch('/api/stripe/cancel-subscription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stripeSubscriptionId: profile?.stripeSubscriptionId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)

      const cancelDate = new Date((data.cancelAt || data.currentPeriodEnd) * 1000)
      await saveGardenerProfile(user.uid, {
        subscriptionStatus: 'canceling',
        cancelAt: cancelDate.toISOString(),
      })
      await refreshProfile()
      const dateStr = cancelDate.toLocaleDateString(lang === 'es' ? 'es-US' : 'en-US', { month: 'long', day: 'numeric', year: 'numeric' })
      toast.success(lang === 'es'
        ? `Suscripción cancelada. Acceso hasta ${dateStr}.`
        : `Subscription canceled. Access continues until ${dateStr}.`)
      setShowCancelModal(false)
    } catch (err) {
      toast.error(err.message || (lang === 'es' ? 'Error al cancelar' : 'Failed to cancel'))
    } finally {
      setCanceling(false)
    }
  }

  async function handleSave() {
    setSaving(true)
    try {
      await saveGardenerProfile(user.uid, form)
      // Wait for profile refresh to complete before showing toast
      // This ensures LangContext picks up the new language value
      await refreshProfile()
      // Small delay to let React re-render with new profile data
      await new Promise(r => setTimeout(r, 100))
      const toastMsg = form.language === 'es' ? 'Configuración guardada' : 'Settings saved'
      toast.success(toastMsg + ' ✓')
    } catch {
      const errMsg = form.language === 'es' ? 'Algo salió mal' : 'Something went wrong'
      toast.error(errMsg)
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
                <PhoneInput
                  label={translate('settings', 'phone')}
                  value={form.phone}
                  onChange={val => setField('phone', val)}
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
              <p className="text-[11px] text-gray-400 mt-1">
                {lang === 'es'
                  ? 'Guarda la configuración para aplicar el cambio de idioma.'
                  : 'Save settings to apply language change.'}
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
                  {getReminderOptions(translate).map(o => (
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
              <div className="flex items-center justify-between">
                <p className="text-[13px] font-medium text-brand-800">
                  YardSync — {lang === 'es' ? 'Activo' : 'Active'}
                </p>
                <span className="text-[11px] bg-brand-600 text-white px-2 py-0.5 rounded-full font-medium">
                  {profile?.subscriptionPlan === 'annual'
                    ? translate('settings', 'annual_plan')
                    : translate('settings', 'monthly_plan')}
                </span>
              </div>
            </Card>

            {/* Upgrade prompt — only show for monthly subscribers */}
            {profile?.subscriptionStatus === 'active' && profile?.subscriptionPlan !== 'annual' && (
              <Card className="mt-3 border-brand-200 bg-white">
                <div className="flex items-start gap-3">
                  <ArrowUpCircle size={20} className="text-brand-600 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-[13px] font-semibold text-gray-800">
                      {translate('settings', 'upgrade_title')}
                    </p>
                    <p className="text-[12px] text-gray-500 mt-1">
                      {translate('settings', 'upgrade_detail')}
                    </p>
                    <Button
                      fullWidth
                      size="sm"
                      className="mt-3"
                      onClick={() => setShowUpgradeModal(true)}
                    >
                      {translate('settings', 'upgrade_button')}
                    </Button>
                  </div>
                </div>
              </Card>
            )}
          </section>

          {/* Volume Reward Tracker — Stripe users only */}
          {profile?.stripeAccountStatus === 'complete' && (() => {
            const volumeDollars = monthlyVolume / 100
            const tier = volumeDollars >= 3000 ? 3 : volumeDollars >= 1500 ? 2 : 1
            const progressFill = tier === 1
              ? Math.min(volumeDollars / 1500, 1)
              : tier === 2
              ? Math.min((volumeDollars - 1500) / 1500, 1)
              : 1
            const progressLabel = tier === 1
              ? (lang === 'es' ? 'hacia 50% de descuento' : 'toward 50% off')
              : tier === 2
              ? (lang === 'es' ? 'hacia YardSync GRATIS' : 'toward FREE YardSync')
              : (lang === 'es' ? 'Nivel gratis alcanzado — racha en seguimiento' : 'Free tier reached — streak being tracked')
            return (
              <section>
                <div className="flex items-center gap-2 mb-3">
                  <TrendingUp size={14} className="text-brand-600" />
                  <p className="text-[11px] font-medium text-gray-400 uppercase tracking-wide">
                    {lang === 'es' ? 'Recompensas YardSync Pay' : 'YardSync Pay Rewards'}
                  </p>
                </div>
                <Card>
                  <p className="text-[12px] text-gray-500 mb-3">
                    {lang === 'es'
                      ? 'Tu suscripción se reduce a medida que crece tu volumen de facturas. El volumen calificado debe mantenerse por 2 meses consecutivos.'
                      : 'Your subscription reduces as your invoice volume grows. Qualifying volume must be held for 2 consecutive months.'}
                  </p>
                  <p className="text-[12px] text-gray-700 font-medium mb-3">
                    {lang === 'es' ? 'Volumen este mes:' : 'This month\'s volume:'}{' '}
                    <span className="text-brand-700">${volumeDollars.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</span>
                  </p>
                  <div className="space-y-2 mb-4">
                    <div className={`flex items-center justify-between rounded-xl px-3 py-2.5 ${tier === 1 ? 'bg-brand-50 border border-brand-200' : 'bg-gray-50 border border-gray-100'}`}>
                      <div className="flex items-center gap-2">
                        {tier >= 1 ? <CheckCircle2 size={14} className="text-brand-600" /> : <Lock size={14} className="text-gray-300" />}
                        <p className="text-[12px] text-gray-700">{lang === 'es' ? 'Menos de' : 'Under'} $1,500/{lang === 'es' ? 'mes' : 'mo'}</p>
                      </div>
                      <p className="text-[12px] font-semibold text-gray-800">$39/{lang === 'es' ? 'mes' : 'mo'}</p>
                    </div>
                    <div className={`flex items-center justify-between rounded-xl px-3 py-2.5 ${tier === 2 ? 'bg-brand-50 border border-brand-200' : 'bg-gray-50 border border-gray-100'}`}>
                      <div className="flex items-center gap-2">
                        {tier >= 2 ? <CheckCircle2 size={14} className="text-brand-600" /> : <Lock size={14} className="text-gray-300" />}
                        <p className="text-[12px] text-gray-700">$1,500–$2,999/{lang === 'es' ? 'mes' : 'mo'}</p>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full font-medium">50% off</span>
                        <p className="text-[12px] font-semibold text-gray-800">$19/{lang === 'es' ? 'mes' : 'mo'}</p>
                      </div>
                    </div>
                    <div className={`flex items-center justify-between rounded-xl px-3 py-2.5 ${tier === 3 ? 'bg-green-50 border border-green-200' : 'bg-gray-50 border border-gray-100'}`}>
                      <div className="flex items-center gap-2">
                        {tier >= 3 ? <Zap size={14} className="text-green-600" /> : <Lock size={14} className="text-gray-300" />}
                        <p className="text-[12px] text-gray-700">$3,000+/{lang === 'es' ? 'mes' : 'mo'}</p>
                      </div>
                      <p className={`text-[12px] font-bold ${tier >= 3 ? 'text-green-600' : 'text-gray-800'}`}>FREE</p>
                    </div>
                  </div>
                  {/* Progress bar */}
                  <div>
                    <div className="w-full h-2.5 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${tier === 3 ? 'bg-green-500' : 'bg-brand-600'}`}
                        style={{ width: `${Math.round(progressFill * 100)}%` }}
                      />
                    </div>
                    <p className="text-[11px] text-gray-400 mt-1.5">
                      {tier === 3 ? '🎉 ' : ''}{progressLabel}
                    </p>
                  </div>
                </Card>
              </section>
            )
          })()}

          {/* Payment Processing — Stripe users */}
          {(
            <section>
              <div className="flex items-center gap-2 mb-3">
                <CreditCard size={14} className="text-brand-600" />
                <p className="text-[11px] font-medium text-gray-400 uppercase tracking-wide">
                  {lang === 'es' ? 'Procesamiento de Pagos' : 'Payment Processing'}
                </p>
              </div>
              <Card>
                <p className="text-[13px] text-gray-600 mb-3">
                  {lang === 'es'
                    ? 'Tus facturas se procesan automáticamente a través de YardSync Pay. JNew Technologies cobra una tarifa del 5.5% por factura. Sin cobros trimestrales.'
                    : 'Your invoices are processed automatically through YardSync Pay. JNew Technologies collects a 5.5% fee per invoice. No quarterly bills.'}
                </p>
                {profile?.stripeAccountStatus === 'complete' && (
                  <div className="flex items-center gap-2">
                    <CheckCircle2 size={14} className="text-green-600" />
                    <p className="text-[13px] text-green-600 font-medium">
                      {lang === 'es' ? 'Cuenta bancaria conectada' : 'Bank account connected'}
                    </p>
                  </div>
                )}
              </Card>
            </section>
          )}

          {/* Square Integration — only for non-Stripe users */}
          {false && <section>
            <div className="flex items-center gap-2 mb-3">
              <CreditCard size={14} className="text-brand-600" />
              <p className="text-[11px] font-medium text-gray-400 uppercase tracking-wide">
                {lang === 'es' ? 'Integración Square' : 'Square Integration'}
              </p>
            </div>
            {process.env.NEXT_PUBLIC_SQUARE_ENVIRONMENT === 'sandbox' && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 mb-3 flex items-center gap-2">
                <AlertTriangle size={13} className="text-amber-600 flex-shrink-0" />
                <p className="text-[11px] text-amber-700 font-medium">
                  {lang === 'es'
                    ? 'Square está en modo de prueba. Los pagos reales no se procesan.'
                    : 'Square is in test mode. Real payments are not processed.'}
                </p>
              </div>
            )}
            {profile?.squareConnected ? (
              <Card>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-gray-900 flex items-center justify-center flex-shrink-0">
                      <span className="text-white text-[11px] font-bold">SQ</span>
                    </div>
                    <div>
                      <p className="text-[13px] font-medium text-gray-800">
                        {profile.squareMerchantName || 'Square'}
                      </p>
                      <p className="text-[11px] text-green-600 font-medium flex items-center gap-1">
                        <Link2 size={10} /> {lang === 'es' ? 'Conectado' : 'Connected'}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setShowDisconnectConfirm(true)}
                    className="text-[12px] text-red-400 hover:text-red-500 font-medium transition-colors"
                  >
                    {lang === 'es' ? 'Desconectar' : 'Disconnect'}
                  </button>
                </div>
                {profile.squareLocationName && (
                  <p className="text-[12px] text-gray-500 mb-2">
                    {lang === 'es' ? 'Ubicación:' : 'Location:'} {profile.squareLocationName}
                  </p>
                )}
                <p className="text-[12px] text-gray-500">
                  {lang === 'es'
                    ? 'Las facturas se envían a través de tu cuenta de Square. Los pagos van directamente a tu cuenta.'
                    : 'Invoices are sent through your Square account. Payments go directly to you.'}
                </p>
                {showDisconnectConfirm && (
                  <div className="mt-3 bg-red-50 border border-red-100 rounded-xl p-3">
                    <p className="text-[13px] text-red-800 font-medium mb-2">
                      {lang === 'es' ? '¿Desconectar Square?' : 'Disconnect Square?'}
                    </p>
                    <p className="text-[12px] text-red-600 mb-3">
                      {lang === 'es'
                        ? 'No podrás enviar facturas hasta que vuelvas a conectar.'
                        : 'You won\'t be able to send invoices until you reconnect.'}
                    </p>
                    <div className="flex gap-2">
                      <button onClick={() => setShowDisconnectConfirm(false)} className="flex-1 text-[13px] text-gray-600 bg-white border border-gray-200 rounded-xl py-2 font-medium">
                        {translate('common', 'cancel')}
                      </button>
                      <button onClick={handleDisconnectSquare} disabled={disconnecting} className="flex-1 text-[13px] text-white bg-red-600 rounded-xl py-2 font-medium disabled:opacity-50">
                        {disconnecting ? '...' : (lang === 'es' ? 'Sí, desconectar' : 'Yes, disconnect')}
                      </button>
                    </div>
                  </div>
                )}
              </Card>
            ) : (
              <Card className="border-amber-100 bg-amber-50/50">
                <div className="flex items-start gap-3 mb-3">
                  <AlertTriangle size={16} className="text-amber-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-[13px] font-medium text-amber-800">
                      {lang === 'es' ? 'Conecta Square para enviar facturas' : 'Connect Square to send invoices'}
                    </p>
                    <p className="text-[12px] text-amber-700 mt-1">
                      {lang === 'es'
                        ? 'Necesitas conectar tu cuenta de Square para poder enviar facturas a tus clientes. Los pagos van directamente a tu cuenta.'
                        : 'Connect your Square account to send invoices to clients. Payments go directly to your account.'}
                    </p>
                  </div>
                </div>
                <Button
                  fullWidth
                  loading={squareRedirecting}
                  onClick={() => {
                    setSquareRedirecting(true)
                    window.location.href = `/api/square/oauth/connect?uid=${user.uid}`
                  }}
                >
                  {squareRedirecting
                    ? (lang === 'es' ? 'Redirigiendo a Square…' : 'Redirecting to Square…')
                    : <><Link2 size={14} /> {lang === 'es' ? 'Conectar Square' : 'Connect Square'}</>
                  }
                </Button>
              </Card>
            )}
          </section>}

          {/* Card on File — only for non-Stripe users */}
          {false && <section>
            <div className="flex items-center gap-2 mb-3">
              <Wallet size={14} className="text-brand-600" />
              <p className="text-[11px] font-medium text-gray-400 uppercase tracking-wide">
                {lang === 'es' ? 'Método de Pago' : 'Payment Method'}
              </p>
            </div>
            <Card>
              {profile?.cardLast4 ? (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-7 rounded bg-gray-100 flex items-center justify-center text-[11px] font-bold text-gray-500">
                      {profile.cardBrand?.toUpperCase() || 'CARD'}
                    </div>
                    <div>
                      <p className="text-[13px] font-medium text-gray-800">
                        •••• •••• •••• {profile.cardLast4}
                      </p>
                      <p className="text-[11px] text-green-600 font-medium">
                        {lang === 'es' ? 'Tarjeta activa' : 'Card on file'}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={handleRemoveCard}
                    disabled={cardLoading}
                    className="text-[12px] text-red-400 hover:text-red-500 font-medium"
                  >
                    {lang === 'es' ? 'Eliminar' : 'Remove'}
                  </button>
                </div>
              ) : (
                <div>
                  <p className="text-[13px] text-gray-600 mb-3">
                    {lang === 'es'
                      ? 'Agrega una tarjeta para pagar tus tarifas de plataforma automáticamente.'
                      : 'Add a card to pay your platform fees automatically.'}
                  </p>
                  <Button
                    fullWidth
                    variant="secondary"
                    loading={cardLoading}
                    onClick={() => {
                      setShowCardModal(true)
                      setCardError('')
                      // Delay to let modal render, then init Stripe
                      setTimeout(() => handleSetupCard(), 300)
                    }}
                  >
                    <CreditCard size={14} /> {lang === 'es' ? 'Agregar tarjeta' : 'Add Payment Card'}
                  </Button>
                  <p className="text-[10px] text-gray-400 mt-2 text-center">
                    {lang === 'es'
                      ? 'Procesado de forma segura por Stripe. YardSync nunca almacena datos de tarjeta.'
                      : 'Securely processed by Stripe. YardSync never stores card data.'}
                  </p>
                </div>
              )}
            </Card>
          </section>}

          {/* Quarterly Platform Fees — only for non-Stripe users */}
          {false && <section>
            <div className="flex items-center gap-2 mb-3">
              <BarChart2 size={14} className="text-brand-600" />
              <p className="text-[11px] font-medium text-gray-400 uppercase tracking-wide">
                {lang === 'es' ? 'Tarifas Trimestrales' : 'Quarterly Platform Fees'}
              </p>
            </div>
            <Card>
              <p className="text-[12px] text-gray-500 mb-3">
                {lang === 'es'
                  ? 'Estas tarifas se incluyen automáticamente en cada factura. Paga al final de cada trimestre.'
                  : 'These fees are automatically included in each invoice. Pay at the end of each quarter.'}
              </p>
              <div className="space-y-2">
                {quarterFees.map(qf => (
                  <div key={qf.label} className={`rounded-xl p-3 border ${qf.paid ? 'bg-green-50 border-green-100' : qf.totalFees > 0 ? 'bg-amber-50 border-amber-100' : 'bg-gray-50 border-gray-100'}`}>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-[13px] font-semibold text-gray-800">{qf.label} {qf.year}</p>
                        {qf.paid ? (
                          <p className="text-[11px] text-green-600 font-medium flex items-center gap-1">
                            <CheckCircle2 size={10} /> {lang === 'es' ? 'Pagado' : 'Paid'}
                            {qf.paidAt && ` · ${new Date(qf.paidAt).toLocaleDateString()}`}
                          </p>
                        ) : qf.totalFees > 0 ? (
                          <p className="text-[11px] text-amber-700">
                            {formatCents(qf.totalFees)} · {qf.invoiceCount} {lang === 'es' ? 'facturas' : 'invoices'}
                          </p>
                        ) : (
                          <p className="text-[11px] text-gray-400">{lang === 'es' ? 'Sin tarifas' : 'No fees'}</p>
                        )}
                      </div>
                      {!qf.paid && qf.totalFees > 0 && (
                        <Button
                          size="sm"
                          loading={payingQuarter === qf.label}
                          onClick={() => handlePayQuarter(qf)}
                          disabled={!profile?.stripePaymentMethodId}
                        >
                          {profile?.stripePaymentMethodId
                            ? (lang === 'es' ? 'Pagar' : 'Pay Now')
                            : (lang === 'es' ? 'Agrega tarjeta' : 'Add Card')}
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-[11px] text-gray-400 mt-3">
                {lang === 'es'
                  ? '📲 Recibirás un recordatorio por SMS 30 días antes del cierre de cada trimestre.'
                  : '📲 You\'ll receive an SMS reminder 30 days before each quarter ends.'}
              </p>
            </Card>
          </section>}

          <Button fullWidth size="lg" loading={saving} onClick={handleSave}>
            {translate('settings', 'save')}
          </Button>

          {/* Cancel subscription */}
          {profile?.subscriptionStatus === 'active' && profile?.stripeSubscriptionId && (
            <div className="pt-4 border-t border-gray-100 mt-4">
              <p className="text-[11px] text-gray-400 text-center mb-1">
                {lang === 'es' ? '¿Necesitas irte?' : 'Need to leave?'}
              </p>
              <button
                onClick={() => setShowCancelModal(true)}
                className="w-full text-center text-red-400 text-[12px] hover:text-red-500 transition-colors py-1"
              >
                {lang === 'es' ? 'Cancelar suscripción' : 'Cancel subscription'}
              </button>
            </div>
          )}

          <p className="text-center text-[11px] text-gray-300 pb-4">
            {translate('settings', 'footer')}
          </p>

        </div>
      </div>

      {/* Card Setup Modal */}
      {showCardModal && (
        <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl">
            <p className="text-[16px] font-semibold text-gray-900 mb-1">
              {lang === 'es' ? 'Agregar tarjeta de pago' : 'Add Payment Card'}
            </p>
            <p className="text-[12px] text-gray-500 mb-4">
              {lang === 'es'
                ? 'Tu tarjeta se almacena de forma segura con Stripe.'
                : 'Your card is securely stored with Stripe.'}
            </p>
            <div
              id="stripe-card-element"
              className="border border-gray-200 rounded-xl px-4 py-3.5 mb-3 min-h-[44px] bg-gray-50"
            />
            {cardError && (
              <p className="text-[12px] text-red-600 mb-3">{cardError}</p>
            )}
            <p className="text-[10px] text-gray-400 mb-4">
              {lang === 'es'
                ? 'YardSync nunca almacena los datos completos de tu tarjeta.'
                : 'YardSync never stores your full card details.'}
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => { setShowCardModal(false); setCardError('') }}
                className="flex-1 text-[14px] text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl py-3 font-medium transition-colors"
              >
                {translate('common', 'cancel')}
              </button>
              <button
                onClick={handleConfirmCard}
                disabled={cardLoading}
                className="flex-1 text-[14px] text-white bg-brand-600 hover:bg-brand-700 rounded-xl py-3 font-medium transition-colors disabled:opacity-50"
              >
                {cardLoading ? '...' : (lang === 'es' ? 'Guardar tarjeta' : 'Save Card')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Upgrade to Annual Modal */}
      {showUpgradeModal && (
        <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6">
            <div className="flex items-center gap-3 mb-4">
              <ArrowUpCircle size={24} className="text-brand-600" />
              <p className="text-[16px] font-semibold text-gray-800">
                {translate('settings', 'upgrade_button')}
              </p>
            </div>
            <p className="text-[13px] text-gray-600 mb-2">
              {translate('settings', 'upgrade_modal_body')}
            </p>
            <div className="bg-brand-50 border border-brand-100 rounded-xl p-3 mt-3 mb-4">
              <div className="flex items-center justify-between">
                <span className="text-[13px] text-brand-800 font-medium">
                  {translate('settings', 'annual_plan')}
                </span>
                <span className="text-[15px] text-brand-800 font-bold">$390{translate('settings', 'per_year')}</span>
              </div>
              <p className="text-[11px] text-brand-600 mt-1">
                {translate('settings', 'upgrade_saving')}
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowUpgradeModal(false)}
                className="flex-1 text-[14px] text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl py-3 font-medium transition-colors"
              >
                {translate('common', 'cancel')}
              </button>
              <button
                onClick={handleUpgradeToAnnual}
                disabled={upgrading}
                className="flex-1 text-[14px] text-white bg-brand-600 hover:bg-brand-700 rounded-xl py-3 font-medium transition-colors disabled:opacity-50"
              >
                {upgrading ? '...' : translate('settings', 'upgrade_confirm')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cancel Subscription Modal */}
      {showCancelModal && (
        <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6">
            <p className="text-[16px] font-semibold text-gray-900 mb-2">
              {lang === 'es' ? '¿Cancelar tu suscripción?' : 'Cancel your subscription?'}
            </p>
            <p className="text-[13px] text-gray-600 mb-1">
              {lang === 'es'
                ? 'Mantendrás acceso completo hasta el final de tu período actual. Después tu cuenta será de solo lectura — tus clientes, facturas e historial están guardados y esperando si regresas.'
                : 'You\'ll keep full access until the end of your current billing period. After that your account will be read-only — your clients, invoices and history are saved and waiting if you come back.'}
            </p>
            <div className="flex gap-3 mt-4">
              <button
                onClick={() => setShowCancelModal(false)}
                className="flex-1 text-[14px] text-white bg-brand-600 hover:bg-brand-700 rounded-xl py-3 font-medium transition-colors"
              >
                {lang === 'es' ? 'Mantener mi suscripción' : 'Keep my subscription'}
              </button>
              <button
                onClick={handleCancelSubscription}
                disabled={canceling}
                className="flex-1 text-[14px] text-red-600 bg-white border-2 border-red-200 hover:border-red-300 rounded-xl py-3 font-medium transition-colors disabled:opacity-50"
              >
                {canceling ? '...' : (lang === 'es' ? 'Sí, cancelar' : 'Yes, cancel')}
              </button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  )
}