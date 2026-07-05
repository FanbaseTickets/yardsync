// Property type distinguishes the kind of location a client is (residential yard
// vs commercial lot vs HOA common area) so the contractor gets a more tailored
// view and can filter by it. Shared by the Clients list, client detail, and the
// public lead/intake form. Default is 'residential'.
export const PROPERTY_TYPES = [
  { key: 'residential', en: 'Residential', es: 'Residencial' },
  { key: 'commercial',  en: 'Commercial',  es: 'Comercial' },
  { key: 'hoa',         en: 'HOA',          es: 'HOA' },
  { key: 'other',       en: 'Other',        es: 'Otro' },
]

export function propertyLabel(key, es) {
  const t = PROPERTY_TYPES.find(p => p.key === (key || 'residential'))
  return t ? (es ? t.es : t.en) : (es ? 'Residencial' : 'Residential')
}
