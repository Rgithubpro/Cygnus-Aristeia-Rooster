// Per-class accent colour. We compute a readable button text colour and a lighter variant for dark mode.
const rgbVan = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16))
const hexVan = (rgb) => `#${rgb.map((c) => c.toString(16).padStart(2, '0')).join('')}`
const lum = ([r, g, b]) => {
  const f = (c) => ((c /= 255) <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)
}
const inkVoor = (rgb) => contrast(rgb, rgbVan('#14203d')) > contrast(rgb, rgbVan('#ffffff')) ? '#14203d' : '#ffffff'
const lichter = (rgb, t) => rgb.map((c) => Math.round(c + (255 - c) * t))
const donkerder = (rgb, t) => rgb.map((c) => Math.round(c * (1 - t)))
const meng = (voor, na, t) => voor.map((c, i) => Math.round(c * (1 - t) + na[i] * t))
const geldigeKleur = (kleur) => /^#[0-9a-fA-F]{6}$/.test(kleur || '')
const contrast = (a, b) => {
  const [licht, donker] = [lum(a), lum(b)].sort((x, y) => y - x)
  return (licht + 0.05) / (donker + 0.05)
}

export const PRESET_KLEUREN = ['#2f56d9', '#1f8a4c', '#c98a0b', '#7a3cc4', '#d9534f', '#0e8a9a', '#d6336c', '#4b5563']

export function themaStijl(thema) {
  const stijl = {}
  const accent = geldigeKleur(thema?.accent) ? rgbVan(thema.accent) : null
  if (accent) {
    const licht = lum(accent) > 0.45 ? donkerder(accent, 0.4) : accent
    const donker = lum(accent) < 0.35 ? lichter(accent, 0.45) : accent
    Object.assign(stijl, {
      '--a-licht': hexVan(licht),
      '--ink-licht': inkVoor(licht),
      '--a-donker': hexVan(donker),
      '--ink-donker': inkVoor(donker),
    })
  }
  const achtergrond = geldigeKleur(thema?.achtergrond) ? rgbVan(thema.achtergrond) : null
  const kaart = geldigeKleur(thema?.kaart) ? rgbVan(thema.kaart) : null
  if (achtergrond) stijl['--klas-bg'] = hexVan(achtergrond)
  if (kaart) stijl['--klas-surface'] = hexVan(kaart)
  const tekstOpPagina = achtergrond || [238, 241, 247]
  const tekstOpKaart = kaart || [255, 255, 255]
  const donkerTekst = rgbVan('#14203d')
  const witTekst = rgbVan('#ffffff')
  const tekstKeuze = geldigeKleur(thema?.tekst) ? rgbVan(thema.tekst) : null
  const leesbareTekst = (achtergrondKleur) => {
    if (tekstKeuze && contrast(tekstKeuze, achtergrondKleur) >= 4.5) return tekstKeuze
    return contrast(donkerTekst, achtergrondKleur) > contrast(witTekst, achtergrondKleur) ? donkerTekst : witTekst
  }
  if (achtergrond || kaart || tekstKeuze) {
    const paginaTekst = leesbareTekst(tekstOpPagina)
    const kaartTekst = leesbareTekst(tekstOpKaart)
    stijl['--klas-ink'] = hexVan(paginaTekst)
    stijl['--klas-ink2'] = hexVan(meng(paginaTekst, tekstOpPagina, 0.38))
    stijl['--klas-card-ink'] = hexVan(kaartTekst)
    stijl['--klas-card-ink2'] = hexVan(meng(kaartTekst, tekstOpKaart, 0.38))
    stijl['--klas-line'] = hexVan(meng(kaartTekst, tekstOpKaart, 0.82))
  }
  return Object.keys(stijl).length ? stijl : undefined
}
