import { APP_NAAM, FOUTEN, TEKSTEN } from './teksten.js'

// Returns the text for a default text: the version from teksten.js, with {app} and other {words} filled in.
export function txt(sleutel, waarden = {}) {
  const w = { app: APP_NAAM, ...waarden }
  return (TEKSTEN[sleutel] ?? sleutel).replace(/\{(\w+)\}/g, (m, k) => (k in w ? w[k] : m))
}

// Text for a database error code, or undefined for an unknown code.
export const foutTekst = (code) => FOUTEN[code]
