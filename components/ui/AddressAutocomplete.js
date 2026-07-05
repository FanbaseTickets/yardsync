'use client'

import { useState, useRef, useEffect } from 'react'
import { MapPin, LocateFixed, Loader2 } from 'lucide-react'

// Radar publishable key (client-safe; restrict by domain in the Radar dashboard).
// When it's absent the component degrades to a plain text input — so the app
// works exactly as before until the key is set in Vercel.
const RADAR_KEY = process.env.NEXT_PUBLIC_RADAR_PUBLISHABLE_KEY

/**
 * Address field with Radar autocomplete + "use my current location".
 *
 * Degradation-safe: no NEXT_PUBLIC_RADAR_PUBLISHABLE_KEY → a plain <input> that
 * behaves identically to the raw field it replaces (same name/value/onChange),
 * so the no-JS intake fallback keeps working. With a key it adds a debounced
 * suggestion dropdown (structured, so nothing gets fat-fingered) and a locate
 * button. `onResolve` (optional) receives the structured parts on selection.
 */
export default function AddressAutocomplete({
  value,
  onChange,
  onResolve,
  placeholder,
  name,
  id,
  es = false,
  className = 'form-input',
  maxLength = 200,
  autoComplete = 'street-address',
}) {
  const [suggestions, setSuggestions] = useState([])
  const [open, setOpen]       = useState(false)
  const [loading, setLoading] = useState(false)
  const [locating, setLocating] = useState(false)
  const [error, setError]     = useState(null)
  const boxRef   = useRef(null)
  const abortRef = useRef(null)
  const debRef   = useRef(null)
  const pickedRef = useRef('')   // last value chosen from the list — don't re-search it

  // Close the dropdown on outside click.
  useEffect(() => {
    function onDoc(e) { if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  // Plain input when Radar isn't configured — identical behavior to before.
  if (!RADAR_KEY) {
    return (
      <input
        type="text" name={name} id={id} value={value}
        onChange={e => onChange(e.target.value)}
        className={className} placeholder={placeholder}
        autoComplete={autoComplete} maxLength={maxLength}
      />
    )
  }

  function runAutocomplete(q) {
    if (!q || q.trim().length < 3 || q === pickedRef.current) { setSuggestions([]); setOpen(false); return }
    if (abortRef.current) abortRef.current.abort()
    const ctrl = new AbortController()
    abortRef.current = ctrl
    setLoading(true); setError(null)
    fetch(`https://api.radar.io/v1/search/autocomplete?query=${encodeURIComponent(q)}&country=US&layers=address,street&limit=5`, {
      headers: { Authorization: RADAR_KEY },
      signal: ctrl.signal,
    })
      .then(r => r.json())
      .then(data => {
        setSuggestions(Array.isArray(data?.addresses) ? data.addresses : [])
        setOpen(true)
      })
      .catch(err => { if (err.name !== 'AbortError') setError(true) })
      .finally(() => setLoading(false))
  }

  function handleInput(e) {
    const q = e.target.value
    onChange(q)
    pickedRef.current = ''
    if (debRef.current) clearTimeout(debRef.current)
    debRef.current = setTimeout(() => runAutocomplete(q), 300)
  }

  function pick(a) {
    const formatted = a.formattedAddress || a.addressLabel || ''
    pickedRef.current = formatted
    onChange(formatted)
    if (onResolve) onResolve({
      formatted,
      street:   [a.number, a.street].filter(Boolean).join(' ') || a.addressLabel || '',
      city:     a.city || '',
      state:    a.stateCode || a.state || '',
      postalCode: a.postalCode || '',
      lat: a.latitude, lng: a.longitude,
    })
    setSuggestions([]); setOpen(false)
  }

  function useMyLocation() {
    if (!navigator.geolocation) { setError(true); return }
    setLocating(true); setError(null)
    navigator.geolocation.getCurrentPosition(
      pos => {
        const { latitude, longitude } = pos.coords
        fetch(`https://api.radar.io/v1/geocode/reverse?coordinates=${latitude},${longitude}`, {
          headers: { Authorization: RADAR_KEY },
        })
          .then(r => r.json())
          .then(data => {
            const a = data?.addresses?.[0]
            if (a) pick(a)
            else setError(true)
          })
          .catch(() => setError(true))
          .finally(() => setLocating(false))
      },
      () => { setLocating(false); setError(true) },   // permission denied / unavailable
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
    )
  }

  return (
    <div className="relative" ref={boxRef}>
      <div className="relative">
        <input
          type="text" name={name} id={id} value={value}
          onChange={handleInput}
          onFocus={() => { if (suggestions.length) setOpen(true) }}
          className={className} placeholder={placeholder}
          autoComplete="off" maxLength={maxLength}
        />
        {loading && <Loader2 size={15} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 animate-spin" />}
      </div>

      <button
        type="button"
        onClick={useMyLocation}
        disabled={locating}
        className="mt-1.5 inline-flex items-center gap-1.5 text-[12px] font-medium text-brand-700 hover:text-brand-800 disabled:opacity-60"
      >
        {locating ? <Loader2 size={13} className="animate-spin" /> : <LocateFixed size={13} />}
        {es ? 'Usar mi ubicación actual' : 'Use my current location'}
      </button>

      {open && suggestions.length > 0 && (
        <ul className="absolute z-20 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
          {suggestions.map((a, i) => (
            <li key={i}>
              <button
                type="button"
                onClick={() => pick(a)}
                className="w-full flex items-start gap-2 text-left px-3 py-2.5 hover:bg-brand-50 transition-colors"
              >
                <MapPin size={14} className="text-brand-500 flex-shrink-0 mt-0.5" />
                <span className="text-[13px] text-gray-700">{a.formattedAddress || a.addressLabel}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {error && (
        <p className="text-[11px] text-amber-600 mt-1">
          {es ? 'No se pudo buscar la dirección — escríbela manualmente.' : "Couldn't look up the address — type it in."}
        </p>
      )}
    </div>
  )
}
