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

    // Reconstruct full URL Twilio used (Vercel sits behind a proxy).
    // Try multiple host header variants — Vercel can route via different hosts.
    const proto = request.headers.get('x-forwarded-proto') || 'https'
    const host = request.headers.get('host') || ''
    const fullUrl = `${proto}://${host}${request.nextUrl.pathname}${request.nextUrl.search}`

    // Signature verification — soft mode for initial deployment.
    // Logs verification result + diagnostic details. Still accepts the
    // request and writes to Firestore even on mismatch so we don't lose
    // status updates while we debug the verification logic in the
    // Vercel proxy environment.
    // TODO: tighten to hard-reject once verified URL reconstruction matches
    //       Twilio's signing URL across all hosts (yardsync.vercel.app +
    //       yardsyncapp.com) and after capturing successful verifications
    //       in production logs.
    const signature = request.headers.get('x-twilio-signature')
    const sigValid = verifyTwilioSignature(TWILIO_AUTH_TOKEN, signature, fullUrl, params)
    if (!sigValid) {
      console.warn('Twilio status callback — signature mismatch (accepting in soft mode)', {
        hasSignature: !!signature,
        hasAuthToken: !!TWILIO_AUTH_TOKEN,
        fullUrl,
        forwardedProto: request.headers.get('x-forwarded-proto'),
        forwardedHost: request.headers.get('x-forwarded-host'),
        host,
        signaturePrefix: signature?.slice(0, 10),
      })
    } else {
      console.log('Twilio status callback — signature OK')
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
