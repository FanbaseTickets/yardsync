import { getDocument, setDocument } from '@/lib/firestoreRest'

const FIREBASE_API_KEY = process.env.FIREBASE_API_KEY || process.env.NEXT_PUBLIC_FIREBASE_API_KEY

// Verify the caller's Firebase ID token → uid (same pattern as the invoice/quote
// routes). Crew writes (invite/accept/remove) must be authed.
export async function verifyCallerUid(req) {
  const auth = req.headers.get('authorization')
  if (!auth?.startsWith('Bearer ')) return null
  try {
    const res = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${FIREBASE_API_KEY}`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ idToken: auth.slice(7) }) }
    )
    if (!res.ok) return null
    const data = await res.json()
    const u = data.users?.[0]
    return u ? { uid: u.localId, email: u.email || null } : null
  } catch { return null }
}

// Deterministic membership id so security rules can look up "is this user a
// worker of this business" directly (businessId === ownerUid).
export function membershipId(bizUid, memberUid) {
  return `${bizUid}_${memberUid}`
}

// Lazily create the businesses/{ownerUid} doc (businessId === ownerUid) from the
// owner's user profile. Called before the first invite. Idempotent.
export async function ensureBusiness(ownerUid) {
  const existing = await getDocument('businesses', ownerUid)
  if (existing?.data) return existing.data
  const u = await getDocument('users', ownerUid)
  const d = u?.data || {}
  const biz = {
    ownerUid,
    name:      d.businessName || d.displayName || d.name || 'My Business',
    slug:      d.publicSlug || null,
    seatCount: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
  await setDocument('businesses', ownerUid, biz)
  return biz
}
