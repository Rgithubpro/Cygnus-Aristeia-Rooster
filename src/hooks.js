import { useEffect, useState } from 'react'

const cacheSleutel = (s) => `ks.cache.${s}`

function leesCache(sleutel) {
  try {
    return JSON.parse(localStorage.getItem(cacheSleutel(sleutel)))
  } catch {
    return null
  }
}

// Loads data, shows the last known copy first (works offline), and refreshes
// every `ms` while the screen is visible and whenever the app comes back to the front.
export function useLive(sleutel, laad, deps, ms = 60000) {
  const [data, setData] = useState(() => leesCache(sleutel))
  const [fout, setFout] = useState(null)
  const [laatst, setLaatst] = useState(null)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    setData(leesCache(sleutel))
    let weg = false
    const run = async () => {
      try {
        const d = await laad()
        if (weg) return
        setData(d)
        setFout(null)
        setLaatst(new Date())
        try {
          localStorage.setItem(cacheSleutel(sleutel), JSON.stringify(d))
        } catch {
          /* ignore */
        }
      } catch (e) {
        if (!weg) setFout(e)
      }
    }
    const alsZichtbaar = () => {
      if (document.visibilityState === 'visible') run()
    }
    run()
    const interval = setInterval(alsZichtbaar, ms)
    document.addEventListener('visibilitychange', alsZichtbaar)
    return () => {
      weg = true
      clearInterval(interval)
      document.removeEventListener('visibilitychange', alsZichtbaar)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sleutel, tick, ...deps])

  return { data, fout, laatst, herlaad: () => setTick((t) => t + 1) }
}
