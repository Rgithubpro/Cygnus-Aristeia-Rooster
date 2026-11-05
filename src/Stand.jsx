import { useEffect, useState } from 'react'
import { rpc } from './api.js'
import { useData } from './data.jsx'
import { nl } from './strings.js'

// The ranking is only returned by the database for days that Root has made visible.
export default function Stand({ sessie }) {
  const { data } = useData()
  const zichtbaarTot = data.instellingen.uitslag_tot_dag
  const [stand, setStand] = useState(null)
  const [fout, setFout] = useState(false)

  useEffect(() => {
    let weg = false
    const laad = () =>
      rpc('stand', { p_token: sessie.token })
        .then((s) => !weg && (setStand(s), setFout(false)))
        .catch(() => !weg && setFout(true))
    laad()
    const t = setInterval(() => document.visibilityState === 'visible' && laad(), 60000)
    return () => {
      weg = true
      clearInterval(t)
    }
  }, [sessie.token, zichtbaarTot])

  if (!stand) return <p className="note">{fout ? nl.laadFout : nl.laden}</p>
  if (stand.tot_dag === 0) return <p className="note">{nl.standLeeg}</p>

  return (
    <div className="stack">
      <h2>
        {nl.standTot} {stand.tot_dag}
      </h2>
      <ol className="stand">
        {stand.stand.map((r) => (
          <li key={r.klas} className={r.eigen ? 'eigen' : ''}>
            <span className="positie">{r.positie}</span>
            <span className="grow">
              {r.emoji ? `${r.emoji} ` : ''}{r.klas}
              {r.eigen ? ` (${nl.jouwKlas})` : ''}
            </span>
            <strong>
              {r.punten} {nl.punten}
            </strong>
          </li>
        ))}
      </ol>
      {stand.onderdelen.length > 0 && (
        <>
          <h3>{nl.uitslagen}</h3>
          {stand.onderdelen.map((o) => (
            <details key={`${o.dag}-${o.onderdeel}`} className="card">
              <summary>
                {nl.dag} {o.dag}: {o.onderdeel}
              </summary>
              <ol className="stand klein">
                {o.resultaten.map((r, i) => (
                  <li key={i} className={r.eigen ? 'eigen' : ''}>
                    <span className="positie">{i + 1}</span>
                    <span className="grow">{r.emoji ? `${r.emoji} ` : ''}{r.klas}</span>
                    <strong>{r.punten}</strong>
                  </li>
                ))}
              </ol>
            </details>
          ))}
        </>
      )}
    </div>
  )
}
