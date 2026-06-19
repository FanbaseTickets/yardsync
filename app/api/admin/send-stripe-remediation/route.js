/**
 * POST /api/admin/send-stripe-remediation
 *
 * Admin-only. Generates a Stripe-hosted remediation AccountLink for a
 * specific contractor and notifies them via SMS + email so they can
 * complete outstanding KYC requirements (SSN, DOB, bank account, etc.).
 *
 * Auth: Bearer <Firebase ID token> of the admin user.
 * Body: { contractorUid }
 *
 * Used by the admin dashboard's "Contractors needing Stripe info" widget.
 */

import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { getDocument } from '@/lib/firestoreRest'
import { getBaseUrl } from '@/lib/baseUrl'
import { sendClientEmail } from '@/lib/email'
import { requirementsSummary } from '@/lib/stripeRequirementLabels'

const stripe   = new Stripe(process.env.STRIPE_SECRET_KEY)
const API_KEY  = process.env.FIREBASE_API_KEY || process.env.NEXT_PUBLIC_FIREBASE_API_KEY

async function verifyAdmin(request) {
  const auth = request.headers.get('authorization')
  if (!auth?.startsWith('Bearer ')) return false
  const idToken = auth.slice(7)
  try {
    const res = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken }),
      }
    )
    if (!res.ok) return false
    const data = await res.json()
    return data.users?.[0]?.email === process.env.ADMIN_EMAIL
  } catch {
    return false
  }
}

async function sendSmsViaTwilio(toPhone, body) {
  const TWILIO_SID     = process.env.TWILIO_ACCOUNT_SID
  const TWILIO_TOKEN   = process.env.TWILIO_AUTH_TOKEN
  const TWILIO_MSG_SVC = process.env.TWILIO_MESSAGING_SERVICE_SID
  if (!TWILIO_SID || !TWILIO_TOKEN || !TWILIO_MSG_SVC) return { sent: false, reason: 'twilio_not_configured' }
  if (!toPhone) return { sent: false, reason: 'no_phone' }

  const digits = toPhone.replace(/\D/g, '')
  if (digits.length < 10) return { sent: false, reason: 'invalid_phone' }
  const to = digits.startsWith('1') ? `+${digits}` : `+1${digits}`

  const params = new URLSearchParams({
    To:                  to,
    MessagingServiceSid: TWILIO_MSG_SVC,
    Body:                body,
  })
  const res = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}/Messages.json`,
    {
      method: 'POST',
      headers: {
        'Content-Type':  'application/x-www-form-urlencoded',
        'Authorization': 'Basic ' + Buffer.from(`${TWILIO_SID}:${TWILIO_TOKEN}`).toString('base64'),
      },
      body: params.toString(),
    }
  )
  const data = await res.json()
  if (data.error_code) return { sent: false, reason: data.message }
  return { sent: true, sid: data.sid }
}

export async function POST(request) {
  if (!(await verifyAdmin(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { contractorUid } = await request.json()
    if (!contractorUid) {
      return NextResponse.json({ error: 'Missing contractorUid' }, { status: 400 })
    }

    const userDoc = await getDocument('users', contractorUid)
    if (!userDoc?.data) {
      return NextResponse.json({ error: 'Contractor not found' }, { status: 404 })
    }
    if (!userDoc.data.stripeAccountId) {
      return NextResponse.json({ error: 'Contractor has no Stripe Connect account' }, { status: 400 })
    }

    // Generate the AccountLink
    const baseUrl = getBaseUrl(request)
    const accountLink = await stripe.accountLinks.create({
      account:     userDoc.data.stripeAccountId,
      type:        'account_update',
      refresh_url: `${baseUrl}/settings?stripe_refresh=1`,
      return_url:  `${baseUrl}/settings?stripe_return=1`,
    })

    const remediationUrl = accountLink.url
    const contractorName = userDoc.data.name || 'there'
    const reqsSummary    = requirementsSummary(userDoc.data.stripeRequirementsCurrentlyDue || [], 'en')
    const reqsBlurb      = reqsSummary ? ` (${reqsSummary})` : ''

    // SMS — short and direct
    const smsResult = await sendSmsViaTwilio(
      userDoc.data.phone,
      `Hi ${contractorName}! Stripe needs a little more info to keep your YardSync payouts flowing${reqsBlurb}. Complete here: ${remediationUrl}\nReply STOP to opt out. – YardSync`
    )

    // Email — friendlier, with branded button
    let emailSent = false
    try {
      const fromEmail = process.env.SENDGRID_FROM_EMAIL
      if (userDoc.data.email && fromEmail) {
        await sendClientEmail({
          to:       userDoc.data.email,
          subject:  'YardSync — Stripe needs a little more info',
          fromName: 'YardSync',
          text: `Hi ${contractorName},\n\nStripe needs a bit more information before your YardSync payouts can continue.${reqsSummary ? `\n\nWhat they need: ${reqsSummary}.` : ''}\n\nComplete the form here: ${remediationUrl}\n\nThe link is good for about 5 minutes — if it expires, just ask us to send a fresh one.\n\nThanks,\nThe YardSync Team`,
          html: `
            <div style="font-family:-apple-system,sans-serif;max-width:560px;margin:0 auto;padding:24px;background:#f8faf9;">
              <div style="background:#0F6E56;color:#fff;padding:20px 24px;border-radius:12px 12px 0 0;">
                <h1 style="margin:0;font-size:20px;font-weight:700;">Stripe needs a little more info</h1>
                <p style="margin:6px 0 0;opacity:.9;font-size:13px;">Quick step to keep your payouts flowing</p>
              </div>
              <div style="background:#fff;padding:24px;border-radius:0 0 12px 12px;border:1px solid #e4e9e5;border-top:none;">
                <p style="margin:0 0 12px;font-size:15px;color:#1a2420;">Hi <strong>${contractorName}</strong>,</p>
                <p style="margin:0 0 16px;font-size:14px;color:#5a6b60;">Stripe needs a bit more information before your YardSync payouts can continue.</p>
                ${reqsSummary ? `<p style="margin:0 0 16px;font-size:14px;color:#5a6b60;"><strong>What they need:</strong> ${reqsSummary}.</p>` : ''}
                <a href="${remediationUrl}" style="display:inline-block;margin:8px 0 16px;background:#0F6E56;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px;">Complete on Stripe →</a>
                <p style="margin:0;font-size:12px;color:#8aaa96;">The link is good for about 5 minutes — if it expires, ask us to send a fresh one.</p>
                <p style="margin:16px 0 0;font-size:13px;color:#8aaa96;">— The YardSync Team</p>
              </div>
            </div>
          `,
        })
        emailSent = true
      }
    } catch (emailErr) {
      console.error('Stripe remediation email failed (non-fatal):', emailErr.message)
    }

    return NextResponse.json({
      ok: true,
      url: remediationUrl,
      smsSent:   smsResult.sent,
      smsReason: smsResult.sent ? null : smsResult.reason,
      emailSent,
    })
  } catch (err) {
    console.error('send-stripe-remediation error:', err)
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 })
  }
}
