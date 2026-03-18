'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import AppShell from '@/components/layout/AppShell'
import PageHeader from '@/components/layout/PageHeader'
import { Card, Badge, Button, EmptyState, Skeleton, Modal, Input, Select } from '@/components/ui'
import { getClients, addClient, getServices } from '@/lib/db'
import { formatCents } from '@/lib/fee'
import { Users, Plus, Search, MapPin, AlertCircle } from 'lucide-react'
import toast from 'react-hot-toast'
import Link from 'next/link'

const BILLING_OPTIONS = [
  { value: 'upfront',   label: 'Upfront (invoice before visit)' },
  { value: 'postvisit', label: 'Post-visit (invoice after)' },
]

const AVATAR_COLORS = [
  'bg-brand-100 text-brand-800',
  'bg-blue-100 text-blue-800',
  'bg-amber-100 text-amber-800',
  'bg-purple-100 text-purple-800',
  'bg-pink-100 text-pink-800',
]

const DEFAULT_FORM = {
  name:        '',
  phone:       '',
  email:       '',
  address:     '',
  serviceId:   '',
  billingMode: 'upfront',
  notes:       '',
}

const RECURRENCE_LABELS = {
  weekly:    'Every week',
  biweekly:  'Every 2 weeks',
  '3x_month':'3x per month',
  monthly:   'Once a month',
  quarterly: 'Once every 3 months',
  annual:    'Once a year',
  onetime:   'One-time only',
}

const PACKAGE_FEE_MAP = {
  monthly:   1500,
  quarterly: 3500,
  annual:    10000,
  weekly:    500,
  onetime:   1000,
}

