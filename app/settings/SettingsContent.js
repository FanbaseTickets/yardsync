'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect, useRef } from 'react'
import { useAuth } from '@/context/AuthContext'
import { useLang } from '@/context/LangContext'
import AppShell from '@/components/layout/AppShell'
import PageHeader from '@/components/layout/PageHeader'
import { Card, Button, Input, Select } from '@/components/ui'
import PhoneInput from '@/components/ui/PhoneInput'
import LogoUpload from '@/components/ui/LogoUpload'
import CardPreview from './CardPreview'
import { saveGardenerProfile, getGardenerProfile, getInvoices } from '@/lib/db'
import { formatCents } from '@/lib/fee'
import { Bell, Globe, User, Clock, CreditCard, Link2, CheckCircle2, ArrowUpCircle, TrendingUp, Lock, Zap, LogOut, AlertTriangle } from 'lucide-react'
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
  const { user, profile, refreshProfile, signOut } = useAuth()
  const { translate, lang } = useLang()
  const [showUpgradeModal, setShowUpgradeModal] = useState(false)
  const [upgrading,        setUpgrading]        = useState(false)
  const [monthlyVolume,    setMonthlyVolume]    = useState(0)
  const [showCancelModal,  setShowCancelModal]  = useState(false)
  const [canceling,        setCanceling]        = useState(false)
  const [reactivating,     setReactivating]     = useState(false)
  const [stripeRemediating, setStripeRemediating] = useState(false)
  const [activeTab, setActiveTab] = useState('profile')

  // Tab from ?tab= (read via window.location to avoid a Suspense boundary —
  // constraint #3). Switching tabs updates the URL so refreshes + deep links
  // (e.g. /settings?tab=billing) land on the right tab.
  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get('tab')
    if (['profile', 'card', 'sms', 'billing'].includes(t)) setActiveTab(t)
  }, [])

  function selectTab(t) {
    setActiveTab(t)
    const url = new URL(window.location.href)
    url.searchParams.set('tab', t)
    window.history.replaceState({}, '', url)
  }

  const SETTINGS_TABS = [
    { key: 'profile', en: 'Profile', es: 'Perfil' },
    { key: 'card',    en: 'Card',    es: 'Tarjeta' },
    { key: 'sms',     en: 'SMS',     es: 'SMS' },
    { key: 'billing', en: 'Billing', es: 'Pagos' },
  ]

  const [form,    setForm]    = useState({
    name:           '',
    businessName:   '',
    phone:          '',
    email:          '',
    reminderTiming: '48',
    language:       'en',
    smsTemplate:    '',
    smsTemplateEs:  '',
    logoUrl:        '',
    headshotUrl:    '',          // contractor headshot — preferred over logo on the card
    // Smart Business Card fields (see docs/SMART_BUSINESS_CARD_SPEC.md §1.1):
    bio:                  '',          // free-text description shown on /join/[slug]
    tagline:              '',          // one-line selling line for the card
    accentColor:          '',          // hex color for card branding ('' = use YardSync default)
    serviceArea:          '',          // free-text "San Antonio & NE suburbs"
    showContactPhone:     true,        // show phone + Call/Text on card (default ON)
    showContactEmail:     false,       // show email on card (default OFF — opt-in)
    cardStatusBadge:      'booking',   // 'booking' | 'none' — Now booking pill
    offersFreeEstimate:   false,       // show a "Free estimate" badge on the card
    upfrontDeadlineHours: 24,          // global default for upfront billing (1-168, default 24)
  })
  const [saving, setSaving] = useState(false)
  const [settingsEditing, setSettingsEditing] = useState(false)  // Profile tab edit/lock

  // Slug state lives outside `form` because slug changes need their own
  // generate/check/save lifecycle (debounced availability check, reserved
  // word validation, collision suffix) separate from the rest of the form.
  const [slugGenerating, setSlugGenerating] = useState(false)
  const [slugEditing,    setSlugEditing]    = useState(false)
  const [slugDraft,      setSlugDraft]      = useState('')
  const [slugCheckState, setSlugCheckState] = useState('idle') // 'idle' | 'checking' | 'available' | 'taken' | 'invalid'
  const [slugCheckError, setSlugCheckError] = useState(null)   // error code from validateSlug or 'taken'
  const [slugSaving,     setSlugSaving]     = useState(false)

  // Origin used for the displayed card URL + Copy button. On Production this
  // resolves to yardsyncapp.com (the canonical share URL). On Preview it
  // resolves to the Vercel preview host so the displayed link actually works
  // when clicked. Falls back to yardsyncapp.com during SSR.
  const [currentOrigin, setCurrentOrigin] = useState('https://yardsyncapp.com')
  useEffect(() => {
    if (typeof window !== 'undefined' && window.location?.origin) {
      setCurrentOrigin(window.location.origin)
    }
  }, [])
  const displayHost = currentOrigin.replace(/^https?:\/\//, '')

  // One-shot form initialization from profile.
  //
  // Earlier this useEffect re-fired whenever `profile` got a new object
  // reference from AuthContext (which can happen for many reasons:
  // navigation, focus events, background token refresh, sibling reads
  // triggering provider re-renders). Every re-fire overwrote in-progress
  // user edits — most visibly, unchecking a card-visibility toggle and
  // having it silently snap back ~1 render later, leaving the DOM
  // checkbox momentarily unchecked but the React state (and CardPreview
  // prop) re-set to the persisted profile value.
  //
  // The ref guard initializes the form once on first profile load. After
  // a successful save we re-sync explicitly in handleSave (the saved
  // values are what the user just typed, so the form is already in
  // sync — no auto-reset needed).
  const formInitialized = useRef(false)
  useEffect(() => {
    if (profile && !formInitialized.current) {
      setForm({
        name:           profile.name           || '',
        businessName:   profile.businessName   || '',
        phone:          profile.phone          || '',
        email:          profile.email          || '',
        reminderTiming: profile.reminderTiming || '48',
        language:       profile.language       || 'en',
        smsTemplate:    profile.smsTemplate    || 'Hi {name}! Your yard service is scheduled for {date} at {time}. See you then! Reply STOP to opt out. – {business}',
        smsTemplateEs:  profile.smsTemplateEs  || 'Hola {name}! Su servicio de jardín está programado para {date} a las {time}. ¡Hasta pronto! Responda STOP para cancelar. – {business}',
        logoUrl:        profile.logoUrl        || '',
        headshotUrl:    profile.headshotUrl    || '',
        bio:                  profile.bio                  || '',
        tagline:              profile.tagline              || '',
        accentColor:          profile.accentColor          || '',
        serviceArea:          profile.serviceArea          || '',
        showContactPhone:     profile.showContactPhone !== false,        // default ON
        showContactEmail:     profile.showContactEmail === true,         // default OFF
        cardStatusBadge:      profile.cardStatusBadge      || 'booking', // 'booking' | 'none'
        offersFreeEstimate:   profile.offersFreeEstimate === true,
        upfrontDeadlineHours: profile.upfrontDeadlineHours || 24,
      })
      setSlugDraft(profile.publicSlug || '')
      formInitialized.current = true
    }
  }, [profile])

  function setField(key, val) {
    setForm(prev => ({ ...prev, [key]: val }))
  }

  useEffect(() => {
    if (user) {
      loadMonthlyVolume()
    }
  }, [user])

  async function loadMonthlyVolume() {
    try {
      const allInvoices = await getInvoices(user.uid)
      const now = new Date()
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
      const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59)
      let total = 0
      allInvoices.forEach(inv => {
        if (inv.status !== 'paid') return
        if (inv.paymentPath !== 'stripe') return
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
      // Optimistic local write so the UI flips to the "pending cancellation"
      // state immediately. The Stripe customer.subscription.updated webhook
      // will then write the same fields server-side (canonical source).
      await saveGardenerProfile(user.uid, {
        subscriptionCancelAtPeriodEnd: true,
        subscriptionCancelAt:          cancelDate.toISOString(),
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

  async function handleCompleteOnStripe() {
    if (!user) return
    setStripeRemediating(true)
    try {
      const idToken = await user.getIdToken()
      const res = await fetch('/api/stripe/connect/remediation-link', {
        method:  'POST',
        headers: {
          'Content-Type':  'application/json',
          'Authorization': `Bearer ${idToken}`,
        },
        body: JSON.stringify({ contractorUid: user.uid }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Could not generate link')
      // Stripe AccountLink is single-use and expires in ~5 min — redirect now.
      window.location.href = data.url
    } catch (err) {
      toast.error(err.message || (lang === 'es' ? 'No se pudo abrir Stripe' : 'Could not open Stripe'))
      setStripeRemediating(false)
    }
  }

  async function handleReactivateSubscription() {
    setReactivating(true)
    try {
      const res = await fetch('/api/stripe/reactivate-subscription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stripeSubscriptionId: profile?.stripeSubscriptionId,
          stripeCustomerId:     profile?.stripeCustomerId,
          plan:                 profile?.subscriptionPlan || 'monthly',
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)

      // Optimistic local clear — webhook will confirm via subscription.updated
      await saveGardenerProfile(user.uid, {
        subscriptionCancelAtPeriodEnd: false,
        subscriptionCancelAt:          null,
      })
      await refreshProfile()
      toast.success(lang === 'es'
        ? 'Suscripción reactivada'
        : 'Subscription reactivated')
    } catch (err) {
      toast.error(err.message || (lang === 'es' ? 'Error al reactivar' : 'Failed to reactivate'))
    } finally {
      setReactivating(false)
    }
  }

  // ── Slug lifecycle (Smart Business Card) ───────────────────────────────
  // The slug owns the /join/[slug] public-intake URL. It lives in its own
  // resolver collection (slugs/{slug}) so we get O(1) lookups + uniqueness
  // enforcement. Lifecycle: generate-from-business-name on first run, then
  // editable with debounced availability check. See docs/SMART_BUSINESS_CARD_SPEC.md §1.4.

  async function handleGenerateSlug() {
    if (!user || slugGenerating) return
    setSlugGenerating(true)
    try {
      const idToken = await user.getIdToken()
      const res = await fetch('/api/slug/generate', {
        method:  'POST',
        headers: {
          'Content-Type':  'application/json',
          'Authorization': `Bearer ${idToken}`,
        },
        body: JSON.stringify({ uid: user.uid }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Could not generate slug')
      await refreshProfile()
      setSlugDraft(data.slug)
      toast.success(lang === 'es' ? 'Tarjeta YardSync creada' : 'YardSync card created')
    } catch (err) {
      toast.error(err.message || (lang === 'es' ? 'No se pudo generar' : 'Could not generate'))
    } finally {
      setSlugGenerating(false)
    }
  }

  // Debounced availability + format check while the contractor types in
  // the slug editor. Sets slugCheckState so the UI can show a spinner,
  // green check, or error inline.
  useEffect(() => {
    if (!slugEditing) return
    const trimmed = (slugDraft || '').trim()
    if (!trimmed || trimmed === profile?.publicSlug) {
      setSlugCheckState('idle')
      setSlugCheckError(null)
      return
    }
    setSlugCheckState('checking')
    const handle = setTimeout(async () => {
      try {
        const res = await fetch(`/api/slug/check?slug=${encodeURIComponent(trimmed)}`)
        const data = await res.json()
        if (data.valid && data.available) {
          setSlugCheckState('available')
          setSlugCheckError(null)
        } else {
          setSlugCheckState(data.valid ? 'taken' : 'invalid')
          setSlugCheckError(data.error || (data.valid ? 'taken' : 'invalid'))
        }
      } catch {
        setSlugCheckState('invalid')
        setSlugCheckError('check_failed')
      }
    }, 400)
    return () => clearTimeout(handle)
  }, [slugDraft, slugEditing, profile?.publicSlug])

  async function handleSaveSlug() {
    if (!user || slugSaving) return
    const trimmed = (slugDraft || '').trim()
    if (!trimmed || trimmed === profile?.publicSlug) {
      setSlugEditing(false)
      return
    }
    if (slugCheckState !== 'available') {
      toast.error(lang === 'es' ? 'Verifique el slug antes de guardar' : 'Check the slug before saving')
      return
    }
    setSlugSaving(true)
    try {
      const idToken = await user.getIdToken()
      const res = await fetch('/api/slug/generate', {
        method:  'POST',
        headers: {
          'Content-Type':  'application/json',
          'Authorization': `Bearer ${idToken}`,
        },
        body: JSON.stringify({ uid: user.uid, slug: trimmed }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Could not save slug')
      await refreshProfile()
      setSlugDraft(data.slug)
      setSlugEditing(false)
      setSlugCheckState('idle')
      toast.success(lang === 'es' ? 'URL actualizada' : 'URL updated')
    } catch (err) {
      toast.error(err.message || (lang === 'es' ? 'No se pudo guardar' : 'Could not save'))
    } finally {
      setSlugSaving(false)
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

          {/* Stripe requirements banner — shown when Stripe has flagged
              outstanding KYC requirements (SSN, DOB, bank account, etc.).
              currently_due + past_due block payouts; eventually_due is
              non-urgent and doesn't trigger this banner. Tapping the
              button generates a Stripe-hosted AccountLink and redirects
              the contractor to fill in the missing info. */}
          {profile?.stripeAccountId
            && ((profile?.stripeRequirementsCurrentlyDue?.length || 0) > 0
                || (profile?.stripeRequirementsPastDue?.length || 0) > 0) && (
            <Card className="border-amber-200 bg-amber-50">
              <div className="flex items-start gap-3">
                <AlertTriangle size={18} className="text-amber-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-[13px] font-semibold text-amber-900">
                    {lang === 'es' ? 'Stripe necesita más información' : 'Stripe needs more info'}
                  </p>
                  <p className="text-[12px] text-amber-800 mt-1">
                    {lang === 'es'
                      ? 'Completa los siguientes datos para mantener tus pagos activos:'
                      : 'Complete the following to keep your payouts flowing:'}
                  </p>
                  {(() => {
                    const paths = [
                      ...(profile.stripeRequirementsCurrentlyDue || []),
                      ...(profile.stripeRequirementsPastDue || []),
                    ]
                    const labels = []
                    const seen = new Set()
                    for (const p of paths) {
                      // Inline minimal label-grouping so the banner shows
                      // "Date of birth" once instead of dob.day + dob.month + dob.year.
                      const groupKey =
                        p.startsWith('individual.dob.')      ? 'dob' :
                        p.startsWith('individual.address.')  ? 'address' :
                        p === 'individual.first_name' || p === 'individual.last_name' ? 'name' :
                        p === 'tos_acceptance.date' || p === 'tos_acceptance.ip' ? 'tos' :
                        p
                      if (seen.has(groupKey)) continue
                      seen.add(groupKey)
                      const labelMap = {
                        'individual.ssn_last_4': lang === 'es' ? 'Últimos 4 del SSN' : 'Last 4 of SSN',
                        'individual.id_number':  lang === 'es' ? 'SSN completo o ID fiscal' : 'Full SSN or Tax ID',
                        'individual.phone':      lang === 'es' ? 'Número de teléfono' : 'Phone number',
                        'individual.email':      lang === 'es' ? 'Correo electrónico' : 'Email',
                        'external_account':      lang === 'es' ? 'Cuenta bancaria para pagos' : 'Bank account for payouts',
                        dob:      lang === 'es' ? 'Fecha de nacimiento' : 'Date of birth',
                        address:  lang === 'es' ? 'Dirección de residencia' : 'Home address',
                        name:     lang === 'es' ? 'Nombre legal' : 'Legal name',
                        tos:      lang === 'es' ? 'Aceptación de Términos' : 'Terms of Service',
                      }
                      labels.push(labelMap[groupKey] || labelMap[p] || p)
                    }
                    return (
                      <ul className="mt-2 text-[12px] text-amber-800 list-disc list-inside space-y-0.5">
                        {labels.map((l, i) => <li key={i}>{l}</li>)}
                      </ul>
                    )
                  })()}
                  <Button
                    fullWidth
                    className="mt-3"
                    loading={stripeRemediating}
                    onClick={handleCompleteOnStripe}
                  >
                    {lang === 'es' ? 'Completar en Stripe' : 'Complete on Stripe'}
                  </Button>
                </div>
              </div>
            </Card>
          )}

          {/* Tab bar — Profile · Card · SMS · Billing (?tab= deep-linkable) */}
          <div className="flex items-center gap-1 bg-gray-100 rounded-xl p-1 sticky top-0 z-10">
            {SETTINGS_TABS.map(t => (
              <button
                key={t.key}
                type="button"
                onClick={() => selectTab(t.key)}
                className={`flex-1 text-[13px] font-medium py-2 rounded-lg transition-colors ${
                  activeTab === t.key ? 'bg-white text-brand-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {lang === 'es' ? t.es : t.en}
              </button>
            ))}
          </div>

          {/* Global edit/lock — every tab's fields stay read-only (greyed) until
              "Edit" is tapped; "Save changes" persists the whole form + re-locks. */}
          <div className="flex items-center justify-between">
            <p className="text-[11px] text-gray-400">
              {settingsEditing
                ? (lang === 'es' ? 'Editando — guarde cuando termine' : 'Editing — save when done')
                : (lang === 'es' ? 'Toque Editar para cambiar' : 'Tap Edit to make changes')}
            </p>
            {!settingsEditing ? (
              <button
                type="button"
                onClick={() => setSettingsEditing(true)}
                className="text-[13px] text-brand-600 font-medium hover:text-brand-700 px-3 py-1.5"
              >
                {lang === 'es' ? 'Editar' : 'Edit'}
              </button>
            ) : (
              <Button
                size="sm"
                loading={saving}
                onClick={async () => { await handleSave(); setSettingsEditing(false) }}
              >
                {lang === 'es' ? 'Guardar cambios' : 'Save changes'}
              </Button>
            )}
          </div>

          {/* ── Profile tab ── */}
          {activeTab === 'profile' && (<>
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
                {/* Images first — headshot (preferred on the card) + logo */}
                <div className="flex flex-wrap gap-6">
                  <LogoUpload
                    label={lang === 'es' ? 'Tu foto' : 'Your headshot'}
                    storageName="headshot"
                    noun="headshot"
                    rounded="rounded-full"
                    disabled={!settingsEditing}
                    value={form.headshotUrl}
                    onChange={url => setField('headshotUrl', url)}
                    hint={lang === 'es' ? 'Se muestra en tu tarjeta.' : 'Shown on your card.'}
                  />
                  <LogoUpload
                    label={lang === 'es' ? 'Logo del negocio' : 'Business logo'}
                    disabled={!settingsEditing}
                    value={form.logoUrl}
                    onChange={url => setField('logoUrl', url)}
                    hint={lang === 'es'
                      ? 'PNG, JPG o WebP. Máx 2MB.'
                      : 'PNG, JPG, or WebP. Max 2MB.'}
                  />
                </div>

                <Input
                  label={translate('settings', 'your_name')}
                  value={form.name}
                  onChange={e => setField('name', e.target.value)}
                  placeholder="Marco Rodriguez"
                  disabled={!settingsEditing}
                />
                <Input
                  label={translate('settings', 'business_name')}
                  value={form.businessName}
                  onChange={e => setField('businessName', e.target.value)}
                  placeholder="Rodriguez Lawn Care"
                  disabled={!settingsEditing}
                />
                <PhoneInput
                  label={translate('settings', 'phone')}
                  value={form.phone}
                  onChange={val => setField('phone', val)}
                  disabled={!settingsEditing}
                />
                <p className="text-[11px] text-brand-600 -mt-2">
                  {lang === 'es'
                    ? '📲 Agrega tu número para recibir un resumen de tus trabajos cada mañana por SMS'
                    : '📲 Add your number to receive a daily morning SMS summary of your jobs'}
                </p>
                <Input
                  label={lang === 'es' ? 'Correo electrónico (opcional)' : 'Email (optional)'}
                  type="email"
                  value={form.email}
                  onChange={e => setField('email', e.target.value)}
                  placeholder={lang === 'es' ? 'usted@ejemplo.com' : 'you@example.com'}
                  autoComplete="email"
                  disabled={!settingsEditing}
                />
                <p className="text-[11px] text-gray-400 -mt-2">
                  {lang === 'es'
                    ? 'Solo se muestra en su tarjeta si activa "Mostrar correo en la tarjeta" abajo.'
                    : 'Only shown on your card if you turn on "Show email on card" below.'}
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
                disabled={!settingsEditing}
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

          </>)}

          {/* ── Card tab ── */}
          {activeTab === 'card' && (<>
          {/* YardSync Card — public business card + intake URL */}
          <section>
            <div className="flex items-center gap-2 mb-3">
              <Link2 size={14} className="text-brand-600" />
              <p className="text-[11px] font-medium text-gray-400 uppercase tracking-wide">
                {lang === 'es' ? 'Tarjeta YardSync' : 'YardSync Card'}
              </p>
            </div>
            <Card>
              {!profile?.publicSlug ? (
                /* First-run: no slug yet — show the Generate CTA */
                <div className="text-center py-2">
                  <p className="text-[13px] text-gray-700 mb-3 leading-relaxed">
                    {lang === 'es'
                      ? 'Cree su tarjeta digital — los clientes potenciales pueden escanear su código QR o tocar su enlace para solicitar servicio. Se agregan automáticamente como prospectos.'
                      : 'Create your shareable digital card — prospects can scan your QR code or tap your link to request service. They get added to your leads automatically.'}
                  </p>
                  <Button onClick={handleGenerateSlug} loading={slugGenerating} fullWidth>
                    {lang === 'es' ? 'Generar tarjeta YardSync' : 'Generate YardSync card'}
                  </Button>
                  <p className="text-[11px] text-gray-400 mt-2">
                    {lang === 'es'
                      ? 'Se generará automáticamente desde el nombre de su negocio.'
                      : 'Auto-generated from your business name.'}
                  </p>
                </div>
              ) : (
                /* Slug exists — show URL + editor + public-profile fields */
                <div className="space-y-4">
                  {/* What this is / why it matters */}
                  <div className="bg-brand-50 border border-brand-100 rounded-lg p-3">
                    <p className="text-[12px] text-brand-800 leading-relaxed">
                      {lang === 'es'
                        ? 'Esta es su tarjeta de presentación digital. Compártala o muestre su código QR — los clientes potenciales tocan o escanean para solicitar servicio y se agregan automáticamente como prospectos en Clientes. Es la forma más rápida de conseguir nuevos trabajos.'
                        : "This is your digital business card. Share it or show its QR code — prospects tap or scan to request service and are added automatically as leads in Clients. It's the fastest way to win new jobs."}
                    </p>
                  </div>
                  {/* URL display + copy + edit */}
                  {!slugEditing ? (
                    <div>
                      <p className="text-[11px] text-gray-500 mb-1">
                        {lang === 'es' ? 'URL de su tarjeta' : 'Your card URL'}
                      </p>
                      <div className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2 mb-2">
                        <a
                          href={`/join/${profile.publicSlug}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[12px] text-gray-700 flex-1 truncate hover:text-brand-600 transition-colors"
                        >
                          {displayHost}/join/{profile.publicSlug}
                        </a>
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(`${currentOrigin}/join/${profile.publicSlug}`)
                            toast.success(lang === 'es' ? 'Copiado' : 'Copied')
                          }}
                          className="text-[12px] text-brand-600 font-medium hover:text-brand-700"
                        >
                          {lang === 'es' ? 'Copiar' : 'Copy'}
                        </button>
                        <button
                          onClick={async () => {
                            const url = `${currentOrigin}/join/${profile.publicSlug}`
                            const shareData = {
                              title: profile.businessName || 'YardSync',
                              text: lang === 'es' ? 'Solicita servicio aquí:' : 'Request service here:',
                              url,
                            }
                            try {
                              if (navigator.share) await navigator.share(shareData)
                              else { navigator.clipboard.writeText(url); toast.success(lang === 'es' ? 'Copiado' : 'Copied') }
                            } catch { /* user cancelled the share sheet */ }
                          }}
                          className="text-[12px] text-brand-600 font-medium hover:text-brand-700"
                        >
                          {lang === 'es' ? 'Compartir' : 'Share'}
                        </button>
                      </div>
                      <button
                        onClick={() => { setSlugEditing(true); setSlugDraft(profile.publicSlug) }}
                        className="text-[12px] text-brand-600 font-medium hover:text-brand-700"
                      >
                        {lang === 'es' ? 'Editar URL' : 'Edit URL'}
                      </button>

                      {/* Direct intake link — for warm leads who don't need the
                          card pitch. Skips straight to the form. */}
                      <div className="mt-4 pt-3 border-t border-dashed border-gray-200">
                        <p className="text-[11px] text-gray-500 mb-1">
                          {lang === 'es' ? 'Enlace directo al formulario' : 'Direct intake link'}
                        </p>
                        <div className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2 mb-1">
                          <a
                            href={`/join/${profile.publicSlug}/request`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[12px] text-gray-700 flex-1 truncate hover:text-brand-600 transition-colors"
                          >
                            {displayHost}/join/{profile.publicSlug}/request
                          </a>
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(`${currentOrigin}/join/${profile.publicSlug}/request`)
                              toast.success(lang === 'es' ? 'Copiado' : 'Copied')
                            }}
                            className="text-[12px] text-brand-600 font-medium hover:text-brand-700"
                          >
                            {lang === 'es' ? 'Copiar' : 'Copy'}
                          </button>
                        </div>
                        <p className="text-[10px] text-gray-400">
                          {lang === 'es'
                            ? 'Envíe este enlace a clientes que ya conocen su negocio — los lleva directo al formulario.'
                            : 'Send this to clients who already know your business — it skips the card and goes straight to the form.'}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <p className="text-[11px] text-gray-500">
                        {lang === 'es' ? 'Editar URL' : 'Edit URL'}
                      </p>
                      <div className="flex items-center gap-1 bg-gray-50 rounded-lg pl-3 pr-1 py-1">
                        <span className="text-[12px] text-gray-500 flex-shrink-0">{displayHost}/join/</span>
                        <input
                          type="text"
                          value={slugDraft}
                          onChange={e => setSlugDraft(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                          className="flex-1 bg-white border border-gray-200 rounded-md px-2 py-1.5 text-[13px] focus:outline-none focus:ring-2 focus:ring-brand-500"
                          maxLength={50}
                          autoFocus
                        />
                      </div>
                      {/* Availability state */}
                      <div className="text-[11px] min-h-[16px]">
                        {slugCheckState === 'checking' && (
                          <span className="text-gray-500">{lang === 'es' ? 'Verificando…' : 'Checking…'}</span>
                        )}
                        {slugCheckState === 'available' && (
                          <span className="text-green-600">✓ {lang === 'es' ? 'Disponible' : 'Available'}</span>
                        )}
                        {slugCheckState === 'taken' && (
                          <span className="text-red-600">{lang === 'es' ? 'Ya está en uso' : 'Already taken'}</span>
                        )}
                        {slugCheckState === 'invalid' && (
                          <span className="text-red-600">
                            {slugCheckError === 'tooShort' && (lang === 'es' ? 'Muy corto (mín. 3 caracteres)' : 'Too short (min 3 chars)')}
                            {slugCheckError === 'tooLong'  && (lang === 'es' ? 'Muy largo (máx. 50 caracteres)' : 'Too long (max 50 chars)')}
                            {slugCheckError === 'badChars' && (lang === 'es' ? 'Solo letras minúsculas, números y guiones' : 'Only lowercase letters, numbers, and hyphens')}
                            {slugCheckError === 'reserved' && (lang === 'es' ? 'Esta URL está reservada' : 'That URL is reserved')}
                            {slugCheckError === 'empty'    && (lang === 'es' ? 'URL requerida' : 'URL required')}
                            {slugCheckError === 'check_failed' && (lang === 'es' ? 'No se pudo verificar' : 'Could not verify')}
                          </span>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="secondary"
                          fullWidth
                          onClick={() => { setSlugEditing(false); setSlugDraft(profile.publicSlug); setSlugCheckState('idle') }}
                        >
                          {translate('common', 'cancel')}
                        </Button>
                        <Button
                          fullWidth
                          loading={slugSaving}
                          disabled={slugCheckState !== 'available'}
                          onClick={handleSaveSlug}
                        >
                          {lang === 'es' ? 'Guardar URL' : 'Save URL'}
                        </Button>
                      </div>
                      <p className="text-[10px] text-gray-400">
                        {lang === 'es'
                          ? 'La URL anterior redirigirá a la nueva durante 30 días para que las tarjetas impresas sigan funcionando.'
                          : 'The old URL will redirect to the new one for 30 days so printed cards keep working.'}
                      </p>
                    </div>
                  )}

                  {/* Live card preview — mirrors /join/[slug] from local form state */}
                  <div className="pt-3 border-t border-gray-100">
                    <CardPreview
                      businessName={form.businessName}
                      tagline={form.tagline}
                      bio={form.bio}
                      serviceArea={form.serviceArea}
                      logoUrl={form.logoUrl}
                      headshotUrl={form.headshotUrl}
                      accentColor={form.accentColor}
                      phone={form.phone}
                      email={form.email}
                      showContactPhone={form.showContactPhone}
                      showContactEmail={form.showContactEmail}
                      cardStatusBadge={form.cardStatusBadge}
                      offersFreeEstimate={form.offersFreeEstimate}
                      publicSlug={profile.publicSlug}
                      lang={lang}
                    />
                  </div>

                  {/* Public-profile fields used by /join page + the card */}
                  <div className="space-y-3 pt-3 border-t border-gray-100">
                    <Input
                      label={lang === 'es' ? 'Eslogan' : 'Tagline'}
                      value={form.tagline}
                      onChange={e => setField('tagline', e.target.value)}
                      placeholder={lang === 'es' ? 'Servicios confiables y a tiempo' : 'Reliable, on-time service'}
                      maxLength={100}
                      disabled={!settingsEditing}
                    />
                    <div>
                      <label className="text-[12px] font-medium text-gray-700 block mb-1">
                        {lang === 'es' ? 'Biografía / descripción' : 'Bio / description'}
                      </label>
                      <textarea
                        value={form.bio}
                        onChange={e => setField('bio', e.target.value)}
                        disabled={!settingsEditing}
                        placeholder={lang === 'es'
                          ? '3 líneas sobre su negocio que los clientes verán en su tarjeta.'
                          : 'A few lines about your business that clients will see on your card.'}
                        rows={3}
                        maxLength={300}
                        className="w-full rounded-xl border border-gray-200 bg-white text-[13px] px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none disabled:bg-gray-50 disabled:text-gray-400 disabled:cursor-not-allowed"
                      />
                      <p className="text-[10px] text-gray-400 mt-1">
                        {(form.bio?.length || 0)}/300 · {lang === 'es' ? 'Escriba en su idioma.' : 'Write in your own language.'}
                      </p>
                    </div>
                    <Input
                      label={lang === 'es' ? 'Área de servicio' : 'Service area'}
                      value={form.serviceArea}
                      onChange={e => setField('serviceArea', e.target.value)}
                      placeholder={lang === 'es' ? 'San Antonio y suburbios del NE' : 'San Antonio & NE suburbs'}
                      maxLength={100}
                      disabled={!settingsEditing}
                    />
                    <div>
                      <label className="text-[12px] font-medium text-gray-700 block mb-1">
                        {lang === 'es' ? 'Color de marca' : 'Brand accent color'}
                      </label>
                      <div className="flex items-center gap-3">
                        <input
                          type="color"
                          value={form.accentColor || '#0F6E56'}
                          onChange={e => setField('accentColor', e.target.value)}
                          disabled={!settingsEditing}
                          className="w-12 h-10 rounded-lg border border-gray-200 cursor-pointer bg-white disabled:opacity-50 disabled:cursor-not-allowed"
                        />
                        <code className="text-[12px] text-gray-600 flex-1">
                          {form.accentColor || '#0F6E56'} {!form.accentColor && (lang === 'es' ? '(predeterminado)' : '(default)')}
                        </code>
                        {settingsEditing && form.accentColor && (
                          <button
                            onClick={() => setField('accentColor', '')}
                            className="text-[11px] text-gray-500 hover:text-gray-700"
                          >
                            {lang === 'es' ? 'Restablecer' : 'Reset'}
                          </button>
                        )}
                      </div>
                      <p className="text-[10px] text-gray-400 mt-1">
                        {lang === 'es' ? 'Aparece en su tarjeta y publicaciones sociales.' : 'Shows on your card and social posts.'}
                      </p>
                    </div>

                    {/* Contact visibility on the public card */}
                    <div className="pt-2 border-t border-gray-100 space-y-3">
                      <p className="text-[11px] font-medium text-gray-500 uppercase tracking-wide">
                        {lang === 'es' ? 'Visibilidad de contacto' : 'Contact visibility'}
                      </p>
                      <label className="flex items-start gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={!!form.showContactPhone}
                          onChange={e => setField('showContactPhone', e.target.checked)}
                          disabled={!settingsEditing}
                          className="mt-0.5 w-4 h-4 accent-brand-600 disabled:opacity-50 disabled:cursor-not-allowed"
                        />
                        <span className="text-[13px] text-gray-700 flex-1">
                          {lang === 'es' ? 'Mostrar teléfono en la tarjeta' : 'Show phone on card'}
                          <span className="block text-[11px] text-gray-400 mt-0.5">
                            {lang === 'es'
                              ? 'Incluye los botones Llamar y Mensaje.'
                              : 'Includes the Call and Text buttons.'}
                          </span>
                        </span>
                      </label>
                      <label className="flex items-start gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={!!form.showContactEmail}
                          onChange={e => setField('showContactEmail', e.target.checked)}
                          disabled={!settingsEditing}
                          className="mt-0.5 w-4 h-4 accent-brand-600 disabled:opacity-50 disabled:cursor-not-allowed"
                        />
                        <span className="text-[13px] text-gray-700 flex-1">
                          {lang === 'es' ? 'Mostrar correo en la tarjeta' : 'Show email on card'}
                          <span className="block text-[11px] text-gray-400 mt-0.5">
                            {lang === 'es'
                              ? 'Opcional. Aparece junto a la acción Guardar contacto.'
                              : 'Optional. Appears alongside the Save-contact action.'}
                          </span>
                        </span>
                      </label>
                      <label className="flex items-start gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={form.cardStatusBadge !== 'none'}
                          onChange={e => setField('cardStatusBadge', e.target.checked ? 'booking' : 'none')}
                          disabled={!settingsEditing}
                          className="mt-0.5 w-4 h-4 accent-brand-600 disabled:opacity-50 disabled:cursor-not-allowed"
                        />
                        <span className="text-[13px] text-gray-700 flex-1">
                          {lang === 'es' ? 'Mostrar pastilla "Reservando ahora"' : 'Show "Now booking" badge'}
                          <span className="block text-[11px] text-gray-400 mt-0.5">
                            {lang === 'es'
                              ? 'Apague cuando esté lleno o de vacaciones.'
                              : 'Turn off when you\'re full or on vacation.'}
                          </span>
                        </span>
                      </label>
                      <label className="flex items-start gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={!!form.offersFreeEstimate}
                          onChange={e => setField('offersFreeEstimate', e.target.checked)}
                          disabled={!settingsEditing}
                          className="mt-0.5 w-4 h-4 accent-brand-600 disabled:opacity-50 disabled:cursor-not-allowed"
                        />
                        <span className="text-[13px] text-gray-700 flex-1">
                          {lang === 'es' ? 'Mostrar pastilla "Estimado gratis"' : 'Show "Free estimate" badge'}
                          <span className="block text-[11px] text-gray-400 mt-0.5">
                            {lang === 'es'
                              ? 'Atrae prospectos ofreciendo una cotización sin costo.'
                              : 'Draws prospects in by offering a no-cost quote.'}
                          </span>
                        </span>
                      </label>
                    </div>
                  </div>
                </div>
              )}
            </Card>
          </section>

          </>)}

          {/* ── SMS tab ── */}
          {activeTab === 'sms' && (<>
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
                <div className="bg-brand-50 border border-brand-100 rounded-lg p-3">
                  <p className="text-[12px] text-brand-800 leading-relaxed">
                    {lang === 'es'
                      ? 'Estos mensajes recuerdan automáticamente a sus clientes sus próximas visitas por SMS. Elija cuándo se envían y edite el texto en inglés y español. Cada mensaje termina con "Responda STOP para cancelar" para cumplir con las reglas de mensajería.'
                      : 'These automatically remind your clients of upcoming visits by text. Choose when they send and edit the English + Spanish wording. Every message ends with "Reply STOP to opt out" to stay compliant.'}
                  </p>
                </div>
                <Select
                  label={translate('settings', 'send_reminders')}
                  value={form.reminderTiming}
                  onChange={e => setField('reminderTiming', e.target.value)}
                  disabled={!settingsEditing}
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
                    disabled={!settingsEditing}
                    rows={3}
                    className="w-full rounded-xl border border-gray-200 bg-white text-[13px] px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none disabled:bg-gray-50 disabled:text-gray-400 disabled:cursor-not-allowed"
                  />
                </div>

                <div>
                  <p className="text-[13px] font-medium text-gray-700 mb-1">
                    {translate('settings', 'spanish_template')}
                  </p>
                  <textarea
                    value={form.smsTemplateEs}
                    onChange={e => setField('smsTemplateEs', e.target.value)}
                    disabled={!settingsEditing}
                    rows={3}
                    className="w-full rounded-xl border border-gray-200 bg-white text-[13px] px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none disabled:bg-gray-50 disabled:text-gray-400 disabled:cursor-not-allowed"
                  />
                </div>

                <div className="bg-amber-50 border border-amber-100 rounded-lg p-3 space-y-2.5">
                  <p className="text-[11px] text-amber-800 leading-relaxed">
                    {lang === 'es'
                      ? '⚠️ Las variables {name} {date} {time} {business} se reemplazan automáticamente con los datos reales. Puede cambiar el texto, pero no escriba mal una variable o el mensaje saldrá incorrecto.'
                      : "⚠️ The variables {name} {date} {time} {business} are filled in automatically with real data. You can reword the text, but don't mistype a variable or the message will come out wrong."}
                  </p>
                  <div>
                    <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wide mb-1">
                      {lang === 'es' ? 'Ejemplo (inglés)' : 'Sample (English)'}
                    </p>
                    <p className="text-[12px] text-gray-700 bg-white rounded-md px-2.5 py-2 border border-gray-200">
                      {(form.smsTemplate || '')
                        .replace(/\{name\}/g, 'Maria')
                        .replace(/\{date\}/g, 'Mon, Jun 24')
                        .replace(/\{time\}/g, '9:00 AM')
                        .replace(/\{business\}/g, form.businessName || 'YardSync')}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wide mb-1">
                      {lang === 'es' ? 'Ejemplo (español)' : 'Sample (Spanish)'}
                    </p>
                    <p className="text-[12px] text-gray-700 bg-white rounded-md px-2.5 py-2 border border-gray-200">
                      {(form.smsTemplateEs || '')
                        .replace(/\{name\}/g, 'María')
                        .replace(/\{date\}/g, 'lun, 24 jun')
                        .replace(/\{time\}/g, '9:00 AM')
                        .replace(/\{business\}/g, form.businessName || 'YardSync')}
                    </p>
                  </div>
                </div>
              </div>
            </Card>
          </section>

          </>)}

          {/* ── Billing tab ── (Subscription · Payment Reminders · Volume Rewards · Stripe Connect) */}
          {activeTab === 'billing' && (<>
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
              {profile?.lastPaymentAt && (
                <p className="text-[12px] text-brand-700 mt-2">
                  {lang === 'es' ? 'Último cobro' : 'Last charged'}:{' '}
                  <span className="font-semibold">
                    {new Date(profile.lastPaymentAt).toLocaleDateString(lang === 'es' ? 'es-US' : 'en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                  </span>
                </p>
              )}
              {profile?.currentPeriodEnd && (
                <p className="text-[12px] text-brand-700 mt-1">
                  {lang === 'es' ? 'Próxima facturación' : 'Next billing date'}:{' '}
                  <span className="font-semibold">
                    {new Date(profile.currentPeriodEnd).toLocaleDateString(lang === 'es' ? 'es-US' : 'en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                  </span>
                </p>
              )}
              {(() => {
                const tier = profile?.rewardTier
                const streak = profile?.rewardStreak || 0
                if (!tier || tier === 'base') return null
                if (streak >= 2 && tier === 'free') {
                  return (
                    <div className="mt-2 inline-flex items-center gap-1.5 text-[11px] bg-green-100 text-green-800 px-2 py-1 rounded-full font-semibold">
                      🏆 {lang === 'es' ? 'Nivel gratis activo' : 'Free tier active'}
                    </div>
                  )
                }
                if (streak >= 2 && tier === 'half') {
                  return (
                    <div className="mt-2 inline-flex items-center gap-1.5 text-[11px] bg-brand-100 text-brand-800 px-2 py-1 rounded-full font-semibold">
                      ⭐ {lang === 'es' ? 'Descuento 50% activo' : '50% reward active'}
                    </div>
                  )
                }
                if (streak === 1) {
                  return (
                    <p className="text-[11px] text-amber-700 mt-2">
                      {lang === 'es'
                        ? `1 de 2 meses calificados completados (${tier === 'free' ? 'nivel gratis' : 'descuento 50%'})`
                        : `1 of 2 qualifying months completed (${tier === 'free' ? 'free tier' : '50% off'})`}
                    </p>
                  )
                }
                return null
              })()}
            </Card>

            {/* Upgrade prompt — only show for monthly subscribers WITHOUT an active
                reward. The annual math ("Save \$78/year") assumes full \$39/mo pricing,
                which is wrong for anyone on 50% off, and completely nonsensical at
                free tier where the sub is already \$0. */}
            {profile?.subscriptionStatus === 'active'
              && profile?.subscriptionPlan !== 'annual'
              && !(profile?.rewardStreak >= 2 && profile?.rewardTier && profile?.rewardTier !== 'base') && (
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

          {/* Payment Reminders — global upfront-billing deadline default */}
          <section>
            <div className="flex items-center gap-2 mb-3">
              <Clock size={14} className="text-brand-600" />
              <p className="text-[11px] font-medium text-gray-400 uppercase tracking-wide">
                {lang === 'es' ? 'Plazo de pago del cliente' : 'Client payment deadline'}
              </p>
            </div>
            <Card>
              <div className="bg-brand-50 border border-brand-100 rounded-lg p-3 mb-3">
                <p className="text-[12px] text-brand-800 leading-relaxed">
                  {lang === 'es'
                    ? 'Para clientes nuevos que pagan por adelantado, esto es cuánto tiempo tiene EL CLIENTE para pagar antes de que usted realice el servicio. No es un recordatorio para usted.'
                    : "For first-time clients on upfront billing, this is how long THE CLIENT has to pay before you service them. It's not a reminder for you."}
                </p>
              </div>
              <label className="text-[12px] font-medium text-gray-700 block mb-1">
                {lang === 'es'
                  ? 'Plazo predeterminado de pago anticipado'
                  : 'Default upfront payment deadline'}
              </label>
              <div className="flex items-center gap-2">
                <p className="text-[13px] text-gray-600">
                  {lang === 'es' ? 'Pago debido' : 'Payment due'}
                </p>
                <input
                  type="number"
                  min={1}
                  max={168}
                  value={form.upfrontDeadlineHours}
                  disabled={!settingsEditing}
                  onChange={e => {
                    const v = parseInt(e.target.value, 10)
                    if (Number.isFinite(v)) setField('upfrontDeadlineHours', Math.max(1, Math.min(168, v)))
                  }}
                  className="w-20 rounded-lg border border-gray-200 bg-white text-[13px] px-3 py-2 text-center focus:outline-none focus:ring-2 focus:ring-brand-500 disabled:bg-gray-50 disabled:text-gray-400 disabled:cursor-not-allowed"
                />
                <p className="text-[13px] text-gray-600">
                  {lang === 'es' ? 'horas antes del servicio' : 'hours before service'}
                </p>
              </div>
              <p className="text-[11px] text-gray-400 mt-2 leading-relaxed">
                {lang === 'es'
                  ? 'Aplica a clientes nuevos en modo de facturación anticipada. Puede anular por cliente. Predeterminado: 24 horas. Máximo: 168 horas (7 días).'
                  : 'Applies to new clients with upfront billing. You can override per-client. Default: 24 hours. Max: 168 hours (7 days).'}
              </p>
            </Card>
          </section>

          {/* Volume Reward Tracker — Stripe users only */}
          {!!profile?.stripeAccountId && (() => {
            // Authoritative reward state from reward-check cron (written to user doc)
            const rewardTier   = profile?.rewardTier   || 'base'
            const rewardStreak = profile?.rewardStreak || 0
            // Previous month's qualifying volume (what the cron last saw)
            const lastVolume   = profile?.lastVolumeAmount ?? 0
            // Current month-to-date volume (from Firestore invoices — informational)
            const volumeDollars = monthlyVolume / 100

            const tier = rewardTier === 'free' ? 3 : rewardTier === 'half' ? 2 : 1
            const isActive = rewardStreak >= 2 && rewardTier !== 'base'

            // Progress bar reflects streak progress (1 of 2 → 2 of 2) when at a qualifying tier
            const progressFill = rewardTier === 'base'
              ? Math.min(volumeDollars / 1500, 1)   // base: show month-to-date progress toward $1,500
              : rewardStreak >= 2
              ? 1
              : 0.5

            let progressLabel
            if (isActive && rewardTier === 'free') {
              progressLabel = lang === 'es' ? '🎉 Nivel gratis activo — tu suscripción es $0/mes' : '🎉 Free tier active — your subscription is $0/mo'
            } else if (isActive && rewardTier === 'half') {
              progressLabel = lang === 'es' ? '⭐ Descuento 50% activo — $19.50/mes' : '⭐ 50% reward active — $19.50/mo'
            } else if (rewardStreak === 1 && rewardTier === 'free') {
              progressLabel = lang === 'es' ? '1 de 2 meses al nivel gratis (próximo mes desbloquea $0/mes)' : '1 of 2 qualifying months at free tier (next month unlocks $0/mo)'
            } else if (rewardStreak === 1 && rewardTier === 'half') {
              progressLabel = lang === 'es' ? '1 de 2 meses al nivel 50% (próximo mes desbloquea $19.50/mes)' : '1 of 2 qualifying months at 50% tier (next month unlocks $19.50/mo)'
            } else {
              progressLabel = lang === 'es' ? 'hacia 50% de descuento' : 'toward 50% off'
            }
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
                  {lastVolume > 0 && (
                    <p className="text-[12px] text-gray-700 font-medium mb-1">
                      {lang === 'es' ? 'Volumen calificado último mes:' : 'Last month qualifying volume:'}{' '}
                      <span className="text-brand-700">${Number(lastVolume).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</span>
                    </p>
                  )}
                  <p className="text-[12px] text-gray-500 mb-3">
                    {lang === 'es' ? 'Este mes hasta ahora:' : 'This month so far:'}{' '}
                    <span className="text-gray-700">${volumeDollars.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</span>
                  </p>
                  <div className="flex items-center justify-between mb-1.5 px-3">
                    <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wider">
                      {lang === 'es' ? 'Volumen' : 'Volume'}
                    </p>
                    <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wider">
                      {lang === 'es' ? 'Tú pagas' : 'You pay'}
                    </p>
                  </div>
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
                      <p className={`text-[12px] font-bold ${tier >= 3 ? 'text-green-600' : 'text-gray-800'}`}>$0/mo</p>
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
                {!!profile?.stripeAccountId && (
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

          {/* Pending-cancellation banner — shows when subscription will end
              at period end but hasn't been finalized yet. Replaces the
              "Cancel subscription" link with a date + Reactivate CTA. */}
          {profile?.subscriptionCancelAtPeriodEnd && profile?.subscriptionCancelAt && (
            <div className="pt-4 border-t border-gray-100 mt-4">
              <Card className="border-amber-200 bg-amber-50">
                <div className="flex items-start gap-3">
                  <AlertTriangle size={16} className="text-amber-600 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-[13px] font-medium text-amber-800">
                      {lang === 'es' ? 'Cancelación pendiente' : 'Cancellation pending'}
                    </p>
                    <p className="text-[12px] text-amber-700 mt-1">
                      {(() => {
                        const d = new Date(profile.subscriptionCancelAt)
                        const dateStr = d.toLocaleDateString(lang === 'es' ? 'es-US' : 'en-US', { month: 'long', day: 'numeric', year: 'numeric' })
                        return lang === 'es'
                          ? `Tu acceso continúa hasta el ${dateStr}. Después de esa fecha, tu cuenta será de solo lectura.`
                          : `Your access continues until ${dateStr}. After that date, your account will be read-only.`
                      })()}
                    </p>
                    <Button
                      fullWidth
                      className="mt-3"
                      loading={reactivating}
                      onClick={handleReactivateSubscription}
                    >
                      {lang === 'es' ? 'Reactivar suscripción' : 'Reactivate subscription'}
                    </Button>
                  </div>
                </div>
              </Card>
            </div>
          )}

          {/* Cancel subscription link — hidden when cancellation already pending */}
          {profile?.subscriptionStatus === 'active'
            && profile?.stripeSubscriptionId
            && !profile?.subscriptionCancelAtPeriodEnd && (
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
          </>)}

          <div className="mt-8 pt-6 border-t border-gray-200">
            <button
              onClick={signOut}
              className="w-full flex items-center justify-center gap-2 px-4 h-12 rounded-xl border border-red-200 bg-white text-red-600 font-medium hover:bg-red-50 transition-colors"
            >
              <LogOut size={18} />
              <span>{translate('common', 'sign_out')}</span>
            </button>
          </div>

          <p className="text-center text-[11px] text-gray-300 pb-4 mt-4">
            {translate('settings', 'footer')}
          </p>

        </div>
      </div>


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