/**
 * Client-side marketing-asset composition for the YardSync digital business card.
 *
 * Given a contractor's card data (business name, tagline, logo/headshot, accent
 * color, badges) it draws shareable PNGs onto a <canvas>:
 *   - composeSocial(...)  → square (1080×1080) post or story (1080×1920)
 *   - qrPngDataUrl(...)   → a clean standalone QR PNG
 *
 * All rendering is in the browser (no server cost). Remote images (logo/
 * headshot live on Firebase Storage) are fetched as blobs and decoded with
 * createImageBitmap so the canvas is never cross-origin "tainted" and
 * toBlob() export works. The QR uses the existing `qrcode` dependency.
 *
 * Shared with the printable PDF card (C10 Phase B PR2) — keep the layout
 * primitives here so both stay visually consistent.
 */

import QRCode from 'qrcode'

const STRINGS = {
  scan:    { en: 'Scan to request service', es: 'Escanea para solicitar servicio' },
  booking: { en: 'Now booking',             es: 'Reservando ahora' },
  free:    { en: 'Free estimate',           es: 'Estimado gratis' },
  powered: { en: 'Powered by YardSync',     es: 'Hecho con YardSync' },
}
const t = (k, lang) => STRINGS[k][lang === 'es' ? 'es' : 'en']

// ── Asset loading ──────────────────────────────────────────────────────────

// Decode a remote image without tainting the canvas. Returns null on failure
// (the caller renders a fallback / skips the image). Remote http(s) URLs go
// through our same-origin /api/card-image proxy because Firebase Storage URLs
// don't send CORS headers — a direct fetch would be blocked and the export
// would taint. Data URLs (the QR) are fetched directly.
export async function loadImage(url) {
  if (!url) return null
  try {
    const src = /^https?:\/\//i.test(url) ? `/api/card-image?url=${encodeURIComponent(url)}` : url
    const res = await fetch(src)
    if (!res.ok) return null
    const blob = await res.blob()
    return await createImageBitmap(blob)
  } catch {
    return null
  }
}

// QR as a PNG data URL (also reused to draw the QR onto the social images).
export async function qrPngDataUrl(text, { size = 1024, color = '#0F6E56' } = {}) {
  return QRCode.toDataURL(text, {
    width: size,
    margin: 2,
    errorCorrectionLevel: 'M',
    color: { dark: color, light: '#ffffff' },
  })
}

async function qrBitmap(text, opts) {
  const dataUrl = await qrPngDataUrl(text, opts)
  const blob = await (await fetch(dataUrl)).blob()
  return createImageBitmap(blob)
}

// ── Canvas primitives ────────────────────────────────────────────────────────

function roundRect(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2)
  ctx.beginPath()
  ctx.moveTo(x + rr, y)
  ctx.arcTo(x + w, y, x + w, y + h, rr)
  ctx.arcTo(x + w, y + h, x, y + h, rr)
  ctx.arcTo(x, y + h, x, y, rr)
  ctx.arcTo(x, y, x + w, y, rr)
  ctx.closePath()
}

function drawCircleImage(ctx, img, cx, cy, r) {
  ctx.save()
  ctx.beginPath()
  ctx.arc(cx, cy, r, 0, Math.PI * 2)
  ctx.clip()
  const ar = img.width / img.height
  let dw, dh
  if (ar > 1) { dh = 2 * r; dw = dh * ar } else { dw = 2 * r; dh = dw / ar }
  ctx.drawImage(img, cx - dw / 2, cy - dh / 2, dw, dh)
  ctx.restore()
}

// Contain-fit (no crop) an image inside a box, centered — for logos, which
// are often wide wordmarks that a circular cover-crop would mangle.
function drawContainImage(ctx, img, x, y, w, h, padding = 0) {
  const bw = w - padding * 2, bh = h - padding * 2
  const ar = img.width / img.height
  let dw = bw, dh = bw / ar
  if (dh > bh) { dh = bh; dw = bh * ar }
  ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh)
}

function wrapText(ctx, text, maxWidth, maxLines) {
  const words = String(text).trim().split(/\s+/)
  const lines = []
  let line = ''
  for (let i = 0; i < words.length; i++) {
    const w = words[i]
    const test = line ? `${line} ${w}` : w
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line)
      line = w
      if (maxLines && lines.length === maxLines - 1) {
        // Final allowed line — cram the remaining words, ellipsize if too wide.
        let rest = words.slice(i).join(' ')
        if (ctx.measureText(rest).width > maxWidth) {
          while (rest.length > 1 && ctx.measureText(rest + '…').width > maxWidth) rest = rest.slice(0, -1)
          rest += '…'
        }
        lines.push(rest)
        return lines
      }
    } else {
      line = test
    }
  }
  if (line) lines.push(line)
  return lines
}

function getInitials(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean)
  return ((parts[0]?.[0] || '') + (parts[1]?.[0] || '')).toUpperCase() || 'Y'
}

const FONT = "'DM Sans', system-ui, -apple-system, Segoe UI, Roboto, sans-serif"

