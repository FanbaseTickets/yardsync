'use client'

// Client-side PWA push helpers (docs/PUSH_NOTIFICATIONS_SPEC.md). Used by the
// Settings "Phone notifications" toggle. Push is a secondary channel — failures
// here never affect SMS/email.

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = window.atob(base64)
  const arr = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i)
  return arr
}

export function pushSupported() {
  return typeof window !== 'undefined'
    && 'serviceWorker' in navigator
    && 'PushManager' in window
    && 'Notification' in window
}

export async function isPushEnabled() {
  if (!pushSupported()) return false
  try {
    const reg = await navigator.serviceWorker.getRegistration('/sw.js')
    if (!reg) return false
    const sub = await reg.pushManager.getSubscription()
    return !!sub
  } catch { return false }
}

export async function enablePush(user) {
  if (!pushSupported()) throw new Error('not_supported')
  const vapid = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  if (!vapid) throw new Error('not_configured')

  const reg = await navigator.serviceWorker.register('/sw.js')
  await navigator.serviceWorker.ready
  const perm = await Notification.requestPermission()
  if (perm !== 'granted') throw new Error('denied')

  const sub = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(vapid),
  })
  const idToken = await user.getIdToken()
  const res = await fetch('/api/push/subscribe', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
    body:    JSON.stringify({ gardenerUid: user.uid, subscription: sub.toJSON() }),
  })
  if (!res.ok) throw new Error('save_failed')
  return true
}

export async function disablePush(user) {
  if (!pushSupported()) return
  try {
    const reg = await navigator.serviceWorker.getRegistration('/sw.js')
    const sub = reg && (await reg.pushManager.getSubscription())
    const endpoint = sub?.endpoint
    if (sub) await sub.unsubscribe()
    const idToken = await user.getIdToken()
    await fetch('/api/push/unsubscribe', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
      body:    JSON.stringify({ gardenerUid: user.uid, endpoint }),
    })
  } catch (e) {
    console.error('disablePush:', e)
  }
}
