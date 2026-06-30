import { NextResponse } from 'next/server'
import { createDocument, getDocument, updateDocument, listCollection } from '@/lib/firestoreRest'
import { sendClientEmail } from '@/lib/email'
import { sendSms } from '@/lib/sms'
import { buildQuoteSms } from '@/lib/quoteSms'
import { getBaseUrl } from '@/lib/baseUrl'
import { grossUpForFees } from '@/lib/fee'

const FIREBASE_API_KEY = process.env.FIREBASE_API_KEY || process.env.NEXT_PUBLIC_FIREBASE_API_KEY
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// Verify the caller's Firebase ID token and return their uid, or null. Same
// pattern as the invoice route: this is the only thing stopping a caller from
// creating quotes that route to someone else's account.
async function verifyCallerUid(req) {
  const auth = req.headers.get('authorization')
  if (!auth?.startsWith('Bearer ')) return null
  try {
    const res = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${FIREBASE_API_KEY}`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ idToken: auth.slice(7) }) }
    )
    if (!res.ok) return null
    const data = await res.json()
    return data.users?.[0]?.localId || null
  } catch { return null }
}

function buildQuoteEmail({ recipientName, totalCents, quoteUrl, contractorName, validUntilLabel, lang }) {
  const amount = `$${(totalCents / 100).toFixed(2)}`
  const name = recipientName || (lang === 'es' ? 'Cliente' : 'Client')
  const from = contractorName || 'YardSync'
  if (lang === 'es') {
    return {
      subject: `Cotización de ${from} — ${amount}`,
      text: `Hola ${name},\n\n${from} te envió una cotización de ${amount}.\n\nRevísala y acéptala aquí: ${quoteUrl}\n\nVálida hasta ${validUntilLabel}.\n\nGracias,\n${from} vía YardSync`,
      html: `
        <div style="font-family: system-ui, -apple-system, sans-serif; max-width: 520px; margin: 0 auto; color: #111;">
          <h2 style="color: #0E7C66; margin: 0 0 16px;">${from}</h2>
          <p>Hola ${name},</p>
          <p>${from} te envió una cotización de <strong>${amount}</strong>.</p>
          <p style="margin: 24px 0;">
            <a href="${quoteUrl}" style="background: #0E7C66; color: #fff; padding: 12px 20px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: 600;">Ver y aceptar</a>
          </p>
          <p style="color: #666; font-size: 12px;">Válida hasta ${validUntilLabel}. O copia este enlace: ${quoteUrl}</p>
          <p style="color: #666; font-size: 12px; margin-top: 32px;">${from} vía YardSync</p>
        </div>`,
    }
  }
  return {
    subject: `Quote from ${from} — ${amount}`,
    text: `Hi ${name},\n\n${from} sent you a quote for ${amount}.\n\nReview and accept it here: ${quoteUrl}\n\nValid until ${validUntilLabel}.\n\nThanks,\n${from} via YardSync`,
    html: `
      <div style="font-family: system-ui, -apple-system, sans-serif; max-width: 520px; margin: 0 auto; color: #111;">
        <h2 style="color: #0E7C66; margin: 0 0 16px;">${from}</h2>
        <p>Hi ${name},</p>
        <p>${from} sent you a quote for <strong>${amount}</strong>.</p>
        <p style="margin: 24px 0;">
          <a href="${quoteUrl}" style="background: #0E7C66; color: #fff; padding: 12px 20px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: 600;">View &amp; accept</a>
        </p>
        <p style="color: #666; font-size: 12px;">Valid until ${validUntilLabel}. Or copy this link: ${quoteUrl}</p>
        <p style="color: #666; font-size: 12px; margin-top: 32px;">${from} via YardSync</p>
      </div>`,
  }
}

// GET /api/quotes — list the authed contractor's quotes (newest first).
export async function GET(req) {
  const callerUid = await verifyCallerUid(req)
  if (!callerUid) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const rows = await listCollection('quotes', { where: [{ field: 'gardenerUid', value: callerUid }] })
    const quotes = rows
      .map(r => ({ id: r.id, ...r.data }))
      .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')))
    return NextResponse.json({ quotes })
  } catch (err) {
    console.error('[quotes] list failed:', err.message)
    return NextResponse.json({ error: 'Could not load quotes' }, { status: 500 })
  }
}

// POST /api/quotes — create + send a quote.
export async function POST(req) {
  try {
    const {
      gardenerUid,
      clientId,
      prospect,
      title,
      lineItems,
      coverFees,
      validUntilDays,
      channels,
      contractorName,
      contractorEmail,
      lang,
    } = await req.json()

    const callerUid = await verifyCallerUid(req)
    if (!callerUid) return NextResponse.json({ error: 'Unauthorized', code: 'unauthorized' }, { status: 401 })
    if (!gardenerUid || callerUid !== gardenerUid) {
      return NextResponse.json({ error: 'Forbidden', code: 'forbidden' }, { status: 403 })
    }

    // Recipient: an existing client (load the doc) or a new prospect (inline).
    let recipient = null
    if (clientId) {
      const cd = await getDocument('clients', clientId)
      if (!cd?.data) return NextResponse.json({ error: 'Client not found', code: 'no_client' }, { status: 404 })
      recipient = {
        name:     cd.data.name || '',
        phone:    cd.data.phone || '',
        email:    cd.data.email || '',
        address:  cd.data.address || '',
        language: cd.data.language === 'es' ? 'es' : 'en',
      }
    } else if (prospect && prospect.name && (prospect.phone || prospect.email)) {
      recipient = {
        name:     String(prospect.name).trim().slice(0, 80),
        phone:    prospect.phone || '',
        email:    prospect.email || '',
        address:  prospect.address || '',
        language: prospect.language === 'es' ? 'es' : 'en',
      }
    } else {
      return NextResponse.json({ error: 'Pick a client or enter a prospect (name + phone or email)', code: 'no_recipient' }, { status: 400 })
    }
    if (recipient.email && !EMAIL_RE.test(recipient.email)) {
      return NextResponse.json({ error: 'Invalid recipient email', code: 'bad_email' }, { status: 400 })
    }

    // Line items + total. coverFees grosses up so the displayed total is
    // fee-inclusive, consistent with invoices.
    const items = Array.isArray(lineItems)
      ? lineItems
          .map(it => ({ label: String(it?.label || '').slice(0, 120), category: it?.category || 'service', amountCents: Number.isFinite(it?.amountCents) ? Math.round(it.amountCents) : 0 }))
          .filter(it => it.amountCents > 0)
      : []
    if (items.length === 0) return NextResponse.json({ error: 'Add at least one line item', code: 'no_items' }, { status: 400 })
    const subtotalCents = items.reduce((s, it) => s + it.amountCents, 0)
    if (subtotalCents < 50) return NextResponse.json({ error: 'Quote total must be at least $0.50', code: 'bad_total' }, { status: 400 })
    const totalCents = coverFees === true ? grossUpForFees(subtotalCents) : subtotalCents

    const language = recipient.language
    const days     = Number.isInteger(validUntilDays) && validUntilDays > 0 && validUntilDays <= 365 ? validUntilDays : 30
    const validUntil = new Date(Date.now() + days * 86400000).toISOString()
    const ch = channels === 'sms' || channels === 'email' ? channels : 'both'

    const nowIso = new Date().toISOString()
    const quoteId = await createDocument('quotes', {
      gardenerUid,
      clientId:        clientId || null,
      prospect:        clientId ? null : recipient,
      recipientName:   recipient.name,
      recipientPhone:  recipient.phone || '',
      recipientEmail:  recipient.email || '',
      title:           String(title || '').slice(0, 120) || (language === 'es' ? 'Cotización' : 'Quote'),
      lineItems:       items,
      subtotalCents,
      coverFees:       coverFees === true,
      totalCents,
      deposit:         null,        // Phase 3
      validUntil,
      status:          'sent',
      signature:       null,
      depositPaid:     false,
      channels:        ch,
      language,
      sentAt:          nowIso,
      viewedAt:        null,
      acceptedAt:      null,
      declinedAt:      null,
      convertedAt:     null,
      convertedClientId: null,
      createdAt:       nowIso,
      updatedAt:       nowIso,
    })

    const quoteUrl = `${getBaseUrl(req)}/quote/${quoteId}`
    const validUntilLabel = new Date(validUntil).toLocaleDateString(language === 'es' ? 'es-US' : 'en-US', { month: 'short', day: 'numeric', year: 'numeric' })

    // Send. Non-fatal: a send failure never loses the quote (it's already saved
    // and visible/resend-able in the contractor's Quotes list).
    let smsResult = { skipped: true }, emailNotified = false
    if ((ch === 'sms' || ch === 'both') && recipient.phone) {
      smsResult = await sendSms({
        to:   recipient.phone,
        body: buildQuoteSms({ contractor: { businessName: contractorName }, recipientName: recipient.name, totalCents, quoteUrl, lang: language }),
        context: 'quote',
        refIds: { gardenerUid, quoteId },
      })
    }
    if ((ch === 'email' || ch === 'both') && recipient.email) {
      const tmpl = buildQuoteEmail({ recipientName: recipient.name, totalCents, quoteUrl, contractorName, validUntilLabel, lang: language })
      await sendClientEmail({ to: recipient.email, subject: tmpl.subject, html: tmpl.html, text: tmpl.text, replyTo: contractorEmail || undefined, fromName: contractorName || 'YardSync' })
      emailNotified = true
    }

    return NextResponse.json({ quoteId, quoteUrl, totalCents, validUntil, emailNotified, smsOk: !!smsResult.ok, smsSkipped: !!smsResult.skipped })
  } catch (err) {
    console.error('[quotes] create failed:', err.message)
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 })
  }
}
