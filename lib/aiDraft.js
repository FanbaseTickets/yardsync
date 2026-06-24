/**
 * AI message drafting helper.
 *
 * Generates short SMS appointment reminders in EN or ES via Claude.
 * Used by /api/ai/draft-message and the eval test suite.
 *
 * Required env: ANTHROPIC_API_KEY
 */

import Anthropic from '@anthropic-ai/sdk'

const MODEL = 'claude-sonnet-4-6'
const MAX_TOKENS = 1024
const SMS_HARD_LIMIT = 320

const SYSTEM_PROMPT = `You are an SMS message drafter for a small business contractor (lawn care, HVAC, and similar trades).

Your job is to draft a friendly, professional appointment reminder SMS to the contractor's customer.

Rules:
- Target 100-140 characters. Stay under 160 if at all possible (SMS standard length).
- Hard ceiling: 320 characters. Shorter is better for SMS deliverability and customer attention.
- Use the language specified by the user (English or Spanish).
- Spanish output should use natural, conversational Latin American Spanish — not formal/Castilian.
- Spanish punctuation MUST be correct: exclamations and questions take inverted opening marks — write "¡Hola María!" (never "Hola María!") and "¿Cómo está?" (never "Como esta?").
- Always include: the customer's first name, the appointment date and time, the service type, and a sign-off using the contractor's business name.
- Tone: warm but efficient. Use periods to end sentences. If a single exclamation mark fits naturally at the end of a greeting (like "Hi Maria!") OR at a single sign-off line, that is acceptable, but never both. No emojis.
- Do not include placeholders like [NAME] or [DATE] — fill in everything from the input.
- Do not invent details that weren't provided.
- Do not include the SMS character count, just the message itself.
- The user message gives you the exact opt-out line to use (it is already written in the message language and already signed with the contractor's business name). Always end every SMS message you draft with that exact opt-out line, verbatim, on a new line. Never omit it, never reword it, never translate it, and never substitute a different sign-off (such as "YardSync"). It is required for carrier compliance.

Output ONLY the SMS message text, no preamble, no explanation, no quotes around it.`

let cachedClient = null
function getClient() {
  if (cachedClient) return cachedClient
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    const err = new Error('ANTHROPIC_API_KEY missing')
    err.code = 'no_api_key'
    throw err
  }
  cachedClient = new Anthropic({ apiKey })
  return cachedClient
}

function isNonEmptyString(v) {
  return typeof v === 'string' && v.trim().length > 0
}

/**
 * Validates the request body for the draft-message route.
 * Returns { ok: true, data } on success or { ok: false, field, error } on failure.
 */
