import { NextResponse } from 'next/server'
import { getClient, updateSchedule } from '@/lib/db'

const TWILIO_SID    = process.env.TWILIO_ACCOUNT_SID
const TWILIO_TOKEN  = process.env.TWILIO_AUTH_TOKEN
const TWILIO_FROM   = process.env.TWILIO_PHONE_NUMBER

export async function POST(request) {
  try {
    const { scheduleId, clientId, message } = await request.json()

    if (!TWILIO_SID || !TWILIO_TOKEN || !TWILIO_FROM) {
      return NextResponse.json(
        { error: 'Twilio credentials not configured' },
        { status: 500 }
      )
    }

    // ── STEP 1: Get client phone number ─────────────────────────────────────
    const client = await getClient(clientId)

    if (!client?.phone) {
      return NextResponse.json(
        { error: 'Client has no phone number on file' },
        { status: 400 }
      )
    }

    // Normalize phone — strip non-digits and ensure +1 prefix
    const digits = client.phone.replace(/\D/g, '')
    const to = digits.startsWith('1') ? `+${digits}` : `+1${digits}`

    console.log(`YardSync → Twilio SMS: ${to}`)
    console.log(`Message: ${message}`)

    // ── STEP 2: Send SMS via Twilio REST API ─────────────────────────────────
    const body = new URLSearchParams({
      To:   to,
      From: TWILIO_FROM,
      Body: message,
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

    console.log('SMS sent — SID:', twilioData.sid)

    // ── STEP 3: Mark schedule as smsSent in Firestore ────────────────────────
    if (scheduleId) {
      await updateSchedule(scheduleId, {
        smsSent:      true,
        smsSentAt:    new Date().toISOString(),
        twilioSmsSid: twilioData.sid,
      })
    }

    return NextResponse.json({
      success: true,
      sid:     twilioData.sid,
    })

  } catch (error) {
    console.error('Twilio route failed:', error)
    return NextResponse.json(
      { error: error.message || 'SMS failed' },
      { status: 500 }
    )
  }
}