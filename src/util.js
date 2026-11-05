export const KLEUREN = [
  ['blauw', '🔵 Blauw'],
  ['groen', '🟢 Groen'],
  ['amber', '🟡 Amber'],
  ['paars', '🟣 Paars'],
  ['koraal', '🔴 Koraal'],
  ['grijs', '⚪ Grijs'],
]

export function emoji(titel = '') {
  const t = titel.toLowerCase()
  const regels = [
    [['muziek', 'optreden', 'song'], '🎸'],
    [['koken', 'eten', 'lunch', 'pauze'], '🍞'],
    [['dans', 'dance'], '💃'],
    [['voetbal'], '⚽'],
    [['hockey'], '🏑'],
    [['volleybal'], '🏐'],
    [['basketbal'], '🏀'],
    [['frisbee'], '🥏'],
    [['tafeltennis'], '🏓'],
    [['estafette', 'sport', 'hardlopen'], '🏃'],
    [['touwtrek'], '🪢'],
    [['escape'], '🔐'],
    [['quiz', 'kennis'], '🧠'],
    [['karaoke'], '🎤'],
    [['schaken'], '♟️'],
    [['fifa', 'just dance', 'game'], '🎮'],
    [['foto'], '📸'],
    [['opening', 'welkom'], '🎉'],
    [['prijs', 'finale', 'uitreiking'], '🏆'],
    [['kunst', 'tekenen'], '🎨'],
    [['poster'], '📋'],
  ]
  for (const [woorden, e] of regels) if (woorden.some((w) => t.includes(w))) return e
  return '🏅'
}

// Current date (YYYY-MM-DD) and minutes since midnight in Amsterdam.
export function nuAmsterdam() {
  const delen = Object.fromEntries(
    new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Europe/Amsterdam',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(new Date())
      .map((p) => [p.type, p.value]),
  )
  return { datum: `${delen.year}-${delen.month}-${delen.day}`, min: Number(delen.hour) * 60 + Number(delen.minute) }
}

export const naarMin = (t) => {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

export const dagDatum = (instellingen, dag) => instellingen?.[`dag${dag}`] || null

export function dagLabel(datum, dag) {
  if (!datum) return `Dag ${dag}`
  const tekst = new Intl.DateTimeFormat('nl-NL', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date(`${datum}T12:00:00`))
  return tekst.charAt(0).toUpperCase() + tekst.slice(1)
}

export function dagVanVandaag(instellingen, nu) {
  if (instellingen?.dag1 === nu.datum) return 1
  if (instellingen?.dag2 === nu.datum) return 2
  return null
}

export function isHuidig(a, instellingen, nu) {
  return dagDatum(instellingen, a.dag) === nu.datum && nu.min >= naarMin(a.start) && nu.min < naarMin(a.eind)
}

export const overlapt = (a, b) => a.dag === b.dag && naarMin(a.start) < naarMin(b.eind) && naarMin(b.start) < naarMin(a.eind)

// Splits text into plain text and http(s) links. Text is never turned into HTML.
export function splitLinks(tekst = '') {
  const delen = []
  let laatste = 0
  for (const m of tekst.matchAll(/https?:\/\/[^\s<>"']+/g)) {
    if (m.index > laatste) delen.push({ type: 'tekst', waarde: tekst.slice(laatste, m.index) })
    delen.push({ type: 'link', waarde: m[0] })
    laatste = m.index + m[0].length
  }
  if (laatste < tekst.length) delen.push({ type: 'tekst', waarde: tekst.slice(laatste) })
  return delen
}

const WOORDEN = ['blauwe', 'rode', 'groene', 'gele', 'snelle', 'grote', 'kleine', 'dappere', 'vrolijke', 'stoere',
  'slimme', 'rustige', 'wilde', 'zachte', 'sterke', 'lenige', 'trotse', 'gekke', 'handige', 'luie',
  'oranje', 'paarse', 'witte', 'zwarte', 'gouden', 'zilveren', 'warme', 'koude', 'vlugge', 'brave',
  'jonge', 'oude', 'felle', 'stille', 'luide', 'zoete', 'lekkere', 'knappe', 'mooie', 'sportieve',
  'dolle', 'blije', 'moedige', 'sluwe', 'nieuwsgierige', 'vriendelijke', 'creatieve', 'eerlijke', 'fitte', 'taaie',
  'lichte', 'zware', 'ronde', 'platte', 'hoge', 'lage', 'verre', 'nabije', 'vroege', 'late']
const DIEREN = ['vos', 'uil', 'beer', 'haas', 'zwaan', 'wolf', 'arend', 'otter', 'tijger', 'panda',
  'leeuw', 'valk', 'das', 'eland', 'kikker', 'koala', 'lynx', 'merel', 'mus', 'pauw',
  'pinguin', 'raaf', 'specht', 'tapir', 'walvis', 'zebra', 'bever', 'dolfijn', 'egel', 'ezel',
  'fret', 'geit', 'haai', 'ijsvogel', 'jaguar', 'kameel', 'lama', 'muis', 'neushoorn', 'ooievaar',
  'paard', 'quokka', 'rat', 'slang', 'tor', 'uiltje', 'vlinder', 'wesp', 'yak', 'zeehond',
  'aap', 'bij', 'draak', 'eend', 'flamingo', 'gans', 'hert', 'kat', 'kip', 'koe']
// Readable password such as "blauwe-vos-27" (60 x 60 x 90 = 324,000 combinations).
export function maakWachtwoord() {
  const r = new Uint32Array(3)
  crypto.getRandomValues(r)
  return `${WOORDEN[r[0] % WOORDEN.length]}-${DIEREN[r[1] % DIEREN.length]}-${10 + (r[2] % 90)}`
}

export const slugVan = (naam) =>
  naam.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40)
