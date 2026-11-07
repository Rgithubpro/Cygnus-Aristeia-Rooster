// A small log of recent errors on this device, shown in the settings so problems are easy to explain.
const K = 'ksv.fouten'
export const leesFouten = () => {
  try {
    return JSON.parse(localStorage.getItem(K)) || []
  } catch {
    return []
  }
}
export function logFout(bericht) {
  try {
    const lijst = [{ t: new Date().toISOString(), m: String(bericht).slice(0, 200) }, ...leesFouten()].slice(0, 15)
    localStorage.setItem(K, JSON.stringify(lijst))
  } catch {
    /* ignore */
  }
}
export const wisFouten = () => {
  try {
    localStorage.removeItem(K)
  } catch {
    /* ignore */
  }
}
