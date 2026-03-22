import { NextResponse } from 'next/server'
import { collection, getDocs, query, where, doc, updateDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import crypto from 'crypto'

function verifySignature(body, signature, sigKey) {
  if (!sigKey || !signature) return false
  const hmac = crypto.createHmac('sha256', sigKey).update(body).digest('base64')
  return hmac === signature
}

export async function POST(request) {
  try {
    const body      = await request.text()
    const signature = request.headers.get('x-square-hmacsha256-signature')
    const sigKey    = process.env.SQUARE_WEBHOOK_SIGNATURE_KEY

    // Verify signature if key is configured
    if (sigKey && !verifySignature(body, signature, sigKey)) {
      console.error('Square webhook signature verification failed')
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
    }

    const event = JSON.parse(body)
    const type  = event.type

    // Handle invoice payment
    if (type === 'invoice.payment_made') {
      const invoiceId = event.data?.object?.invoice?.id
      if (!invoiceId) {
        console.log('Square webhook: no invoice ID in event')
        return NextResponse.json({ received: true })
      }

      // Find matching invoice in Firestore
      const q    = query(collection(db, 'invoices'), where('squareInvoiceId', '==', invoiceId))
      const snap = await getDocs(q)

      if (!snap.empty) {
        const invDoc = snap.docs[0]
        await updateDoc(doc(db, 'invoices', invDoc.id), {
          status:  'paid',
          paidAt:  new Date().toISOString(),
        })
        console.log(`Square webhook: invoice ${invDoc.id} marked paid (Square ID: ${invoiceId})`)
      } else {
        console.log(`Square webhook: no matching invoice for Square ID ${invoiceId}`)
      }
    }

    return NextResponse.json({ received: true })
  } catch (err) {
    console.error('Square webhook error:', err)
    return NextResponse.json({ error: 'Webhook handler failed' }, { status: 500 })
  }
}
