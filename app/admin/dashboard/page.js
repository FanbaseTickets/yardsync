'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import { formatCents } from '@/lib/fee'
import { collection, getDocs, doc, updateDoc, addDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import {
  Shield, LogOut, Users, DollarSign,
  TrendingUp, AlertCircle, RefreshCw,
  ChevronDown, ChevronUp, CheckCircle, Plus, Calendar, Download, Clock,
  CreditCard, AlertOctagon, History, Zap, Mail, FileSpreadsheet
} from 'lucide-react'
import toast from 'react-hot-toast'
import { fmt as format } from '@/lib/date'

function splitInvoice(inv) {
  const feeLines  = inv.lineItems?.filter(l => l.category === 'fee')  || []
  const baseLines = inv.lineItems?.filter(l => l.category !== 'fee') || []
  const fees      = feeLines.reduce((s, l)  => s + (l.amountCents || 0), 0)
  const gardener  = baseLines.reduce((s, l) => s + (l.amountCents || 0), 0)
  return { fees, gardener }
}

function getAgeDays(inv) {
  const created = inv.createdAt?.toDate?.() || new Date(inv.createdAt)
  return Math.floor((Date.now() - created.getTime()) / (1000 * 60 * 60 * 24))
}

function AgeBadge({ days }) {
  if (days < 30) return <span className="text-[10px] bg-green-900/50 text-green-400 px-1.5 py-0.5 rounded-full font-medium">{days}d</span>
  if (days < 60) return <span className="text-[10px] bg-yellow-900/50 text-yellow-400 px-1.5 py-0.5 rounded-full font-medium">{days}d</span>
  return <span className="text-[10px] bg-red-900/50 text-red-400 px-1.5 py-0.5 rounded-full font-medium">{days}d overdue</span>
}

export default function AdminDashboard() {
  const { user, loading, signOut } = useAuth()
  const router = useRouter()

  const [gardeners,       setGardeners]       = useState([])
  const [gardenerFilter,  setGardenerFilter]  = useState('all')
  const [allInvoicesRaw,  setAllInvoicesRaw]  = useState([])
  const [allFeePayments,  setAllFeePayments]  = useState([])
  const [dataLoading, setDataLoading] = useState(true)
  const [expanded,    setExpanded]    = useState(null)
  const [refreshing,  setRefreshing]  = useState(false)

  useEffect(() => {
    if (loading) return
    if (!user) { router.replace('/admin'); return }
    if (user.email !== process.env.NEXT_PUBLIC_ADMIN_EMAIL) {
      toast.error('Not authorized')
      router.replace('/login')
      return
    }
    loadData()
  }, [user, loading])

  const [actionModal,    setActionModal]    = useState(null)
  const [actionGardener, setActionGardener] = useState(null)
  const [actionForm,     setActionForm]     = useState({})
  const [actionLoading,  setActionLoading]  = useState(false)
  const [setupTarget,    setSetupTarget]    = useState(null)
  const [setupNotes,     setSetupNotes]     = useState('')
  const [setupSaving,    setSetupSaving]    = useState(false)

  async function loadData() {
    setDataLoading(true)
    try {
      const [usersSnap, invoicesSnap, clientsSnap, feePaySnap] = await Promise.all([
        getDocs(collection(db, 'users')),
        getDocs(collection(db, 'invoices')),
        getDocs(collection(db, 'clients')),
        getDocs(collection(db, 'feePayments')),
      ])

      const allFeePaymentsData = feePaySnap.docs.map(d => ({ id: d.id, ...d.data() }))
      setAllFeePayments(allFeePaymentsData)

      const allInvoices = invoicesSnap.docs.map(d => ({ id: d.id, ...d.data() }))
      const allClients  = clientsSnap.docs.map(d => ({ id: d.id, ...d.data() }))
      const now         = new Date()

      setAllInvoicesRaw(allInvoices)

      const gardenerMap = Object.fromEntries(usersSnap.docs.map(d => [d.id, { id: d.id, ...d.data() }]))

      const gardenerList = usersSnap.docs.map(d => {
        const g         = { id: d.id, ...d.data() }
        const gInvoices = allInvoices.filter(inv => inv.gardenerUid === d.id)
        const gClients  = allClients.filter(c => c.gardenerUid === d.id)

        const allTimeTotals = gInvoices.reduce((acc, inv) => {
          const { fees, gardener } = splitInvoice(inv)
          acc.fees     += fees
          acc.gardener += gardener
          acc.total    += (inv.totalCents || 0)
          return acc
        }, { fees: 0, gardener: 0, total: 0 })

        const thisMonthInvoices = gInvoices.filter(inv => {
          const d2 = inv.createdAt?.toDate?.() || new Date(inv.createdAt)
          return d2.getMonth() === now.getMonth() && d2.getFullYear() === now.getFullYear()
        })
        const thisMonthTotals = thisMonthInvoices.reduce((acc, inv) => {
          const { fees, gardener } = splitInvoice(inv)
          acc.fees     += fees
          acc.gardener += gardener
          acc.total    += (inv.totalCents || 0)
          return acc
        }, { fees: 0, gardener: 0, total: 0 })

        const quarters = [0,1,2,3].map(q => {
          const qStart = new Date(now.getFullYear(), q * 3, 1)
          const qEnd   = new Date(now.getFullYear(), q * 3 + 3, 0)
          const qInvs  = gInvoices.filter(inv => {
            const d2 = inv.createdAt?.toDate?.() || new Date(inv.createdAt)
            return d2 >= qStart && d2 <= qEnd
          })
          const fees = qInvs.reduce((s, inv) => {
            const feeLines = inv.lineItems?.filter(l => l.category === 'fee') || []
            return s + feeLines.reduce((fs, l) => fs + (l.amountCents || 0), 0)
          }, 0)
          return { label: `Q${q+1} ${now.getFullYear()}`, fees, invoices: qInvs.length }
        })

        const recentInvoices = [...gInvoices]
          .sort((a, b) => {
            const da  = a.createdAt?.toDate?.() || new Date(a.createdAt)
            const db2 = b.createdAt?.toDate?.() || new Date(b.createdAt)
            return db2 - da
          })
          .slice(0, 5)

        const gFeePayments = allFeePaymentsData.filter(fp => fp.gardenerUid === d.id)
        const uncollectedFees = gInvoices
          .filter(inv => !inv.feeCollected)
          .reduce((s, inv) => {
            const fl = inv.lineItems?.filter(l => l.category === 'fee') || []
            return s + fl.reduce((fs, l) => fs + (l.amountCents || 0), 0)
          }, 0)

        return {
          ...g,
          invoiceCount:    gInvoices.length,
          activeClients:   gClients.filter(c => c.status === 'active').length,
          allClients:      gClients,
          allInvoices:     gInvoices,
          allTime:         allTimeTotals,
          thisMonth:       thisMonthTotals,
          quarters,
          recentInvoices,
          feePayments:     gFeePayments,
          uncollectedFees,
          hasCard:         !!g.stripePaymentMethodId,
        }
      })

      setGardeners(gardenerList)
    } catch (err) {
      console.error(err)
      toast.error('Could not load admin data')
    } finally {
      setDataLoading(false)
    }
  }

  async function handleMarkPaid(invoiceId) {
    try {
      await updateDoc(doc(db, 'invoices', invoiceId), {
        status: 'paid', updatedAt: new Date().toISOString(),
      })
      toast.success('Invoice marked as paid')
      loadData()
    } catch (err) {
      toast.error('Failed to mark paid')
    }
  }

  async function handleMarkCollected(gardener, quarter, year) {
    try {
      // Calculate fees for this quarter
      const qIndex = parseInt(quarter.replace('Q', '')) - 1
      const qStart = new Date(year, qIndex * 3, 1)
      const qEnd   = new Date(year, qIndex * 3 + 3, 0, 23, 59, 59)
      const qInvoices = gardener.allInvoices.filter(inv => {
        if (inv.feeCollected) return false
        const d = inv.createdAt?.toDate?.() || new Date(inv.createdAt)
        return d >= qStart && d <= qEnd
      })
      const totalFees = qInvoices.reduce((s, inv) => {
        const fl = inv.lineItems?.filter(l => l.category === 'fee') || []
        return s + fl.reduce((fs, l) => fs + (l.amountCents || 0), 0)
      }, 0)

      if (totalFees <= 0) { toast.error('No uncollected fees for this quarter'); return }

      // Save fee payment record
      await addDoc(collection(db, 'feePayments'), {
        gardenerUid: gardener.id,
        quarter, year,
        amountCents: totalFees,
        stripePaymentIntentId: 'manual',
        status: 'paid',
        chargeMethod: 'manual',
        paidAt: new Date().toISOString(),
        createdAt: serverTimestamp(),
      })

      // Mark invoices as collected
      await Promise.all(qInvoices.map(inv =>
        updateDoc(doc(db, 'invoices', inv.id), {
          feeCollected: true,
          feeCollectedAt: new Date().toISOString(),
          feePaymentIntentId: 'manual',
        })
      ))

      toast.success(`${quarter} ${year} marked collected for ${gardener.name} (${formatCents(totalFees)})`)
      loadData()
    } catch (err) {
      toast.error('Failed to mark collected')
    }
  }

  const [sendingTemplate, setSendingTemplate] = useState(false)

  async function handleSendTemplate() {
    if (!setupTarget?.email) { toast.error('No email on file for this contractor'); return }
    setSendingTemplate(true)
    try {
      const idToken = await user.getIdToken()
      const res = await fetch('/api/admin/send-template', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${idToken}` },
        body: JSON.stringify({ email: setupTarget.email, name: setupTarget.name }),
      })
      if (!res.ok) throw new Error('Send failed')
      toast.success(`Template sent to ${setupTarget.email}`)
      setSetupTarget(null)
      setSetupNotes('')
    } catch {
      toast.error('Failed to send template')
    } finally {
      setSendingTemplate(false)
    }
  }

  async function handleMarkSetupContacted() {
    if (!setupTarget) return
    setSetupSaving(true)
    try {
      await updateDoc(doc(db, 'users', setupTarget.id), {
        setupContacted: true,
        setupContactedAt: new Date().toISOString(),
        setupNotes: setupNotes,
      })
      toast.success(`${setupTarget.name || 'Gardener'} marked as contacted`)
      setSetupTarget(null)
      setSetupNotes('')
      loadData()
    } catch {
      toast.error('Failed to update')
    } finally {
      setSetupSaving(false)
    }
  }

  async function handleAddClient() {
    if (!actionForm.name || !actionForm.phone) { toast.error('Name and phone are required'); return }
    setActionLoading(true)
    try {
      await addDoc(collection(db, 'clients'), {
        ...actionForm,
        gardenerUid: actionGardener.id,
        status: 'active',
        packageType: 'monthly',
        basePriceCents: 0,
        packageLabel: 'Unassigned',
        recurrence: 'monthly',
        billingMode: 'upfront',
        language: 'en',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
      toast.success(`Client added for ${actionGardener.name}`)
      setActionModal(null); setActionForm({}); loadData()
    } catch (err) {
      toast.error('Failed to add client')
    } finally {
      setActionLoading(false)
    }
  }

  async function handleAddSchedule() {
    if (!actionForm.clientName || !actionForm.serviceDate) { toast.error('Client name and date are required'); return }
    setActionLoading(true)
    try {
      await addDoc(collection(db, 'schedules'), {
        ...actionForm, gardenerUid: actionGardener.id,
        status: 'scheduled', smsSent: false,
        isWalkIn: !actionForm.clientId, isRecurring: false,
        createdAt: serverTimestamp(),
      })
      toast.success(`Schedule added for ${actionGardener.name}`)
      setActionModal(null); setActionForm({}); loadData()
    } catch (err) {
      toast.error('Failed to add schedule')
    } finally {
      setActionLoading(false)
    }
  }

  async function handleRefresh() {
    setRefreshing(true)
    await loadData()
    setRefreshing(false)
    toast.success('Data refreshed')
  }

  async function handleSignOut() {
    await signOut()
    router.replace('/admin')
  }

  // ── CSV Export ──────────────────────────────────────────────────────────
  function handleExportCSV() {
    const gardenerMap = Object.fromEntries(gardeners.map(g => [g.id, g]))
    const now = new Date()
    const rows = [['Date', 'Gardener Name', 'Client Name', 'Client Paid', 'Gardener Kept', 'YardSync Fee', 'Status']]

    allInvoicesRaw
      .sort((a, b) => {
        const da = a.createdAt?.toDate?.() || new Date(a.createdAt)
        const db2 = b.createdAt?.toDate?.() || new Date(b.createdAt)
        return db2 - da
      })
      .forEach(inv => {
        const invDate = inv.createdAt?.toDate?.() || new Date(inv.createdAt)
        const g = gardenerMap[inv.gardenerUid]
        const { fees, gardener } = splitInvoice(inv)
        rows.push([
          format(invDate, 'yyyy-MM-dd'),
          (g?.name || g?.email || 'Unknown').replace(/,/g, ''),
          (inv.clientName || 'Unknown').replace(/,/g, ''),
          `$${((inv.totalCents || 0) / 100).toFixed(2)}`,
          `$${(gardener / 100).toFixed(2)}`,
          `$${(fees / 100).toFixed(2)}`,
          inv.status || 'sent',
        ])
      })

    const csv = rows.map(r => r.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `yardsync-fees-${String(now.getMonth() + 1).padStart(2, '0')}-${now.getFullYear()}.csv`
    a.click()
    URL.revokeObjectURL(url)
    toast.success(`Exported ${rows.length - 1} invoices to CSV`)
  }

  // ── Aggregate computed values ──────────────────────────────────────────
  const totalMyRevenue     = gardeners.reduce((s, g) => s + g.allTime.fees, 0)
  const thisMonthMyRevenue = gardeners.reduce((s, g) => s + g.thisMonth.fees, 0)
  const totalGardenerGross = gardeners.reduce((s, g) => s + g.allTime.gardener, 0)

  const now = new Date()
  const thisMonthCollected = allInvoicesRaw
    .filter(inv => {
      if (inv.status !== 'paid') return false
      const d = inv.createdAt?.toDate?.() || new Date(inv.createdAt)
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
    })
    .reduce((s, inv) => s + (inv.totalCents || 0), 0)

  const totalOutstanding = allInvoicesRaw
    .filter(inv => inv.status !== 'paid')
    .reduce((s, inv) => s + (inv.totalCents || 0), 0)

  const unpaidCount = allInvoicesRaw.filter(inv => inv.status !== 'paid').length

  if (loading || dataLoading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-full border-2 border-brand-500 border-t-transparent animate-spin" />
          <p className="text-gray-400 text-sm">Loading platform data...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white">

      {/* Header */}
      <div className="bg-gray-900 border-b border-gray-800 px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-brand-600 flex items-center justify-center">
              <Shield size={16} className="text-white" />
            </div>
            <div>
              <h1 className="text-[16px] font-bold text-white">YardSync Admin</h1>
              <p className="text-[11px] text-gray-400">JNew Technologies · Platform Overview</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={handleExportCSV}
              className="flex items-center gap-1.5 text-[12px] text-gray-400 hover:text-white transition-colors"
            >
              <Download size={13} />
              Export CSV
            </button>
            <button
              onClick={handleRefresh}
              className="flex items-center gap-1.5 text-[12px] text-gray-400 hover:text-white transition-colors"
            >
              <RefreshCw size={13} className={refreshing ? 'animate-spin' : ''} />
              Refresh
            </button>
            <button
              onClick={handleSignOut}
              className="flex items-center gap-1.5 text-[12px] text-gray-400 hover:text-red-400 transition-colors"
            >
              <LogOut size={13} />
              Sign out
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-8 space-y-8">

        {/* Pending Pro Setups — alert widget */}
        {(() => {
          const pending = gardeners.filter(g => g.setupFeePaid && !g.setupContacted)
          if (pending.length === 0) return null
          const mostRecent = [...pending].sort((a, b) => {
            const da = new Date(a.setupPaidAt || 0).getTime()
            const db = new Date(b.setupPaidAt || 0).getTime()
            return db - da
          })[0]
          const recentDate = mostRecent?.setupPaidAt
            ? new Date(mostRecent.setupPaidAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
            : ''
          return (
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-5 animate-pulse-once">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-amber-500/20 flex items-center justify-center flex-shrink-0">
                  <Zap size={22} className="text-amber-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-[16px] font-bold text-amber-300">
                      {pending.length} Pro Setup{pending.length === 1 ? '' : 's'} pending onboarding
                    </p>
                    <span className="text-[10px] bg-amber-500/30 text-amber-200 px-2 py-0.5 rounded-full font-bold uppercase tracking-wide">
                      Action needed
                    </span>
                  </div>
                  <p className="text-[12px] text-amber-200/80 mt-1">
                    Most recent: <strong>{mostRecent?.name || 'Unknown'}</strong>{mostRecent?.email ? ` (${mostRecent.email})` : ''} · {recentDate}
                  </p>
                  <div className="mt-3 space-y-1.5">
                    {pending.slice(0, 5).map(g => (
                      <button
                        key={g.id}
                        onClick={() => { setSetupTarget(g); setSetupNotes(g.setupNotes || '') }}
                        className="w-full flex items-center justify-between text-left bg-amber-500/5 hover:bg-amber-500/15 border border-amber-500/20 rounded-lg px-3 py-2 transition-colors"
                      >
                        <div className="min-w-0">
                          <p className="text-[13px] font-semibold text-white truncate">{g.name || 'Unknown'}</p>
                          <p className="text-[11px] text-amber-200/60 truncate">{g.email || g.businessName || g.id}</p>
                        </div>
                        <span className="text-[11px] text-amber-300 font-medium flex-shrink-0 ml-3">Mark contacted →</span>
                      </button>
                    ))}
                    {pending.length > 5 && (
                      <p className="text-[11px] text-amber-200/60 text-center pt-1">
                        +{pending.length - 5} more in the gardener list below
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )
        })()}

        {/* Aggregate revenue row */}
        <div>
          <p className="text-[11px] font-medium text-gray-500 uppercase tracking-widest mb-4">
            Revenue Summary · {format(new Date(), 'MMMM yyyy')}
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4">
              <DollarSign size={16} className="text-green-400 mb-2" />
              <p className="text-[11px] text-gray-500 uppercase tracking-wide">Collected This Month</p>
              <p className="text-[20px] font-bold text-green-400 mt-0.5">{formatCents(thisMonthCollected)}</p>
              <p className="text-[10px] text-gray-600 mt-0.5">paid invoices only</p>
            </div>
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4">
              <TrendingUp size={16} className="text-brand-400 mb-2" />
              <p className="text-[11px] text-gray-500 uppercase tracking-wide">YardSync Fees This Month</p>
              <p className="text-[20px] font-bold text-brand-400 mt-0.5">{formatCents(thisMonthMyRevenue)}</p>
              <p className="text-[10px] text-gray-600 mt-0.5">platform revenue</p>
            </div>
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4">
              <Clock size={16} className="text-amber-400 mb-2" />
              <p className="text-[11px] text-gray-500 uppercase tracking-wide">Outstanding</p>
              <p className="text-[20px] font-bold text-amber-400 mt-0.5">{formatCents(totalOutstanding)}</p>
              <p className="text-[10px] text-gray-600 mt-0.5">{unpaidCount} unpaid invoice{unpaidCount !== 1 ? 's' : ''}</p>
            </div>
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4">
              <DollarSign size={16} className="text-brand-400 mb-2" />
              <p className="text-[11px] text-gray-500 uppercase tracking-wide">All-Time Fees Earned</p>
              <p className="text-[20px] font-bold text-white mt-0.5">{formatCents(totalMyRevenue)}</p>
              <p className="text-[10px] text-gray-600 mt-0.5">lifetime platform revenue</p>
            </div>
          </div>
        </div>

        {/* Platform summary */}
        <div>
          <p className="text-[11px] font-medium text-gray-500 uppercase tracking-widest mb-4">
            Platform Overview
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'Gardeners',         value: gardeners.length,                 icon: Users,       color: 'text-blue-400',  sub: null },
              { label: 'Gardeners Grossed',  value: formatCents(totalGardenerGross),  icon: TrendingUp,  color: 'text-gray-400',  sub: 'all time client payments' },
              { label: 'My Revenue',         value: formatCents(totalMyRevenue),      icon: DollarSign,  color: 'text-brand-400', sub: 'all time fees earned' },
              { label: 'My Cut This Month',  value: formatCents(thisMonthMyRevenue),  icon: AlertCircle, color: 'text-green-400', sub: 'outstanding to collect' },
            ].map(({ label, value, icon: Icon, color, sub }) => (
              <div key={label} className="bg-gray-900 border border-gray-800 rounded-2xl p-4">
                <Icon size={16} className={`${color} mb-2`} />
                <p className="text-[11px] text-gray-500 uppercase tracking-wide">{label}</p>
                <p className="text-[20px] font-bold text-white mt-0.5">{value}</p>
                {sub && <p className="text-[10px] text-gray-600 mt-0.5">{sub}</p>}
              </div>
            ))}
          </div>
        </div>

        {/* Gardeners list */}
        <div>
          <p className="text-[11px] font-medium text-gray-500 uppercase tracking-widest mb-3">
            Gardeners ({gardeners.length})
          </p>

          {/* Filter chips */}
          <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
            {[
              { id: 'all',              label: 'All' },
              { id: 'connect_complete', label: 'Connect-complete' },
              { id: 'needs_connect',    label: 'Needs Connect' },
              { id: 'no_invoices',      label: 'No invoices yet' },
              { id: 'top_earners',      label: 'Top earners' },
            ].map(chip => {
              const active = gardenerFilter === chip.id
              return (
                <button
                  key={chip.id}
                  onClick={() => setGardenerFilter(chip.id)}
                  className={`px-3 h-8 rounded-full text-[12px] font-medium whitespace-nowrap transition-colors border ${
                    active
                      ? 'bg-brand-500 text-white border-brand-500'
                      : 'bg-gray-900 text-gray-300 border-gray-800 hover:border-gray-700'
                  }`}
                >
                  {chip.label}
                </button>
              )
            })}
          </div>

          {gardeners.length === 0 ? (
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-12 text-center">
              <Users size={32} className="text-gray-600 mx-auto mb-3" />
              <p className="text-gray-400">No gardeners on the platform yet</p>
            </div>
          ) : (
            <div className="space-y-3">
              {(() => {
                const filtered = gardeners.filter(g => {
                  if (gardenerFilter === 'connect_complete') return !!g.stripeAccountId
                  if (gardenerFilter === 'needs_connect')    return !g.stripeAccountId
                  if (gardenerFilter === 'no_invoices')      return (g.invoiceCount || 0) === 0
                  if (gardenerFilter === 'top_earners') {
                    const topIds = new Set(
                      [...gardeners]
                        .sort((a, b) => (b.allTime?.total || 0) - (a.allTime?.total || 0))
                        .slice(0, 5)
                        .map(x => x.id)
                    )
                    return topIds.has(g.id)
                  }
                  return true
                })
                const sorted = [...filtered].sort((a, b) => {
                  if (gardenerFilter === 'top_earners') {
                    return (b.allTime?.total || 0) - (a.allTime?.total || 0)
                  }
                  return (b.activeClients || 0) - (a.activeClients || 0)
                })
                return sorted.map(g => {
                  const isExpanded = expanded === g.id
                  const joinDate   = g.createdAt?.toDate?.()
                  return (
                    <div key={g.id} className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">

                      <button
                        onClick={() => setExpanded(isExpanded ? null : g.id)}
                        className="w-full p-5 flex items-center gap-4 hover:bg-gray-800/50 transition-colors"
                      >
                        <div className="w-10 h-10 rounded-full bg-brand-900 flex items-center justify-center text-brand-300 font-bold text-[13px] flex-shrink-0">
                          {g.name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0,2) || '??'}
                        </div>
                        <div className="flex-1 min-w-0 text-left">
                          <div className="flex items-center gap-2">
                            <p className="text-[14px] font-semibold text-white truncate">{g.name || 'Unknown'}</p>
                            {g.setupFeePaid && !g.setupContacted && (
                              <span
                                onClick={e => { e.stopPropagation(); setSetupTarget(g); setSetupNotes(g.setupNotes || '') }}
                                className="inline-flex items-center gap-1 text-[10px] bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded-full font-semibold animate-pulse cursor-pointer hover:bg-amber-500/30 transition-colors"
                              >
                                <Zap size={10} /> Setup Needed
                              </span>
                            )}
                          </div>
                          <p className="text-[12px] text-gray-400 truncate">{g.businessName || g.email}</p>
                        </div>
                        <div className="hidden md:flex items-center gap-6 flex-shrink-0">
                          <div className="text-right">
                            <p className="text-[10px] text-gray-500">Clients</p>
                            <p className="text-[13px] font-semibold text-white">{g.activeClients}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-[10px] text-gray-500">Gardener grossed</p>
                            <p className="text-[13px] font-semibold text-gray-300">{formatCents(g.allTime.gardener)}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-[10px] text-gray-500">My cut (month)</p>
                            <p className="text-[13px] font-semibold text-green-400">{formatCents(g.thisMonth.fees)}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-[10px] text-gray-500">My cut (total)</p>
                            <p className="text-[13px] font-semibold text-brand-400">{formatCents(g.allTime.fees)}</p>
                          </div>
                        </div>
                        <div className="flex md:hidden items-center gap-3 flex-shrink-0">
                          <div className="text-right">
                            <p className="text-[10px] text-gray-500">Their gross</p>
                            <p className="text-[12px] font-semibold text-gray-300">{formatCents(g.allTime.gardener)}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-[10px] text-gray-500">My cut</p>
                            <p className="text-[12px] font-semibold text-brand-400">{formatCents(g.allTime.fees)}</p>
                          </div>
                        </div>
                        {isExpanded
                          ? <ChevronUp size={16} className="text-gray-500 flex-shrink-0 ml-2" />
                          : <ChevronDown size={16} className="text-gray-500 flex-shrink-0 ml-2" />
                        }
                      </button>

                      {isExpanded && (
                        <div className="border-t border-gray-800 px-5 pb-5">
                          <div className="mt-4 mb-4 grid grid-cols-2 gap-3">
                            <div className="bg-gray-800 rounded-xl p-4">
                              <p className="text-[11px] text-gray-500 uppercase tracking-wide mb-1">Gardener earned this month</p>
                              <p className="text-[22px] font-bold text-gray-200">{formatCents(g.thisMonth.gardener)}</p>
                              <p className="text-[11px] text-gray-500 mt-1">from client invoices</p>
                            </div>
                            <div className="bg-amber-950/40 border border-amber-800/40 rounded-xl p-4">
                              <p className="text-[11px] text-amber-500 uppercase tracking-wide mb-1">My cut this month</p>
                              <p className="text-[22px] font-bold text-amber-400">{formatCents(g.thisMonth.fees)}</p>
                              <p className="text-[11px] text-amber-700 mt-1">outstanding to collect</p>
                            </div>
                          </div>
                          <div className="grid grid-cols-3 gap-3 mb-4">
                            <div className="bg-gray-800 rounded-xl p-3 text-center">
                              <p className="text-[16px] font-bold text-gray-200">{formatCents(g.allTime.gardener)}</p>
                              <p className="text-[11px] text-gray-400">Gardener all-time</p>
                            </div>
                            <div className="bg-gray-800 rounded-xl p-3 text-center">
                              <p className="text-[16px] font-bold text-brand-400">{formatCents(g.allTime.fees)}</p>
                              <p className="text-[11px] text-gray-400">My cut all-time</p>
                            </div>
                            <div className="bg-gray-800 rounded-xl p-3 text-center">
                              <p className="text-[16px] font-bold text-white">{g.invoiceCount}</p>
                              <p className="text-[11px] text-gray-400">Total invoices</p>
                            </div>
                          </div>

                          <div className="mb-4">
                            <p className="text-[11px] text-gray-500 uppercase tracking-wide mb-2">Quarterly Fee Breakdown</p>
                            <div className="grid grid-cols-4 gap-2">
                              {g.quarters.map(q => (
                                <div key={q.label} className="bg-gray-800 rounded-xl p-3 text-center">
                                  <p className="text-[11px] text-gray-500 mb-1">{q.label}</p>
                                  <p className="text-[14px] font-bold text-brand-400">{formatCents(q.fees)}</p>
                                  <p className="text-[10px] text-gray-600 mt-0.5">{q.invoices} inv</p>
                                </div>
                              ))}
                            </div>
                          </div>

                          <div className="mb-4">
                            <p className="text-[11px] text-gray-500 uppercase tracking-wide mb-2">Contact</p>
                            <p className="text-[13px] text-gray-300">{g.email}</p>
                            {g.phone && <p className="text-[13px] text-gray-300 mt-0.5">{g.phone}</p>}
                            {joinDate && (
                              <p className="text-[12px] text-gray-500 mt-1">
                                Joined {format(joinDate, 'MMMM d, yyyy')}
                              </p>
                            )}
                          </div>

                          <div className="mb-4 grid grid-cols-2 gap-2">
                            <button
                              onClick={() => { setActionGardener(g); setActionForm({}); setActionModal('addClient') }}
                              className="flex items-center justify-center gap-2 bg-gray-800 hover:bg-gray-700 text-white text-[13px] font-medium rounded-xl px-4 py-3 transition-colors"
                            >
                              <Plus size={14} /> Add Client
                            </button>
                            <button
                              onClick={() => { setActionGardener(g); setActionForm({}); setActionModal('addSchedule') }}
                              className="flex items-center justify-center gap-2 bg-gray-800 hover:bg-gray-700 text-white text-[13px] font-medium rounded-xl px-4 py-3 transition-colors"
                            >
                              <Calendar size={14} /> Add Schedule
                            </button>
                          </div>

                          {/* Outstanding fees + card status */}
                          <div className="mb-4">
                            <p className="text-[11px] text-gray-500 uppercase tracking-wide mb-2">Fee Collection Status</p>
                            <div className="flex items-center gap-2 mb-2">
                              {g.hasCard ? (
                                <span className="inline-flex items-center gap-1 text-[11px] bg-green-900/40 text-green-400 px-2 py-1 rounded-full font-medium">
                                  <CreditCard size={10} /> Card on file
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-[11px] bg-red-900/40 text-red-400 px-2 py-1 rounded-full font-medium">
                                  <AlertOctagon size={10} /> No card on file
                                </span>
                              )}
                              {g.uncollectedFees > 0 ? (
                                <span className="text-[11px] bg-amber-900/40 text-amber-400 px-2 py-1 rounded-full font-medium">
                                  {formatCents(g.uncollectedFees)} outstanding
                                </span>
                              ) : (
                                <span className="text-[11px] bg-green-900/40 text-green-400 px-2 py-1 rounded-full font-medium">
                                  All fees collected
                                </span>
                              )}
                            </div>
                            {g.uncollectedFees > 0 && (
                              <div className="grid grid-cols-4 gap-2 mt-2">
                                {g.quarters.map(q => {
                                  const qPaid = g.feePayments?.find(fp =>
                                    fp.quarter === q.label.split(' ')[0] &&
                                    fp.year === parseInt(q.label.split(' ')[1]) &&
                                    (fp.status === 'paid' || fp.status === 'auto_charged')
                                  )
                                  const qLabel  = q.label.split(' ')[0]
                                  const qYear   = parseInt(q.label.split(' ')[1])
                                  return (
                                    <div key={q.label} className={`rounded-lg p-2 text-center ${qPaid ? 'bg-green-900/30' : q.fees > 0 ? 'bg-amber-900/30' : 'bg-gray-800'}`}>
                                      <p className="text-[10px] text-gray-400">{qLabel}</p>
                                      <p className="text-[12px] font-bold text-white">{formatCents(q.fees)}</p>
                                      {qPaid ? (
                                        <p className="text-[9px] text-green-400 mt-0.5">Collected</p>
                                      ) : q.fees > 0 ? (
                                        <button
                                          onClick={() => handleMarkCollected(g, qLabel, qYear)}
                                          className="text-[9px] text-amber-400 hover:text-amber-300 mt-0.5 underline"
                                        >
                                          Mark collected
                                        </button>
                                      ) : (
                                        <p className="text-[9px] text-gray-600 mt-0.5">—</p>
                                      )}
                                    </div>
                                  )
                                })}
                              </div>
                            )}
                          </div>

                          {/* Fee payment history */}
                          {g.feePayments?.length > 0 && (
                            <div className="mb-4">
                              <p className="text-[11px] text-gray-500 uppercase tracking-wide mb-2 flex items-center gap-1">
                                <History size={10} /> Fee Payment History
                              </p>
                              <div className="space-y-1.5">
                                {g.feePayments
                                  .sort((a, b) => (b.paidAt || '').localeCompare(a.paidAt || ''))
                                  .map(fp => (
                                    <div key={fp.id} className="flex items-center justify-between bg-gray-800 rounded-lg px-3 py-2">
                                      <div className="flex items-center gap-2">
                                        <CheckCircle size={12} className="text-green-400" />
                                        <span className="text-[12px] text-white font-medium">{fp.quarter} {fp.year}</span>
                                        <span className="text-[10px] bg-gray-700 text-gray-300 px-1.5 py-0.5 rounded font-medium">
                                          {fp.chargeMethod === 'auto' ? 'Auto' : 'Manual'}
                                        </span>
                                      </div>
                                      <div className="text-right">
                                        <p className="text-[12px] text-brand-400 font-medium">{formatCents(fp.amountCents)}</p>
                                        {fp.paidAt && <p className="text-[10px] text-gray-500">{new Date(fp.paidAt).toLocaleDateString()}</p>}
                                      </div>
                                    </div>
                                  ))
                                }
                              </div>
                            </div>
                          )}

                          {g.recentInvoices.length > 0 && (
                            <div>
                              <p className="text-[11px] text-gray-500 uppercase tracking-wide mb-2">Recent invoices</p>
                              <div className="space-y-2">
                                {g.recentInvoices.map(inv => {
                                  const invDate   = inv.createdAt?.toDate?.() || new Date(inv.createdAt)
                                  const feeLines  = inv.lineItems?.filter(l => l.category === 'fee')  || []
                                  const baseLines = inv.lineItems?.filter(l => l.category !== 'fee') || []
                                  const feeAmt    = feeLines.reduce((s, l)  => s + (l.amountCents || 0), 0)
                                  const baseAmt   = baseLines.reduce((s, l) => s + (l.amountCents || 0), 0)
                                  const ageDays   = inv.status !== 'paid' ? getAgeDays(inv) : null
                                  return (
                                    <div key={inv.id} className="bg-gray-800 rounded-xl px-4 py-3">
                                      <div className="flex items-center justify-between mb-1.5">
                                        <div className="flex items-center gap-2">
                                          <p className="text-[13px] text-white font-medium">{inv.clientName}</p>
                                          {ageDays !== null && <AgeBadge days={ageDays} />}
                                        </div>
                                        <div className="flex items-center gap-2">
                                          <p className="text-[12px] text-gray-400">{format(invDate, 'MMM d, yyyy')}</p>
                                          {inv.status !== 'paid' ? (
                                            <button
                                              onClick={() => handleMarkPaid(inv.id)}
                                              className="flex items-center gap-1 bg-brand-600 hover:bg-brand-700 text-white text-[11px] font-medium rounded-lg px-2 py-1 transition-colors"
                                            >
                                              <CheckCircle size={11} /> Mark paid
                                            </button>
                                          ) : (
                                            <span className="text-[11px] text-green-400 font-medium">Paid</span>
                                          )}
                                        </div>
                                      </div>
                                      <div className="flex items-center gap-4">
                                        <div>
                                          <p className="text-[10px] text-gray-500">Client paid</p>
                                          <p className="text-[13px] text-white font-medium">{formatCents(inv.totalCents || 0)}</p>
                                        </div>
                                        <div>
                                          <p className="text-[10px] text-gray-500">Gardener kept</p>
                                          <p className="text-[13px] text-gray-300">{formatCents(baseAmt)}</p>
                                        </div>
                                        <div>
                                          <p className="text-[10px] text-gray-500">My cut</p>
                                          <p className="text-[13px] text-brand-400 font-medium">+{formatCents(feeAmt)}</p>
                                        </div>
                                      </div>
                                    </div>
                                  )
                                })}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })
              })()}
            </div>
          )}
        </div>

      </div>

      {actionModal === 'addClient' && actionGardener && (
        <div className="fixed inset-0 bg-black/70 z-[60] flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-md p-6">
            <p className="text-[16px] font-semibold text-white mb-1">Add Client</p>
            <p className="text-[12px] text-gray-400 mb-4">For {actionGardener.name || actionGardener.email}</p>
            <div className="space-y-3">
              <input placeholder="Client name *" value={actionForm.name || ''} onChange={e => setActionForm(f => ({...f, name: e.target.value}))} className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-[14px] text-white placeholder-gray-500 focus:outline-none focus:border-brand-500" />
              <input placeholder="Phone * — (210) 555-0100" value={actionForm.phone || ''} onChange={e => {
                const digits = e.target.value.replace(/\D/g, '').slice(0, 10)
                let formatted = digits
                if (digits.length > 6) formatted = `(${digits.slice(0,3)}) ${digits.slice(3,6)}-${digits.slice(6)}`
                else if (digits.length > 3) formatted = `(${digits.slice(0,3)}) ${digits.slice(3)}`
                else if (digits.length > 0) formatted = `(${digits}`
                setActionForm(f => ({...f, phone: formatted}))
              }} className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-[14px] text-white placeholder-gray-500 focus:outline-none focus:border-brand-500" />
              <input placeholder="Email" value={actionForm.email || ''} onChange={e => setActionForm(f => ({...f, email: e.target.value}))} className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-[14px] text-white placeholder-gray-500 focus:outline-none focus:border-brand-500" />
              <input placeholder="Address" value={actionForm.address || ''} onChange={e => setActionForm(f => ({...f, address: e.target.value}))} className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-[14px] text-white placeholder-gray-500 focus:outline-none focus:border-brand-500" />
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => { setActionModal(null); setActionForm({}) }} className="flex-1 bg-gray-800 hover:bg-gray-700 text-white text-[14px] font-medium rounded-xl py-3 transition-colors">Cancel</button>
              <button onClick={handleAddClient} disabled={actionLoading} className="flex-1 bg-brand-600 hover:bg-brand-700 text-white text-[14px] font-medium rounded-xl py-3 transition-colors disabled:opacity-50">{actionLoading ? 'Adding...' : 'Add Client'}</button>
            </div>
          </div>
        </div>
      )}

      {setupTarget && (
        <div className="fixed inset-0 bg-black/70 z-[60] flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-md p-6">
            <div className="flex items-center gap-2 mb-1">
              <Zap size={16} className="text-amber-400" />
              <p className="text-[16px] font-semibold text-white">Setup Package — {setupTarget.name || 'Gardener'}</p>
            </div>
            <p className="text-[12px] text-gray-400 mb-4">Purchased the $99 setup package</p>
            <div className="space-y-3 mb-4">
              <div className="bg-gray-800 rounded-xl p-3 space-y-1.5">
                <div className="flex justify-between text-[13px]">
                  <span className="text-gray-400">Email</span>
                  <span className="text-white">{setupTarget.email || '—'}</span>
                </div>
                <div className="flex justify-between text-[13px]">
                  <span className="text-gray-400">Phone</span>
                  <span className="text-white">{setupTarget.phone || '—'}</span>
                </div>
                <div className="flex justify-between text-[13px]">
                  <span className="text-gray-400">Purchased</span>
                  <span className="text-white">{setupTarget.setupPaidAt ? new Date(setupTarget.setupPaidAt).toLocaleDateString() : '—'}</span>
                </div>
              </div>
              <div>
                <p className="text-[12px] text-gray-400 mb-1">Notes</p>
                <textarea
                  value={setupNotes}
                  onChange={e => setSetupNotes(e.target.value)}
                  rows={3}
                  placeholder="Add notes about the setup call..."
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-[14px] text-white placeholder-gray-500 focus:outline-none focus:border-brand-500 resize-none"
                />
              </div>
            </div>
            <div className="mb-4">
              <p className="text-[12px] text-gray-400 mb-2">Client Onboarding</p>
              <div className="flex gap-2">
                <button
                  onClick={handleSendTemplate}
                  disabled={sendingTemplate || !setupTarget?.email}
                  className="flex-1 flex items-center justify-center gap-2 bg-gray-800 hover:bg-gray-700 text-white text-[13px] font-medium rounded-xl py-2.5 transition-colors border border-gray-700 disabled:opacity-50"
                >
                  <Mail size={14} />
                  {sendingTemplate ? 'Sending...' : 'Send template to client'}
                </button>
                <a
                  href="/YardSync_Client_Import_Template.xlsx"
                  download
                  className="flex-1 flex items-center justify-center gap-2 bg-gray-800 hover:bg-gray-700 text-white text-[13px] font-medium rounded-xl py-2.5 transition-colors border border-gray-700"
                >
                  <FileSpreadsheet size={14} />
                  Download template
                </a>
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => { setSetupTarget(null); setSetupNotes('') }} className="flex-1 bg-gray-800 hover:bg-gray-700 text-white text-[14px] font-medium rounded-xl py-3 transition-colors">Cancel</button>
              <button onClick={handleMarkSetupContacted} disabled={setupSaving} className="flex-1 bg-green-600 hover:bg-green-700 text-white text-[14px] font-medium rounded-xl py-3 transition-colors disabled:opacity-50">{setupSaving ? 'Saving...' : 'Mark Contacted'}</button>
            </div>
          </div>
        </div>
      )}

      {actionModal === 'addSchedule' && actionGardener && (
        <div className="fixed inset-0 bg-black/70 z-[60] flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-md p-6">
            <p className="text-[16px] font-semibold text-white mb-1">Add Schedule</p>
            <p className="text-[12px] text-gray-400 mb-4">For {actionGardener.name || actionGardener.email}</p>
            <div className="space-y-3">
              <select value={actionForm.clientId || ''} onChange={e => {
                const c = actionGardener.allClients.find(c => c.id === e.target.value)
                setActionForm(f => ({...f, clientId: e.target.value, clientName: c?.name || '', clientPhone: c?.phone || ''}))
              }} className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-[14px] text-white focus:outline-none focus:border-brand-500">
                <option value="">Select client (or walk-in)</option>
                {actionGardener.allClients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              {!actionForm.clientId && (
                <input placeholder="Walk-in name *" value={actionForm.clientName || ''} onChange={e => setActionForm(f => ({...f, clientName: e.target.value}))} className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-[14px] text-white placeholder-gray-500 focus:outline-none focus:border-brand-500" />
              )}
              <input type="date" value={actionForm.serviceDate || ''} onChange={e => setActionForm(f => ({...f, serviceDate: e.target.value}))} className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-[14px] text-white focus:outline-none focus:border-brand-500" />
              <select value={actionForm.time || '9:00 AM'} onChange={e => setActionForm(f => ({...f, time: e.target.value}))} className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-[14px] text-white focus:outline-none focus:border-brand-500">
                {['6:00 AM','6:30 AM','7:00 AM','7:30 AM','8:00 AM','8:30 AM','9:00 AM','9:30 AM','10:00 AM','10:30 AM','11:00 AM','11:30 AM','12:00 PM','12:30 PM','1:00 PM','1:30 PM','2:00 PM','2:30 PM','3:00 PM','3:30 PM','4:00 PM','4:30 PM','5:00 PM','5:30 PM','6:00 PM','6:30 PM','7:00 PM'].map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => { setActionModal(null); setActionForm({}) }} className="flex-1 bg-gray-800 hover:bg-gray-700 text-white text-[14px] font-medium rounded-xl py-3 transition-colors">Cancel</button>
              <button onClick={handleAddSchedule} disabled={actionLoading} className="flex-1 bg-brand-600 hover:bg-brand-700 text-white text-[14px] font-medium rounded-xl py-3 transition-colors disabled:opacity-50">{actionLoading ? 'Adding...' : 'Add Schedule'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
