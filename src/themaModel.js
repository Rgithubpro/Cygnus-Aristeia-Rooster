import { afbeeldingUrl } from './config.js'

// ---------- colours ----------
const rgbVan = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16))
export const hexVan = (rgb) => `#${rgb.map((c) => Math.max(0, Math.min(255, Math.round(c))).toString(16).padStart(2, '0')).join('')}`
const lum = ([r, g, b]) => {
  const f = (c) => ((c /= 255) <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)
}
export const contrast = (a, b) => {
  const [x, y] = [lum(rgbVan(a)), lum(rgbVan(b))].sort((p, q) => q - p)
  return (x + 0.05) / (y + 0.05)
}
const meng = (a, b, t) => hexVan(rgbVan(a).map((c, i) => c + (rgbVan(b)[i] - c) * t))
const inkVoor = (hex) => (lum(rgbVan(hex)) > 0.4 ? '#14203d' : '#ffffff')

// Makes an accent colour readable as text/border on the given backgrounds by moving it towards the text colour.
function leesbaar(accent, achtergronden, tekst) {
  let a = accent
  for (let i = 0; i < 12; i++) {
    if (achtergronden.every((bg) => contrast(a, bg) >= 3)) return a
    a = meng(a, tekst, 0.12)
  }
  return a
}

// Complete palettes (light and dark variant each). "standaard" keeps the app's own colours and only applies an accent.
export const PALETTEN = {
  standaard: { label: 'Standaard' },
  zee: {
    label: 'Zee',
    licht: { bg: '#e8f4fb', kaart: '#ffffff', tekst: '#0b2a3d', accent: '#0b78b8', accent2: '#19a597' },
    donker: { bg: '#07202e', kaart: '#0d2f43', tekst: '#e6f3fa', accent: '#4fc3f7', accent2: '#4dd6c4' },
  },
  bos: {
    label: 'Bos',
    licht: { bg: '#eaf4ec', kaart: '#ffffff', tekst: '#12301c', accent: '#1f7a3f', accent2: '#b07a00' },
    donker: { bg: '#0c1f14', kaart: '#12301f', tekst: '#e4f2e8', accent: '#62d394', accent2: '#ffc46b' },
  },
  zonsondergang: {
    label: 'Zonsondergang',
    licht: { bg: '#fdf0e6', kaart: '#ffffff', tekst: '#3a1d12', accent: '#c94a14', accent2: '#c2185b' },
    donker: { bg: '#2a130c', kaart: '#3b1d12', tekst: '#ffeadd', accent: '#ff8a5c', accent2: '#ff6fa5' },
  },
  roze: {
    label: 'Roze',
    licht: { bg: '#fdeef5', kaart: '#ffffff', tekst: '#3d1030', accent: '#c2185b', accent2: '#7b1fa2' },
    donker: { bg: '#2a0d1f', kaart: '#3b1430', tekst: '#ffe6f2', accent: '#ff6fa5', accent2: '#c792ff' },
  },
  goud: {
    label: 'Goud',
    licht: { bg: '#fbf6e6', kaart: '#fffdf5', tekst: '#2f2508', accent: '#8f6700', accent2: '#6d4c41' },
    donker: { bg: '#1f1a08', kaart: '#2c2510', tekst: '#fff3cf', accent: '#ffd54a', accent2: '#ffb74d' },
  },
  nacht: {
    label: 'Nacht',
    licht: { bg: '#0b1020', kaart: '#141b33', tekst: '#eef1fb', accent: '#8fa8ff', accent2: '#ff7ab8' },
    donker: { bg: '#0b1020', kaart: '#141b33', tekst: '#eef1fb', accent: '#8fa8ff', accent2: '#ff7ab8' },
  },
  mono: {
    label: 'Zwart-wit',
    licht: { bg: '#f2f2f2', kaart: '#ffffff', tekst: '#111111', accent: '#222222', accent2: '#666666' },
    donker: { bg: '#111111', kaart: '#1b1b1b', tekst: '#eeeeee', accent: '#dddddd', accent2: '#999999' },
  },
  neon: {
    label: 'Neon',
    licht: { bg: '#0a0a14', kaart: '#14142a', tekst: '#f4f4ff', accent: '#00f5d4', accent2: '#ff3cac' },
    donker: { bg: '#0a0a14', kaart: '#14142a', tekst: '#f4f4ff', accent: '#00f5d4', accent2: '#ff3cac' },
  },
  eigen: { label: 'Eigen kleuren' },
}
export const PRESET_KLEUREN = ['#2f56d9', '#1f8a4c', '#c98a0b', '#7a3cc4', '#d9534f', '#0e8a9a', '#d6336c', '#4b5563']

