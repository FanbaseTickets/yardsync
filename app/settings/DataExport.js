'use client'

/**
 * "Your data — export anytime" — CSV export of the contractor's own clients and
 * invoice history (Settings → Billing). Builds client-side from Firestore; no
 * server cost. Framed as data ownership (ToS §7), not an exit button.
 */

import { useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import { getClients, getInvoices } from '@/lib/db'
import { toCsv, downloadCsv, csvDate } from '@/lib/exportCsv'
import { Download, Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'

const cents = (c) => (((c || 0) / 100)).toFixed(2)
const stamp = () => new Date().toISOString().slice(0, 10)

export default function DataExport({ lang }) {
  const { user } = useAuth()
  const [busy, setBusy] = useState(null) // 'clients' | 'invoices'

  async function exportClients() {
    setBusy('clients')
    try {
      // Exclude soft-deleted leads; keep active clients + pending/accepted leads.
      const clients = (await getClients(user.uid)).filter(c => c.leadStatus !== 'dismissed')
      const columns = [
        { label: 'Name',            value: 'name' },
        { label: 'Phone',           value: 'phone' },
        { label: 'Email',           value: 'email' },
        { label: 'Address',         value: 'address' },
        { label: 'Package',         value: c => c.packageLabel || c.packageType || '' },
        { label: 'Recurrence',      value: 'recurrence' },
        { label: 'Base price (USD)', value: c => cents(c.basePriceCents) },
        { label: 'Status',          value: c => (c.leadStatus === 'new' ? 'lead' : (c.status || 'active')) },
        { label: 'Billing mode',    value: 'billingMode' },
        { label: 'SMS language',    value: 'language' },
        { label: 'Created',         value: c => csvDate(c.createdAt) },
        { label: 'Notes',           value: 'notes' },
      ]
      if (clients.length === 0) { toast(lang === 'es' ? 'Aún no hay clientes' : 'No clients yet'); return }
      downloadCsv(toCsv(clients, columns), `yardsync-clients-${stamp()}.csv`)
    } catch (e) {
      console.error('Export clients failed:', e)
      toast.error(lang === 'es' ? 'No se pudo exportar' : 'Could not export')
    } finally { setBusy(null) }
  }

  async function exportInvoices() {
    setBusy('invoices')
    try {
      const invoices = await getInvoices(user.uid)
      const columns = [
        { label: 'Date',              value: c => csvDate(c.createdAt) },
        { label: 'Client',            value: 'clientName' },
        { label: 'Total (USD)',       value: c => cents(c.totalCents) },
        { label: 'YardSync fee (USD)', value: c => cents(c.applicationFee) },
        { label: 'Stripe fee (USD)',  value: c => cents(c.stripeProcessingFee) },
        { label: 'You received (USD)', value: c => cents(c.contractorReceives) },
        { label: 'Status',            value: 'status' },
        { label: 'Type',              value: 'invoiceType' },
        { label: 'Paid date',         value: c => csvDate(c.paidAt) },
        { label: 'Payment intent',    value: 'stripePaymentIntentId' },
      ]
      if (invoices.length === 0) { toast(lang === 'es' ? 'Aún no hay facturas' : 'No invoices yet'); return }
      downloadCsv(toCsv(invoices, columns), `yardsync-invoices-${stamp()}.csv`)
    } catch (e) {
      console.error('Export invoices failed:', e)
      toast.error(lang === 'es' ? 'No se pudo exportar' : 'Could not export')
    } finally { setBusy(null) }
  }

  const Btn = ({ id, label, onClick }) => (
    <button
      type="button"
      onClick={onClick}
      disabled={busy !== null}
      className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl border border-gray-200 bg-white text-[13px] font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60 transition-colors"
    >
      {busy === id ? <Loader2 size={15} className="animate-spin text-brand-600" /> : <Download size={15} className="text-brand-600" />}
      {label}
    </button>
  )

  return (
    <section>
      <div className="flex items-center gap-2 mb-2">
        <Download size={14} className="text-brand-600" />
        <p className="text-[11px] font-medium text-gray-400 uppercase tracking-wide">
          {lang === 'es' ? 'Tus datos' : 'Your data'}
        </p>
      </div>
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
          {lang === 'es'
            ? 'Tus clientes y tu historial de facturas son tuyos — descárgalos en CSV cuando quieras.'
            : 'Your clients and invoice history are yours — export them as a CSV anytime.'}
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <Btn id="clients"  label={lang === 'es' ? 'Exportar clientes' : 'Export clients'}  onClick={exportClients} />
          <Btn id="invoices" label={lang === 'es' ? 'Exportar facturas' : 'Export invoices'} onClick={exportInvoices} />
        </div>
      </div>
    </section>
  )
}