// ── Social composition ───────────────────────────────────────────────────────

/**
 * Draw a marketing card onto `canvas`. Returns nothing — read the canvas after.
 * @param {HTMLCanvasElement} canvas
 * @param {object} opts { width, height, data, qrUrl, lang }
 *   data: { businessName, tagline, accentColor, logoImg, headshotImg,
 *           cardStatusBadge, offersFreeEstimate, cardUrlLabel }
 */
export async function composeSocial(canvas, { width, height, data, qrUrl, lang }) {
  const accent = data.accentColor || '#0F6E56'
  const story  = height > width
  // Ensure DM Sans is loaded before measuring/drawing text (else canvas falls
  // back to a system font and wrap math is off).
  try { await document.fonts?.ready } catch { /* non-fatal */ }
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  ctx.textAlign = 'center'
  ctx.textBaseline = 'alphabetic'

  // Background + white panel
  ctx.fillStyle = accent
  ctx.fillRect(0, 0, width, height)
  const pad = Math.round(width * 0.055)
  const px = pad, py = pad, pw = width - pad * 2, ph = height - pad * 2
  ctx.fillStyle = '#ffffff'
  roundRect(ctx, px, py, pw, ph, Math.round(width * 0.045))
  ctx.fill()

  const cx = width / 2
  const innerW = pw - pad * 1.2

  // ── Sizes (tighter on the shorter square so the CTA + URL always fit) ──
  const avatarR  = Math.round(width * (story ? 0.105 : 0.085))
  const nameSize = Math.round(width * (story ? 0.062 : 0.056))
  const tagSize  = Math.round(width * 0.032)
  const badgeSize = Math.round(width * 0.026)
  const ctaSize  = Math.round(width * 0.036)
  const urlSize  = Math.round(width * 0.027)
  const footSize = Math.round(width * 0.024)
  const gap      = Math.round(height * (story ? 0.024 : 0.016))

  // ── Measure blocks ──
  ctx.font = `700 ${nameSize}px ${FONT}`
  const nameLines = wrapText(ctx, data.businessName || 'Your Business', innerW, 2)
  ctx.font = `500 ${tagSize}px ${FONT}`
  const tagLines = data.tagline ? wrapText(ctx, data.tagline, innerW, 2) : []
  const badges = []
  if (data.cardStatusBadge !== 'none') badges.push(t('booking', lang))
  if (data.offersFreeEstimate) badges.push(t('free', lang))

  // Avatar mirrors the card: headshot is primary; a logo shows as a small badge
  // below it when BOTH exist; a logo alone becomes the (fitted) circle.
  const headshotImg = data.headshotImg
  const logoImg     = data.logoImg
  const showBadge   = !!(headshotImg && logoImg)
  const badgeSide   = Math.round(avatarR * 1.15)
  const badgeGap    = Math.round(avatarR * 0.22)
  const avatarH = avatarR * 2 + (showBadge ? badgeGap + badgeSide : 0)
  const nameH   = nameLines.length * nameSize * 1.12
  const tagH    = tagLines.length * tagSize * 1.3
  const badgeH  = badges.length ? Math.round(badgeSize * 2.1) : 0
  const ctaH    = ctaSize * 1.2
  const urlH    = data.cardUrlLabel ? urlSize * 1.2 : 0
  const footerH = footSize * 1.4

  // Footer pins near the panel bottom; the rest centers in the area above it.
  const topPad        = Math.round(ph * (story ? 0.06 : 0.04))
  const footerReserve = footerH + Math.round(ph * (story ? 0.05 : 0.04))
  const areaH         = ph - topPad - footerReserve

  // QR fills the leftover space so the CTA + URL always stay on-panel.
  const presentFixed = [avatarH, nameH, tagH, badgeH, ctaH, urlH].filter(Boolean)
  const gaps     = presentFixed.length // gaps between (fixed blocks + QR) === presentFixed.length
  const fixedSum = avatarH + nameH + tagH + badgeH + ctaH + urlH + gap * gaps
  let qrBox = Math.min(Math.round(width * (story ? 0.46 : 0.42)), areaH - fixedSum)
  qrBox = Math.max(qrBox, Math.round(width * (story ? 0.30 : 0.24)))

  const stackH = fixedSum + qrBox
  let y = py + topPad + Math.max(0, (areaH - stackH) / 2)

  // ── Avatar (headshot primary → logo fitted → initials; logo badge if both) ──
  const mainCy = y + avatarR
  if (headshotImg) {
    drawCircleImage(ctx, headshotImg, cx, mainCy, avatarR)
  } else if (logoImg) {
    // Logo-as-avatar: white circle + contain-fit logo (never cropped).
    ctx.fillStyle = '#ffffff'
    ctx.beginPath(); ctx.arc(cx, mainCy, avatarR, 0, Math.PI * 2); ctx.fill()
    ctx.strokeStyle = '#E5E7EB'; ctx.lineWidth = 2
    ctx.beginPath(); ctx.arc(cx, mainCy, avatarR, 0, Math.PI * 2); ctx.stroke()
    drawContainImage(ctx, logoImg, cx - avatarR, mainCy - avatarR, avatarR * 2, avatarR * 2, Math.round(avatarR * 0.28))
  } else {
    ctx.fillStyle = accent
    ctx.beginPath(); ctx.arc(cx, mainCy, avatarR, 0, Math.PI * 2); ctx.fill()
    ctx.fillStyle = '#ffffff'
    ctx.font = `700 ${Math.round(avatarR * 0.9)}px ${FONT}`
    ctx.fillText(getInitials(data.businessName), cx, mainCy + avatarR * 0.32)
  }
  if (showBadge) {
    const by = mainCy + avatarR + badgeGap
    const bx = cx - badgeSide / 2
    ctx.fillStyle = '#ffffff'
    roundRect(ctx, bx, by, badgeSide, badgeSide, Math.round(badgeSide * 0.22)); ctx.fill()
    ctx.strokeStyle = '#E5E7EB'; ctx.lineWidth = 2
    roundRect(ctx, bx, by, badgeSide, badgeSide, Math.round(badgeSide * 0.22)); ctx.stroke()
    drawContainImage(ctx, logoImg, bx, by, badgeSide, badgeSide, Math.round(badgeSide * 0.18))
  }
  y += avatarH

  // ── Business name ──
  y += gap
  ctx.fillStyle = '#111827'
  ctx.font = `700 ${nameSize}px ${FONT}`
  for (const ln of nameLines) { ctx.fillText(ln, cx, y + nameSize); y += nameSize * 1.12 }

  // ── Tagline ──
  if (tagLines.length) {
    y += gap
    ctx.fillStyle = '#6B7280'
    ctx.font = `500 ${tagSize}px ${FONT}`
    for (const ln of tagLines) { ctx.fillText(ln, cx, y + tagSize); y += tagSize * 1.3 }
  }

  // ── Badges ──
  if (badges.length) {
    y += gap
    ctx.font = `600 ${badgeSize}px ${FONT}`
    const bGap = Math.round(width * 0.02)
    const padX = Math.round(width * 0.025)
    const widths = badges.map(b => ctx.measureText(b).width + padX * 2)
    const totalW = widths.reduce((a, b) => a + b, 0) + bGap * (badges.length - 1)
    let bx = cx - totalW / 2
    badges.forEach((b, i) => {
      ctx.fillStyle = i === 0 ? accent : '#F3F4F6'
      roundRect(ctx, bx, y, widths[i], badgeH, badgeH / 2); ctx.fill()
      ctx.fillStyle = i === 0 ? '#ffffff' : '#374151'
      ctx.fillText(b, bx + widths[i] / 2, y + badgeH * 0.66)
      bx += widths[i] + bGap
    })
    y += badgeH
  }

  // ── QR block ──
  y += gap
  const qrImg = await qrBitmap(qrUrl, { size: 1024, color: accent })
  const qbx = cx - qrBox / 2
  ctx.save()
  ctx.shadowColor = 'rgba(0,0,0,0.08)'
  ctx.shadowBlur = Math.round(width * 0.02)
  ctx.shadowOffsetY = Math.round(width * 0.008)
  ctx.fillStyle = '#ffffff'
  roundRect(ctx, qbx, y, qrBox, qrBox, Math.round(width * 0.03)); ctx.fill()
  ctx.restore()
  ctx.strokeStyle = '#E5E7EB'; ctx.lineWidth = 2
  roundRect(ctx, qbx, y, qrBox, qrBox, Math.round(width * 0.03)); ctx.stroke()
  const qrInset = Math.round(qrBox * 0.08)
  ctx.drawImage(qrImg, qbx + qrInset, y + qrInset, qrBox - qrInset * 2, qrBox - qrInset * 2)
  y += qrBox

  // ── CTA ──
  y += gap
  ctx.fillStyle = accent
  ctx.font = `700 ${ctaSize}px ${FONT}`
  ctx.fillText(t('scan', lang), cx, y + ctaSize)
  y += ctaH

  // ── URL ──
  if (urlH) {
    y += gap
    ctx.fillStyle = '#6B7280'
    ctx.font = `500 ${urlSize}px ${FONT}`
    ctx.fillText(data.cardUrlLabel, cx, y + urlSize)
  }

  // ── Footer (pinned near panel bottom) ──
  ctx.fillStyle = '#9CA3AF'
  ctx.font = `500 ${footSize}px ${FONT}`
  ctx.fillText(t('powered', lang), cx, py + ph - Math.round(ph * (story ? 0.035 : 0.028)))
}

// Trigger a browser download of a canvas as PNG.
export function downloadCanvas(canvas, filename) {
  canvas.toBlob((blob) => {
    if (!blob) return
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }, 'image/png')
}

// Trigger a download from a data URL (used for the standalone QR PNG).
export function downloadDataUrl(dataUrl, filename) {
  const a = document.createElement('a')
  a.href = dataUrl
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
}

// Slugify a business name into a safe filename stem.
export function fileStem(name) {
  return String(name || 'yardsync-card')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'yardsync-card'
}
