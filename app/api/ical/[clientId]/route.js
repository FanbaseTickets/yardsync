import { NextResponse } from 'next/server'

// This endpoint is deprecated — iCal generation now happens client-side
// via lib/ical.js to avoid Firebase permission errors in API routes.
export async function GET() {
  return NextResponse.json(
    { error: 'iCal files are now generated client-side. Use the "Add to Calendar" button on the client detail page.' },
    { status: 410 }
  )
}
