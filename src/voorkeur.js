import { useEffect, useState } from 'react'

// Personal preferences of this device (survive logging out). Keys start with "ksv." on purpose.
const K = 'ksv.voorkeur'
export const leesVoorkeur = () => {
  try {
    return JSON.parse(localStorage.getItem(K)) || {}
  } catch {
    return {}
  }
}
export function zetVoorkeur(patch) {
  try {
    localStorage.setItem(K, JSON.stringify({ ...leesVoorkeur(), ...patch }))
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new Event('ks-voorkeur'))
}
export function useVoorkeur() {
  const [v, setV] = useState(leesVoorkeur)
  useEffect(() => {
    const f = () => setV(leesVoorkeur())
    window.addEventListener('ks-voorkeur', f)
    return () => window.removeEventListener('ks-voorkeur', f)
  }, [])
  return [v, zetVoorkeur]
}
