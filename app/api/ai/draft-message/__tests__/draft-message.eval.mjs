/**
 * Eval suite for /api/ai/draft-message.
 *
 * Hits the running dev server and checks the model output against
 * a small set of structural rules per sample. LLM evals are inherently
 * fuzzy — these checks aim to catch the obvious failure modes
 * (empty output, runaway length, unfilled placeholders, wrong language)
 * rather than score subjective quality.
 *
 * Run:
 *   1. In one terminal: npm run dev
 *   2. In another:      node app/api/ai/draft-message/__tests__/draft-message.eval.mjs
 *
 * Optional: AI_EVAL_BASE_URL=https://your-deploy.vercel.app to point at a deploy.
 */

const BASE_URL = process.env.AI_EVAL_BASE_URL || 'http://localhost:3000'
const ENDPOINT = `${BASE_URL}/api/ai/draft-message`

const tomorrow = (() => { const d = new Date(); d.setDate(d.getDate() + 1); return d.toISOString() })()
const saturday = (() => {
  const d = new Date()
  d.setDate(d.getDate() + ((6 - d.getDay() + 7) % 7 || 7))
  return d.toISOString()
})()

const SAMPLES = [
  {
    name: 'standard lawn mowing — English, no notes',
    input: {
      clientName: 'Maria Lopez',
      appointmentDate: tomorrow,
      appointmentTime: '9:00 AM',
      serviceType: 'lawn mowing',
      language: 'en',
      contractorName: "Jay's Lawn Care",
      businessName: "Jay's Lawn Care",
    },
    firstName: 'Maria',
  },
  {
    name: 'HVAC tune-up — Spanish, with quote note',
    input: {
      clientName: 'Carlos Hernández',
      appointmentDate: tomorrow,
      appointmentTime: '2:30 PM',
      serviceType: 'mantenimiento de aire acondicionado',
      language: 'es',
      contractorName: 'Aire Pro San Antonio',
      businessName: 'Aire Pro San Antonio',
      additionalNotes: 'Llevar cotización para reparación del compresor',
    },
    firstName: 'Carlos',
  },
  {
    name: 'long client name + long service type (stress)',
    input: {
      clientName: 'Maria Guadalupe Hernández-Villarreal',
      appointmentDate: tomorrow,
      appointmentTime: '11:15 AM',
      serviceType: 'full property landscape redesign with irrigation inspection and tree trimming',
      language: 'en',
      contractorName: 'Greenline Landscaping & Irrigation Services LLC',
      businessName: 'Greenline Landscaping & Irrigation Services LLC',
    },
    firstName: 'Maria',
  },
  {
    name: 'early-morning appointment with weather note — English',
    input: {
      clientName: 'Tom Reyes',
      appointmentDate: tomorrow,
      appointmentTime: '6:00 AM',
      serviceType: 'lawn mowing',
      language: 'en',
      contractorName: 'YardPro',
      businessName: 'YardPro',
      additionalNotes: 'Heavy dew expected — wear boots if you walk the yard before we arrive',
    },
    firstName: 'Tom',
  },
  {
    name: 'Spanish reminder — repeat customer, business name sign-off',
    input: {
      clientName: 'Susana Patel',
      appointmentDate: saturday,
      appointmentTime: '10:00 AM',
      serviceType: 'servicio de jardinería quincenal',
      language: 'es',
      contractorName: 'Jardines Verdes',
      businessName: 'Jardines Verdes',
      additionalNotes: 'El mismo equipo de la última visita',
    },
    firstName: 'Susana',
  },
]

const PLACEHOLDER_PATTERNS = [
  /\[\s*name\s*\]/i,
  /\[\s*date\s*\]/i,
  /\[\s*time\s*\]/i,
  /\{\s*name\s*\}/i,
  /\{\s*date\s*\}/i,
  /\bTBD\b/,
  /\bXXX\b/,
]

const SPANISH_HINTS = [/\bsu\b/i, /\bpara\b/i, /\bcita\b/i, /\bmañana\b/i, /\btarde\b/i, /\bnos vemos\b/i, /\brecordatorio\b/i]
const ENGLISH_HINTS = [/\byour\b/i, /\bat\b/i, /\bsee you\b/i, /\bappointment\b/i, /\bscheduled\b/i, /\breminder\b/i, /\bservice\b/i]

// Exact A2P opt-out wording per language. Mirrors lib/aiDraft.buildOptOutLine
// and the default SMS templates.
function expectedOptOut(businessName, language) {
  return language === 'es'
    ? `Responda STOP para cancelar. – ${businessName}`
    : `Reply STOP to opt out. – ${businessName}`
}

