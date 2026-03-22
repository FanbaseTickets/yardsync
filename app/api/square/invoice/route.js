import { NextResponse } from 'next/server'
import { getSquareBaseUrl, getSquareHeaders, idempotencyKey } from '@/lib/square'

export async function POST(request) {
  try {
    const {
      clientId,
      gardenerUid,
      clientName,
      clientEmail,
      clientPhone,
      lineItems,
      totalCents,
      // Per-gardener OAuth tokens (preferred) — falls back to env vars for sandbox
      gardenerAccessToken,
      gardenerLocationId,
    } = await request.json()

    const baseUrl    = getSquareBaseUrl()
    const token      = gardenerAccessToken || process.env.SQUARE_ACCESS_TOKEN
    const locationId = gardenerLocationId  || process.env.SQUARE_LOCATION_ID
    const headers    = getSquareHeaders(token)

    console.log('YardSync → Square invoice request:', { clientId, totalCents })

    // ── STEP 1: Find or create Square customer ──────────────────────────────
    let squareCustomerId = null

    if (clientEmail) {
      const searchRes = await fetch(`${baseUrl}/v2/customers/search`, {
        method:  'POST',
        headers,
        body: JSON.stringify({
          query: { filter: { email_address: { exact: clientEmail } } }
        })
      })
      const searchData = await searchRes.json()
      if (searchData.customers?.length > 0) {
        squareCustomerId = searchData.customers[0].id
      }
    }

    if (!squareCustomerId) {
      const nameParts  = clientName.trim().split(' ')
      const givenName  = nameParts[0] || clientName
      const familyName = nameParts.slice(1).join(' ') || ''

      const createRes  = await fetch(`${baseUrl}/v2/customers`, {
        method:  'POST',
        headers,
        body: JSON.stringify({
          idempotency_key: idempotencyKey(),
          given_name:      givenName,
          family_name:     familyName,
          email_address:   clientEmail || undefined,
          phone_number:    clientPhone || undefined,
          reference_id:    clientId,
        })
      })
      const createData = await createRes.json()
      if (!createData.customer?.id) throw new Error('Could not create Square customer')
      squareCustomerId = createData.customer.id
    }

    // ── STEP 2: Create Square order ─────────────────────────────────────────
    const orderRes = await fetch(`${baseUrl}/v2/orders`, {
      method:  'POST',
      headers,
      body: JSON.stringify({
        idempotency_key: idempotencyKey(),
        order: {
          location_id:  locationId,
          reference_id: clientId,
          customer_id:  squareCustomerId,
          line_items: [{
            name:             'Lawn care service',
            quantity:         '1',
            base_price_money: { amount: totalCents, currency: 'USD' },
          }],
        }
      })
    })
    const orderData = await orderRes.json()
    if (!orderData.order?.id) throw new Error('Could not create Square order')

    // ── STEP 3: Create invoice ──────────────────────────────────────────────
    const tomorrow   = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    const dueDateStr = tomorrow.toISOString().split('T')[0]

    const invoiceRes = await fetch(`${baseUrl}/v2/invoices`, {
      method:  'POST',
      headers,
      body: JSON.stringify({
        idempotency_key: idempotencyKey(),
        invoice: {
          location_id:      locationId,
          order_id:         orderData.order.id,
          title:            `YardSync — ${clientName}`,
          description:      'Lawn care service via YardSync',
          delivery_method:  clientEmail ? 'EMAIL' : 'SHARE_MANUALLY',
          accepted_payment_methods: {
            card: true, square_gift_card: false,
            bank_account: false, buy_now_pay_later: false, cash_app_pay: false,
          },
          payment_requests: [{
            request_type:    'BALANCE',
            due_date:         dueDateStr,
            tipping_enabled:  false,
          }],
          primary_recipient: { customer_id: squareCustomerId },
        }
      })
    })
    const invoiceData = await invoiceRes.json()
    if (!invoiceData.invoice?.id) throw new Error('Could not create Square invoice')

    // ── STEP 4: Publish invoice ─────────────────────────────────────────────
    const publishRes = await fetch(
      `${baseUrl}/v2/invoices/${invoiceData.invoice.id}/publish`,
      {
        method:  'POST',
        headers,
        body: JSON.stringify({
          idempotency_key: idempotencyKey(),
          version:         invoiceData.invoice.version,
        })
      }
    )
    const publishData = await publishRes.json()
    if (!publishData.invoice?.id) throw new Error('Could not publish Square invoice')

    // Return invoice data — Firestore save happens client-side
    return NextResponse.json({
      success:          true,
      invoiceId:        publishData.invoice.id,
      invoiceUrl:       publishData.invoice.public_url || null,
      squareOrderId:    orderData.order.id,
      squareCustomerId: squareCustomerId,
    })

  } catch (error) {
    console.error('Square invoice failed:', error)
    return NextResponse.json({ error: error.message || 'Invoice failed' }, { status: 500 })
  }
}
