import {
  collection, doc, addDoc, setDoc, updateDoc, deleteDoc,
  getDocs, getDoc, query, where, serverTimestamp
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