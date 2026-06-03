import { NextResponse } from 'next/server'
import crypto from 'crypto'
import { setDocument } from '@/lib/firestoreRest'

/**
 * Twilio Status Callback receiver.
 *
 * Twilio POSTs here multiple times per outbound message as it transitions:
 *   queued → sending → sent → delivered    (success)
 *   queued → undelivered                   (carrier rejected — phone-side filter, bad number, etc.)
 *   queued → failed                        (Twilio internal error)
 *
 * Each call carries MessageSid, MessageStatus, ErrorCode, To, From,
 * MessagingServiceSid, etc. We verify the X-Twilio-Signature against
 * TWILIO_AUTH_TOKEN, then upsert smsStatus/{MessageSid} with the latest
 * snapshot.
 *
 * The sender passes context via the StatusCallback URL query string:
 *   ?ctx=cron_reminder&scheduleId=xxx&clientId=yyy
 * so the callback can record what business event the SMS was for.
 *
 * Returns 200 with empty body (what Twilio expects). Twilio retries on
 * non-2xx, so we accept-and-log internal errors rather than 5xx.
 */

export const runtime = 'nodejs'

const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN

function verifyTwilioSignature(authToken, signature, fullUrl, params) {
  if (!authToken || !signature) return false
  const sortedKeys = Object.keys(params).sort()
  const concat = fullUrl + sortedKeys.map(k => k + params[k]).join('')
  const expected = crypto.createHmac('sha1', authToken).update(concat).digest('base64')
  return expected === signature
}

export async function POST(request) {
  try {
    const rawBody = await request.text()
    const params = Object.fromEntries(new URLSearchParams(rawBody))

    // Reconstruct full URL Twilio used (Vercel sits behind a proxy)
    const proto = request.headers.get('x-forwarded-proto') || 'https'
    const host = request.headers.get('host') || ''
    const fullUrl = `${proto}://${host}${request.nextUrl.pathname}${request.nextUrl.search}`

    // Verify signature — if it fails, reject loudly
    const signature = request.headers.get('x-twilio-signature')
    const valid = verifyTwilioSignature(TWILIO_AUTH_TOKEN, signature, fullUrl, params)
    if (!valid) {
      console.error('Twilio status callback — signature verify failed', {
        hasSignature: !!signature,
        hasAuthToken: !!TWILIO_AUTH_TOKEN,
        urlPrefix: fullUrl.slice(0, 80),
      })
      return new NextResponse('Invalid signature', { status: 403 })
    }

    const messageSid = params.MessageSid
    if (!messageSid) {
      console.error('Twilio status callback — no MessageSid in body')
      return new NextResponse('No MessageSid', { status: 400 })
    }

    // Caller-supplied context from query string
    const ctx        = request.nextUrl.searchParams.get('ctx')        || 'unknown'
    const scheduleId = request.nextUrl.searchParams.get('scheduleId') || null
    const clientId   = request.nextUrl.searchParams.get('clientId')   || null
    const invoiceId  = request.nextUrl.searchParams.get('invoiceId')  || null
    const gardenerUid = request.nextUrl.searchParams.get('gardenerUid') || null

    const status = params.MessageStatus || params.SmsStatus || 'unknown'
    const errorCode = params.ErrorCode || null

    const update = {
      messageSid,
      status,
      errorCode,
      errorMessage: params.ErrorMessage || null,
      to: params.To || null,
      from: params.From || null,
      messagingServiceSid: params.MessagingServiceSid || null,
      context: ctx,
      scheduleId,
      clientId,
      invoiceId,
      gardenerUid,
      updatedAt: new Date().toISOString(),
    }

    console.log('Twilio status callback:', {
      sid: messageSid,
      status,
      ctx,
      errorCode,
      to: update.to,
    })

    try {
      await setDocument('smsStatus', messageSid, update)
    } catch (writeErr) {
      // Don't 5xx — Twilio would retry and we'd compound the problem
      console.error('Twilio status callback — Firestore write failed (non-fatal):', writeErr.message)
    }

    return new NextResponse('', { status: 200 })
  } catch (err) {
    console.error('Twilio status callback — handler threw:', err.message)
    // Accept anyway; Twilio retries on 5xx, but internal bugs shouldn't trigger retries
    return new NextResponse('', { status: 200 })
  }
}