export function validateInput(body) {
  if (!body || typeof body !== 'object') {
    return { ok: false, field: 'body', error: 'Request body must be a JSON object' }
  }

  const {
    clientName,
    appointmentDate,
    appointmentTime,
    serviceType,
    language,
    contractorName,
    businessName,
    additionalNotes,
  } = body

  if (!isNonEmptyString(clientName))   return { ok: false, field: 'clientName',   error: 'clientName is required' }
  if (clientName.length > 200)         return { ok: false, field: 'clientName',   error: 'clientName must be ≤ 200 characters' }

  if (!isNonEmptyString(appointmentDate)) return { ok: false, field: 'appointmentDate', error: 'appointmentDate is required (ISO string)' }
  const parsed = new Date(appointmentDate)
  if (isNaN(parsed.getTime()))            return { ok: false, field: 'appointmentDate', error: 'appointmentDate must be a valid ISO date' }

  if (!isNonEmptyString(appointmentTime)) return { ok: false, field: 'appointmentTime', error: 'appointmentTime is required' }
  if (!isNonEmptyString(serviceType))     return { ok: false, field: 'serviceType',     error: 'serviceType is required' }

  if (language !== 'en' && language !== 'es') {
    return { ok: false, field: 'language', error: 'language must be "en" or "es"' }
  }

  if (!isNonEmptyString(contractorName)) return { ok: false, field: 'contractorName', error: 'contractorName is required' }
  if (contractorName.length > 200)       return { ok: false, field: 'contractorName', error: 'contractorName must be ≤ 200 characters' }

  // businessName drives the opt-out sign-off + sign-off line. Optional for
  // backward compatibility — falls back to contractorName when absent.
  if (businessName != null) {
    if (!isNonEmptyString(businessName)) return { ok: false, field: 'businessName', error: 'businessName must be a non-empty string when provided' }
    if (businessName.length > 200)       return { ok: false, field: 'businessName', error: 'businessName must be ≤ 200 characters' }
  }

  if (additionalNotes != null) {
    if (typeof additionalNotes !== 'string') return { ok: false, field: 'additionalNotes', error: 'additionalNotes must be a string' }
    if (additionalNotes.length > 500)         return { ok: false, field: 'additionalNotes', error: 'additionalNotes must be ≤ 500 characters' }
  }

  const resolvedBusiness = isNonEmptyString(businessName) ? businessName.trim() : contractorName.trim()

  return {
    ok: true,
    data: {
      clientName: clientName.trim(),
      appointmentDate,
      appointmentTime: appointmentTime.trim(),
      serviceType: serviceType.trim(),
      language,
      contractorName: contractorName.trim(),
      businessName: resolvedBusiness,
      additionalNotes: additionalNotes ? additionalNotes.trim() : '',
    },
  }
}

/**
 * The exact A2P opt-out / sign-off line, in the message language, signed with
 * the contractor's business name. Mirrors the default SMS templates' wording:
 *   EN: "Reply STOP to opt out. – {business}"
 *   ES: "Responda STOP para cancelar. – {business}"
 */
export function buildOptOutLine(businessName, language) {
  return language === 'es'
    ? `Responda STOP para cancelar. – ${businessName}`
    : `Reply STOP to opt out. – ${businessName}`
}

function formatDate(isoString, language) {
  try {
    const d = new Date(isoString)
    const locale = language === 'es' ? 'es-US' : 'en-US'
    return d.toLocaleDateString(locale, { weekday: 'long', month: 'long', day: 'numeric' })
  } catch {
    return isoString
  }
}

function buildUserPrompt(input) {
  const {
    clientName, appointmentDate, appointmentTime, serviceType,
    language, businessName, additionalNotes,
  } = input
  const friendlyDate = formatDate(appointmentDate, language)
  const langLabel = language === 'es' ? 'Spanish' : 'English'
  const optOutLine = buildOptOutLine(businessName, language)

  const lines = [
    `Draft an appointment reminder SMS in ${langLabel}.`,
    '',
    `Customer name: ${clientName}`,
    `Appointment date: ${friendlyDate}`,
    `Appointment time: ${appointmentTime}`,
    `Service: ${serviceType}`,
    `Contractor / business name (sign off as this, never as "YardSync"): ${businessName}`,
  ]
  if (additionalNotes) lines.push(`Additional notes: ${additionalNotes}`)
  lines.push('')
  lines.push(`End the message with this exact opt-out line, verbatim, on its own new line:`)
  lines.push(optOutLine)
  return lines.join('\n')
}

/**
 * Calls Claude to draft an SMS reminder. Throws on API error.
 * Returns { draft, charCount }.
 */
export async function draftMessage(input) {
  const client = getClient()

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: MAX_TOKENS,
    system: SYSTEM_PROMPT,
    messages: [
      { role: 'user', content: buildUserPrompt(input) },
    ],
  })

  const textBlock = response.content?.find(b => b.type === 'text')
  const draft = (textBlock?.text || '').trim()

  if (!draft) {
    const err = new Error('Empty draft from model')
    err.code = 'empty_draft'
    throw err
  }

  // Hard cap — model is instructed to stay under 320 but we enforce it on our side.
  const safeDraft = draft.length > SMS_HARD_LIMIT ? draft.slice(0, SMS_HARD_LIMIT) : draft

  return { draft: safeDraft, charCount: safeDraft.length }
}
