/**
 * Firestore REST API with Firebase Auth
 *
 * Signs in as admin via Firebase Auth REST API to get an ID token,
 * then uses that token for authenticated Firestore REST calls.
 * Token is cached in memory and refreshed when expired.
 */

const PROJECT_ID = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
const API_KEY    = process.env.FIREBASE_API_KEY || process.env.NEXT_PUBLIC_FIREBASE_API_KEY
const BASE_URL   = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`

let cachedToken = null
let tokenExpiry = 0

async function getAuthToken() {
  // Return cached token if still valid (with 60s buffer)
  if (cachedToken && Date.now() < tokenExpiry - 60000) {
    return cachedToken
  }

  const email    = process.env.FIREBASE_ADMIN_EMAIL || 'admin@fanbasetickets.net'
  const password = process.env.FIREBASE_ADMIN_PASSWORD

  if (!password) {
    console.error('FIREBASE_ADMIN_PASSWORD not set — Firestore REST calls will fail')
    return null
  }

  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        password,
        returnSecureToken: true,
      }),
    }
  )

  if (!res.ok) {
    const err = await res.text()
    console.error('Firebase Auth sign-in failed:', err)
    return null
  }

  const data = await res.json()
  cachedToken = data.idToken
  // expiresIn is in seconds, typically 3600
  tokenExpiry = Date.now() + (parseInt(data.expiresIn || '3600') * 1000)
  return cachedToken
}

function authHeaders(token) {
  const headers = { 'Content-Type': 'application/json' }
  if (token) headers['Authorization'] = `Bearer ${token}`
  return headers
}

// ── Value converters ──────────────────────────────────────────

export function toFirestoreValue(val) {
  if (val === null || val === undefined) return { nullValue: null }
  if (typeof val === 'string')  return { stringValue: val }
  if (typeof val === 'boolean') return { booleanValue: val }
  if (typeof val === 'number')  return Number.isInteger(val)
    ? { integerValue: String(val) }
    : { doubleValue: val }
  if (Array.isArray(val)) return {
    arrayValue: { values: val.map(toFirestoreValue) }
  }
  if (typeof val === 'object') return {
    mapValue: {
      fields: Object.fromEntries(
        Object.entries(val).map(([k, v]) => [k, toFirestoreValue(v)])
      )
    }
  }
  return { stringValue: String(val) }
}

// Decode a single Firestore REST value, recursing into arrays + maps so that
// array-of-objects fields (e.g. pushSubscriptions, lineItems) come back as real
// JS arrays/objects instead of raw { arrayValue: … } wrappers.
function fromFirestoreValue(v) {
  if (!v || typeof v !== 'object') return v
  if ('stringValue'    in v) return v.stringValue
  if ('booleanValue'   in v) return v.booleanValue
  if ('integerValue'   in v) return Number(v.integerValue)
  if ('doubleValue'    in v) return v.doubleValue
  if ('timestampValue' in v) return v.timestampValue
  if ('nullValue'      in v) return null
  if ('arrayValue'     in v) return (v.arrayValue.values || []).map(fromFirestoreValue)
  if ('mapValue'       in v) return fromFirestoreFields(v.mapValue.fields || {})
  return v
}

export function fromFirestoreFields(fields) {
  const out = {}
  for (const [k, v] of Object.entries(fields)) out[k] = fromFirestoreValue(v)
  return out
}

// ── CRUD operations ───────────────────────────────────────────

export async function queryCollection(collectionId, fieldPath, value) {
  const token = await getAuthToken()
  const url = `${BASE_URL}:runQuery`
  const res = await fetch(url, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({
      structuredQuery: {
        from: [{ collectionId }],
        where: {
          fieldFilter: {
            field: { fieldPath },
            op: 'EQUAL',
            value: { stringValue: value }
          }
        },
        limit: 1
      }
    })
  })
  const data = await res.json()
  const doc = data[0]?.document
  if (!doc) return null
  const parts = doc.name.split('/')
  const id = parts[parts.length - 1]
  return { id, name: doc.name, data: fromFirestoreFields(doc.fields || {}) }
}

/**
 * List documents in a collection via Firestore REST runQuery.
 *
 * Options:
 *   where:   array of { field, op, value }. `op` defaults to 'EQUAL'.
 *            Multiple entries are AND-combined via compositeFilter.
 *   limit:   max docs to return (Firestore REST has its own cap — pass higher
 *            limits with care; cron usage stays under 100s of docs for now)
 *
 * Returns array of `{ id, name, data }` — same shape as queryCollection.
 *
 * Used by cron routes that need to read multiple users / clients / schedules
 * (the Firebase client SDK pattern they previously used had no auth context
 * and was silently rejected by Firestore rules).
 */
export async function listCollection(collectionId, options = {}) {
  const token = await getAuthToken()

  const structuredQuery = {
    from: [{ collectionId }],
  }

  if (Array.isArray(options.where) && options.where.length > 0) {
    const filters = options.where.map(w => ({
      fieldFilter: {
        field: { fieldPath: w.field },
        op:    w.op || 'EQUAL',
        value: toFirestoreValue(w.value),
      },
    }))
    structuredQuery.where = filters.length === 1
      ? filters[0]
      : { compositeFilter: { op: 'AND', filters } }
  }

  if (options.limit) {
    structuredQuery.limit = options.limit
  }

  const res = await fetch(`${BASE_URL}:runQuery`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({ structuredQuery }),
  })

  if (!res.ok) {
    const errText = await res.text()
    throw new Error(`Firestore runQuery ${collectionId} failed (${res.status}): ${errText}`)
  }

  const data = await res.json()
  if (!Array.isArray(data)) return []

  return data
    .filter(item => item.document)
    .map(item => {
      const doc = item.document
      const parts = doc.name.split('/')
      const id = parts[parts.length - 1]
      return { id, name: doc.name, data: fromFirestoreFields(doc.fields || {}) }
    })
}

export async function getDocument(collectionId, docId) {
  const token = await getAuthToken()
  const url = `${BASE_URL}/${collectionId}/${docId}`
  const res = await fetch(url, { headers: authHeaders(token) })
  if (!res.ok) return null
  const doc = await res.json()
  if (!doc.fields) return null
  return { id: docId, name: doc.name, data: fromFirestoreFields(doc.fields) }
}

export async function setDocument(collectionId, docId, fields) {
  const token = await getAuthToken()
  const fieldPaths = Object.keys(fields).map(k => `updateMask.fieldPaths=${k}`).join('&')
  const url = `${BASE_URL}/${collectionId}/${docId}?${fieldPaths}`

  const firestoreFields = {}
  for (const [key, value] of Object.entries(fields)) {
    firestoreFields[key] = toFirestoreValue(value)
  }

  const res = await fetch(url, {
    method: 'PATCH',
    headers: authHeaders(token),
    body: JSON.stringify({ fields: firestoreFields })
  })

  if (!res.ok) {
    const errText = await res.text()
    throw new Error(`Firestore PATCH ${collectionId}/${docId} failed (${res.status}): ${errText}`)
  }
}

export async function updateDocument(collectionId, docId, fields) {
  return setDocument(collectionId, docId, fields)
}

export async function createDocument(collectionId, fields) {
  const token = await getAuthToken()
  const firestoreFields = {}
  for (const [key, value] of Object.entries(fields)) {
    firestoreFields[key] = toFirestoreValue(value)
  }

  const res = await fetch(`${BASE_URL}/${collectionId}`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({ fields: firestoreFields }),
  })

  if (!res.ok) {
    const errText = await res.text()
    throw new Error(`Firestore POST ${collectionId} failed (${res.status}): ${errText}`)
  }

  const created = await res.json()
  const docId = created.name?.split('/').pop()
  return docId
}
