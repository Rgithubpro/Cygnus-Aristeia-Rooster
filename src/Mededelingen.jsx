import { rpc } from './api.js'
import { useLive } from './hooks.js'
import { nl } from './strings.js'

export default function Mededelingen({ sessie }) {
  const { data, fout } = useLive('mededelingen', () => rpc('mededelingen_lijst', { p_token: sessie.token }), [])

  if (!data) return <p className="note">{fout ? nl.laadFout : nl.laden}</p>
  if (data.length === 0) return <p className="note">{nl.leegMededelingen}</p>

  return (
    <ul className="stack lijst-los">
      {data.map((m) => (
        <li key={m.id} className="card">
          <div className="section-head">
            <h3>{m.titel}</h3>
            {m.globaal && <span className="tag">{nl.voorIedereen}</span>}
          </div>
          {m.tekst && <p>{m.tekst}</p>}
          <p className="note">{m.tijd}</p>
        </li>
      ))}
    </ul>
  )
}
