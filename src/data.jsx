import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { rpc } from './api.js'

const Ctx = createContext(null)
export const useData = () => useContext(Ctx)

const CACHE = 'ks.alles'
const leesCache = () => {
  try {
    return JSON.parse(localStorage.getItem(CACHE))
  } catch {
    return null
  }
}

// Keeps one copy of everything this session may see. Every minute (while the screen is visible)
// it asks a tiny "did anything change?" question and only downloads the data when it did.
export function DataProvider({ sessie, children }) {
  const [data, setData] = useState(leesCache)
  const [fout, setFout] = useState(null)
  const [laatst, setLaatst] = useState(null)
  const versie = useRef(data?.versie ?? null)

  const laad = useCallback(
    async (forceer) => {
      try {
        if (!forceer) {
          const v = await rpc('ververs', { p_token: sessie.token })
          if (v === versie.current) {
            setFout(null)
            setLaatst(new Date())
            return
          }
        }
        const d = await rpc('alles', { p_token: sessie.token })
        versie.current = d.versie
        setData(d)
        setFout(null)
        setLaatst(new Date())
        try {
          localStorage.setItem(CACHE, JSON.stringify(d))
        } catch {
          /* storage unavailable: keep working in memory */
        }
      } catch (e) {
        setFout(e)
      }
    },
    [sessie.token],
  )

  useEffect(() => {
    laad(true)
    const alsZichtbaar = () => {
      if (document.visibilityState === 'visible') laad(false)
    }
    const interval = setInterval(alsZichtbaar, 60000)
    document.addEventListener('visibilitychange', alsZichtbaar)
    window.addEventListener('online', alsZichtbaar)
    return () => {
      clearInterval(interval)
      document.removeEventListener('visibilitychange', alsZichtbaar)
      window.removeEventListener('online', alsZichtbaar)
    }
  }, [laad])

  return <Ctx.Provider value={{ data, fout, laatst, ververs: () => laad(true) }}>{children}</Ctx.Provider>
}
