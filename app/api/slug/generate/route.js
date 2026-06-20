/**
 * POST /api/slug/generate
 *
 * Handles both first-run slug generation AND subsequent slug changes for
 * the authenticated contractor. Settings calls this when:
 *   - Contractor taps "Generate your YardSync card" (no `slug` in body
 *     → auto-generate from businessName via slugify + collision suffix)
 *   - Contractor saves an edited slug (`slug` in body → validate + reserve)
 *
 * Auth: Bearer <Firebase ID token>. The token's localId must match the
 * `uid` in the body (a contractor can only manage their own slug).
 *
 * Body: { uid: string, slug?: string }
 *
 * Writes:
 *   - slugs/{newSlug}      — the resolver doc (owns the public URL)
 *   - users/{uid}          — sets publicSlug, syncs previousSlugs on change
 *   - slugs/{oldSlug}      — when changing, marks old as inactive with
 *                            expiresAt = now + 30d so printed cards keep
 *                            working for the redirect window
 *
 * Response: { slug: string }
 */

import { NextResponse } from 'next/server'
import { getDocument, setDocument } from '@/lib/firestoreRest'
import { slugify, validateSlug, generateUniqueSlug } from '@/lib/slug'

const API_KEY = process.env.FIREBASE_API_KEY || process.env.NEXT_PUBLIC_FIREBASE_API_KEY
const REDIRECT_WINDOW_DAYS = 30

async function verifyContractor(request, targetUid) {
  const auth = request.headers.get('authorization')
  if (!auth?.startsWith('Bearer ')) return false
  const idToken = auth.slice(7)
  try {
    const res = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken }),
      }
    )
    if (!res.ok) return false
    const data = await res.json()
    const user = data.users?.[0]
    if (!user) return false
    return user.localId === targetUid
  } catch {
    return false
  }
}

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}))
    const { uid, slug: requestedSlug } = body
    if (!uid) {
      return NextResponse.json({ error: 'Missing uid' }, { status: 400 })
    }

    if (!(await verifyContractor(request, uid))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Pull the contractor's user doc so we know the businessName + current slug
    const userDoc = await getDocument('users', uid)
    if (!userDoc?.data) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const currentSlug = userDoc.data.publicSlug || null
    const businessName = userDoc.data.businessName || ''

    let nextSlug
    if (requestedSlug) {
      // Path: contractor is changing/setting a specific slug
      const trimmed = String(requestedSlug).trim().toLowerCase()
      const validationError = validateSlug(trimmed)
      if (validationError) {
        return NextResponse.json({ error: `Slug invalid: ${validationError}` }, { status: 400 })
      }
      // No-op if it's the same slug they already have
      if (trimmed === currentSlug) {
        return NextResponse.json({ slug: trimmed })
      }
      // Make sure it's not taken by someone else
      const existing = await getDocument('slugs', trimmed)
      if (existing?.data?.active === true && existing?.data?.ownerUid !== uid) {
        return NextResponse.json({ error: 'Slug already taken' }, { status: 409 })
      }
      nextSlug = trimmed
    } else {
      // Path: first-run auto-generation from businessName
      if (!businessName) {
        return NextResponse.json(
          { error: 'Cannot auto-generate slug — set your business name in Settings first' },
          { status: 400 }
        )
      }
      // If they already have a slug, just return it (idempotent first-run)
      if (currentSlug) {
        return NextResponse.json({ slug: currentSlug })
      }
      nextSlug = await generateUniqueSlug(businessName, async candidate => {
        const doc = await getDocument('slugs', candidate)
        return doc?.data?.active === true
      })
    }

    const nowIso = new Date().toISOString()

    // 1. Write the new resolver doc
    await setDocument('slugs', nextSlug, {
      ownerType: 'user',
      ownerUid:  uid,
      createdAt: nowIso,
      active:    true,
      expiresAt: null,
    })

    // 2. If this is a slug CHANGE (old slug exists), mark the old one
    //    inactive with a 30-day redirect window so printed cards keep working.
    if (currentSlug && currentSlug !== nextSlug) {
      const expiresAt = new Date(Date.now() + REDIRECT_WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString()
      try {
        await setDocument('slugs', currentSlug, {
          active:    false,
          expiresAt,
          redirectTo: nextSlug,
        })
      } catch (oldSlugErr) {
        // Non-fatal — the new slug is already live. Log + continue.
        console.error('Failed to mark old slug inactive (non-fatal):', oldSlugErr.message)
      }
    }

    // 3. Update the user doc with the new publicSlug + previousSlugs trail
    const previousSlugs = Array.isArray(userDoc.data.previousSlugs) ? userDoc.data.previousSlugs : []
    if (currentSlug && currentSlug !== nextSlug) {
      previousSlugs.push({
        slug:      currentSlug,
        expiresAt: new Date(Date.now() + REDIRECT_WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString(),
      })
    }
    await setDocument('users', uid, {
      publicSlug:     nextSlug,
      previousSlugs:  previousSlugs.slice(-10), // cap history at 10 entries
      updatedAt:      nowIso,
    })

    return NextResponse.json({ slug: nextSlug })
  } catch (err) {
    console.error('slug generate error:', err)
    return NextResponse.json(
      { error: err.message || 'Server error' },
      { status: 500 }
    )
  }
}
