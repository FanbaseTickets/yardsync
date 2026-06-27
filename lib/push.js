import webpush from 'web-push'
import { getDocument, updateDocument } from '@/lib/firestoreRest'

let configured = false
function ensureConfigured() {
  if (configured) return true
  const pub  = process.env.VAPID_PUBLIC_KEY
  const priv = process.env.VAPID_PRIVATE_KEY
  if (!pub || !priv) return false
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || 'mailto:support@yardsyncapp.com', pub, priv)
  configured = true
  return true
}

// Best-effort web push to a contractor's installed devices. SECONDARY to
// SMS/email (docs/PUSH_NOTIFICATIONS_SPEC.md) — it NEVER throws into the caller,
// so the SMS/email send is always the source of truth. A contractor with no push
// subscription is a silent no-op (they just get the SMS/email as before).
export async function sendPush(gardenerUid, { title, body, url }) {
  try {
    if (!ensureConfigured() || !gardenerUid) return
    const userDoc = await getDocument('users', gardenerUid)
    const subs = userDoc?.data?.pushSubscriptions
    if (!Array.isArray(subs) || subs.length === 0) return

    const payload = JSON.stringify({ title, body, url })
    const dead = []
    await Promise.all(subs.map(async (sub) => {
      try {
        await webpush.sendNotification(sub, payload)
      } catch (e) {
        // 404/410 = the subscription is gone (uninstalled / permission revoked).
        if (e.statusCode === 404 || e.statusCode === 410) dead.push(sub.endpoint)
      }
    }))

    if (dead.length) {
      const kept = subs.filter(s => !dead.includes(s.endpoint))
      await updateDocument('users', gardenerUid, {
        pushSubscriptions: kept,
        updatedAt:         new Date().toISOString(),
      })
    }
  } catch (e) {
    console.error('[push] sendPush failed (non-fatal):', e.message)
  }
}
