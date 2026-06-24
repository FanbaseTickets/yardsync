import { redirect } from 'next/navigation'

// /pricing was a hard 404 (pricing lives inline on the landing page). A bare
// URL that dead-ends reads as MVP-ness / a trust hit (flagged in persona
// testing). Redirect to the landing so the link always resolves.
export default function PricingRedirect() {
  redirect('/')
}
