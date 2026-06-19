import { NextResponse } from 'next/server'
import { getDocument, setDocument } from '@/lib/firestoreRest'
import { getBaseUrl } from '@/lib/baseUrl'

const TWILIO_SID     = process.env.TWILIO_ACCOUNT_SID
const TWILIO_TOKEN   = process.env.TWILIO_AUTH_TOKEN
const TWILIO_MSG_SVC = process.env.TWILIO_MESSAGING_SERVICE_SID

export async function POST(request) {
  try {
    const { scheduleId, clientId, clientPhone, message, language, gardenerUid } = await request.json()

    if (!TWILIO_SID || !TWILIO_TOKEN || !TWILIO_MSG_SVC) {
      return NextResponse.json(
        { error: 'Twilio credentials not configured' },
        { status: 500 }
      )
    }

    // ── STEP 1: Normalize phone from request body — no Firestore lookup needed
    if (!clientPhone) {
      return NextResponse.json(
        { error: 'Client has no phone number on file' },
        { status: 400 }
      )
    }

    const digits = clientPhone.replace(/\D/g, '')
    if (digits.length < 10) {
      return NextResponse.json({ error: 'Invalid phone number — must be 10 digits' }, { status: 400 })
    }
    const to = digits.startsWith('1') ? `+${digits}` : `+1${digits}`

    // Resolve the deployment's actual base URL from the inbound request so
    // SMS sent from Preview embed Preview URLs (calendar link + status
    // callback) instead of always hard-pointing at production. Crons that
    // call lib/sms.js continue to fall back to NEXT_PUBLIC_APP_URL because
    // they have no request context.
    const baseUrl = getBaseUrl(request)

    // ── STEP 2: Append calendar link if this is a scheduled visit ──────────
    let finalMessage = message
    console.log('SMS route — scheduleId:', scheduleId, 'clientId:', clientId, 'language:', language)
    if (scheduleId && clientId) {
      const calUrl = `${baseUrl}/api/ical/${clientId}?scheduleId=${scheduleId}`
      const calLabel = language === 'es' ? 'Agregar al calendario' : 'Add to calendar'
      finalMessage += `\n📅 ${calLabel}: ${calUrl}`
      console.log('SMS route — calendar link appended:', calUrl)
    } else {
      console.log('SMS route — calendar link SKIPPED (missing scheduleId or clientId)')
    }

    // ── STEP 2.5: A2P compliance — enforce STOP opt-out language ─────────────
    // Pre-migration contractors have customized `smsTemplate` fields without
    // STOP language. Rather than modify their stored templates (intrusive),
    // we append the opt-out line at send time if the message body doesn't
    // already include a recognized STOP phrase. This guarantees every
    // outbound SMS is A2P 10DLC compliant regardless of which template
    // generated it.
    const hasOptOut = /\bSTOP\s+to\s+opt\s+out\b/i.test(finalMessage) || /\bSTOP\s+para\s+cancelar\b/i.test(finalMessage)
    if (!hasOptOut) {
      const stopLine = language === 'es'
        ? '\nResponda STOP para cancelar. – YardSync'
        : '\nReply STOP to opt out. – YardSync'
      finalMessage += stopLine
      console.log('SMS route — appended STOP language (template was missing it)')
    }

    // ── STEP 3: Send SMS via Twilio REST API ─────────────────────────────────
    // Use MessagingServiceSid (not From) so Twilio routes through the A2P-registered
    // Messaging Service for 10DLC sender pool + compliance reporting.
    //
    // StatusCallback URL tells Twilio to POST delivery updates to our status-callback
    // route so we can record real delivery status (queued/sent/delivered/undelivered/failed)
    // in Firestore — instead of the toast lying based on Twilio API 2xx. Uses baseUrl
    // resolved above so Preview-side sends get Preview-side delivery updates.
    const cbParams = new URLSearchParams({ ctx: 'twilio_send' })
    if (scheduleId) cbParams.set('scheduleId', scheduleId)
    if (clientId)   cbParams.set('clientId', clientId)
    const statusCallback = `${baseUrl}/api/twilio/status-callback?${cbParams.toString()}`

    const body = new URLSearchParams({
      To:                   to,
      MessagingServiceSid:  TWILIO_MSG_SVC,
      Body:                 finalMessage,
      StatusCallback:       statusCallback,
    })

    const twilioRes = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}/Messages.json`,
      {
        method:  'POST',
        headers: {
          'Content-Type':  'application/x-www-form-urlencoded',
          'Authorization': 'Basic ' + Buffer.from(`${TWILIO_SID}:${TWILIO_TOKEN}`).toString('base64'),
        },
        body: body.toString(),
      }
    )

    const twilioData = await twilioRes.json()

    if (twilioData.status === 'failed' || twilioData.error_code) {
      console.error('Twilio error:', twilioData)
      throw new Error(twilioData.message || 'Twilio send failed')
    }

    const messageSid = twilioData.sid || twilioData.message_sid || null
    console.log('SMS sent — SID:', messageSid, 'status:', twilioData.status)

    // ── STEP 4: Increment the contractor's lifetime SMS-sent counter ─────────
    // Non-atomic read-modify-write — race risk is negligible for SMS sends
    // because (a) sends are user-initiated one at a time and (b) the counter
    // has no functional dependency, it's just a display number on the
    // dashboard and /sms page. Don't fail the send if the counter write
    // fails — the SMS already went out.
    if (gardenerUid) {
      try {
        const userDoc = await getDocument('users', gardenerUid)
        const current = userDoc?.data?.smsSentTotal || 0
        await setDocument('users', gardenerUid, {
          smsSentTotal: current + 1,
          lastSmsAt:    new Date().toISOString(),
        })
      } catch (counterErr) {
        console.error('smsSentTotal increment failed (non-fatal):', counterErr.message)
      }
    }

    return NextResponse.json({
      success: true,
      sid:     messageSid,
    })

  } catch (error) {
    console.error('Twilio route failed:', error)
    return NextResponse.json(
      { error: error.message || 'SMS failed' },
      { status: 500 }
    )
  }
}