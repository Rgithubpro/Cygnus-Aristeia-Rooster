import { useState } from 'react'
import { rpc } from './api.js'
import { useLive } from './hooks.js'
import { nl } from './strings.js'

export default function KiesNaam({ sessie, onKlaar }) {
  const [zoek, setZoek] = useState('')
  const [gekozen, setGekozen] = useState(null)
  const [fout, setFout] = useState('')
  const { data: leerlingen } = useLive('leerlingen', () => rpc('leerlingen_van_klas', { p_token: sessie.token }), [], 120000)

  async function bevestig() {
    setFout('')
    try {
      await rpc('kies_leerling', { p_token: sessie.token, p_leerling_id: gekozen.id })
      onKlaar({ ...sessie, leerlingId: gekozen.id })
    } catch {
      setFout(nl.laadFout)
    }
  }

  if (gekozen) {
    return (
      <div className="card stack">
        <h2>
          {nl.benJij} {gekozen.naam}?
        </h2>
        {fout && <p className="fout">{fout}</p>}
        <button className="btn" onClick={bevestig}>
          {nl.jaDatBenIk}
        </button>
        <button className="btn ghost" onClick={() => setGekozen(null)}>
          {nl.nee}
        </button>
      </div>
    )
  }

  const lijst = (leerlingen || []).filter((l) => l.naam.toLowerCase().includes(zoek.toLowerCase()))

  return (
    <div className="card stack">
      <h2>{nl.wieBenJij}</h2>
      <input
        type="search"
        placeholder={nl.zoekNaam}
        value={zoek}
        onChange={(e) => setZoek(e.target.value)}
        aria-label={nl.zoekNaam}
      />
      {leerlingen && leerlingen.length === 0 && <p className="note">{nl.geenLeerlingen}</p>}
      <ul className="keuzelijst">
        {lijst.map((l) => (
          <li key={l.id}>
            <button className="keuze" onClick={() => setGekozen(l)}>
              {l.naam}
            </button>
          </li>
        ))}
      </ul>
      {sessie.rol === 'beheer' && (
        <button className="btn ghost" onClick={() => onKlaar({ ...sessie, naamOvergeslagen: true })}>
          {nl.overslaan}
        </button>
      )}
    </div>
  )
}
