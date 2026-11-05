import { useState } from 'react'
import { rpc } from './api.js'
import { useData } from './data.jsx'
import { nl } from './strings.js'
import { dagDatum, dagLabel } from './util.js'
import ActiviteitForm, { LEEG } from './ActiviteitForm.jsx'
import BeheerLeerlingen from './BeheerLeerlingen.jsx'
import BeheerInfo from './BeheerInfo.jsx'
import BeheerPush from './BeheerPush.jsx'
import BeheerKlas from './BeheerKlas.jsx'

export default function Beheer({ sessie }) {
  const [deel, setDeel] = useState('activiteiten')
  const { ververs } = useData()
  const delen = [
    ['activiteiten', nl.activiteiten],
    ['leerlingen', nl.leerlingen],
    ['dagberichten', nl.dagberichten],
    ['info', nl.info],
    ['meldingen', nl.meldingen],
    ['klas', nl.uiterlijk],
  ]
  return (
    <div className="stack">
      <div className="segment scroll" role="tablist">
        {delen.map(([id, label]) => (
          <button key={id} role="tab" aria-selected={deel === id} onClick={() => setDeel(id)}>
            {label}
          </button>
        ))}
      </div>
      {deel === 'activiteiten' && <Activiteiten sessie={sessie} />}
      {deel === 'leerlingen' && <BeheerLeerlingen sessie={sessie} />}
      {deel === 'dagberichten' && <Dagberichten sessie={sessie} />}
      {deel === 'info' && <BeheerInfo sessie={sessie} />}
      {deel === 'meldingen' && <BeheerPush sessie={sessie} />}
      {deel === 'klas' && <BeheerKlas sessie={sessie} />}
      <button className="btn ghost klein" onClick={ververs}>
        ↻ {nl.verversen}
      </button>
    </div>
  )
}

function Activiteiten({ sessie }) {
  const { data, ververs } = useData()
  const [bewerk, setBewerk] = useState(null)

  if (bewerk) {
    return (
      <ActiviteitForm
        startwaarde={bewerk}
        leerlingen={data.leerlingen}
        anderen={data.activiteiten}
        opslaan={(f) =>
          rpc('activiteit_opslaan', {
            p_token: sessie.token,
            p_id: f.id,
            p_titel: f.titel,
            p_dag: f.dag,
            p_start: f.start,
            p_eind: f.eind,
            p_locatie: f.locatie,
            p_omschrijving: f.omschrijving,
            p_kleur: f.kleur,
            p_emoji: f.emoji,
            p_leerlingen: f.leerlingen,
          })
        }
        onKlaar={async () => {
          await ververs()
          setBewerk(null)
        }}
        onAnnuleer={() => setBewerk(null)}
      />
    )
  }

  async function verwijder(a) {
    if (!window.confirm(nl.zekerActiviteit)) return
    await rpc('activiteit_verwijderen', { p_token: sessie.token, p_id: a.id })
    ververs()
  }

  const eigen = data.activiteiten.filter((a) => !a.globaal)
  const globaal = data.activiteiten.filter((a) => a.globaal)

  return (
    <div className="stack">
      <button className="btn" onClick={() => setBewerk({ ...LEEG })}>
        {nl.nieuweActiviteit}
      </button>
      {eigen.length === 0 && <p className="note">{nl.geenActiviteitenBeheer}</p>}
      <ul className="stack lijst-los">
        {eigen.map((a) => (
          <li key={a.id} className="card stack klein-gap">
            <strong>{a.titel}</strong>
            <span className="meta">
              {dagLabel(dagDatum(data.instellingen, a.dag), a.dag)}, {a.start} – {a.eind}
              {a.locatie ? `, ${a.locatie}` : ''}
            </span>
            <span className="meta">
              {a.leerlingen.length} {nl.deelnemersAantal}
            </span>
            <div className="rij">
              <button className="btn ghost klein" onClick={() => setBewerk(a)}>
                {nl.bewerken}
              </button>
              <button className="btn ghost klein" onClick={() => setBewerk({ ...a, id: null, titel: `${a.titel} (kopie)` })}>
                {nl.dupliceren}
              </button>
              <button className="btn danger klein" onClick={() => verwijder(a)}>
                {nl.verwijderen}
              </button>
            </div>
          </li>
        ))}
      </ul>
      {globaal.length > 0 && (
        <>
          <h3>{nl.voorIedereen}</h3>
          <ul className="keuzelijst">
            {globaal.map((a) => (
              <li key={a.id}>
                {dagLabel(dagDatum(data.instellingen, a.dag), a.dag)} {a.start}: {a.titel}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}

function Dagberichten({ sessie }) {
  const { data, ververs } = useData()
  const start = (d) => data.dagberichten.find((b) => b.dag === d && !b.globaal)?.bericht || ''
  const [waarden, setWaarden] = useState({ 1: start(1), 2: start(2) })
  const [fout, setFout] = useState('')
  const [ok, setOk] = useState(0)

  async function bewaar(d) {
    setFout('')
    setOk(0)
    try {
      await rpc('dagbericht_zetten', { p_token: sessie.token, p_dag: d, p_bericht: waarden[d] })
      await ververs()
      setOk(d)
    } catch {
      setFout(nl.laadFout)
    }
  }

  return (
    <div className="stack">
      <p className="note">{nl.dagberichtUitleg}</p>
      {[1, 2].map((d) => (
        <div key={d} className="card stack">
          <label className="veld">
            <span>{dagLabel(dagDatum(data.instellingen, d), d)}</span>
            <input value={waarden[d]} maxLength={200} onChange={(e) => setWaarden({ ...waarden, [d]: e.target.value })} />
          </label>
          <button className="btn" onClick={() => bewaar(d)}>
            {nl.opslaan}
          </button>
          {ok === d && <p className="ok">✓ {nl.opgeslagen}</p>}
        </div>
      ))}
      {fout && <p className="fout">{fout}</p>}
    </div>
  )
}