export default function ClientsPage() {
  const { user }  = useAuth()
  const router    = useRouter()

  const [clients,  setClients]  = useState([])
  const [services, setServices] = useState([])
  const [loading,  setLoading]  = useState(true)
  const [search,   setSearch]   = useState('')
  const [showAdd,  setShowAdd]  = useState(false)
  const [form,     setForm]     = useState(DEFAULT_FORM)
  const [errors,   setErrors]   = useState({})
  const [saving,   setSaving]   = useState(false)

  useEffect(() => {
    if (!user) return
    loadData()
  }, [user])

  async function loadData() {
    setLoading(true)
    try {
      const [c, s] = await Promise.all([
        getClients(user.uid),
        getServices(user.uid),
      ])
      setClients(c)
      setServices(s.filter(sv => sv.serviceType === 'base'))
    } catch {
      toast.error('Could not load clients')
    } finally {
      setLoading(false)
    }
  }

  function setField(key, val) {
    setForm(prev => ({ ...prev, [key]: val }))
    if (errors[key]) setErrors(prev => ({ ...prev, [key]: null }))
  }

  const selectedService = services.find(s => s.id === form.serviceId)

  function validate() {
    const e = {}
    if (!form.name.trim())    e.name      = 'Name is required'
    if (!form.phone.trim())   e.phone     = 'Phone is required'
    if (!form.address.trim()) e.address   = 'Address is required'
    if (!form.serviceId)      e.serviceId = 'Select a package'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  async function handleAdd() {
    if (!validate()) return
    setSaving(true)
    try {
      await addClient(user.uid, {
        name:            form.name.trim(),
        phone:           form.phone.trim(),
        email:           form.email.trim(),
        address:         form.address.trim(),
        notes:           form.notes.trim(),
        billingMode:     form.billingMode,
        serviceId:       form.serviceId,
        packageType:     selectedService?.packageType    || 'monthly',
        basePriceCents:  selectedService?.priceCents     || 6500,
        packageLabel:    selectedService?.label          || '',
        packageDesc:     selectedService?.description    || '',
        packageIncludes: selectedService?.includes       || '',
        recurrence:      selectedService?.recurrence     || 'biweekly',
        preferredDay:    selectedService?.preferredDay   || '',
      })
      toast.success(`${form.name} added!`)
      setShowAdd(false)
      setForm(DEFAULT_FORM)
      loadData()
    } catch {
      toast.error('Could not add client')
    } finally {
      setSaving(false)
    }
  }

  const filtered      = clients.filter(c =>
    c.name?.toLowerCase().includes(search.toLowerCase()) ||
    c.address?.toLowerCase().includes(search.toLowerCase())
  )
  const activeCount   = clients.filter(c => c.status === 'active').length
  const inactiveCount = clients.filter(c => c.status !== 'active').length

  function getInitials(name) {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
  }

  return (
    <AppShell>
      <div className="page-content">
        <PageHeader
          title="Clients"
          subtitle={`${activeCount} active${inactiveCount > 0 ? ` · ${inactiveCount} inactive` : ''}`}
          actions={<Button icon={Plus} size="sm" onClick={() => setShowAdd(true)}>Add</Button>}
        />

        <div className="px-4 py-4 max-w-lg mx-auto space-y-4">
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="search"
              placeholder="Search by name or address..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-gray-200 bg-white text-[14px] focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>

          {loading ? (
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-20" />)}
            </div>
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={Users}
              title={search ? 'No clients match your search' : 'No clients yet'}
              description={search ? 'Try a different name or address' : 'Add your first client to get started'}
              action={!search && <Button icon={Plus} onClick={() => setShowAdd(true)}>Add first client</Button>}
            />
          ) : (
            <div className="space-y-2">
              {filtered.map((client, i) => (
                <Card
                  key={client.id}
                  onClick={() => router.push(`/clients/${client.id}`)}
                  padding={false}
                  className={`animate-fade-up stagger-${Math.min(i+1,4)}`}
                >
                  <div className="p-4 flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-[13px] font-semibold flex-shrink-0 ${AVATAR_COLORS[i % AVATAR_COLORS.length]}`}>
                      {getInitials(client.name)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-[14px] font-medium text-gray-900">{client.name}</p>
                        <Badge label={client.packageType} variant={client.packageType} />
                      </div>
                      <div className="flex items-center gap-1 mt-0.5">
                        <MapPin size={10} className="text-gray-300 flex-shrink-0" />
                        <p className="text-[12px] text-gray-400 truncate">{client.address}</p>
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <p className="text-[12px] text-brand-600 font-medium">
                          {formatCents(client.basePriceCents || 0)}/base
                        </p>
                        {client.recurrence && client.packageType !== 'onetime' && (
                          <p className="text-[11px] text-gray-400">
                            · {RECURRENCE_LABELS[client.recurrence] || client.recurrence}
                          </p>
                        )}
                      </div>
                    </div>
                    <Badge label={client.status} variant={client.status} />
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Add Client Modal */}
      <Modal
        open={showAdd}
        onClose={() => { setShowAdd(false); setForm(DEFAULT_FORM); setErrors({}) }}
        title="Add client"
        footer={
          <>
            <Button variant="secondary" fullWidth onClick={() => setShowAdd(false)}>Cancel</Button>
            <Button fullWidth loading={saving} onClick={handleAdd} disabled={services.length === 0}>
              Add client
            </Button>
          </>
        }
      >
        <div className="space-y-4">

          {/* No packages warning */}
          {services.length === 0 && (
            <div className="flex items-start gap-2.5 bg-amber-50 border border-amber-100 rounded-xl p-3">
              <AlertCircle size={16} className="text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-[13px] font-medium text-amber-800">No packages set up yet</p>
                <p className="text-[12px] text-amber-600 mt-0.5">
                  Go to Services and add a base package first, then come back to add clients.
                </p>
                <Link href="/services">
                  <span className="text-[12px] text-amber-700 font-medium underline">
                    Go to Services →
                  </span>
                </Link>
              </div>
            </div>
          )}

          <Input
            label="Full name *"
            placeholder="Sarah Martinez"
            value={form.name}
            onChange={e => setField('name', e.target.value)}
            error={errors.name}
          />
          <Input
            label="Phone *"
            placeholder="(210) 555-0100"
            type="tel"
            value={form.phone}
            onChange={e => setField('phone', e.target.value)}
            error={errors.phone}
          />
          <Input
            label="Email"
            placeholder="sarah@example.com"
            value={form.email}
            onChange={e => setField('email', e.target.value)}
            error={errors.email}
          />
          <Input
            label="Service address *"
            placeholder="4821 Maple Dr, San Antonio TX"
            value={form.address}
            onChange={e => setField('address', e.target.value)}
            error={errors.address}
          />

          {/* Package selector */}
          <Select
            label="Package *"
            value={form.serviceId}
            onChange={e => setField('serviceId', e.target.value)}
            error={errors.serviceId}
            disabled={services.length === 0}
          >
            <option value="">— Select a package —</option>
            {services.map(s => (
              <option key={s.id} value={s.id}>
                {s.label} · {formatCents(s.priceCents || 0)}
              </option>
            ))}
          </Select>

          {/* Package preview */}
          {selectedService && (
            <div className="bg-brand-50 border border-brand-100 rounded-xl p-3 space-y-1.5">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge label={selectedService.packageType} variant={selectedService.packageType} />
                <p className="text-[12px] font-medium text-brand-800">{selectedService.label}</p>
              </div>
              {selectedService.recurrence && (
                <p className="text-[11px] text-brand-600 font-medium">
                  {RECURRENCE_LABELS[selectedService.recurrence] || selectedService.recurrence}
                  {selectedService.preferredDay
                    ? ` · ${selectedService.preferredDay.charAt(0).toUpperCase() + selectedService.preferredDay.slice(1)}s`
                    : ''}
                </p>
              )}
              {selectedService.description && (
                <p className="text-[12px] text-brand-600">{selectedService.description}</p>
              )}
              {selectedService.includes && (
                <div className="flex flex-wrap gap-1 mt-1">
                  {selectedService.includes.split(',').map((item, i) => (
                    <span key={i} className="text-[11px] bg-white text-brand-700 px-2 py-0.5 rounded-full border border-brand-100">
                      {item.trim()}
                    </span>
                  ))}
                </div>
              )}
              <p className="text-[12px] font-semibold text-brand-800 pt-1 border-t border-brand-100">
                Client pays {formatCents(
                  (selectedService.priceCents || 0) +
                  (PACKAGE_FEE_MAP[selectedService.packageType] || 1000)
                )} / {selectedService.packageType}
              </p>
            </div>
          )}

          <Select
            label="Billing mode"
            value={form.billingMode}
            onChange={e => setField('billingMode', e.target.value)}
          >
            {BILLING_OPTIONS.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </Select>

          <Input
            label="Notes (optional)"
            placeholder="Gate code 1234, prefers mornings..."
            value={form.notes}
            onChange={e => setField('notes', e.target.value)}
          />
        </div>
      </Modal>
    </AppShell>
  )
}