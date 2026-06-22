/**
 * GET /api/card-image?url=<firebase storage url>
 *
 * Same-origin image proxy for client-side canvas composition (lib/cardTemplate
 * → Settings card assets). Firebase Storage download URLs don't send CORS
 * headers, so a browser `fetch()` of them is blocked and the canvas can't draw
 * the logo/headshot without tainting on export. Proxying through our own origin
 * sidesteps CORS entirely — no bucket CORS config needed.
 *
 * Locked to Firebase/GCS storage hosts so this can't be used as an open proxy.
 */

import { NextResponse } from 'next/server'

const ALLOWED_HOSTS = new Set([
  'firebasestorage.googleapis.com',
  'storage.googleapis.com',
])

export async function GET(request) {
  const target = new URL(request.url).searchParams.get('url')
  if (!target) return NextResponse.json({ error: 'Missing url' }, { status: 400 })

  let u
  try { u = new URL(target) } catch { return NextResponse.json({ error: 'Bad url' }, { status: 400 }) }
  if (u.protocol !== 'https:' || !ALLOWED_HOSTS.has(u.hostname)) {
    return NextResponse.json({ error: 'Host not allowed' }, { status: 403 })
  }

  try {
    const res = await fetch(u.toString())
    if (!res.ok) return NextResponse.json({ error: `Upstream ${res.status}` }, { status: 502 })
    const ct = res.headers.get('content-type') || 'image/png'
    if (!ct.startsWith('image/')) return NextResponse.json({ error: 'Not an image' }, { status: 415 })
    const buf = await res.arrayBuffer()
    return new NextResponse(buf, {
      status: 200,
      headers: { 'Content-Type': ct, 'Cache-Control': 'public, max-age=3600' },
    })
  } catch {
    return NextResponse.json({ error: 'Fetch failed' }, { status: 502 })
  }
}
