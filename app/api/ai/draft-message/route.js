import { NextResponse } from 'next/server'
import { validateInput, draftMessage } from '@/lib/aiDraft'

export const runtime = 'nodejs'

export async function POST(request) {
  let body
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const v = validateInput(body)
  if (!v.ok) {
    return NextResponse.json({ error: v.error, field: v.field }, { status: 400 })
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('AI draft route — ANTHROPIC_API_KEY not configured')
    return NextResponse.json({ error: 'AI service unavailable' }, { status: 500 })
  }

  try {
    const result = await draftMessage(v.data)
    return NextResponse.json(result)
  } catch (err) {
    console.error('AI draft route — Anthropic call failed:', err?.status, err?.message)
    return NextResponse.json(
      { error: 'Could not draft message — please try again' },
      { status: 502 }
    )
  }
}
