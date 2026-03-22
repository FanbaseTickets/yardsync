import { NextResponse } from 'next/server'
import { getSquareBaseUrl } from '@/lib/square'

export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const code        = searchParams.get('code')
  const state       = searchParams.get('state') // gardenerUid
  const error       = searchParams.get('error')

  if (error) {
    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/settings?squareError=${encodeURIComponent(error)}`)
  }

  if (!code || !state) {
    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/settings?squareError=missing_code`)
  }

  try {
    const baseUrl = getSquareBaseUrl()

    // Exchange authorization code for access token
    const tokenRes = await fetch(`${baseUrl}/oauth2/token`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id:     process.env.SQUARE_APPLICATION_ID,
        client_secret: process.env.SQUARE_APPLICATION_SECRET,
        code,
        grant_type:    'authorization_code',
        redirect_uri:  `${process.env.NEXT_PUBLIC_APP_URL}/api/square/oauth/callback`,
      }),
    })
    const tokenData = await tokenRes.json()

    if (!tokenData.access_token) {
      console.error('Square OAuth token exchange failed:', tokenData)
      return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/settings?squareError=token_failed`)
    }

    // Fetch merchant profile to get merchant_id and locations
    const merchantRes = await fetch(`${baseUrl}/v2/merchants/me`, {
      headers: {
        'Square-Version': '2024-01-18',
        'Authorization':  `Bearer ${tokenData.access_token}`,
      },
    })
    const merchantData = await merchantRes.json()
    const merchantId   = merchantData.merchant?.id || ''
    const merchantName = merchantData.merchant?.business_name || ''

    // Fetch locations to get primary location_id
    const locRes = await fetch(`${baseUrl}/v2/locations`, {
      headers: {
        'Square-Version': '2024-01-18',
        'Authorization':  `Bearer ${tokenData.access_token}`,
      },
    })
    const locData    = await locRes.json()
    const location   = locData.locations?.[0]
    const locationId = location?.id || ''
    const locationName = location?.name || ''

    // Redirect to settings with tokens as query params
    // Client-side will write to Firestore (cannot write from API route)
    const params = new URLSearchParams({
      squareConnected:    'true',
      squareAccessToken:  tokenData.access_token,
      squareRefreshToken: tokenData.refresh_token || '',
      squareMerchantId:   merchantId,
      squareMerchantName: merchantName,
      squareLocationId:   locationId,
      squareLocationName: locationName,
      squareExpiresAt:    tokenData.expires_at || '',
    })

    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/settings?${params.toString()}`)
  } catch (err) {
    console.error('Square OAuth callback error:', err)
    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/settings?squareError=callback_failed`)
  }
}
