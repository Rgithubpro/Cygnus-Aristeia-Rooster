import { createContext, useContext, useEffect, useState, useSyncExternalStore } from 'react'
import { berekenThema } from './themaModel.js'

const QUERY = '(prefers-color-scheme: dark)'
function useSysteemDonker() {
  return useSyncExternalStore(
    (cb) => {
      const m = window.matchMedia(QUERY)
      m.addEventListener('change', cb)
      return () => m.removeEventListener('change', cb)
    },
    () => window.matchMedia(QUERY).matches,
    () => false,
  )
}

// Writes the class look onto the page (CSS variables on <html>) and removes it again afterwards.
export function useThemaToepassen(thema) {
  const donker = useSysteemDonker()
  const sleutel = JSON.stringify(thema || {})
  useEffect(() => {
    const root = document.documentElement
    const { vars, schema, achtergrond } = berekenThema(thema, donker)
    const namen = Object.keys(vars)
    namen.forEach((n) => root.style.setProperty(n, vars[n]))
    if (schema) root.style.colorScheme = schema
    const metas = [...document.querySelectorAll('meta[name="theme-color"]')]
    const oud = metas.map((m) => [m, m.getAttribute('content'), m.getAttribute('media')])
    if (achtergrond) metas.forEach((m) => { m.setAttribute('content', achtergrond); m.removeAttribute('media') })
    return () => {
      namen.forEach((n) => root.style.removeProperty(n))
      root.style.removeProperty('color-scheme')
      oud.forEach(([m, c, med]) => {
        m.setAttribute('content', c)
        if (med) m.setAttribute('media', med)
        else m.removeAttribute('media')
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sleutel, donker])
}

const Ctx = createContext({ thema: {}, opgeslagen: {}, concept: null, zetConcept: () => {} })
export const useThema = () => useContext(Ctx)

// `concept` is an unsaved draft from the editor: the whole app previews it live.
export function ThemaProvider({ opgeslagen, children }) {
  const [concept, zetConcept] = useState(null)
  const thema = concept ?? opgeslagen ?? {}
  useThemaToepassen(thema)
  return <Ctx.Provider value={{ thema, opgeslagen: opgeslagen ?? {}, concept, zetConcept }}>{children}</Ctx.Provider>
}
