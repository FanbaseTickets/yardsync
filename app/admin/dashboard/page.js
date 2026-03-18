'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import { formatCents } from '@/lib/fee'
import { collection, getDocs } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { format } from 'date-fns'
import {
  Shield, LogOut, Users, DollarSign,
  TrendingUp, AlertCircle, RefreshCw,
  ChevronDown, ChevronUp
} from 'lucide-react'
import toast from 'react-hot-toast'

export default function AdminDashboard() {
  const { user, loading, signOut } = useAuth()
  const router = useRouter()

  const [gardeners,   setGardeners]   = useState([])
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

  async function loadData() {
    setDataLoading(true)
    try {
      const [usersSnap, invoicesSnap, clientsSnap] = await Promise.all([
        getDocs(collection(db, 'users')),
        getDocs(collection(db, 'invoices')),
        getDocs(collection(db, 'clients')),
      ])

      const allInvoices = invoicesSnap.docs.map(d => ({ id: d.id, ...d.data() }))
      const allClients  = clientsSnap.docs.map(d => ({ id: d.id, ...d.data() }))
      const now         = new Date()

      const gardenerList = usersSnap.docs.map(d => {
        const g         = { id: d.id, ...d.data() }
        const gInvoices = allInvoices.filter(inv => inv.gardenerUid === d.id)
        const gClients  = allClients.filter(c => c.gardenerUid === d.id)

        // All-time fees from line items
        const totalFees = gInvoices.reduce((sum, inv) => {
          const feeLines = inv.lineItems?.filter(l => l.category === 'fee') || []
          return sum + feeLines.reduce((s, l) => s + (l.amountCents || 0), 0)
        }, 0)

        // This month fees
        const thisMonthInvoices = gInvoices.filter(inv => {
          const d2 = inv.createdAt?.toDate?.() || new Date(inv.createdAt)
          return d2.getMonth() === now.getMonth() && d2.getFullYear() === now.getFullYear()
        })
        const thisMonthFees = thisMonthInvoices.reduce((sum, inv) => {
          const feeLines = inv.lineItems?.filter(l => l.category === 'fee') || []
          return sum + feeLines.reduce((s, l) => s + (l.amountCents || 0), 0)
        }, 0)

        // Recent invoices sorted newest first
        const recentInvoices = [...gInvoices]
          .sort((a, b) => {
            const da = a.createdAt?.toDate?.() || new Date(a.createdAt)
            const db2 = b.createdAt?.toDate?.() || new Date(b.createdAt)
            return db2 - da
          })
          .slice(0, 5)

        return {
          ...g,
          invoiceCount:  gInvoices.length,
          activeClients: gClients.filter(c => c.status === 'active').length,
          totalFees,
          thisMonthFees,
          recentInvoices,
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

  const totalRevenue     = gardeners.reduce((s, g) => s + g.totalFees, 0)
  const thisMonthRevenue = gardeners.reduce((s, g) => s + g.thisMonthFees, 0)

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

        {/* Platform summary */}
        <div>
          <p className="text-[11px] font-medium text-gray-500 uppercase tracking-widest mb-4">
            Platform Overview · {format(new Date(), 'MMMM yyyy')}
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              {
                label: 'Active Gardeners',
                value: gardeners.length,
                icon:  Users,
                color: 'text-blue-400',
              },
              {
                label: 'Total Revenue',
                value: formatCents(totalRevenue),
                icon:  TrendingUp,
                color: 'text-brand-400',
              },
              {
                label: 'This Month',
                value: formatCents(thisMonthRevenue),
                icon:  DollarSign,
                color: 'text-green-400',
              },
              {
                label: 'Outstanding',
                value: formatCents(thisMonthRevenue),
                icon:  AlertCircle,
                color: 'text-amber-400',
              },
            ].map(({ label, value, icon: Icon, color }) => (
              <div key={label} className="bg-gray-900 border border-gray-800 rounded-2xl p-4">
                <Icon size={16} className={`${color} mb-2`} />
                <p className="text-[11px] text-gray-500 uppercase tracking-wide">{label}</p>
                <p className="text-[22px] font-bold text-white mt-0.5">{value}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Gardeners list */}
        <div>
          <p className="text-[11px] font-medium text-gray-500 uppercase tracking-widest mb-4">
            Gardeners ({gardeners.length})
          </p>

          {gardeners.length === 0 ? (
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-12 text-center">
              <Users size={32} className="text-gray-600 mx-auto mb-3" />
              <p className="text-gray-400">No gardeners on the platform yet</p>
            </div>
          ) : (
            <div className="space-y-3">
              {[...gardeners]
                .sort((a, b) => b.thisMonthFees - a.thisMonthFees)
                .map(g => {
                  const isExpanded = expanded === g.id
                  const joinDate   = g.createdAt?.toDate?.()

                  return (
                    <div key={g.id} className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">

                      {/* Row */}
                      <button
                        onClick={() => setExpanded(isExpanded ? null : g.id)}
                        className="w-full p-5 flex items-center gap-4 hover:bg-gray-800/50 transition-colors"
                      >
                        {/* Avatar */}
                        <div className="w-10 h-10 rounded-full bg-brand-900 flex items-center justify-center text-brand-300 font-bold text-[13px] flex-shrink-0">
                          {g.name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0,2) || '??'}
                        </div>

                        {/* Name + business */}
                        <div className="flex-1 min-w-0 text-left">
                          <p className="text-[14px] font-semibold text-white truncate">
                            {g.name || 'Unknown'}
                          </p>
                          <p className="text-[12px] text-gray-400 truncate">
                            {g.businessName || g.email}
                          </p>
                        </div>

                        {/* Desktop stats */}
                        <div className="hidden md:flex items-center gap-8 flex-shrink-0">
                          <div className="text-right">
                            <p className="text-[11px] text-gray-500">Clients</p>
                            <p className="text-[14px] font-semibold text-white">{g.activeClients}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-[11px] text-gray-500">Invoices</p>
                            <p className="text-[14px] font-semibold text-white">{g.invoiceCount}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-[11px] text-gray-500">This month</p>
                            <p className="text-[14px] font-semibold text-green-400">
                              {formatCents(g.thisMonthFees)}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-[11px] text-gray-500">All time</p>
                            <p className="text-[14px] font-semibold text-brand-400">
                              {formatCents(g.totalFees)}
                            </p>
                          </div>
                        </div>

                        {/* Mobile stats */}
                        <div className="flex md:hidden items-center gap-4 flex-shrink-0">
                          <div className="text-right">
                            <p className="text-[11px] text-gray-500">Month</p>
                            <p className="text-[13px] font-semibold text-green-400">
                              {formatCents(g.thisMonthFees)}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-[11px] text-gray-500">Total</p>
                            <p className="text-[13px] font-semibold text-brand-400">
                              {formatCents(g.totalFees)}
                            </p>
                          </div>
                        </div>

                        {isExpanded
                          ? <ChevronUp size={16} className="text-gray-500 flex-shrink-0 ml-2" />
                          : <ChevronDown size={16} className="text-gray-500 flex-shrink-0 ml-2" />
                        }
                      </button>

                      {/* Expanded detail */}
                      {isExpanded && (
                        <div className="border-t border-gray-800 px-5 pb-5">

                          {/* Outstanding balance */}
                          <div className="mt-4 mb-4 bg-amber-950/40 border border-amber-800/40 rounded-xl p-4 flex items-center justify-between">
                            <div>
                              <p className="text-[12px] text-amber-400 font-medium">
                                Outstanding balance
                              </p>
                              <p className="text-[11px] text-amber-600 mt-0.5">
                                Fees generated this month — not yet collected
                              </p>
                            </div>
                            <p className="text-[22px] font-bold text-amber-400">
                              {formatCents(g.thisMonthFees)}
                            </p>
                          </div>

                          {/* Stats grid */}
                          <div className="grid grid-cols-3 gap-3 mb-4">
                            <div className="bg-gray-800 rounded-xl p-3 text-center">
                              <p className="text-[20px] font-bold text-white">{g.activeClients}</p>
                              <p className="text-[11px] text-gray-400">Active clients</p>
                            </div>
                            <div className="bg-gray-800 rounded-xl p-3 text-center">
                              <p className="text-[20px] font-bold text-white">{g.invoiceCount}</p>
                              <p className="text-[11px] text-gray-400">Total invoices</p>
                            </div>
                            <div className="bg-gray-800 rounded-xl p-3 text-center">
                              <p className="text-[16px] font-bold text-brand-400">
                                {formatCents(g.totalFees)}
                              </p>
                              <p className="text-[11px] text-gray-400">All-time fees</p>
                            </div>
                          </div>

                          {/* Contact */}
                          <div className="mb-4">
                            <p className="text-[11px] text-gray-500 uppercase tracking-wide mb-2">
                              Contact
                            </p>
                            <p className="text-[13px] text-gray-300">{g.email}</p>
                            {g.phone && (
                              <p className="text-[13px] text-gray-300 mt-0.5">{g.phone}</p>
                            )}
                            {joinDate && (
                              <p className="text-[12px] text-gray-500 mt-1">
                                Joined {format(joinDate, 'MMMM d, yyyy')}
                              </p>
                            )}
                          </div>

                          {/* Recent invoices */}
                          {g.recentInvoices.length > 0 && (
                            <div>
                              <p className="text-[11px] text-gray-500 uppercase tracking-wide mb-2">
                                Recent invoices
                              </p>
                              <div className="space-y-2">
                                {g.recentInvoices.map(inv => {
                                  const invDate  = inv.createdAt?.toDate?.() || new Date(inv.createdAt)
                                  const feeLines = inv.lineItems?.filter(l => l.category === 'fee') || []
                                  const feeAmt   = feeLines.reduce((s, l) => s + (l.amountCents || 0), 0)
                                  return (
                                    <div
                                      key={inv.id}
                                      className="flex items-center justify-between bg-gray-800 rounded-xl px-4 py-2.5"
                                    >
                                      <div>
                                        <p className="text-[13px] text-white font-medium">
                                          {inv.clientName}
                                        </p>
                                        <p className="text-[11px] text-gray-400">
                                          {format(invDate, 'MMM d, yyyy')}
                                        </p>
                                      </div>
                                      <div className="text-right">
                                        <p className="text-[13px] text-white">
                                          {formatCents(inv.totalCents || 0)}
                                        </p>
                                        <p className="text-[11px] text-brand-400">
                                          +{formatCents(feeAmt)} your cut
                                        </p>
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
                })}
            </div>
          )}
        </div>

      </div>
    </div>
  )
}