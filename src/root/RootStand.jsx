import { useEffect, useMemo, useState } from 'react'
import { rootRpc } from './client.js'
import RootLeagues from './RootLeagues.jsx'

// Scores per class per game. Students only see days up to "zichtbaar t/m dag".
export default function RootStand({ overzicht, herlaad }) {
  const [rijen, setRijen] = useState(null)
  const [dag, setDag] = useState(1)
  const [onderdeel, setOnderdeel] = useState('')
  const [waarden, setWaarden] = useState({})
  const [fout, setFout] = useState('')
  const [ok, setOk] = useState(false)
  const laad = () => rootRpc('root_punten_lijst').then(setRijen)
  useEffect(() => {
    laad()
  }, [])

  const onderdelen = useMemo(() => {
    const m = new Map()
    for (const r of rijen || []) m.set(`${r.dag}|${r.onderdeel}`, { dag: r.dag, onderdeel: r.onderdeel })
    return [...m.values()]
  }, [rijen])

  const totaal = useMemo(() => {
    const t = Object.fromEntries(overzicht.klassen.map((k) => [k.id, 0]))
    for (const r of rijen || []) if (r.klas_id in t) t[r.klas_id] += r.punten
    return overzicht.klassen.map((k) => ({ ...k, punten: t[k.id] })).sort((a, b) => b.punten - a.punten)
  }, [rijen, overzicht])

  function laadOnderdeel(o) {
    setDag(o.dag)
    setOnderdeel(o.onderdeel)
    setWaarden(Object.fromEntries((rijen || []).filter((r) => r.dag === o.dag && r.onderdeel === o.onderdeel).map((r) => [r.klas_id, String(r.punten)])))
    window.scrollTo(0, 0)
  }

  async function bewaar(e) {
    e.preventDefault()
    setFout('')
    setOk(false)
    try {
      const payload = Object.fromEntries(overzicht.klassen.map((k) => [k.id, waarden[k.id] ?? '']))
      await rootRpc('root_punten_opslaan', { p_dag: dag, p_onderdeel: onderdeel, p_waarden: payload })
      await laad()
      setOk(true)
    } catch {
      setFout('Opslaan mislukt. Gebruik hele getallen.')
    }
  }

  async function zichtbaar(d) {
    await rootRpc('root_uitslag_zichtbaar', { p_dag: d })
    herlaad()
  }

  const zicht = overzicht.instellingen.uitslag_tot_dag

  return (
    <div className="stack">
      <RootLeagues overzicht={overzicht} herlaad={herlaad} />

      <form className="card stack" onSubmit={bewaar}>
        <h2>Punten invoeren</h2>
        <div className="rij">
          <label className="veld">
            <span>Dag</span>
            <select value={dag} onChange={(e) => setDag(Number(e.target.value))}>
              <option value={1}>Dag 1</option>
              <option value={2}>Dag 2</option>
            </select>
          </label>
          <label className="veld grow">
            <span>Onderdeel</span>
            <input value={onderdeel} onChange={(e) => setOnderdeel(e.target.value)} list="onderdelen" maxLength={60} required />
            <datalist id="onderdelen">{onderdelen.map((o) => <option key={`${o.dag}${o.onderdeel}`} value={o.onderdeel} />)}</datalist>
          </label>
        </div>
        <ul className="vinklijst hoog">
          {overzicht.klassen.map((k) => (
            <li key={k.id} className="rij tussen">
              <span>{k.naam}</span>
              <input className="getal" type="number" step="1" value={waarden[k.id] ?? ''} onChange={(e) => setWaarden({ ...waarden, [k.id]: e.target.value })} aria-label={`Punten ${k.naam}`} />
            </li>
          ))}
        </ul>
        {fout && <p className="fout">{fout}</p>}
        {ok && <p className="ok">✓ Opgeslagen</p>}
        <button className="btn" disabled={!onderdeel.trim()}>Opslaan</button>
      </form>

      <div className="card stack">
        <h2>Onderdelen</h2>
        {onderdelen.length === 0 && <p className="note">Nog geen punten ingevoerd.</p>}
        {onderdelen.map((o) => (
          <div key={`${o.dag}${o.onderdeel}`} className="rij tussen">
            <span>Dag {o.dag}: {o.onderdeel}</span>
            <span className="rij">
              <button className="btn ghost klein" onClick={() => laadOnderdeel(o)}>Bewerken</button>
              <button
                className="btn danger klein"
                onClick={async () => { if (window.confirm('Alle punten van dit onderdeel verwijderen?')) { await rootRpc('root_punten_verwijderen', { p_dag: o.dag, p_onderdeel: o.onderdeel }); laad() } }}
              >
                Verwijderen
              </button>
            </span>
          </div>
        ))}
      </div>

      <div className="card stack">
        <h2>Totaalstand (alleen voor jou, alle dagen)</h2>
        <ol className="stand">
          {totaal.map((k, i) => (
            <li key={k.id}><span className="positie">{i + 1}</span><span className="grow">{k.naam}</span><strong>{k.punten}</strong></li>
          ))}
        </ol>
      </div>
    </div>
  )
}
