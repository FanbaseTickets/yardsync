import { NextResponse } from 'next/server'
import { getSquareBaseUrl } from '@/lib/square'

export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const gardenerUid = searchParams.get('uid')

  if (!gardenerUid) {
    return NextResponse.json({ error: 'Missing uid' }, { status: 400 })
  }

  const baseUrl     = getSquareBaseUrl()
  const appId       = process.env.SQUARE_APPLICATION_ID
  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/square/oauth/callback`
  const scopes      = 'MERCHANT_PROFILE_READ PAYMENTS_WRITE INVOICES_WRITE INVOICES_READ CUSTOMERS_WRITE CUSTOMERS_READ ORDERS_WRITE ORDERS_READ'

  const authUrl = `${baseUrl}/oauth2/authorize?client_id=${appId}&scope=${encodeURIComponent(scopes)}&session=false&state=${gardenerUid}&redirect_uri=${encodeURIComponent(redirectUri)}`

  return NextResponse.redirect(authUrl)
}
