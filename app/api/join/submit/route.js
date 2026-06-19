/**
 * POST /api/join/submit — intake lead capture
 *
 * Public, unauthenticated. Called by the /join/[slug] IntakeForm
 * (JSON body) and falls back to native HTML form posts (form-encoded
 * body) for no-JS clients.
 *
 * Behavior order (matches docs/SMART_BUSINESS_CARD_SPEC.md §2.2):
 *   1. Honeypot — if `website_url` is non-empty, return 200 with no
 *      side-effects (silent drop; bot thinks it worked).
 *   2. Resolve slug → owner uid. Unresolvable → 404.
 *   3. Rate limit — read rateLimits/{slug}; reject if >10/hour.
 *   4. Validate name + phone (E.164 normalize). Field-level errors.
 *   5. Duplicate check — query owner's clients by phone, flag (don't block).
 *   6. Write clients/{id} with intake fields.
 *   7. SMS the contractor on their already-opted-in phone (no STOP).
 *   8. If smsConsent → SMS the client (with STOP).
 *
 * No Firebase client SDK — all Firestore work goes through firestoreRest.
 */

import { NextResponse } from 'next/server'
import crypto from 'crypto'
import {
  getDocument,
  setDocument,
  createDocument,
  listCollection,
} from '@/lib/firestoreRest'
import { sendSms } from '@/lib/sms'
import { getBaseUrl } from '@/lib/baseUrl'

const RATE_LIMIT_WINDOW_MS  = 60 * 60 * 1000 // 1 hour
const RATE_LIMIT_CAP        = 10              // max submissions per slug per window

// ── Body parsing — accepts JSON or form-encoded ─────────────────────────
async function parseBody(request) {
  const contentType = (request.headers.get('content-type') || '').toLowerCase()
  if (contentType.includes('application/json')) {
    return { body: await request.json(), isFormPost: false }
  }
  // Form-encoded (no-JS fallback) or multipart
  const fd = await request.formData()
  const body = {}
  for (const [k, v] of fd.entries()) body[k] = typeof v === 'string' ? v : ''
  // HTML checkbox sends "on" when checked, omits when unchecked
  body.smsConsent = body.smsConsent === 'on' || body.smsConsent === 'true' || body.smsConsent === true
  return { body, isFormPost: true }
}

// ── Phone normalization — mirrors PhoneInput + IntakeForm ──────────────
function normalizePhone(raw) {
  if (typeof raw !== 'string') return null
  const digits = raw.replace(/\D/g, '')
  const local = digits.length === 11 && digits.startsWith('1') ? digits.slice(1) : digits
  if (local.length !== 10) return null
  return `+1${local}`
}

