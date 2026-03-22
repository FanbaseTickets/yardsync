import { NextResponse } from 'next/server'
import { collection, getDocs, addDoc, updateDoc, doc, query, where, serverTimestamp } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import Stripe from 'stripe'

const stripe     = new Stripe(process.env.STRIPE_SECRET_KEY)
const TWILIO_SID   = process.env.TWILIO_ACCOUNT_SID
const TWILIO_TOKEN = process.env.TWILIO_AUTH_TOKEN
const TWILIO_FROM  = process.env.TWILIO_PHONE_NUMBER

async function sendSMS(to, message) {
  const digits = to.replace(/\D/g, '')
  if (digits.length < 10) return null
  const phone = digits.startsWith('1') ? `+${digits}` : `+1${digits}`
  const body = new URLSearchParams({ To: phone, From: TWILIO_FROM, Body: message })
  const res = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}/Messages.json`,
    {
      method: 'POST',
      headers: {
        'Content-Type':  'application/x-www-form-urlencoded',
        'Authorization': 'Basic ' + Buffer.from(`${TWILIO_SID}:${TWILIO_TOKEN}`).toString('base64'),
      },
      body: body.toString(),
    }
  )
  return await res.json()
}

export async function GET(request) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const now     = new Date()
    const quarter = Math.floor(now.getMonth() / 3) + 1
    const qLabel  = `Q${quarter}`
    const year    = now.getFullYear()
    const qStart  = new Date(year, (quarter - 1) * 3, 1)
    const qEnd    = new Date(year, quarter * 3, 0, 23, 59, 59)

    const usersSnap    = await getDocs(collection(db, 'users'))
    const invoicesSnap = await getDocs(collection(db, 'invoices'))
    const allInvoices  = invoicesSnap.docs.map(d => ({ id: d.id, ...d.data() }))

    const results = { charged: [], smsReminder: [], failed: [] }

    for (const userDoc of usersSnap.docs) {
      const gardener = { id: userDoc.id, ...userDoc.data() }

      // Calculate uncollected fees for this quarter
      const qInvoices = allInvoices.filter(inv => {
        if (inv.gardenerUid !== gardener.id) return false
        if (inv.feeCollected) return false
        const d = inv.createdAt?.toDate?.() || new Date(inv.createdAt)
        return d >= qStart && d <= qEnd
      })

      if (qInvoices.length === 0) continue

      const totalFees = qInvoices.reduce((s, inv) => {
        const feeLines = inv.lineItems?.filter(l => l.category === 'fee') || []
        return s + feeLines.reduce((fs, l) => fs + (l.amountCents || 0), 0)
      }, 0)

      if (totalFees <= 0) continue

      const name = gardener.name?.split(' ')[0] || 'there'

      // If gardener has card on file → auto-charge
      if (gardener.stripeCustomerId && gardener.stripePaymentMethodId) {
        try {
          const paymentIntent = await stripe.paymentIntents.create({
            amount:         totalFees,
            currency:       'usd',
            customer:       gardener.stripeCustomerId,
            payment_method: gardener.stripePaymentMethodId,
            off_session:    true,
            confirm:        true,
            description:    `YardSync platform fees — ${qLabel} ${year}`,
            metadata: { gardenerUid: gardener.id, quarter: qLabel, year: String(year) },
          })

          if (paymentIntent.status === 'succeeded') {
            // Save fee payment record
            await addDoc(collection(db, 'feePayments'), {
              gardenerUid: gardener.id,
              quarter: qLabel, year,
              amountCents: totalFees,
              stripePaymentIntentId: paymentIntent.id,
              status: 'auto_charged',
              chargeMethod: 'auto',
              paidAt: new Date().toISOString(),
              createdAt: serverTimestamp(),
            })

            // Mark invoices as fee collected
            await Promise.all(qInvoices.map(inv =>
              updateDoc(doc(db, 'invoices', inv.id), {
                feeCollected: true,
                feeCollectedAt: new Date().toISOString(),
                feePaymentIntentId: paymentIntent.id,
              })
            ))

            // Send confirmation SMS
            if (gardener.phone) {
              const msg = gardener.language === 'es'
                ? `YardSync: Tu pago de ${(totalFees / 100).toFixed(2)} USD por tarifas de plataforma ${qLabel} ${year} fue procesado. Gracias!`
                : `YardSync: Your ${qLabel} ${year} platform fee of $${(totalFees / 100).toFixed(2)} was auto-charged. Thank you!`
              await sendSMS(gardener.phone, msg)
            }

            results.charged.push({ uid: gardener.id, amount: totalFees })
            console.log(`Billing auto-charged → uid:${gardener.id} amount:${totalFees} quarter:${qLabel}`)
          } else {
            results.failed.push({ uid: gardener.id, reason: paymentIntent.status })
          }
        } catch (err) {
          console.error(`Billing charge failed → uid:${gardener.id}`, err.message)
          results.failed.push({ uid: gardener.id, reason: err.message })

          // Send failure SMS
          if (gardener.phone) {
            const msg = gardener.language === 'es'
              ? `YardSync: No pudimos cobrar tus tarifas de ${qLabel}. Actualiza tu método de pago en yardsync.vercel.app/settings`
              : `YardSync: We couldn't charge your ${qLabel} fees. Update your payment method at yardsync.vercel.app/settings`
            await sendSMS(gardener.phone, msg)
          }
        }
      } else {
        // No card on file → send reminder SMS
        if (gardener.phone) {
          const msg = gardener.language === 'es'
            ? `Hola ${name}! Tus tarifas de plataforma YardSync de ${qLabel} ${year} son $${(totalFees / 100).toFixed(2)}. Agrega un método de pago en yardsync.vercel.app/settings`
            : `Hi ${name}! Your YardSync ${qLabel} ${year} platform fees of $${(totalFees / 100).toFixed(2)} are overdue. Add a payment method at yardsync.vercel.app/settings`
          await sendSMS(gardener.phone, msg)
          results.smsReminder.push({ uid: gardener.id, amount: totalFees })
          console.log(`Billing SMS reminder → uid:${gardener.id} amount:${totalFees}`)
        }
      }
    }

    return NextResponse.json({
      quarter: qLabel, year,
      charged: results.charged.length,
      reminded: results.smsReminder.length,
      failed: results.failed.length,
      results,
    })
  } catch (err) {
    console.error('Billing cron failed:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
