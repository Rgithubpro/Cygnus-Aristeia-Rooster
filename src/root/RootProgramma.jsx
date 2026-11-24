import { useEffect, useState } from 'react'
import { rootRpc } from './client.js'
import ActiviteitForm, { LEEG } from '../ActiviteitForm.jsx'
import { dagDatum, dagLabel } from '../util.js'
import { txt } from '../t.js'

// Programme items that every class sees (opening, lunch, prize giving) and day messages for everyone.
export default function RootProgramma({ overzicht }) {
  const [data, setData] = useState(null)
  const [bewerk, setBewerk] = useState(null)
  const laad = () => rootRpc('root_programma').then(setData)
  useEffect(() => {
    laad()
  }, [])

  if (!data) return <p className="note">{txt('Laden…')}</p>

  if (bewerk) {
    return (
      <ActiviteitForm
        zonderDeelnemers
        startwaarde={bewerk}
        opslaan={(f) =>
          rootRpc('root_activiteit_opslaan', {
            p_id: f.id, p_titel: f.titel, p_dag: f.dag, p_start: f.start, p_eind: f.eind,
            p_locatie: f.locatie, p_omschrijving: f.omschrijving, p_kleur: f.kleur, p_emoji: f.emoji,
          })
        }
        onKlaar={async () => { await laad(); setBewerk(null) }}
        onAnnuleer={() => setBewerk(null)}
      />
    )
  }

  const label = (d) => dagLabel(dagDatum(overzicht.instellingen, d), d)

  return (
    <div className="stack">
      <Dagberichten data={data} label={label} />
      <h2>{txt('Onderdelen voor iedereen')}</h2>
      <button className="btn" onClick={() => setBewerk({ ...LEEG })}>{txt('Nieuw onderdeel')}</button>
      {data.activiteiten.length === 0 && <p className="note">{txt('Nog geen onderdelen.')}</p>}
      <ul className="stack lijst-los">
        {data.activiteiten.map((a) => (
          <li key={a.id} className="card stack klein-gap">
            <strong>{a.emoji ? `${a.emoji} ` : ''}{a.titel}</strong>
            <span className="meta">{label(a.dag)}, {a.start} – {a.eind}{a.locatie ? `, ${a.locatie}` : ''}</span>
            <div className="rij">
              <button className="btn ghost klein" onClick={() => setBewerk(a)}>{txt('Bewerken')}</button>
              <button className="btn ghost klein" onClick={() => setBewerk({ ...a, id: null, titel: `${a.titel} (kopie)` })}>{txt('Dupliceren')}</button>
              <button
                className="btn danger klein"
                onClick={async () => {
                  if (!window.confirm(txt('Dit onderdeel verwijderen?'))) return
                  await rootRpc('root_activiteit_verwijderen', { p_id: a.id })
                  laad()
                }}
              >
                {txt('Verwijderen')}
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}

function Dagberichten({ data, label }) {
  const start = (d) => data.dagberichten.find((b) => b.dag === d)?.bericht || ''
  const [w, setW] = useState({ 1: start(1), 2: start(2) })
  const [ok, setOk] = useState(0)
  return (
    <div className="card stack">
      <h2>{txt('Dagberichten voor alle klassen')}</h2>
      <p className="note">{txt('Klassenbeheerders kunnen dit per klas overschrijven.')}</p>
      {[1, 2].map((d) => (
        <div key={d} className="rij">
          <label className="veld grow">
            <span>{label(d)}</span>
            <input value={w[d]} maxLength={200} onChange={(e) => setW({ ...w, [d]: e.target.value })} />
          </label>
          <button
            className="btn ghost klein"
            onClick={async () => { await rootRpc('root_dagbericht_zetten', { p_dag: d, p_bericht: w[d] }); setOk(d) }}
          >
            {ok === d ? txt('✓ Opgeslagen') : txt('Opslaan')}
          </button>
        </div>
      ))}
    </div>
  )
}
