// PWA install helpers. Chrome/Android fire `beforeinstallprompt` (we capture it
// and trigger it from our own button). iOS Safari has no such event — the user
// must tap Share → Add to Home Screen, so we detect iOS and show instructions.
// The capture is a module side-effect so it runs as early as the first import,
// before any component that wants to show an install button mounts.

let deferredPrompt = null
let listeners = []

function notify() { listeners.forEach(fn => { try { fn() } catch {} }) }

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault()      // stop Chrome's mini-infobar; we drive it ourselves
    deferredPrompt = e
    notify()
  })
  window.addEventListener('appinstalled', () => { deferredPrompt = null; notify() })
}

export function onInstallChange(fn) {
  listeners.push(fn)
  return () => { listeners = listeners.filter(x => x !== fn) }
}

export function canPromptInstall() { return !!deferredPrompt }

export async function promptInstall() {
  if (!deferredPrompt) return false
  deferredPrompt.prompt()
  let outcome = 'dismissed'
  try { ({ outcome } = await deferredPrompt.userChoice) } catch {}
  deferredPrompt = null
  notify()
  return outcome === 'accepted'
}

export function isStandalone() {
  if (typeof window === 'undefined') return false
  return window.matchMedia?.('(display-mode: standalone)')?.matches
    || window.navigator?.standalone === true
}

export function isIOS() {
  if (typeof window === 'undefined') return false
  const ua = window.navigator?.userAgent || ''
  return /iphone|ipad|ipod/i.test(ua) && !window.MSStream
}
