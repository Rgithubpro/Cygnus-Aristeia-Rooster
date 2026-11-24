import { useEffect, useState } from 'react'
import { rpc } from './api.js'
import { useData } from './data.jsx'
import { txt } from './t.js'

const MEDAILLE = { 1: '🥇', 2: '🥈', 3: '🥉' }

function Rijen({ klassen, toonPunten }) {
  if (klassen.length === 0) return <p className="note">{txt('Nog geen uitslag.')}</p>
  return (
    <ol className="stand">
      {klassen.map((r, i) => (
        <li key={`${r.klas}-${i}`} className={r.eigen ? 'eigen' : ''}>
          <span className="positie">{MEDAILLE[r.positie] || r.positie}</span>
          <span className="grow">
            {r.emoji ? `${r.emoji} ` : ''}
            {r.klas}
            {r.eigen ? ` (${txt('jouw klas')})` : ''}
          </span>
          {toonPunten && r.punten !== null && (
            <strong>
              {r.punten} {txt('punten')}
            </strong>
          )}
        </li>
      ))}
    </ol>
  )
}

// The database only returns what Root made visible: day 1 = top N per league, day 2 = everyone.
export default function Stand({ sessie }) {
  const { data } = useData()
  const zichtbaarTot = data.instellingen.uitslag_tot_dag
  const [stand, setStand] = useState(null)
  const [fout, setFout] = useState(false)

  useEffect(() => {
    let weg = false
    const laad = () =>
      rpc('stand_dag_leagues', { p_token: sessie.token })
        .then((s) => !weg && (setStand(s), setFout(false)))
        .catch(() => !weg && setFout(true))
    laad()
    const t = setInterval(() => document.visibilityState === 'visible' && laad(), 60000)
    return () => {
      weg = true
      clearInterval(t)
    }
  }, [sessie.token, zichtbaarTot])

  if (!stand) return <p className="note">{fout ? txt('Er ging iets mis. Controleer je verbinding en probeer het opnieuw.') : txt('Laden…')}</p>
  if (stand.tot_dag === 0) return <p className="note">{txt('De stand wordt aan het einde van de dag bekendgemaakt.')}</p>

  const eigenEerst = [...stand.leagues].sort((a, b) => Number(b.eigen) - Number(a.eigen))
  const top = false

  return (
    <div className="stack">
      {eigenEerst.map((lg, i) => {
        const kop = (
          <>
            {lg.emoji ? `${lg.emoji} ` : '🏆 '}
            {lg.naam} {lg.eigen && <span className="tag">{txt('jouw league')}</span>}
          </>
        )
        const inhoud = (
          <>
            <Rijen klassen={lg.klassen} toonPunten={stand.toon_punten} />
            {lg.eigen && !top && stand.onderdelen.length > 0 && (
              <div className="stack">
                <h3>{txt('Uitslagen per onderdeel')}</h3>
                {stand.onderdelen.map((o) => (
                  <details key={`${o.dag}-${o.onderdeel}`} className="card">
                    <summary>
                      {txt('Dag')} {o.dag}: {o.onderdeel}
                    </summary>
                    <ol className="stand klein">
                      {o.resultaten.map((r, j) => (
                        <li key={j} className={r.eigen ? 'eigen' : ''}>
                          <span className="positie">{j + 1}</span>
                          <span className="grow">
                            {r.emoji ? `${r.emoji} ` : ''}
                            {r.klas}
                          </span>
                          <strong>{r.punten}</strong>
                        </li>
                      ))}
                    </ol>
                  </details>
                ))}
              </div>
            )}
          </>
        )
        // your own league is always open; the other leagues fold away on day 2
        return !top && !lg.eigen && i > 0 ? (
          <details key={lg.id ?? 'overig'} className="card league">
            <summary>
              <strong>{kop}</strong>
            </summary>
            {inhoud}
          </details>
        ) : (
          <section key={lg.id ?? 'overig'} className="stack league">
            <h2>{kop}</h2>
            {inhoud}
          </section>
        )
      })}
    </div>
  )
}
