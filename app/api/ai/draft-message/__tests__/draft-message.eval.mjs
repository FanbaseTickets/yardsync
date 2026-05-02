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
      additionalNotes: 'Heavy dew expected — wear boots if you walk the yard before we arrive',
    },
    firstName: 'Tom',
  },
  {
    name: 'weekend appointment — English, repeat customer',
    input: {
      clientName: 'Susan Patel',
      appointmentDate: saturday,
      appointmentTime: '10:00 AM',
      serviceType: 'biweekly lawn service',
      language: 'en',
      contractorName: 'Greenline Lawn Care',
      additionalNotes: 'Same crew as last visit',
    },
    firstName: 'Susan',
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

  checks.push({ name: 'response is { draft, charCount }',     pass: typeof draft === 'string' && typeof response?.charCount === 'number' })
  checks.push({ name: 'draft is non-empty',                   pass: typeof draft === 'string' && draft.trim().length > 0 })
  checks.push({ name: 'draft length ≤ 320',                   pass: typeof draft === 'string' && draft.length <= 320 })
  checks.push({ name: 'charCount matches actual length',      pass: typeof draft === 'string' && response?.charCount === draft.length })
  checks.push({ name: `contains first name "${sample.firstName}"`, pass: typeof draft === 'string' && draft.toLowerCase().includes(sample.firstName.toLowerCase()) })
  checks.push({ name: `contains time form "${sample.input.appointmentTime}"`, pass: typeof draft === 'string' && containsTime(draft, sample.input.appointmentTime) })
  checks.push({ name: 'contains contractor business name',    pass: typeof draft === 'string' && draft.toLowerCase().includes(sample.input.contractorName.toLowerCase()) })
  checks.push({ name: 'no placeholder tokens',                pass: typeof draft === 'string' && !PLACEHOLDER_PATTERNS.some(re => re.test(draft)) })
  checks.push({ name: 'at most one exclamation mark',         pass: typeof draft === 'string' && (draft.match(/!/g) || []).length <= 1 })

  if (sample.input.language === 'es') {
    checks.push({ name: 'contains Spanish-distinctive word',  pass: typeof draft === 'string' && SPANISH_HINTS.some(re => re.test(draft)) })
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
