import { useState } from 'react'
import { rpc } from './api.js'
import { useData } from './data.jsx'
import { txt } from './t.js'

export default function KiesNaam({ sessie, onKlaar, onAnnuleer }) {
  const { data, ververs } = useData()
  const [zoek, setZoek] = useState('')
  const [gekozen, setGekozen] = useState(null)
  const [fout, setFout] = useState('')

  async function bevestig() {
    setFout('')
    try {
      await rpc('kies_leerling', { p_token: sessie.token, p_leerling_id: gekozen.id })
      await ververs()
      onKlaar({ ...sessie, leerlingId: gekozen.id })
    } catch {
      setFout(txt('Er ging iets mis. Controleer je verbinding en probeer het opnieuw.'))
    }
  }

  if (gekozen) {
    return (
      <div className="card stack">
        <h2>
          {txt('Ben jij')} {gekozen.naam}?
        </h2>
        {fout && <p className="fout">{fout}</p>}
        <button className="btn" onClick={bevestig}>
          {txt('Ja, dat ben ik')}
        </button>
        <button className="btn ghost" onClick={() => setGekozen(null)}>
          {txt('Nee')}
        </button>
      </div>
    )
  }

  const leerlingen = data?.leerlingen
  const lijst = (leerlingen || []).filter((l) => l.naam.toLowerCase().includes(zoek.toLowerCase()))

  return (
    <div className="card stack">
      <h2>{txt('Wie ben jij?')}</h2>
      <p className="note">{txt('Let op: je naam wordt op dit apparaat bewaard en gekoppeld aan je meldingen. Kies goed.')}</p>
      <input type="search" placeholder={txt('Zoek je naam')} value={zoek} onChange={(e) => setZoek(e.target.value)} aria-label={txt('Zoek je naam')} />
      {!leerlingen && <p className="note">{txt('Laden…')}</p>}
      {leerlingen && leerlingen.length === 0 && <p className="note">{txt('Er staan nog geen leerlingen in deze klas.')}</p>}
      <ul className="keuzelijst">
        {lijst.map((l) => (
          <li key={l.id}>
            <button className="keuze" onClick={() => setGekozen(l)}>
              {l.naam}
            </button>
          </li>
        ))}
      </ul>
      {sessie.rol === 'beheer' && !onAnnuleer && (
        <button className="btn ghost" onClick={() => onKlaar({ ...sessie, naamOvergeslagen: true })}>
          {txt('Ik ben geen leerling, overslaan')}
        </button>
      )}
      {onAnnuleer && (
        <button className="btn ghost" onClick={onAnnuleer}>
          {txt('Annuleren')}
        </button>
      )}
    </div>
  )
}
