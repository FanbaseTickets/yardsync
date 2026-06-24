/**
 * SMS reminder template defaults + a one-time normalizer.
 *
 * The Spanish default originally shipped without the inverted opening "¡". It's
 * fixed at the source now, but accounts created before the fix have the old
 * string SAVED in Firestore. normalizeEsTemplate() swaps that EXACT pre-fix
 * default for the corrected one wherever the template is read (display + send).
 * Exact-match only — a contractor's intentionally customized template is never
 * altered.
 */

export const EN_DEFAULT =
  'Hi {name}! Your yard service is scheduled for {date} at {time}. See you then! Reply STOP to opt out. – {business}'

export const ES_DEFAULT =
  '¡Hola {name}! Su servicio de jardín está programado para {date} a las {time}. ¡Hasta pronto! Responda STOP para cancelar. – {business}'

// The pre-fix Spanish default (missing the opening "¡").
const OLD_ES_DEFAULT =
  'Hola {name}! Su servicio de jardín está programado para {date} a las {time}. ¡Hasta pronto! Responda STOP para cancelar. – {business}'

// Empty / pre-fix old default → corrected default; any custom template unchanged.
export function normalizeEsTemplate(t) {
  if (!t || t === OLD_ES_DEFAULT) return ES_DEFAULT
  return t
}
