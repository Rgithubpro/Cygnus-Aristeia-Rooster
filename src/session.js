const SLEUTEL = 'ks.sessie'

export function laadSessie() {
  try {
    return JSON.parse(localStorage.getItem(SLEUTEL))
  } catch {
    return null
  }
}

export function bewaarSessie(sessie) {
  try {
    localStorage.setItem(SLEUTEL, JSON.stringify(sessie))
  } catch {
    /* storage can be unavailable; the app then simply asks again next time */
  }
}

// Removes the session and every cached rooster/mededeling from this device.
export function wisAlles() {
  try {
    Object.keys(localStorage)
      .filter((k) => k.startsWith('ks.'))
      .forEach((k) => localStorage.removeItem(k))
  } catch {
    /* ignore */
  }
}
