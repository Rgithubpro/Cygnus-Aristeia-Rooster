// Per-class accent colour. We compute a readable button text colour and a lighter variant for dark mode.
const rgbVan = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16))
const hexVan = (rgb) => `#${rgb.map((c) => c.toString(16).padStart(2, '0')).join('')}`
const lum = ([r, g, b]) => {
  const f = (c) => ((c /= 255) <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)
}
const inkVoor = (rgb) => (lum(rgb) > 0.4 ? '#14203d' : '#ffffff')
const lichter = (rgb, t) => rgb.map((c) => Math.round(c + (255 - c) * t))
const donkerder = (rgb, t) => rgb.map((c) => Math.round(c * (1 - t)))

export const PRESET_KLEUREN = ['#2f56d9', '#1f8a4c', '#c98a0b', '#7a3cc4', '#d9534f', '#0e8a9a', '#d6336c', '#4b5563']

export function themaStijl(thema) {
  const a = thema?.accent
  if (!a || !/^#[0-9a-fA-F]{6}$/.test(a)) return undefined
  const rgb = rgbVan(a)
  const licht = lum(rgb) > 0.45 ? donkerder(rgb, 0.4) : rgb // keep text readable on white
  const donker = lum(rgb) < 0.35 ? lichter(rgb, 0.45) : rgb // keep text readable on dark
  return {
    '--a-licht': hexVan(licht),
    '--ink-licht': inkVoor(licht),
    '--a-donker': hexVan(donker),
    '--ink-donker': inkVoor(donker),
  }
}
