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
// (the caller renders a fallback / skips the image).
export async function loadImage(url) {
  if (!url) return null
  try {
    const res = await fetch(url, { mode: 'cors' })
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

  // Background — accent
  ctx.fillStyle = accent
  ctx.fillRect(0, 0, width, height)

  // White panel
  const pad = Math.round(width * 0.055)
  const px = pad, py = pad, pw = width - pad * 2, ph = height - pad * 2
  ctx.fillStyle = '#ffffff'
  roundRect(ctx, px, py, pw, ph, Math.round(width * 0.045))
  ctx.fill()

  const cx = width / 2
  const innerW = pw - pad * 1.2
  let y = py + Math.round(ph * (story ? 0.075 : 0.085))

  // Logo / headshot (logo preferred)
  const avatar = data.logoImg || data.headshotImg
  const ar = Math.round(width * (story ? 0.11 : 0.105))
  if (avatar) {
    drawCircleImage(ctx, avatar, cx, y + ar, ar)
  } else {
    ctx.fillStyle = accent
    ctx.beginPath(); ctx.arc(cx, y + ar, ar, 0, Math.PI * 2); ctx.fill()
    ctx.fillStyle = '#ffffff'
    ctx.font = `700 ${Math.round(ar * 0.9)}px ${FONT}`
    ctx.fillText(getInitials(data.businessName), cx, y + ar + ar * 0.32)
  }
  y += ar * 2 + Math.round(height * 0.035)

  // Business name
  ctx.fillStyle = '#111827'
  const nameSize = Math.round(width * (story ? 0.066 : 0.062))
  ctx.font = `700 ${nameSize}px ${FONT}`
  const nameLines = wrapText(ctx, data.businessName || 'Your Business', innerW, 2)
  for (const ln of nameLines) { ctx.fillText(ln, cx, y + nameSize); y += nameSize * 1.12 }
  y += Math.round(height * 0.012)

  // Tagline
  if (data.tagline) {
    ctx.fillStyle = '#6B7280'
    const tagSize = Math.round(width * 0.032)
    ctx.font = `500 ${tagSize}px ${FONT}`
    const tagLines = wrapText(ctx, data.tagline, innerW, 2)
    for (const ln of tagLines) { ctx.fillText(ln, cx, y + tagSize); y += tagSize * 1.3 }
    y += Math.round(height * 0.012)
  }

  // Badges row
  const badges = []
  if (data.cardStatusBadge !== 'none') badges.push(t('booking', lang))
  if (data.offersFreeEstimate) badges.push(t('free', lang))
  if (badges.length) {
    const bSize = Math.round(width * 0.026)
    ctx.font = `600 ${bSize}px ${FONT}`
    const gap = Math.round(width * 0.02)
    const padX = Math.round(width * 0.025), bh = Math.round(bSize * 2.1)
    const widths = badges.map(b => ctx.measureText(b).width + padX * 2)
    let totalW = widths.reduce((a, b) => a + b, 0) + gap * (badges.length - 1)
    let bx = cx - totalW / 2
    badges.forEach((b, i) => {
      ctx.fillStyle = i === 0 ? accent : '#F3F4F6'
      roundRect(ctx, bx, y, widths[i], bh, bh / 2); ctx.fill()
      ctx.fillStyle = i === 0 ? '#ffffff' : '#374151'
      ctx.fillText(b, bx + widths[i] / 2, y + bh * 0.66)
      bx += widths[i] + gap
    })
    y += bh + Math.round(height * 0.03)
  } else {
    y += Math.round(height * 0.015)
  }

  // QR block — white rounded box with the QR centered
  const qrImg = await qrBitmap(qrUrl, { size: 1024, color: accent })
  const boxSize = Math.round(width * (story ? 0.46 : 0.42))
  const bx = cx - boxSize / 2
  ctx.save()
  ctx.shadowColor = 'rgba(0,0,0,0.08)'
  ctx.shadowBlur = Math.round(width * 0.02)
  ctx.shadowOffsetY = Math.round(width * 0.008)
  ctx.fillStyle = '#ffffff'
  roundRect(ctx, bx, y, boxSize, boxSize, Math.round(width * 0.03)); ctx.fill()
  ctx.restore()
  ctx.strokeStyle = '#E5E7EB'; ctx.lineWidth = 2
  roundRect(ctx, bx, y, boxSize, boxSize, Math.round(width * 0.03)); ctx.stroke()
  const qrInset = Math.round(boxSize * 0.08)
  ctx.drawImage(qrImg, bx + qrInset, y + qrInset, boxSize - qrInset * 2, boxSize - qrInset * 2)
  y += boxSize + Math.round(height * 0.03)

  // CTA
  ctx.fillStyle = accent
  const ctaSize = Math.round(width * 0.036)
  ctx.font = `700 ${ctaSize}px ${FONT}`
  ctx.fillText(t('scan', lang), cx, y + ctaSize)
  y += ctaSize * 1.5

  // URL
  if (data.cardUrlLabel) {
    ctx.fillStyle = '#6B7280'
    const uSize = Math.round(width * 0.028)
    ctx.font = `500 ${uSize}px ${FONT}`
    ctx.fillText(data.cardUrlLabel, cx, y + uSize)
  }

  // Footer — Powered by YardSync, pinned near panel bottom
  ctx.fillStyle = '#9CA3AF'
  const fSize = Math.round(width * 0.024)
  ctx.font = `500 ${fSize}px ${FONT}`
  ctx.fillText(t('powered', lang), cx, py + ph - Math.round(ph * 0.04))
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
