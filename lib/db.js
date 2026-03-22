import {
  collection, doc, addDoc, setDoc, updateDoc, deleteDoc,
  getDocs, getDoc, query, where, orderBy, serverTimestamp
} from 'firebase/firestore'
import { db } from './firebase'

export async function getGardenerProfile(uid) {
  const snap = await getDoc(doc(db, 'users', uid))
  return snap.exists() ? { id: snap.id, ...snap.data() } : null
}

export async function saveGardenerProfile(uid, data) {
  await setDoc(doc(db, 'users', uid), { ...data, updatedAt: serverTimestamp() }, { merge: true })
}

export async function getClients(gardenerUid) {
  const q = query(collection(db, 'clients'), where('gardenerUid', '==', gardenerUid))
  const snap = await getDocs(q)
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
}

export async function getClient(clientId) {
  const snap = await getDoc(doc(db, 'clients', clientId))
  return snap.exists() ? { id: snap.id, ...snap.data() } : null
}

export async function addClient(gardenerUid, clientData) {
  return await addDoc(collection(db, 'clients'), {
    ...clientData, gardenerUid, status: 'active',
    createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
  })
}

export async function updateClient(clientId, data) {
  await updateDoc(doc(db, 'clients', clientId), { ...data, updatedAt: serverTimestamp() })
}

export async function deleteClient(clientId) {
  await deleteDoc(doc(db, 'clients', clientId))
}

export async function getSchedules(gardenerUid, monthStart, monthEnd) {
  const q = query(
    collection(db, 'schedules'),
    where('gardenerUid', '==', gardenerUid)
  )
  const snap = await getDocs(q)
  return snap.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .filter(s => s.serviceDate >= monthStart && s.serviceDate <= monthEnd)
}

export async function getTodaySchedules(gardenerUid, todayStr) {
  const q = query(
    collection(db, 'schedules'),
    where('gardenerUid', '==', gardenerUid),
    where('serviceDate', '==', todayStr)
  )
  const snap = await getDocs(q)
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
}

export async function addSchedule(gardenerUid, scheduleData) {
  return await addDoc(collection(db, 'schedules'), {
    ...scheduleData, gardenerUid, status: 'scheduled',
    smsSent: false, createdAt: serverTimestamp(),
  })
}

export async function updateSchedule(scheduleId, data) {
  await updateDoc(doc(db, 'schedules', scheduleId), { ...data, updatedAt: serverTimestamp() })
}

export async function deleteSchedule(scheduleId) {
  await deleteDoc(doc(db, 'schedules', scheduleId))
}

export async function deleteAllClientSchedules(gardenerUid, clientId) {
  const q = query(
    collection(db, 'schedules'),
    where('gardenerUid', '==', gardenerUid),
    where('clientId', '==', clientId),
    where('status', '==', 'scheduled')
  )
  const snap = await getDocs(q)
  await Promise.all(snap.docs.map(d => deleteDoc(doc(db, 'schedules', d.id))))
  return snap.docs.length
}

export async function getServices(gardenerUid) {
  const q = query(collection(db, 'services'), where('gardenerUid', '==', gardenerUid))
  const snap = await getDocs(q)
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
}

export async function addService(gardenerUid, serviceData) {
  return await addDoc(collection(db, 'services'), {
    ...serviceData, gardenerUid, active: true, createdAt: serverTimestamp(),
  })
}

export async function updateService(serviceId, data) {
  await updateDoc(doc(db, 'services', serviceId), { ...data, updatedAt: serverTimestamp() })
}

export async function deleteService(serviceId) {
  await deleteDoc(doc(db, 'services', serviceId))
}

export async function getInvoices(gardenerUid) {
  const q = query(collection(db, 'invoices'), where('gardenerUid', '==', gardenerUid))
  const snap = await getDocs(q)
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
}

export async function getClientInvoices(clientId) {
  const q = query(collection(db, 'invoices'), where('clientId', '==', clientId))
  const snap = await getDocs(q)
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
}

export async function saveInvoice(gardenerUid, invoiceData) {
  return await addDoc(collection(db, 'invoices'), {
    ...invoiceData, gardenerUid, createdAt: serverTimestamp(),
  })
}