function isValidEmail(email) {
  if (!email) return true
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

function sha256(input) {
  return crypto.createHash('sha256').update(String(input || '')).digest('hex')
}

// ── Rate limit (per slug, 1h window) ────────────────────────────────────
// Read-modify-write — not transactional but acceptable for spam control.
// Under racy concurrent submissions the counter may slightly undercount;
// fine for the threshold (10/hr is loose).
async function checkAndIncrementRateLimit(slug) {
  const now = Date.now()
  const doc = await getDocument('rateLimits', slug)
  const count       = doc?.data?.count || 0
  const windowStart = doc?.data?.windowStart ? new Date(doc.data.windowStart).getTime() : 0
  const windowAge   = now - windowStart

  if (windowAge < RATE_LIMIT_WINDOW_MS && count >= RATE_LIMIT_CAP) {
    return { allowed: false, retryAfterMs: RATE_LIMIT_WINDOW_MS - windowAge }
  }

  // Reset window if expired, else increment
  if (windowAge >= RATE_LIMIT_WINDOW_MS) {
    await setDocument('rateLimits', slug, {
      count:       1,
      windowStart: new Date(now).toISOString(),
    })
  } else {
    await setDocument('rateLimits', slug, {
      count:       count + 1,
      windowStart: new Date(windowStart).toISOString(),
    })
  }

  return { allowed: true }
}

// ── Form response helpers ──────────────────────────────────────────────
function jsonResponse(payload, status = 200) {
  return NextResponse.json(payload, { status })
}

/**
 * For no-JS submissions, redirect back to the /join page with a
 * `thanks=1` query param so the page can render a thank-you screen
 * server-side. The IntakeForm reads searchParams (passed by the page)
 * to switch into confirmation mode on first paint.
 */
function noJsRedirect(slug, baseUrl, key = 'thanks') {
  return NextResponse.redirect(`${baseUrl}/join/${slug}?${key}=1`, { status: 303 })
}

function noJsError(slug, baseUrl, code) {
  return NextResponse.redirect(`${baseUrl}/join/${slug}?error=${code}`, { status: 303 })
}

export async function POST(request) {
  const baseUrl = getBaseUrl(request)
  let isFormPost = false
  try {
    const parsed = await parseBody(request)
    isFormPost = parsed.isFormPost
    const body = parsed.body

    const slug = String(body.slug || '').trim()
    if (!slug) {
      return isFormPost
        ? NextResponse.redirect(`${baseUrl}/join`, { status: 303 })
        : jsonResponse({ error: 'Missing slug' }, 400)
    }

    // ── 1. Honeypot ────────────────────────────────────────────────────
    // If a bot filled the hidden website_url field, accept the submission
    // visually but do nothing. Don't 4xx — bots that detect honeypot
    // rejection iterate to defeat it.
    if (body.website_url && String(body.website_url).trim().length > 0) {
      console.log('[join/submit] honeypot tripped for slug=', slug)
      return isFormPost
        ? noJsRedirect(slug, baseUrl)
        : jsonResponse({ ok: true })
    }

    // ── 2. Resolve slug ────────────────────────────────────────────────
    const slugDoc = await getDocument('slugs', slug)
    if (!slugDoc?.data?.active || !slugDoc.data.ownerUid) {
      return isFormPost
        ? noJsError(slug, baseUrl, 'inactive')
        : jsonResponse({ error: 'Slug not active' }, 404)
    }
    const ownerUid = slugDoc.data.ownerUid

    // ── 3. Rate limit ──────────────────────────────────────────────────
    const rl = await checkAndIncrementRateLimit(slug)
    if (!rl.allowed) {
      return isFormPost
        ? noJsError(slug, baseUrl, 'rate_limited')
        : jsonResponse({ error: 'rate_limited' }, 429)
    }

    // ── 4. Validate ────────────────────────────────────────────────────
    const name = String(body.name || '').trim()
    if (!name) {
      return isFormPost
        ? noJsError(slug, baseUrl, 'name_required')
        : jsonResponse({ error: 'name_required' }, 400)
    }
    const phoneNormalized = normalizePhone(body.phone)
    if (!phoneNormalized) {
      return isFormPost
        ? noJsError(slug, baseUrl, 'phone_invalid')
        : jsonResponse({ error: 'phone_invalid' }, 400)
    }
    const email = String(body.email || '').trim()
    if (email && !isValidEmail(email)) {
      return isFormPost
        ? noJsError(slug, baseUrl, 'email_invalid')
        : jsonResponse({ error: 'email_invalid' }, 400)
    }
    const address         = String(body.address || '').trim()
    const note            = String(body.note || '').trim()
    const serviceInterest = String(body.serviceInterest || '').trim()
    const language        = body.language === 'es' ? 'es' : 'en'
    const smsConsent      = body.smsConsent === true || body.smsConsent === 'true' || body.smsConsent === 'on'

    // ── 5. Duplicate check — non-blocking ─────────────────────────────
    let possibleDuplicateOf = null
    try {
      const matches = await listCollection('clients', {
        where: [
          { field: 'gardenerUid', op: 'EQUAL', value: ownerUid },
          { field: 'phone',       op: 'EQUAL', value: phoneNormalized },
        ],
        limit: 1,
      })
      if (matches.length > 0) {
        possibleDuplicateOf = matches[0].data?.name || matches[0].id
      }
    } catch (dupeErr) {
      // Non-fatal — duplicate-detection is a UX hint, not a correctness gate.
      console.error('[join/submit] duplicate check failed (non-fatal):', dupeErr.message)
    }

    // ── 6. Write the lead ──────────────────────────────────────────────
    const nowIso = new Date().toISOString()
    const ua    = request.headers.get('user-agent') || ''
    const ip    = (request.headers.get('x-forwarded-for') || '').split(',')[0].trim()
    const intakeMeta = {
      uaHash:      sha256(ua),
      ipHash:      sha256(ip),
      submittedAt: nowIso,
    }

    const clientDoc = {
      gardenerUid:        ownerUid,
      name,
      phone:              phoneNormalized,
      email:              email || null,
      address:            address || null,
      serviceInterest:    serviceInterest || null,
      note:               note || null,
      source:             'intake',
      leadStatus:         'new',
      leadSubmittedAt:    nowIso,
      language,
      intakeSmsConsent:   smsConsent,
      intakeSmsConsentAt: nowIso,
      intakeMeta,
      possibleDuplicateOf,
      createdAt:          nowIso,
      updatedAt:          nowIso,
    }

    let clientId
    try {
      clientId = await createDocument('clients', clientDoc)
    } catch (writeErr) {
      console.error('[join/submit] Firestore write failed:', writeErr.message)
      return isFormPost
        ? noJsError(slug, baseUrl, 'server_error')
        : jsonResponse({ error: 'server_error' }, 500)
    }

    // ── 7. Notify the contractor (their own already-opted-in phone) ────
    // No STOP line per A2P guidance (the SMS is to their own phone, not
    // a third-party). Fail-quietly: don't reject the request if Twilio
    // hiccups — the lead is already saved.
    try {
      const ownerDoc = await getDocument('users', ownerUid)
      const contractorPhone = ownerDoc?.data?.phone
      if (contractorPhone) {
        await sendSms({
          to:      contractorPhone,
          body:    `New YardSync lead: ${name} (${phoneNormalized}). Open YardSync to follow up: yardsyncapp.com/clients`,
          context: 'join_lead_to_contractor',
          refIds:  { gardenerUid: ownerUid, clientId },
        })
      }
    } catch (notifyErr) {
      console.error('[join/submit] contractor notify failed (non-fatal):', notifyErr.message)
    }

    // ── 8. Optional thank-you SMS to the client (gated by consent) ─────
    if (smsConsent) {
      try {
        const ownerDoc = await getDocument('users', ownerUid)
        const businessName = ownerDoc?.data?.businessName || 'YardSync'
        const body = language === 'es'
          ? `¡Hola ${name}! Gracias por su solicitud a ${businessName}. Pronto nos comunicaremos. Responda STOP para cancelar. – ${businessName}`
          : `Hi ${name}! Thanks for your request to ${businessName}. We'll be in touch soon. Reply STOP to opt out. – ${businessName}`
        await sendSms({
          to:      phoneNormalized,
          body,
          context: 'join_thanks_to_client',
          refIds:  { gardenerUid: ownerUid, clientId },
        })
      } catch (thanksErr) {
        console.error('[join/submit] thank-you SMS failed (non-fatal):', thanksErr.message)
      }
    }

    // ── Success ────────────────────────────────────────────────────────
    return isFormPost
      ? noJsRedirect(slug, baseUrl)
      : jsonResponse({ ok: true, clientId })
  } catch (err) {
    console.error('[join/submit] uncaught error:', err)
    return isFormPost
      ? NextResponse.redirect(`${baseUrl}/join?error=server`, { status: 303 })
      : jsonResponse({ error: 'server_error' }, 500)
  }
}
