/**
 * GET /api/slug/check?slug=foo
 *
 * Public availability check for the Settings slug editor. Returns whether
 * the given slug is valid (format/reserved) and available (not already
 * taken in the slugs/{slug} resolver collection).
 *
 * Intentionally unauthenticated — the slug editor on Settings calls this
 * on every keystroke (debounced 400ms), and adding auth round-trips would
 * make the UX laggy. Worst case an attacker can probe slug existence,
 * which isn't sensitive (slugs are public URLs by design).
 *
 * Response: { valid: bool, available: bool, error: string|null }
 *   - valid:     passes validateSlug() (format + not reserved)
 *   - available: not currently a doc in slugs/{slug}
 *   - error:     specific error code if !valid (for UI localization)
 */

import { NextResponse } from 'next/server'
import { getDocument } from '@/lib/firestoreRest'
import { validateSlug } from '@/lib/slug'

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const slug = (searchParams.get('slug') || '').trim()

    const error = validateSlug(slug)
    if (error) {
      return NextResponse.json({ valid: false, available: false, error })
    }

    const existing = await getDocument('slugs', slug)
    const available = !existing || existing?.data?.active === false

    return NextResponse.json({ valid: true, available, error: null })
  } catch (err) {
    console.error('slug check error:', err)
    return NextResponse.json(
      { valid: false, available: false, error: 'server_error' },
      { status: 500 }
    )
  }
}
