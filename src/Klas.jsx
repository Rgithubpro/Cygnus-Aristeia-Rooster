import { useState } from 'react'
import { rpc } from './api.js'
import { useLive } from './hooks.js'
import Rooster from './Rooster.jsx'
import { nl } from './strings.js'

export default function Klas({ sessie }) {
  const [gekozen, setGekozen] = useState(null)
  const { data: leerlingen } = useLive('leerlingen', () => rpc('leerlingen_van_klas', { p_token: sessie.token }), [], 120000)

  if (gekozen) {
    return (
      <div className="stack">
        <button className="btn ghost klein" onClick={() => setGekozen(null)}>
          {nl.terug}
        </button>
        <h2>{gekozen.naam}</h2>
        <Rooster sessie={sessie} leerlingId={gekozen.id} />
      </div>
    )
  }

  return (
    <div className="stack">
      <p className="note">{nl.klasRoosterUitleg}</p>
      <ul className="keuzelijst">
        {(leerlingen || []).map((l) => (
          <li key={l.id}>
            <button className="keuze" onClick={() => setGekozen(l)}>
              {l.naam}
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
