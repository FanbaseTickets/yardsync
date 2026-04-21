import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { queryCollection, getDocument, updateDocument } from '@/lib/firestoreRest'
import { sendClientEmail } from '@/lib/email'
import { sendSms } from '@/lib/sms'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)

// Idempotency gate: skip if the same event was already sent this calendar month.
// Prevents duplicate notifications on manual cron re-runs.
function shouldNotify(userData, eventKey) {
  const last = userData?.lastNotifiedEvent
  const lastAt = userData?.lastNotifiedAt
  if (last !== eventKey) return true
  if (!lastAt) return true
  const d = new Date(lastAt)
  const now = new Date()
  if (d.getUTCFullYear() === now.getUTCFullYear() && d.getUTCMonth() === now.getUTCMonth()) {
    return false
  }
  return true
}

// Bilingual email + SMS templates for each event.
function buildNotification(eventKey, { volumeDollars, fromTier, lang }) {
  const es = lang === 'es'
  const amount = `$${Number(volumeDollars || 0).toLocaleString('en-US', { maximumFractionDigits: 0 })}`
  const dropThreshold = fromTier === 'free' ? '$3,000' : '$1,500'

  const wrap = (heading, paragraphs) => `
<div style="font-family:-apple-system,'DM Sans',sans-serif;max-width:560px;margin:0 auto;padding:24px;">
  <h2 style="color:#16a34a;margin:0 0 16px;">${heading}</h2>
  ${paragraphs.map(p => `<p style="color:#374151;font-size:15px;line-height:1.6;margin:0 0 12px;">${p}</p>`).join('\n  ')}
  <p style="color:#6b7280;font-size:13px;margin:16px 0 0;">
    ${es ? 'Revisa tu progreso en Ajustes → Recompensas YardSync Pay.' : 'Track your progress anytime in Settings → YardSync Pay Rewards.'}
  </p>
</div>`

  if (eventKey === 'milestone_half') {
    if (es) return {
      subject: 'Estás a medio camino del 50% de descuento en tu suscripción de YardSync',
      text: `¡Gran mes! Facturaste ${amount} a través de YardSync el mes pasado. Estás a 1 de 2 meses de calificación para reducir tu suscripción a la mitad — de $39/mes a solo $19.50/mes. Sigue así el próximo mes y el descuento se activa automáticamente.`,
      html: wrap('¡Gran mes!', [
        `Facturaste <strong>${amount}</strong> a través de YardSync el mes pasado.`,
        `Estás a <strong>1 de 2 meses de calificación</strong> para reducir tu suscripción a la mitad — de $39/mes a solo <strong>$19.50/mes</strong>.`,
        `Sigue así el próximo mes y el descuento se activa automáticamente. No necesitas hacer nada.`,
      ]),
    }
    return {
      subject: "You're halfway to 50% off your YardSync subscription",
      text: `Great month! You invoiced ${amount} through YardSync last month. You're now 1 of 2 qualifying months away from cutting your subscription in half — from $39/mo to just $19.50/mo. Keep it up next month and the discount kicks in automatically.`,
      html: wrap('Great month!', [
        `You invoiced <strong>${amount}</strong> through YardSync last month.`,
        `You're now <strong>1 of 2 qualifying months</strong> away from cutting your subscription in half — from $39/mo to just <strong>$19.50/mo</strong>.`,
        `Keep it up next month and the discount kicks in automatically. No action needed on your end.`,
      ]),
    }
  }

  if (eventKey === 'milestone_free') {
    if (es) return {
      subject: 'Estás a un mes de una suscripción GRATIS de YardSync',
      text: `¡Mes increíble — ${amount} facturados a través de YardSync! Estás a 1 mes de ganar una suscripción gratis. Alcanza $3,000+ de nuevo el próximo mes y tus $39/mes bajan a $0. La tarifa del 5.5% por factura sigue aplicando, pero tu suscripción corre por nuestra cuenta.`,
      html: wrap('¡Mes increíble!', [
        `<strong>${amount}</strong> facturados a través de YardSync!`,
        `Estás a <strong>1 mes</strong> de ganar una suscripción gratis. Alcanza $3,000+ de nuevo el próximo mes y tus $39/mes bajan a <strong>$0</strong>.`,
        `La tarifa del 5.5% por factura sigue aplicando, pero tu suscripción corre por nuestra cuenta.`,
      ]),
    }
    return {
      subject: "You're one month away from a FREE YardSync subscription",
      text: `Incredible month — ${amount} invoiced through YardSync! You're now 1 month away from earning a free subscription. Hit $3,000+ again next month and your $39/mo drops to $0. The 5.5% per-invoice fee still applies, but your subscription is on the house.`,
      html: wrap('Incredible month!', [
        `<strong>${amount}</strong> invoiced through YardSync!`,
        `You're now <strong>1 month away</strong> from earning a free subscription. Hit $3,000+ again next month and your $39/mo drops to <strong>$0</strong>.`,
        `The 5.5% per-invoice fee still applies, but your subscription is on the house.`,
      ]),
    }
  }

  if (eventKey === 'activated_half') {
    if (es) return {
      subject: '¡Tu descuento del 50% ya está activo!',
      text: `¡Es oficial — has facturado $1,500+ durante dos meses consecutivos. Tu suscripción de YardSync es ahora $19.50/mes (50% de descuento). Este descuento se mantiene activo mientras sigas facturando $1,500+/mes.`,
      html: wrap('¡Descuento del 50% activo!', [
        `Es oficial — has facturado <strong>$1,500+</strong> durante dos meses consecutivos.`,
        `Tu suscripción de YardSync es ahora <strong>$19.50/mes</strong> (50% de descuento).`,
        `Este descuento se mantiene activo mientras sigas facturando $1,500+/mes. Si tu volumen baja del umbral por un mes, regresarás a $39/mes — pero siempre puedes recuperarlo.`,
      ]),
      sms: 'YardSync: ¡Descuento del 50% activado! Tu suscripción es ahora $19.50/mes. Sigue facturando $1,500+/mes para mantenerlo.',
    }
    return {
      subject: 'Your 50% discount is now active!',
      text: `It's official — you've invoiced $1,500+ for two consecutive months. Your YardSync subscription is now $19.50/mo (50% off). This discount stays active as long as you keep invoicing $1,500+/mo.`,
      html: wrap('50% discount active!', [
        `It's official — you've invoiced <strong>$1,500+</strong> for two consecutive months.`,
        `Your YardSync subscription is now <strong>$19.50/mo</strong> (50% off).`,
        `This discount stays active as long as you keep invoicing $1,500+/mo. If your volume dips below the threshold for a month, you'll go back to $39/mo — but you can always earn it back.`,
      ]),
      sms: 'YardSync: 50% discount activated! Your subscription is now $19.50/mo. Keep invoicing $1,500+/mo to keep it.',
    }
  }

  if (eventKey === 'activated_free') {
    if (es) return {
      subject: 'Tu suscripción de YardSync ahora es GRATIS',
      text: `¡Te lo ganaste — $3,000+ facturados dos meses seguidos. Tu suscripción es ahora $0/mes. La tarifa del 5.5% por factura sigue aplicando, pero tu cuota mensual de suscripción está completamente eliminada.`,
      html: wrap('¡Suscripción GRATIS desbloqueada!', [
        `Te lo ganaste — <strong>$3,000+</strong> facturados dos meses seguidos.`,
        `Tu suscripción es ahora <strong>$0/mes</strong>.`,
        `La tarifa del 5.5% por factura sigue aplicando, pero tu cuota mensual de suscripción está completamente eliminada. Mantén el volumen y se queda gratis.`,
      ]),
      sms: 'YardSync: ¡Suscripción GRATIS desbloqueada! $0/mes mientras sigas facturando $3,000+/mes.',
    }
    return {
      subject: 'Your YardSync subscription is now FREE',
      text: `You earned it — $3,000+ invoiced two months running. Your subscription is now $0/mo. The 5.5% per-invoice fee still applies, but your monthly subscription fee is completely waived.`,
      html: wrap('FREE subscription unlocked!', [
        `You earned it — <strong>$3,000+</strong> invoiced two months running.`,
        `Your subscription is now <strong>$0/mo</strong>.`,
        `The 5.5% per-invoice fee still applies, but your monthly subscription fee is completely waived. Keep up the volume and it stays free.`,
      ]),
      sms: 'YardSync: FREE subscription unlocked! $0/mo as long as you keep invoicing $3,000+/mo. Congrats!',
    }
  }

  if (eventKey === 'dropped') {
    if (es) return {
      subject: 'Tu recompensa de volumen de YardSync se ha pausado',
      text: `Tu volumen de facturas el mes pasado fue ${amount}, que está por debajo del umbral de ${dropThreshold}. Tu suscripción ha regresado a $39/mes. Esto no es permanente — alcanza el umbral de nuevo por 2 meses consecutivos y el descuento vuelve.`,
      html: wrap('Recompensa pausada', [
        `Tu volumen de facturas el mes pasado fue <strong>${amount}</strong>, por debajo del umbral de ${dropThreshold}.`,
        `Tu suscripción ha regresado a <strong>$39/mes</strong>.`,
        `Esto no es permanente — alcanza el umbral de nuevo por 2 meses consecutivos y el descuento vuelve.`,
      ]),
      sms: `YardSync: Tu volumen bajó del umbral el mes pasado. Tu descuento se ha pausado. Alcanza la meta 2 meses seguidos para recuperarlo.`,
    }
    return {
      subject: 'Your YardSync volume reward has paused',
      text: `Your invoice volume last month was ${amount}, which is below the ${dropThreshold} threshold. Your subscription has returned to $39/mo. This isn't permanent — hit the threshold again for 2 consecutive months and the discount comes right back.`,
      html: wrap('Reward paused', [
        `Your invoice volume last month was <strong>${amount}</strong>, which is below the ${dropThreshold} threshold.`,
        `Your subscription has returned to <strong>$39/mo</strong>.`,
        `This isn't permanent — hit the threshold again for 2 consecutive months and the discount comes right back.`,
      ]),
      sms: `YardSync: Your volume dipped below the threshold last month, so your discount has paused. Hit the target 2 months in a row to earn it back.`,
    }
  }

  return null
}

