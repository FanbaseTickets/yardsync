import { NextResponse } from 'next/server'

const TWILIO_SID    = process.env.TWILIO_ACCOUNT_SID
const TWILIO_TOKEN  = process.env.TWILIO_AUTH_TOKEN
const TWILIO_FROM   = process.env.TWILIO_PHONE_NUMBER

export async function POST(request) {
  try {
    const { scheduleId, clientId, clientPhone, message, language } = await request.json()

    if (!TWILIO_SID || !TWILIO_TOKEN || !TWILIO_FROM) {
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

    // ── STEP 2: Append calendar link if this is a scheduled visit ──────────
    let finalMessage = message
    console.log('SMS route — scheduleId:', scheduleId, 'clientId:', clientId, 'language:', language)
    if (scheduleId && clientId) {
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://yardsync.vercel.app'
      const calUrl = `${appUrl}/api/ical/${clientId}?scheduleId=${scheduleId}`
      const calLabel = language === 'es' ? 'Agregar al calendario' : 'Add to calendar'
      finalMessage += `\n📅 ${calLabel}: ${calUrl}`
      console.log('SMS route — calendar link appended:', calUrl)
    } else {
      console.log('SMS route — calendar link SKIPPED (missing scheduleId or clientId)')
    }

    // ── STEP 3: Send SMS via Twilio REST API ─────────────────────────────────
    const body = new URLSearchParams({
      To:   to,
      From: TWILIO_FROM,
      Body: finalMessage,
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