/**
 * GET /api/admin/test-reward-emails?secret=<CRON_SECRET>
 *
 * Throwaway route — fires all 5 reward notification templates to ADMIN_EMAIL
 * so Jay can eyeball them in a real inbox / check SendGrid delivery logs.
 *
 * Delete this file after verification is complete.
 */

import sgMail from '@sendgrid/mail'

const LANG = 'en'

function wrap(heading, paragraphs) {
  return `<div style="font-family:-apple-system,'DM Sans',sans-serif;max-width:560px;margin:0 auto;padding:24px;">
  <h2 style="color:#16a34a;margin:0 0 16px;">${heading}</h2>
  ${paragraphs.map(p => `<p style="color:#374151;font-size:15px;line-height:1.6;margin:0 0 12px;">${p}</p>`).join('\n  ')}
  <p style="color:#6b7280;font-size:13px;margin:16px 0 0;">
    Track your progress anytime in Settings → YardSync Pay Rewards.
  </p>
</div>`
}

const TESTS = [
  {
    event: 'milestone_half',
    subject: "[TEST 1/5] You're halfway to 50% off your YardSync subscription",
    html: wrap('Great month!', [
      `You invoiced <strong>$1,800</strong> through YardSync last month.`,
      `You're now <strong>1 of 2 qualifying months</strong> away from cutting your subscription in half — from $39/mo to just <strong>$19.50/mo</strong>.`,
      `Keep it up next month and the discount kicks in automatically. No action needed on your end.`,
    ]),
    text: `Great month! You invoiced $1,800 through YardSync last month. One of 2 qualifying months completed toward 50% off.`,
  },
  {
    event: 'milestone_free',
    subject: "[TEST 2/5] You're one month away from a FREE YardSync subscription",
    html: wrap('Incredible month!', [
      `<strong>$3,500</strong> invoiced through YardSync!`,
      `You're now <strong>1 month away</strong> from earning a free subscription. Hit $3,000+ again next month and your $39/mo drops to <strong>$0</strong>.`,
      `The 5.5% per-invoice fee still applies, but your subscription is on the house.`,
    ]),
    text: `Incredible month — $3,500 invoiced! One more month at $3,000+ and your subscription is free.`,
  },
  {
    event: 'activated_half',
    subject: '[TEST 3/5] Your 50% discount is now active!',
    html: wrap('50% discount active!', [
      `It's official — you've invoiced <strong>$1,500+</strong> for two consecutive months.`,
      `Your YardSync subscription is now <strong>$19.50/mo</strong> (50% off).`,
      `This discount stays active as long as you keep invoicing $1,500+/mo. If your volume dips below the threshold for a month, you'll go back to $39/mo — but you can always earn it back.`,
    ]),
    text: `50% discount activated! Your subscription is now $19.50/mo.`,
  },
  {
    event: 'activated_free',
    subject: '[TEST 4/5] Your YardSync subscription is now FREE',
    html: wrap('FREE subscription unlocked!', [
      `You earned it — <strong>$3,000+</strong> invoiced two months running.`,
      `Your subscription is now <strong>$0/mo</strong>.`,
      `The 5.5% per-invoice fee still applies, but your monthly subscription fee is completely waived. Keep up the volume and it stays free.`,
    ]),
    text: `FREE subscription unlocked! $0/mo as long as you keep invoicing $3,000+/mo.`,
  },
  {
    event: 'dropped',
    subject: '[TEST 5/5] Your YardSync volume reward has paused',
    html: wrap('Reward paused', [
      `Your invoice volume last month was <strong>$800</strong>, which is below the $1,500 threshold.`,
      `Your subscription has returned to <strong>$39/mo</strong>.`,
      `This isn't permanent — hit the threshold again for 2 consecutive months and the discount comes right back.`,
    ]),
    text: `Your volume dipped below the threshold. Your discount has paused. Hit the target 2 months in a row to earn it back.`,
  },
]

export async function GET(request) {
  const url = new URL(request.url)
  const secret = url.searchParams.get('secret')
  if (secret !== process.env.CRON_SECRET) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const to = process.env.ADMIN_EMAIL
  const fromEmail = process.env.SENDGRID_FROM_EMAIL
  const apiKey = process.env.SENDGRID_API_KEY
  if (!to || !fromEmail || !apiKey) {
    return Response.json({
      error: 'Missing env',
      hasAdminEmail: !!to,
      hasFromEmail: !!fromEmail,
      hasApiKey: !!apiKey,
    }, { status: 500 })
  }

  sgMail.setApiKey(apiKey)

  const results = []
  for (const t of TESTS) {
    try {
      await sgMail.send({
        to,
        from: { email: fromEmail, name: 'YardSync' },
        subject: t.subject,
        html: t.html,
        text: t.text,
      })
      results.push({ event: t.event, ok: true })
    } catch (err) {
      const detail = err.response?.body?.errors?.[0]?.message || err.message
      results.push({ event: t.event, ok: false, error: detail })
    }
  }

  return Response.json({ sent: results.filter(r => r.ok).length, total: TESTS.length, to, results })
}
