// Generates the PWA app icons as plain PNGs using only Node's built-in zlib —
// no image/canvas dependency needed for a few flat-color glyphs.
import { deflateSync } from 'node:zlib'
import { writeFileSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const outDir = join(__dirname, '..', 'public', 'icons')
mkdirSync(outDir, { recursive: true })

const CRC_TABLE = (() => {
  const table = new Uint32Array(256)
  for (let n = 0; n < 256; n += 1) {
    let c = n
    for (let k = 0; k < 8; k += 1) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    }
    table[n] = c
  }
  return table
})()

function crc32(buf) {
  let c = 0xffffffff
  for (let i = 0; i < buf.length; i += 1) {
    c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  }
  return (c ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii')
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length, 0)
  const crcBuf = Buffer.alloc(4)
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0)
  return Buffer.concat([len, typeBuf, data, crcBuf])
}

function buildPNG(size, getPixel) {
  const raw = Buffer.alloc(size * (1 + size * 4))
  for (let y = 0; y < size; y += 1) {
    const rowStart = y * (1 + size * 4)
    raw[rowStart] = 0 // filter type: none
    for (let x = 0; x < size; x += 1) {
      const [r, g, b, a] = getPixel(x, y)
      const px = rowStart + 1 + x * 4
      raw[px] = r
      raw[px + 1] = g
      raw[px + 2] = b
      raw[px + 3] = a
    }
  }

  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 6 // color type: RGBA
  ihdr[10] = 0
  ihdr[11] = 0
  ihdr[12] = 0

  const idat = deflateSync(raw, { level: 9 })

  return Buffer.concat([
    signature,
    chunk('IHDR', ihdr),
    chunk('IDAT', idat),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

function lerp(a, b, t) {
  return Math.round(a + (b - a) * t)
}

function hexToRgb(hex) {
  const n = parseInt(hex.replace('#', ''), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

const BRAND_A = hexToRgb('#8B6CFF') // top-left
const BRAND_B = hexToRgb('#5A34D6') // bottom-right
const WHITE = [255, 255, 255]

function inRoundedRect(x, y, rx0, ry0, rx1, ry1, radius) {
  const cx = Math.min(Math.max(x, rx0 + radius), rx1 - radius)
  const cy = Math.min(Math.max(y, ry0 + radius), ry1 - radius)
  if (x >= rx0 + radius && x <= rx1 - radius) return y >= ry0 && y <= ry1
  if (y >= ry0 + radius && y <= ry1 - radius) return x >= rx0 && x <= rx1
  const dx = x - cx
  const dy = y - cy
  return dx * dx + dy * dy <= radius * radius
}

function inCircle(x, y, cx, cy, r) {
  const dx = x - cx
  const dy = y - cy
  return dx * dx + dy * dy <= r * r
}

// glyphScale < 1 shrinks the wallet glyph toward the center — used for the
// maskable variant so the mark survives circular/squircle OS masks.
function makeIcon(size, { glyphScale = 1, cornerRadius = 0 } = {}) {
  return buildPNG(size, (x, y) => {
    if (cornerRadius > 0 && !inRoundedRect(x, y, 0, 0, size - 1, size - 1, cornerRadius)) {
      return [0, 0, 0, 0]
    }

    const t = (x + y) / (2 * size)
    const bg = [lerp(BRAND_A[0], BRAND_B[0], t), lerp(BRAND_A[1], BRAND_B[1], t), lerp(BRAND_A[2], BRAND_B[2], t)]

    const cx = size / 2
    const cy = size / 2
    const cardW = size * 0.46 * glyphScale
    const cardH = size * 0.32 * glyphScale
    const rx0 = cx - cardW / 2
    const ry0 = cy - cardH / 2
    const rx1 = cx + cardW / 2
    const ry1 = cy + cardH / 2
    const radius = size * 0.06 * glyphScale

    if (inRoundedRect(x, y, rx0, ry0, rx1, ry1, radius)) {
      // Card stripe near the top third, like a magnetic strip.
      if (y >= ry0 + cardH * 0.22 && y <= ry0 + cardH * 0.4) {
        return [...BRAND_B, 255]
      }
      return [...WHITE, 255]
    }

    const coinR = size * 0.1 * glyphScale
    const coinCx = rx1 - coinR * 0.2
    const coinCy = ry0 + coinR * 0.2
    if (inCircle(x, y, coinCx, coinCy, coinR)) {
      return [...WHITE, 255]
    }
    if (inCircle(x, y, coinCx, coinCy, coinR * 0.55)) {
      return [...BRAND_B, 255]
    }

    return [...bg, 255]
  })
}

writeFileSync(join(outDir, 'icon-192.png'), makeIcon(192, { cornerRadius: 192 * 0.18 }))
writeFileSync(join(outDir, 'icon-512.png'), makeIcon(512, { cornerRadius: 512 * 0.18 }))
writeFileSync(join(outDir, 'icon-maskable-512.png'), makeIcon(512, { glyphScale: 0.72 }))

console.log('Generated icons in', outDir)