// Fire email (and optionally SMS) for an event. Wrapped in try/catch —
// notification failures never crash the cron or block reward processing.
async function fireNotification({ eventKey, userData, uid, withSms, volumeDollars, fromTier }) {
  try {
    if (!shouldNotify(userData, eventKey)) {
      console.log(`[reward-check] ${uid} — skipping ${eventKey} (already sent this month)`)
      return
    }
    const lang = userData?.preferredLanguage || userData?.language || 'en'
    const tmpl = buildNotification(eventKey, { volumeDollars, fromTier, lang })
    if (!tmpl) return

    const email = userData?.email
    if (email) {
      await sendClientEmail({
        to:       email,
        subject:  tmpl.subject,
        html:     tmpl.html,
        text:     tmpl.text,
        fromName: 'YardSync',
      })
    } else {
      console.log(`[reward-check] ${uid} — no email on file for ${eventKey}`)
    }

    if (withSms && tmpl.sms) {
      const phone = userData?.phone
      if (phone) {
        await sendSms({ to: phone, body: tmpl.sms })
      } else {
        console.log(`[reward-check] ${uid} — no phone on file for ${eventKey} SMS`)
      }
    }

    await updateDocument('users', uid, {
      lastNotifiedEvent: eventKey,
      lastNotifiedAt:    new Date().toISOString(),
      updatedAt:         new Date().toISOString(),
    })
    console.log(`[reward-check] ${uid} — ${eventKey} notification sent`)
  } catch (err) {
    console.error(`[reward-check] ${uid} — ${eventKey} notification failed (non-fatal):`, err.message)
  }
}

