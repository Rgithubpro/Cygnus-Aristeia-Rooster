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

  const groepen = (rijen) => Object.entries(
    rijen.reduce((resultaat, rij) => {
      const competitie = rij.competitie || 'Algemeen'
      ;(resultaat[competitie] ||= []).push(rij)
      return resultaat
    }, {}),
  )

  return (
    <div className="stack">
      <h2>
        {stand.tot_dag === 1 ? nl.standDag1 : `${nl.standTot} ${stand.tot_dag}`}
      </h2>
      {stand.tot_dag === 1 && <p className="note">{nl.standDag1Uitleg}</p>}
      {groepen(stand.stand).map(([competitie, resultaten]) => (
        <section className="stack" key={competitie}>
          <h3>{competitie}</h3>
          <ol className="stand">
            {resultaten.map((r, i) => (
              <li key={`${r.klas}-${r.positie}-${i}`} className={r.eigen ? 'eigen' : ''}>
                <span className="positie">{r.positie}</span>
                <span className="grow">
                  {r.emoji ? `${r.emoji} ` : ''}{r.klas}
                  {r.eigen ? ` (${nl.jouwKlas})` : ''}
                </span>
                <strong>{r.punten} {nl.punten}</strong>
              </li>
            ))}
          </ol>
        </section>
      ))}
      {stand.onderdelen.length > 0 && (
        <>
          <h3>{nl.uitslagen}</h3>
          {stand.onderdelen.map((o) => (
            <details key={`${o.dag}-${o.onderdeel}`} className="card">
              <summary>
                {nl.dag} {o.dag}: {o.onderdeel}
              </summary>
              <div className="stack uitslag-groepen">
                {groepen(o.resultaten).map(([naam, rijen]) => (
                  <section className="stack klein-gap" key={naam}>
                    <h3>{naam}</h3>
                    <ol className="stand klein">
                      {rijen.map((r, i) => (
                        <li key={`${r.klas}-${r.positie}-${i}`} className={r.eigen ? 'eigen' : ''}>
                          <span className="positie">{r.positie}</span>
                          <span className="grow">{r.emoji ? `${r.emoji} ` : ''}{r.klas}</span>
                          <strong>{r.punten}</strong>
                        </li>
                      ))}
                    </ol>
                  </section>
                ))}
              </div>
            </details>
          ))}
        </>
      )}
    </div>
  )
}
