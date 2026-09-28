/** Weasel 颜色格式：abgr / rgba / argb */

export function clamp(v, min, max) {
  return Math.min(max, Math.max(min, v))
}

export function parseHexToRgba(hex) {
  if (!hex) return { r: 0, g: 0, b: 0, a: 255 }
  let h = String(hex).replace('#', '').trim()
  if (h.length === 3) {
    h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2]
  }
  if (h.length === 6) h += 'ff'
  if (h.length !== 8) return { r: 0, g: 0, b: 0, a: 255 }
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
    a: parseInt(h.slice(6, 8), 16),
  }
}

export function rgbaToHex({ r, g, b, a = 255 }, withAlpha = true) {
  const to2 = (n) => clamp(Math.round(n), 0, 255).toString(16).padStart(2, '0')
  const base = `${to2(r)}${to2(g)}${to2(b)}`
  return withAlpha ? `#${base}${to2(a)}` : `#${base}`
}

/** 从 0x... 数字/字符串解析到 rgba 对象 */
export function parseWeaselColor(value, format = 'rgba') {
  if (value == null || value === '') return null
  let n
  if (typeof value === 'number') {
    n = value >>> 0
  } else {
    const s = String(value).trim()
    if (/^#[0-9a-fA-F]{3,8}$/.test(s)) {
      return parseHexToRgba(s)
    }
    if (/^0x[0-9a-fA-F]+$/.test(s)) {
      n = parseInt(s.slice(2), 16) >>> 0
    } else if (/^[0-9]+$/.test(s)) {
      n = parseInt(s, 10) >>> 0
    } else {
      return null
    }
  }

  // n 为 32 位无符号
  if (n <= 0xffffff) {
    // 无 alpha：按 RGB，alpha=FF
    return {
      r: (n >> 16) & 0xff,
      g: (n >> 8) & 0xff,
      b: n & 0xff,
      a: 255,
    }
  }

  const b0 = n & 0xff
  const b1 = (n >> 8) & 0xff
  const b2 = (n >> 16) & 0xff
  const b3 = (n >> 24) & 0xff

  if (format === 'argb') {
    return { r: b2, g: b1, b: b0, a: b3 }
  }
  if (format === 'rgba') {
    // 0xrrggbbaa
    return { r: b3, g: b2, b: b1, a: b0 }
  }
  // abgr 默认：0xaabbggrr
  return { r: b0, g: b1, b: b2, a: b3 }
}

/** rgba 对象 → weasel 0x 字符串 */
export function formatWeaselColor(rgba, format = 'rgba') {
  if (!rgba) return null
  const { r, g, b, a } = {
    r: clamp(Math.round(rgba.r), 0, 255),
    g: clamp(Math.round(rgba.g), 0, 255),
    b: clamp(Math.round(rgba.b), 0, 255),
    a: rgba.a == null ? 255 : clamp(Math.round(rgba.a), 0, 255),
  }
  let n
  if (format === 'argb') {
    n = ((a << 24) | (r << 16) | (g << 8) | b) >>> 0
  } else if (format === 'rgba') {
    n = ((r << 24) | (g << 16) | (b << 8) | a) >>> 0
  } else {
    n = ((a << 24) | (b << 16) | (g << 8) | r) >>> 0
  }
  return `0x${n.toString(16).toUpperCase().padStart(8, '0')}`
}

/** CSS 颜色（含透明度） */
export function toCss(rgba) {
  if (!rgba) return 'transparent'
  const { r, g, b, a = 255 } = rgba
  return `rgba(${r}, ${g}, ${b}, ${(a / 255).toFixed(3)})`
}

export function contrastText(rgba) {
  if (!rgba) return '#fff'
  const { r, g, b, a = 255 } = rgba
  if (a < 40) return '#fff'
  const y = 0.2126 * r + 0.7152 * g + 0.0722 * b
  return y > 150 ? '#1a1d24' : '#fff'
}

/** 在不同 color_format 之间转换 0x 值 */
export function convertFormat(value, from, to) {
  const rgba = parseWeaselColor(value, from)
  if (!rgba) return value
  return formatWeaselColor(rgba, to)
}