export async function updateInvoice(invoiceId, data) {
  await updateDoc(doc(db, 'invoices', invoiceId), { ...data, updatedAt: serverTimestamp() })
}

export async function getSchedulesFromToday(gardenerUid, todayStr) {
  const q = query(
    collection(db, 'schedules'),
    where('gardenerUid', '==', gardenerUid)
  )
  const snap = await getDocs(q)
  return snap.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .filter(s => s.serviceDate >= todayStr)
    .sort((a, b) => a.serviceDate.localeCompare(b.serviceDate))
}

// ── Quarterly Fee Functions ──────────────────────────────────────────────

function getQuarterRange(quarter, year) {
  const qIndex = parseInt(quarter.replace('Q', '')) - 1
  const start = new Date(year, qIndex * 3, 1)
  const end   = new Date(year, qIndex * 3 + 3, 0, 23, 59, 59)
  return { start, end }
}

export async function getQuarterlyFeesOwed(gardenerUid, quarter, year) {
  const invoices = await getInvoices(gardenerUid)
  const { start, end } = getQuarterRange(quarter, year)
  let totalFees = 0
  let invoiceCount = 0
  invoices.forEach(inv => {
    if (inv.feeCollected) return
    const d = inv.createdAt?.toDate?.() || new Date(inv.createdAt)
    if (d >= start && d <= end) {
      const feeLines = inv.lineItems?.filter(l => l.category === 'fee') || []
      totalFees += feeLines.reduce((s, l) => s + (l.amountCents || 0), 0)
      invoiceCount++
    }
  })
  return { totalFees, invoiceCount }
}

export async function getFeePayments(gardenerUid) {
  const q = query(collection(db, 'feePayments'), where('gardenerUid', '==', gardenerUid))
  const snap = await getDocs(q)
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
}

export async function saveFeePayment(data) {
  return await addDoc(collection(db, 'feePayments'), {
    ...data, createdAt: serverTimestamp(),
  })
}

export async function markQuarterFeesCollected(gardenerUid, quarter, year, stripePaymentIntentId) {
  const invoices = await getInvoices(gardenerUid)
  const { start, end } = getQuarterRange(quarter, year)
  const updates = []
  invoices.forEach(inv => {
    if (inv.feeCollected) return
    const d = inv.createdAt?.toDate?.() || new Date(inv.createdAt)
    if (d >= start && d <= end) {
      updates.push(updateDoc(doc(db, 'invoices', inv.id), {
        feeCollected: true,
        feeCollectedAt: new Date().toISOString(),
        feePaymentIntentId: stripePaymentIntentId || 'manual',
        updatedAt: serverTimestamp(),
      }))
    }
  })
  await Promise.all(updates)
  return updates.length
}

export async function getAllOutstandingFees() {
  const snap = await getDocs(collection(db, 'invoices'))
  const allInvoices = snap.docs.map(d => ({ id: d.id, ...d.data() }))
  const now = new Date()
  const currentQ = Math.floor(now.getMonth() / 3) + 1
  const currentYear = now.getFullYear()

  const byGardener = {}
  allInvoices.forEach(inv => {
    if (inv.feeCollected) return
    const uid = inv.gardenerUid
    if (!byGardener[uid]) byGardener[uid] = { totalFees: 0, invoiceCount: 0 }
    const feeLines = inv.lineItems?.filter(l => l.category === 'fee') || []
    byGardener[uid].totalFees += feeLines.reduce((s, l) => s + (l.amountCents || 0), 0)
    byGardener[uid].invoiceCount++
  })
  return byGardener
}

// ── Materials Functions ──────────────────────────────────────────────────

export async function getMostRecentSchedule(gardenerUid, clientId) {
  const q = query(
    collection(db, 'schedules'),
    where('gardenerUid', '==', gardenerUid),
    where('clientId', '==', clientId),
    where('status', '==', 'scheduled')
  )
  const snap = await getDocs(q)
  const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }))
  return docs.sort((a, b) => a.serviceDate.localeCompare(b.serviceDate))[0] || null
}

export async function updateScheduleMaterials(scheduleId, materials) {
  await updateDoc(doc(db, 'schedules', scheduleId), {
    materials,
    materialsTotal: materials.reduce((sum, m) => sum + (m.totalCents || 0), 0),
    updatedAt: serverTimestamp(),
  })
}