function containsTime(draft, time) {
  if (draft.toLowerCase().includes(time.toLowerCase())) return true
  // Fallback: hour + meridian (e.g. "9:00 AM" → match "9am" or "9 am")
  const m = time.match(/(\d{1,2})(?::\d{2})?\s*(am|pm)/i)
  if (!m) return false
  const hour = m[1]
  const mer = m[2].toLowerCase()
  const re = new RegExp(`\\b${hour}\\s*${mer}\\b`, 'i')
  return re.test(draft)
}

function checkSample(sample, response) {
  const checks = []
  const draft = response?.draft
  const isStr = typeof draft === 'string'
  const { language, businessName } = sample.input
  const optOut = expectedOptOut(businessName, language)

  checks.push({ name: 'response is { draft, charCount }',     pass: isStr && typeof response?.charCount === 'number' })
  checks.push({ name: 'draft is non-empty',                   pass: isStr && draft.trim().length > 0 })
  checks.push({ name: 'draft length ≤ 320',                   pass: isStr && draft.length <= 320 })
  checks.push({ name: 'charCount matches actual length',      pass: isStr && response?.charCount === draft.length })
  checks.push({ name: `contains first name "${sample.firstName}"`, pass: isStr && draft.toLowerCase().includes(sample.firstName.toLowerCase()) })
  checks.push({ name: `contains time form "${sample.input.appointmentTime}"`, pass: isStr && containsTime(draft, sample.input.appointmentTime) })
  checks.push({ name: 'contains contractor business name',    pass: isStr && draft.toLowerCase().includes(businessName.toLowerCase()) })
  checks.push({ name: 'no placeholder tokens',                pass: isStr && !PLACEHOLDER_PATTERNS.some(re => re.test(draft)) })
  checks.push({ name: 'at most one exclamation mark',         pass: isStr && (draft.match(/!/g) || []).length <= 1 })

  // BUG 1 regression coverage ───────────────────────────────────────────────
  // (a) opt-out line present, verbatim, in the message language
  checks.push({ name: `opt-out line in ${language} ("${optOut}")`, pass: isStr && draft.includes(optOut) })
  // (b) signed with the business name, NOT "YardSync"
  const businessIsYardSync = /yardsync/i.test(businessName)
  checks.push({ name: 'sign-off is NOT "YardSync"', pass: isStr && (businessIsYardSync || !/yardsync/i.test(draft)) })
  // wrong-language opt-out must NOT appear
  const wrongOptOutFragment = language === 'es' ? /Reply STOP to opt out/i : /Responda STOP para cancelar/i
  checks.push({ name: 'no opposite-language opt-out line', pass: isStr && !wrongOptOutFragment.test(draft) })

  // (c) message is in the requested language
  if (language === 'es') {
    checks.push({ name: 'message reads as Spanish',  pass: isStr && SPANISH_HINTS.some(re => re.test(draft)) })
  } else {
    checks.push({ name: 'message reads as English',  pass: isStr && ENGLISH_HINTS.some(re => re.test(draft)) })
  }

  return checks
}

async function runSample(sample) {
  let response
  let httpStatus
  try {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(sample.input),
    })
    httpStatus = res.status
    response = await res.json().catch(() => ({}))
    if (!res.ok) {
      return { sample, error: `HTTP ${res.status}: ${response?.error || 'unknown'}`, checks: [], response }
    }
  } catch (err) {
    return { sample, error: `fetch failed: ${err.message}`, checks: [], response: null }
  }
  return { sample, error: null, checks: checkSample(sample, response), response, httpStatus }
}

function formatChecks(checks) {
  return checks.map(c => `    ${c.pass ? '✓' : '✗'} ${c.name}`).join('\n')
}

async function main() {
  console.log(`AI draft-message eval — ${ENDPOINT}\n`)

  const results = []
  for (const sample of SAMPLES) {
    process.stdout.write(`▶ ${sample.name}\n`)
    const result = await runSample(sample)
    results.push(result)
    if (result.error) {
      console.log(`    ✗ ${result.error}\n`)
      continue
    }
    console.log(`    draft: ${JSON.stringify(result.response.draft)}`)
    console.log(`    chars: ${result.response.charCount}`)
    console.log(formatChecks(result.checks))
    console.log('')
  }

  const totals = results.reduce((acc, r) => {
    if (r.error) {
      acc.failed += 1
    } else {
      const allPass = r.checks.every(c => c.pass)
      if (allPass) acc.passed += 1; else acc.failed += 1
    }
    return acc
  }, { passed: 0, failed: 0 })

  console.log('— Summary —')
  console.log(`  Passed: ${totals.passed}/${SAMPLES.length}`)
  console.log(`  Failed: ${totals.failed}/${SAMPLES.length}`)

  process.exit(totals.failed === 0 ? 0 : 1)
}

main().catch(err => {
  console.error('Eval crashed:', err)
  process.exit(1)
})
