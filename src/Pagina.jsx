import { useEffect, useState } from 'react'
import { rpc } from './api.js'
import { afbeeldingUrl } from './config.js'
import { useData } from './data.jsx'
import { nl } from './strings.js'
import TekstMetLinks, { LinkKnop } from './TekstMetLinks.jsx'

// Renders the blocks of the class page. Text is plain text; links ask before opening; images come from the class folder.
export function PaginaBlokken({ blokken }) {
  return (
    <div className="pagina stack">
      {blokken.map((b, i) => {
        switch (b.type) {
          case 'kop':
            return <h2 key={i}>{b.tekst}</h2>
          case 'tekst':
            return <TekstMetLinks key={i} tekst={b.tekst} />
          case 'afbeelding':
            return (
              <figure key={i} className="pagina-plaatje">
                <img src={afbeeldingUrl(b.pad)} alt={b.onderschrift || ''} loading="lazy" />
                {b.onderschrift && <figcaption className="note">{b.onderschrift}</figcaption>}
              </figure>
            )
          case 'link':
            return <LinkKnop key={i} url={b.url} tekst={b.tekst} />
          case 'lijst':
            return (
              <ul key={i} className="pagina-lijst">
                {b.items.map((x, j) => (
                  <li key={j}>{x}</li>
                ))}
              </ul>
            )
          case 'lijn':
            return <hr key={i} />
          default:
            return null
        }
      })}
    </div>
  )
}

export default function Pagina({ sessie }) {
  const { data } = useData()
  const [blokken, setBlokken] = useState(null)
  const [fout, setFout] = useState(false)

  useEffect(() => {
    let weg = false
    rpc('pagina_ophalen', { p_token: sessie.token })
      .then((p) => !weg && (setBlokken(p || []), setFout(false)))
      .catch(() => !weg && setFout(true))
    return () => {
      weg = true
    }
  }, [sessie.token, data.versie])

  if (!blokken) return <p className="note">{fout ? nl.laadFout : nl.laden}</p>
  if (blokken.length === 0) return <p className="note">{nl.leegPagina}</p>
  return (
    <div className="card">
      <PaginaBlokken blokken={blokken} />
    </div>
  )
}
