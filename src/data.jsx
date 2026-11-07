import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { rpc } from './api.js'
import { afbeeldingUrl } from './config.js'

const Ctx = createContext(null)
export const useData = () => useContext(Ctx)

const voorgeladen = new Set()
// Fetching a picture once lets the service worker store it, so it also shows offline.
export function voorlaad(paden) {
  paden.filter(Boolean).forEach((p) => {
    if (voorgeladen.has(p)) return
    voorgeladen.add(p)
    fetch(afbeeldingUrl(p), { mode: 'cors', credentials: 'omit' }).catch(() => voorgeladen.delete(p))
  })
}

const CACHE = 'ks.alles'
const vingerafdruk = (token) => token.slice(-10)

// The offline copy is only used for the login it was saved for (never shown to someone else on a shared phone).
const leesCache = (token) => {
  try {
    const c = JSON.parse(localStorage.getItem(CACHE))
    return c && c.t === vingerafdruk(token) ? c.d : null
  } catch {
    return null
  }
}

// Keeps one copy of everything this session may see. Every minute (while the screen is visible)
// it asks a tiny "did anything change?" question and only downloads the data when it did.
export function DataProvider({ sessie, children }) {
  const [data, setData] = useState(() => leesCache(sessie.token))
  const [fout, setFout] = useState(null)
  const [laatst, setLaatst] = useState(null)
  const versie = useRef(data?.versie ?? null)
  const actief = useRef(true)

  const laad = useCallback(
    async (forceer) => {
      try {
        if (!forceer) {
          const v = await rpc('ververs', { p_token: sessie.token })
          if (!actief.current) return
          if (v === versie.current) {
            setFout(null)
            setLaatst(new Date())
            return
          }
        }
        const d = await rpc('alles', { p_token: sessie.token })
        if (!actief.current) return // logged out meanwhile: do not write anything back
        versie.current = d.versie
        const t = d.klas?.thema || {}
        voorlaad([t.logo, t.banner, t.mascotte, ...(d.berichten || []).map((b) => b.afbeelding_pad)])
        setData(d)
        setFout(null)
        setLaatst(new Date())
        try {
          localStorage.setItem(CACHE, JSON.stringify({ t: vingerafdruk(sessie.token), d }))
        } catch {
          /* storage unavailable: keep working in memory */
        }
      } catch (e) {
        if (actief.current) setFout(e)
      }
    },
    [sessie.token],
  )

  useEffect(() => {
    actief.current = true
    laad(true)
    const alsZichtbaar = () => {
      if (document.visibilityState === 'visible') laad(false)
    }
    const interval = setInterval(alsZichtbaar, 60000)
    document.addEventListener('visibilitychange', alsZichtbaar)
    window.addEventListener('online', alsZichtbaar)
    return () => {
      actief.current = false
      clearInterval(interval)
      document.removeEventListener('visibilitychange', alsZichtbaar)
      window.removeEventListener('online', alsZichtbaar)
    }
  }, [laad])

  return <Ctx.Provider value={{ data, fout, laatst, ververs: () => laad(true) }}>{children}</Ctx.Provider>
}
