import { NextResponse } from 'next/server'
import { collection, getDocs, query, where } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { formatCents } from '@/lib/fee'

const TWILIO_SID   = process.env.TWILIO_ACCOUNT_SID
const TWILIO_TOKEN = process.env.TWILIO_AUTH_TOKEN
const TWILIO_FROM  = process.env.TWILIO_PHONE_NUMBER

export async function GET(request) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const now     = new Date()
    const quarter = Math.floor(now.getMonth() / 3)
    const qStart  = new Date(now.getFullYear(), quarter * 3, 1)
    const qEnd    = new Date(now.getFullYear(), quarter * 3 + 3, 0)
    const qLabel  = `Q${quarter + 1} ${now.getFullYear()}`

    const usersSnap    = await getDocs(query(collection(db, 'users'), where('subscriptionStatus', '==', 'active')))
    const invoicesSnap = await getDocs(collection(db, 'invoices'))
    const allInvoices  = invoicesSnap.docs.map(d => ({ id: d.id, ...d.data() }))

    const results = []

    for (const userDoc of usersSnap.docs) {
      const gardener = { id: userDoc.id, ...userDoc.data() }
      if (!gardener.phone) continue

      const qInvoices = allInvoices.filter(inv => {
        if (inv.gardenerUid !== gardener.id) return false
        if (inv.status !== 'paid') return false
        const d = inv.createdAt?.toDate?.() || new Date(inv.createdAt)
        return d >= qStart && d <= qEnd
      })

      if (qInvoices.length === 0) continue

      const totalFees = qInvoices.reduce((s, inv) => {
        const feeLines = inv.lineItems?.filter(l => l.category === 'fee') || []
        return s + feeLines.reduce((fs, l) => fs + (l.amountCents || 0), 0)
      }, 0)

      const name    = gardener.name?.split(' ')[0] || 'there'
      const message = gardener.language === 'es'
        ? `Hola ${name}! Tu resumen ${qLabel} de YardSync: ${qInvoices.length} facturas procesadas, ${formatCents(totalFees)} en tarifas de plataforma incluidas en tus facturas. ¿Preguntas? Responde AYUDA. — YardSync`
        : `Hi ${name}! Your ${qLabel} YardSync summary: ${qInvoices.length} invoices processed, ${formatCents(totalFees)} in platform fees included in your invoices. Questions? Reply HELP. — YardSync`

      try {
        const digits = gardener.phone.replace(/\D/g, '')
        if (digits.length < 10) continue
        const to   = digits.startsWith('1') ? `+${digits}` : `+1${digits}`
        const body = new URLSearchParams({ To: to, From: TWILIO_FROM, Body: message })

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
        results.push({ uid: gardener.id, fees: totalFees, invoices: qInvoices.length, sid: twilioData.sid })
        console.log(`Quarterly SMS sent → uid:${gardener.id} fees:${totalFees} quarter:${qLabel}`)
      } catch (err) {
        console.error(`Quarterly SMS failed → uid:${gardener.id}`, err.message)
      }
    }

    return NextResponse.json({ quarter: qLabel, sent: results.length, results })
  } catch (err) {
    console.error('Quarterly cron failed:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
