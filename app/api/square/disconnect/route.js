import { NextResponse } from 'next/server'
import { getSquareBaseUrl } from '@/lib/square'

export async function POST(request) {
  try {
    const { accessToken, merchantId } = await request.json()

    if (!accessToken) {
      return NextResponse.json({ error: 'Missing access token' }, { status: 400 })
    }

    const baseUrl = getSquareBaseUrl()

    // Revoke the OAuth token
    const revokeRes = await fetch(`${baseUrl}/oauth2/revoke`, {
      method:  'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Client ${process.env.SQUARE_APPLICATION_SECRET}`,
      },
      body: JSON.stringify({
        client_id:    process.env.SQUARE_APPLICATION_ID,
        access_token: accessToken,
        merchant_id:  merchantId || undefined,
      }),
    })

    const revokeData = await revokeRes.json()

    if (!revokeData.success) {
      console.error('Square revoke failed:', revokeData)
    }

    // Return success regardless — client will clear Firestore fields
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Square disconnect error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
