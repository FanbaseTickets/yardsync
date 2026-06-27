// Free-access model (docs/FREE_ACCESS_SPEC.md): launches the $0 card-on-file
// capture. Calls the authenticated setup-card route to mint a Stripe Checkout
// session in mode:'setup' and redirects the browser to it. On return, the
// checkout.session.completed (mode==='setup') webhook sets pmOnFile, and the
// success_url lands back on `returnPath` with ?card=saved.
//
// `user` is the Firebase auth user (from useAuth). `returnPath` is where Stripe
// should send them back (defaults to the current path so they can retry the
// action that triggered the capture, e.g. sending an invoice).
export async function startCardCapture(user, returnPath) {
  if (!user) throw new Error('Not signed in')
  const idToken = await user.getIdToken()
  const path = returnPath
    || (typeof window !== 'undefined' ? window.location.pathname + window.location.search : '/dashboard')
  const res = await fetch('/api/stripe/setup-card', {
    method:  'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${idToken}`,
    },
    body: JSON.stringify({ gardenerUid: user.uid, returnPath: path }),
  })
  const data = await res.json()
  if (!res.ok || !data.url) throw new Error(data.error || 'Could not start card setup')
  window.location.href = data.url
}