export async function GET(req) {
  // Security check
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Get previous month date range (UTC)
  const now = new Date()
  const firstOfLastMonth = new Date(Date.UTC(
    now.getUTCMonth() === 0 ? now.getUTCFullYear() - 1 : now.getUTCFullYear(),
    now.getUTCMonth() === 0 ? 11 : now.getUTCMonth() - 1,
    1
  ))
  const firstOfThisMonth = new Date(Date.UTC(
    now.getUTCFullYear(), now.getUTCMonth(), 1
  ))
  const periodStart = Math.floor(firstOfLastMonth.getTime() / 1000)
  const periodEnd = Math.floor(firstOfThisMonth.getTime() / 1000)

  // List all active subscriptions
  const subscriptions = await stripe.subscriptions.list({
    status: 'active',
    limit: 100,
  })

  const results = []

  for (const sub of subscriptions.data) {
    // Look up stripeAccountId via Firestore (subscription metadata is unreliable —
    // the save-account-metadata endpoint fire-and-forget races with Connect completion)
    const subDoc = await queryCollection('subscriptions', 'stripeSubscriptionId', sub.id)
    if (!subDoc) {
      console.warn(`[reward-check] No subscriptions doc for ${sub.id} — skipping`)
      continue
    }
    const uid = subDoc.data.gardenerUid
    const userDoc = await getDocument('users', uid)
    if (!userDoc) {
      console.warn(`[reward-check] No users doc for uid=${uid} — skipping`)
      continue
    }
    const stripeAccountId = userDoc.data.stripeAccountId
    if (!stripeAccountId) {
      console.log(`[reward-check] ${uid} has no stripeAccountId (Connect not complete) — skipping`)
      continue
    }

    // Sum paid charges on connected account for previous month
    const charges = await stripe.charges.list(
      {
        created: { gte: periodStart, lt: periodEnd },
        limit: 100,
      },
      { stripeAccount: stripeAccountId }
    )

    const volume = charges.data
      .filter(c => c.paid && !c.refunded)
      .reduce((sum, c) => sum + c.amount, 0)

    const volumeDollars = volume / 100

    // Determine tier
    let tier = 'base'
    if (volumeDollars >= 3000) tier = 'free'
    else if (volumeDollars >= 1500) tier = 'half'

    // Read current streak from metadata
    const currentStreak = parseInt(sub.metadata?.rewardStreak || '0')
    const currentTierHeld = sub.metadata?.rewardTierHeld || 'base'

    let newStreak = 0
    let newTierHeld = tier

    if (tier !== 'base' && tier === currentTierHeld) {
      // Same tier held — increment streak
      newStreak = currentStreak + 1
    } else if (tier !== 'base') {
      // New tier reached — start streak at 1
      newStreak = 1
    } else {
      // Fell below threshold — reset
      newStreak = 0
      newTierHeld = 'base'
    }

    // Update metadata
    await stripe.subscriptions.update(sub.id, {
      metadata: {
        ...sub.metadata,
        rewardStreak: String(newStreak),
        rewardTierHeld: newTierHeld,
        lastVolumeCheck: firstOfLastMonth.toISOString().slice(0, 7),
        lastVolumeAmount: String(volumeDollars),
      },
    })

    // Write reward status to Firestore user doc so Settings can display it
    await updateDocument('users', uid, {
      rewardTier:       newTierHeld,
      rewardStreak:     newStreak,
      lastVolumeCheck:  firstOfLastMonth.toISOString().slice(0, 7),
      lastVolumeAmount: volumeDollars,
      updatedAt:        new Date().toISOString(),
    })

    // ── Milestone notifications (email only) — fire on first qualifying month ──
    if (currentStreak === 0 && newStreak === 1 && tier === 'half') {
      await fireNotification({ eventKey: 'milestone_half', userData: userDoc.data, uid, withSms: false, volumeDollars })
    } else if (currentStreak === 0 && newStreak === 1 && tier === 'free') {
      await fireNotification({ eventKey: 'milestone_free', userData: userDoc.data, uid, withSms: false, volumeDollars })
    }

    // Apply discount at streak = 2.
    // Stripe 2025+ subscriptions use flexible billing mode which requires
    // `discounts: [{ coupon }]` instead of the legacy `coupon` parameter.
    if (newStreak >= 2) {
      const couponId = tier === 'free'
        ? 'YARDSYNC_FREE'
        : 'YARDSYNC_50OFF'

      // Read existing discounts (array in flexible mode, single object in legacy)
      const existingCouponIds = (sub.discounts || []).map(d => d?.coupon?.id).filter(Boolean)
      const legacyCouponId    = sub.discount?.coupon?.id
      const alreadyApplied    = existingCouponIds.includes(couponId) || legacyCouponId === couponId

      if (!alreadyApplied) {
        await stripe.subscriptions.update(sub.id, {
          discounts: [{ coupon: couponId }],
        })
        // ── Activation notification (email + SMS) — only on the transition ──
        const eventKey = tier === 'free' ? 'activated_free' : 'activated_half'
        await fireNotification({ eventKey, userData: userDoc.data, uid, withSms: true, volumeDollars })
      }
    }

    // If fell back below threshold, remove any active discount.
    // Note: in flexible billing mode, `update({ discounts: [] })` silently no-ops;
    // must use deleteDiscount to actually clear.
    const hasActiveDiscount = (sub.discounts && sub.discounts.length > 0) || !!sub.discount
    if (tier === 'base' && hasActiveDiscount) {
      await stripe.subscriptions.deleteDiscount(sub.id)
      await updateDocument('users', uid, {
        rewardTier:       'base',
        rewardStreak:     0,
        lastVolumeCheck:  firstOfLastMonth.toISOString().slice(0, 7),
        lastVolumeAmount: volumeDollars,
        updatedAt:        new Date().toISOString(),
      })
      // ── Drop notification (email + SMS) — only on the transition ──
      await fireNotification({ eventKey: 'dropped', userData: userDoc.data, uid, withSms: true, volumeDollars, fromTier: currentTierHeld })
    }

    results.push({
      subscriptionId: sub.id,
      stripeAccountId,
      volumeDollars,
      tier,
      newStreak,
      couponApplied: newStreak >= 2 ? (tier === 'free' ? 'YARDSYNC_FREE' : 'YARDSYNC_50OFF') : null,
    })
  }

  console.log(`[reward-check] Processed ${results.length} subscriptions:`, JSON.stringify(results))
  return NextResponse.json({ processed: results.length, results })
}
