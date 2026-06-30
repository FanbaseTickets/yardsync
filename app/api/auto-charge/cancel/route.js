import { NextResponse } from 'next/server'
import { getDocument } from '@/lib/firestoreRest'
import { cancelClientAutoBilling } from '@/lib/autoCharge'

// Public cancel endpoint for the email cancel link. Authorized by a per-client
// token (stored on the client doc when a reminder is sent), so only someone with
// the link from their own reminder can cancel — no guessing client ids.
export async function POST(req) {
  try {
    const { clientId, token } = await req.json()
    if (!clientId || !token) return NextResponse.json({ error: 'Missing clientId/token' }, { status: 400 })

    const client = await getDocument('clients', clientId)
    if (!client || !client.data?.autoCancelToken || client.data.autoCancelToken !== token) {
      return NextResponse.json({ error: 'Invalid or expired link' }, { status: 403 })
    }

    await cancelClientAutoBilling(clientId)
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('auto-charge/cancel error:', err.message)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