// ---------- fonts (system fonts only: instant, offline, no tracking) ----------
export const FONTS = {
  systeem: { label: 'Modern', stack: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif' },
  klassiek: { label: 'Klassiek', stack: '"Iowan Old Style", "Palatino Linotype", Palatino, "Book Antiqua", Georgia, serif' },
  rond: { label: 'Rond en vriendelijk', stack: 'ui-rounded, "SF Pro Rounded", "Varela Round", Nunito, "Trebuchet MS", system-ui, sans-serif' },
  mono: { label: 'Technisch', stack: 'ui-monospace, "SF Mono", Menlo, Consolas, monospace' },
  hand: { label: 'Handgeschreven', stack: '"Segoe Print", "Bradley Hand", "Chalkboard SE", "Marker Felt", "Comic Sans MS", cursive' },
  sterk: { label: 'Dik en sterk', stack: '"Arial Black", Impact, "Helvetica Neue", system-ui, sans-serif' },
}

// ---------- background patterns (built with the class colours) ----------
const TEGELS = {
  stippen: (k) => `<svg xmlns='http://www.w3.org/2000/svg' width='28' height='28'><circle cx='14' cy='14' r='2' fill='${k}'/></svg>`,
  sterren: (k) => `<svg xmlns='http://www.w3.org/2000/svg' width='64' height='64'><path d='M16 6l2.2 6.2L24 14l-5.8 1.8L16 22l-2.2-6.2L8 14l5.8-1.8z' fill='${k}'/><path d='M48 38l1.5 4.2 4.2 1.5-4.2 1.5L48 49.5l-1.5-4.3-4.2-1.5 4.2-1.5z' fill='${k}'/></svg>`,
  golven: (k) => `<svg xmlns='http://www.w3.org/2000/svg' width='60' height='24'><path d='M0 12 Q15 0 30 12 T60 12' fill='none' stroke='${k}' stroke-width='2'/></svg>`,
  strepen: (k) => `<svg xmlns='http://www.w3.org/2000/svg' width='24' height='24'><path d='M-4 28 L28 -4' stroke='${k}' stroke-width='3'/></svg>`,
  ruit: (k) => `<svg xmlns='http://www.w3.org/2000/svg' width='32' height='32'><path d='M16 2L30 16L16 30L2 16Z' fill='none' stroke='${k}' stroke-width='1.5'/></svg>`,
  confetti: (k, k2) => `<svg xmlns='http://www.w3.org/2000/svg' width='90' height='90'><circle cx='12' cy='14' r='3' fill='${k}'/><rect x='50' y='10' width='8' height='4' rx='1' fill='${k2}' transform='rotate(30 54 12)'/><circle cx='74' cy='40' r='2.5' fill='${k2}'/><rect x='20' y='54' width='8' height='4' rx='1' fill='${k}' transform='rotate(-35 24 56)'/><path d='M60 70l4 7h-8z' fill='${k}'/><circle cx='36' cy='80' r='2' fill='${k2}'/></svg>`,
  harten: (k) => `<svg xmlns='http://www.w3.org/2000/svg' width='44' height='44'><path d='M22 34C8 24 8 12 16 12c4 0 6 3 6 3s2-3 6-3c8 0 8 12-6 22z' fill='${k}'/></svg>`,
}
export const PATRONEN = ['geen', 'stippen', 'sterren', 'golven', 'strepen', 'ruit', 'confetti', 'harten']
const patroonUrl = (naam, k, k2) => `url("data:image/svg+xml,${encodeURIComponent(TEGELS[naam](k, k2 || k))}")`

// ---------- the whole theme as CSS variables ----------
export function berekenThema(thema, systeemDonker) {
  const t = thema || {}
  const modus = t.modus || 'auto'
  const donker = modus === 'donker' || (modus === 'auto' && systeemDonker)
  const vars = {}
  let schema = null
  let accent = null
  let accent2 = null
  const palet = t.palet || 'standaard'

  let k = null
  if (palet === 'eigen') {
    k = {
      bg: t.achtergrond || (donker ? '#0e1426' : '#eef1f7'),
      kaart: t.kaart || (donker ? '#161e36' : '#ffffff'),
      tekst: t.tekst || (donker ? '#e9edf8' : '#14203d'),
      accent: t.accent || (donker ? '#8fa8ff' : '#2f56d9'),
      accent2: t.accent2 || t.accent || (donker ? '#8fa8ff' : '#2f56d9'),
    }
  } else if (PALETTEN[palet]?.licht) {
    k = { ...PALETTEN[palet][donker ? 'donker' : 'licht'] }
  }

  if (k) {
    schema = lum(rgbVan(k.bg)) < 0.3 ? 'dark' : 'light'
    accent = leesbaar(k.accent, [k.bg, k.kaart], k.tekst)
    accent2 = leesbaar(k.accent2, [k.bg, k.kaart], k.tekst)
    Object.assign(vars, {
      '--bg': k.bg,
      '--surface': k.kaart,
      '--ink': k.tekst,
      '--ink2': meng(k.tekst, k.bg, 0.38),
      '--line': meng(k.bg, k.tekst, 0.16),
      '--accent': accent,
      '--accent-ink': inkVoor(accent),
      '--accent2': accent2,
      '--accent2-ink': inkVoor(accent2),
      '--moved': schema === 'dark' ? '#ffc46b' : '#8a4b00',
      '--moved-bg': schema === 'dark' ? '#3a2d12' : '#fff1d6',
      '--cancelled': schema === 'dark' ? '#ff9aa1' : '#a3262e',
      '--cancelled-bg': schema === 'dark' ? '#40181c' : '#fde3e5',
    })
  } else if (t.accent) {
    const rgb = rgbVan(t.accent)
    accent = lum(rgb) > 0.45 && !systeemDonker ? meng(t.accent, '#000000', 0.4) : systeemDonker && lum(rgb) < 0.35 ? meng(t.accent, '#ffffff', 0.45) : t.accent
    accent2 = accent
    vars['--accent'] = accent
    vars['--accent-ink'] = inkVoor(accent)
    vars['--accent2'] = accent
    vars['--accent2-ink'] = inkVoor(accent)
  }

  const hoek = { scherp: 0.15, normaal: 1, rond: 1.6, extra: 2.4 }[t.hoeken || 'normaal']
  if (t.hoeken) Object.assign(vars, { '--r-xs': `${0.4 * hoek}rem`, '--r-m': `${0.7 * hoek}rem`, '--r-l': `${0.95 * hoek}rem` })
  if (t.dichtheid) vars['--d'] = String({ compact: 0.8, normaal: 1, ruim: 1.25 }[t.dichtheid])
  if (t.tekstgrootte) vars['--schaal'] = { klein: '90%', normaal: '100%', groot: '115%' }[t.tekstgrootte]
  if (t.font_tekst && FONTS[t.font_tekst]) vars['--font-body'] = FONTS[t.font_tekst].stack
  if (t.font_kop && FONTS[t.font_kop]) vars['--font-kop'] = FONTS[t.font_kop].stack

  if (t.patroon && t.patroon !== 'geen' && TEGELS[t.patroon]) {
    const kleur = accent || (systeemDonker ? '#8fa8ff' : '#2f56d9')
    vars['--patroon'] = patroonUrl(t.patroon, kleur, accent2 || kleur)
    vars['--patroon-o'] = String({ zacht: 0.07, midden: 0.14, sterk: 0.24 }[t.patroon_sterkte || 'midden'])
  }
  return { vars, schema, achtergrond: vars['--bg'] || null, donker }
}

// ---------- images (a draft may carry local preview URLs in _blob) ----------
export function afbeeldingSrc(thema, sleutel) {
  const blob = thema?._blob?.[sleutel]
  if (blob !== undefined) return blob || null
  return thema?.[sleutel] ? afbeeldingUrl(thema[sleutel]) : null
}

// ---------- tabs ----------
export const TAB_STANDAARD = { rooster: 'Rooster', info: 'Info', stand: 'Stand', pagina: 'Onze klas' }
export function tabsVan(thema, labels = TAB_STANDAARD) {
  const t = thema || {}
  const volgorde = [...(t.tab_volgorde || []), 'rooster', 'info', 'stand', 'pagina'].filter((id, i, a) => a.indexOf(id) === i)
  return volgorde
    .filter((id) => id === 'rooster' || (t.tabs?.[id]?.aan ?? id !== 'pagina'))
    .map((id) => [id, t.tabs?.[id]?.naam || labels[id]])
}

export const TOON_STANDAARD = { logo: true, slogan: true, appnaam: true, emoji: true, locatie: true, omschrijving: true, voor: true, einde: true, nu: true }
export const toonVan = (thema) => ({ ...TOON_STANDAARD, ...(thema?.toon || {}) })
