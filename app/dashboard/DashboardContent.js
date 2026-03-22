'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect } from 'react'
import { useAuth } from '@/context/AuthContext'
import { useLang } from '@/context/LangContext'
import AppShell from '@/components/layout/AppShell'
import { StatCard, Card, Badge, Button, Skeleton } from '@/components/ui'
import { getClients, getTodaySchedules, getInvoices, getServices, getSchedules, updateSchedule, saveGardenerProfile } from '@/lib/db'
import { formatCents } from '@/lib/fee'
import { Users, CalendarCheck, DollarSign, MessageSquare, CheckCircle2, Clock, Leaf, LogOut, Settings, CreditCard, Link2, Package, UserPlus, CalendarPlus, X } from 'lucide-react'
import toast from 'react-hot-toast'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'

import { fmt as format } from '@/lib/date'
import { formatDateLocalized } from '@/lib/i18n'

export default function DashboardPage() {
  const { user, profile, signOut, refreshProfile } = useAuth()
  const { translate, lang } = useLang()
  const router       = useRouter()
  const searchParams = useSearchParams()

  const [clients,       setClients]       = useState([])
  const [todayJobs,     setTodayJobs]     = useState([])
  const [invoices,      setInvoices]      = useState([])
  const [services,      setServices]      = useState([])
  const [allSchedules,  setAllSchedules]  = useState([])
  const [loading,       setLoading]       = useState(true)
  const [completing,    setCompleting]    = useState(null)

  const todayStr    = format(new Date(), 'yyyy-MM-dd')
  const displayDate = formatDateLocalized(new Date(), 'EEEE, MMMM d', lang)
  const hour        = new Date().getHours()
  const greeting    = hour < 12
    ? translate('dashboard', 'greeting_morning')
    : hour < 17
    ? translate('dashboard', 'greeting_afternoon')
    : translate('dashboard', 'greeting_evening')

  const firstName = profile?.name
    ? profile.name.split(' ').find(w => w.length > 1) || profile.name.split(' ')[0]
    : 'there'

  // Handle Stripe redirect back after successful payment
  useEffect(() => {
    if (!user) return
    if (searchParams.get('subscribed') === 'true') {
      ;(async () => {
        try {
          await saveGardenerProfile(user.uid, {
            subscriptionStatus: 'active',
            subscriptionPlan:   searchParams.get('plan') || 'monthly',
          })
          await refreshProfile()
          const welcomeMsg = profile?.language === 'es'
            ? 'Suscripción activada. ¡Bienvenido a YardSync!'
            : 'Subscription activated! Welcome to YardSync 🌿'
          toast.success(welcomeMsg)
          router.replace('/dashboard')
        } catch (err) {
          console.error('Failed to activate subscription:', err)
        }
      })()
    }
  }, [user, searchParams])

  useEffect(() => {
    if (!user) return
    refreshProfile()
    loadData()
  }, [user])

  async function loadData() {
    setLoading(true)
    try {
      const monthStart = format(new Date(new Date().getFullYear(), new Date().getMonth(), 1), 'yyyy-MM-dd')
      const monthEnd   = format(new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0), 'yyyy-MM-dd')
      const [c, j, inv, svc, sched] = await Promise.all([
        getClients(user.uid),
        getTodaySchedules(user.uid, todayStr),
        getInvoices(user.uid),
        getServices(user.uid),
        getSchedules(user.uid, monthStart, monthEnd),
      ])
      setClients(c)
      setTodayJobs(j)
      setInvoices(inv)
      setServices(svc)
      setAllSchedules(sched)
    } catch {
      toast.error(translate('common', 'error'))
    } finally {
      setLoading(false)
    }
  }

  async function markComplete(schedule) {
    setCompleting(schedule.id)
    try {
      await updateSchedule(schedule.id, {
        status: 'completed',
        completedAt: new Date().toISOString()
      })
      setTodayJobs(prev =>
        prev.map(j => j.id === schedule.id ? { ...j, status: 'completed' } : j)
      )
      toast.success(translate('dashboard', 'completed'))
    } catch {
      toast.error(translate('common', 'error'))
    } finally {
      setCompleting(null)
    }
  }

  const activeClients    = clients.filter(c => c.status === 'active' && c.gardenerUid === user?.uid).length
  const completedToday   = todayJobs.filter(j => j.status === 'completed').length
  const thisMonthRevenue = invoices
    .filter(inv => {
      if (inv.status !== 'paid') return false
      const d = inv.createdAt?.toDate?.() || new Date(inv.createdAt)
      return d.getMonth() === new Date().getMonth()
    })
    .reduce((sum, inv) => sum + (inv.totalCents || 0), 0)
  const smsSentTotal = todayJobs.filter(j => j.smsSent).length
  const clientMap    = Object.fromEntries(clients.map(c => [c.id, c]))
  const unpaidCount  = invoices.filter(i => i.status === 'unpaid').length

  return (
    <AppShell>
      <div className="page-content">

        {/* Header */}
        <div className="bg-brand-700 px-4 pt-5 pb-6">
          <div className="flex items-start justify-between max-w-lg mx-auto">
            <div>
              <div className="flex items-center gap-2 mb-0.5">
                <Leaf size={16} className="text-brand-200" />
                <span className="text-brand-200 text-[12px] font-medium tracking-wide uppercase">
                  YardSync
                </span>
              </div>
              <h1 className="text-[22px] font-display text-white leading-tight">
                {greeting}, {firstName}
              </h1>
              <p className="text-brand-200 text-[13px] mt-0.5">
                {displayDate} · {todayJobs.length} {todayJobs.length !== 1
                  ? translate('dashboard', 'jobs_today')
                  : translate('dashboard', 'job_today')}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => router.push('/settings')}
                className="w-8 h-8 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition-colors"
              >
                <Settings size={15} className="text-white" />
              </button>
              <button
                onClick={signOut}
                className="w-8 h-8 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition-colors"
              >
                <LogOut size={15} className="text-white" />
              </button>
            </div>
          </div>
        </div>

        <div className="px-4 py-4 max-w-lg mx-auto space-y-5">

          {/* Onboarding Checklist */}
          {!loading && !profile?.onboardingComplete && (() => {
            const steps = [
              { key: 'step_card',     done: !!profile?.cardLast4,        href: '/settings', icon: CreditCard,   optional: false },
              { key: 'step_square',   done: !!profile?.squareConnected,  href: '/settings', icon: Link2,        optional: true },
              { key: 'step_service',  done: services.length > 0,         href: '/services', icon: Package,      optional: false },
              { key: 'step_client',   done: clients.length > 0,          href: '/clients',  icon: UserPlus,     optional: false },
              { key: 'step_schedule', done: allSchedules.length > 0,     href: '/calendar', icon: CalendarPlus, optional: false },
            ]
            const completed     = steps.filter(s => s.done).length
            const requiredSteps = steps.filter(s => !s.optional)
            const requiredDone  = requiredSteps.every(s => s.done)
            const allDone       = requiredDone
            return (
              <Card className="border-brand-100 bg-brand-50/50 animate-fade-up">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="text-[14px] font-semibold text-brand-900">
                      {translate('onboarding', 'title')}
                    </p>
                    <p className="text-[12px] text-brand-600 mt-0.5">
                      {translate('onboarding', 'subtitle')}
                    </p>
                  </div>
                  {allDone && (
                    <button
                      onClick={async () => {
                        await saveGardenerProfile(user.uid, { onboardingComplete: true })
                        refreshProfile()
                      }}
                      className="text-gray-400 hover:text-gray-600 transition-colors p-1"
                      aria-label="Dismiss checklist"
                    >
                      <X size={16} />
                    </button>
                  )}
                </div>
                {/* Progress bar */}
                <div className="mb-3">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-[11px] font-medium text-brand-700">
                      {requiredSteps.filter(s => s.done).length}/{requiredSteps.length} {translate('onboarding', 'progress')}
                    </p>
                    <p className="text-[11px] font-medium text-brand-700">
                      {Math.round((requiredSteps.filter(s => s.done).length / requiredSteps.length) * 100)}%
                    </p>
                  </div>
                  <div className="w-full h-2 bg-brand-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-brand-600 rounded-full transition-all duration-500"
                      style={{ width: `${(requiredSteps.filter(s => s.done).length / requiredSteps.length) * 100}%` }}
                    />
                  </div>
                </div>
                {/* Steps */}
                <div className="space-y-1.5">
                  {steps.map(step => (
                    <Link
                      key={step.key}
                      href={step.done ? '#' : step.href}
                      onClick={e => step.done && e.preventDefault()}
                      className={`flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors ${
                        step.done
                          ? 'bg-white/60'
                          : 'bg-white hover:bg-brand-100 cursor-pointer'
                      }`}
                    >
                      {step.done ? (
                        <CheckCircle2 size={18} className="text-brand-600 flex-shrink-0" />
                      ) : (
                        <step.icon size={18} className="text-brand-400 flex-shrink-0" />
                      )}
                      <p className={`text-[13px] font-medium flex-1 ${
                        step.done ? 'text-brand-400 line-through decoration-brand-300' : 'text-brand-900'
                      }`}>
                        {translate('onboarding', step.key)}
                        {step.optional && <span className="text-brand-400 text-[11px] ml-1">{translate('common', 'optional')}</span>}
                      </p>
                      {!step.done && (
                        <span className="text-[11px] text-brand-500 font-medium">→</span>
                      )}
                    </Link>
                  ))}
                </div>
                {/* Dismiss button when all done */}
                {allDone && (
                  <button
                    onClick={async () => {
                      await saveGardenerProfile(user.uid, { onboardingComplete: true })
                      refreshProfile()
                      toast.success('🌿')
                    }}
                    className="w-full mt-3 text-[13px] text-brand-700 bg-brand-100 hover:bg-brand-200 font-medium rounded-xl py-2.5 transition-colors"
                  >
                    {translate('onboarding', 'dismiss')}
                  </button>
                )}
              </Card>
            )
          })()}

          {/* Stats */}
          {loading ? (
            <div className="grid grid-cols-2 gap-3">
              {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-20" />)}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 animate-fade-up">
              <StatCard label={translate('dashboard', 'active_clients')}  value={activeClients}                            icon={Users}         />
              <StatCard label={translate('dashboard', 'this_month')}      value={formatCents(thisMonthRevenue)}             icon={DollarSign} accent />
              <StatCard label={translate('dashboard', 'jobs_today_stat')} value={`${completedToday}/${todayJobs.length}`}  icon={CalendarCheck} />
              <StatCard label={translate('dashboard', 'sms_sent')}        value={smsSentTotal}                              icon={MessageSquare} />
            </div>
          )}

          {/* Today's Jobs */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-[14px] font-semibold text-gray-800">
                {translate('dashboard', 'todays_schedule')}
              </h2>
              <Link href="/calendar" className="text-[12px] text-brand-600 font-medium">
                {translate('dashboard', 'view_calendar')}
              </Link>
            </div>

            {loading ? (
              <div className="space-y-2">
                {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-16" />)}
              </div>
            ) : todayJobs.length === 0 ? (
              <Card className="text-center py-8">
                <CalendarCheck size={28} className="text-gray-300 mx-auto mb-2" />
                <p className="text-[14px] text-gray-400">
                  {translate('dashboard', 'no_jobs')}
                </p>
                <Link href="/calendar">
                  <Button variant="brand" size="sm" className="mt-3">
                    {translate('dashboard', 'add_to_calendar')}
                  </Button>
                </Link>
              </Card>
            ) : (
              <div className="space-y-2">
                {todayJobs.map((job, i) => {
                  const client = clientMap[job.clientId]
                  const done   = job.status === 'completed'
                  return (
                    <Card
                      key={job.id}
                      padding={false}
                      className={`animate-fade-up stagger-${Math.min(i+1,4)} ${done ? 'opacity-70' : ''}`}
                    >
                      <div className="p-4 flex items-center gap-3 w-full">
                        <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 transition-colors ${
                          done ? 'bg-brand-500' : 'bg-amber-400'
                        }`} />
                        <div className="flex-1 min-w-0">
                          <p className={`text-[14px] font-medium transition-all ${
                            done ? 'text-gray-400 line-through decoration-gray-300' : 'text-gray-900'
                          }`}>
                            {client?.name || 'Unknown client'}
                          </p>
                          <p className="text-[12px] text-gray-400 truncate">
                            {client?.address || ''} · {job.time || '—'}
                          </p>
                          <div className="flex items-center gap-2 mt-1 flex-wrap">
                            <Badge
                              label={client?.packageType || 'monthly'}
                              variant={client?.packageType || 'monthly'}
                            />
                            {job.smsSent && (
                              <span className="text-[11px] text-brand-600 font-medium">SMS ✓</span>
                            )}
                            {done && (
                              <span className="text-[11px] text-brand-600 font-medium">
                                {translate('dashboard', 'completed')}
                              </span>
                            )}
                          </div>
                        </div>
                        {!done ? (
                          <Button
                            variant="brand"
                            size="sm"
                            loading={completing === job.id}
                            onClick={() => markComplete(job)}
                            icon={CheckCircle2}
                          >
                            {translate('dashboard', 'done')}
                          </Button>
                        ) : (
                          <CheckCircle2 size={20} className="text-brand-500 flex-shrink-0" />
                        )}
                      </div>
                    </Card>
                  )
                })}
              </div>
            )}
          </section>

          {/* Unpaid invoice alert */}
          {!loading && unpaidCount > 0 && (
            <Card className="border-amber-200 bg-amber-50 flex items-center gap-3">
              <Clock size={18} className="text-amber-600 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-[13px] font-medium text-amber-800">
                  {unpaidCount} {unpaidCount > 1
                    ? translate('dashboard', 'unpaid_invoices_pl')
                    : translate('dashboard', 'unpaid_invoices')}
                </p>
                <p className="text-[12px] text-amber-600">
                  {translate('dashboard', 'tap_to_review')}
                </p>
              </div>
            </Card>
          )}

        </div>
      </div>
    </AppShell>
  )
}