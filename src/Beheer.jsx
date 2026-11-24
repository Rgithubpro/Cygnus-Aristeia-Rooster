import { useEffect, useState } from 'react'
import { WIKI_URL } from './config.js'
import Modal from './Modal.jsx'
import { rpc } from './api.js'
import { useData } from './data.jsx'
import { dagDatum, dagLabel } from './util.js'
import ActiviteitForm, { LEEG } from './ActiviteitForm.jsx'
import BeheerLeerlingen from './BeheerLeerlingen.jsx'
import BeheerInfo from './BeheerInfo.jsx'
import BeheerPush from './BeheerPush.jsx'
import BeheerSjablonen from './BeheerSjablonen.jsx'
import BeheerKlas from './BeheerKlas.jsx'
import { stuurBeheerPagina, useAnalyticsToestemming } from './analytics.js'
import { txt } from './t.js'

const WIKI = (
  <a href={WIKI_URL} target="_blank" rel="noopener noreferrer">
    {txt('de wiki')}
  </a>
)

function BeheerWelkom() {
  const [open, setOpen] = useState(() => {
    try {
      return localStorage.getItem('ksv.beheer_welkom') !== '1'
    } catch {
      return false
    }
  })
  if (!open) return null
  const sluit = () => {
    try {
      localStorage.setItem('ksv.beheer_welkom', '1')
    } catch {
      /* ignore */
    }
    setOpen(false)
  }
  return (
    <Modal titel={txt('👋 Welkom, beheerder!')} onSluit={sluit}>
      <p>{txt('Hier regel je alles voor je klas: de activiteiten en wie meedoet, je leerlingen, berichten, en het uiterlijk van de hele app (kleuren, logo, app-icoon, een eigen klaspagina en meer).')}</p>
      {WIKI_URL && <p>{txt('Begin met de uitleg en tips op')} {WIKI}.</p>}
      {WIKI_URL && <a className="btn" href={WIKI_URL} target="_blank" rel="noopener noreferrer">{txt('📖 Open de wiki')}</a>}
    </Modal>
  )
}

export default function Beheer({ sessie }) {
  const [deel, setDeel] = useState('activiteiten')
  const analyticsToestemming = useAnalyticsToestemming()
  const { ververs } = useData()
  useEffect(() => {
    if (analyticsToestemming === 'granted') stuurBeheerPagina(sessie.klas?.slug, deel)
  }, [analyticsToestemming, deel, sessie.klas?.slug])
  const delen = [
    ['activiteiten', txt('Activiteiten')],
    ['leerlingen', txt('Leerlingen')],
    ['dagberichten', txt('Dagberichten')],
    ['info', txt('Info')],
    ['meldingen', txt('Meldingen')],
    ['klas', txt('Uiterlijk')],
  ]
  return (
    <div className="stack">
      <BeheerWelkom />
      {WIKI_URL && <p className="hulp">{txt('📖 Nieuw als beheerder? Lees')} {WIKI} {txt('voor uitleg en hulp om te beginnen.')}</p>}
      <div className="segment" role="tablist">
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
        ↻ {txt('Vernieuwen')}
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
    if (!window.confirm(txt('Deze activiteit verwijderen?'))) return
    await rpc('activiteit_verwijderen', { p_token: sessie.token, p_id: a.id })
    ververs()
  }

  const eigen = data.activiteiten.filter((a) => !a.globaal)
  const globaal = data.activiteiten.filter((a) => a.globaal)

  return (
    <div className="stack">
      <BeheerSjablonen sessie={sessie} />
      <button className="btn" onClick={() => setBewerk({ ...LEEG })}>
        {txt('Nieuwe activiteit')}
      </button>
      {eigen.length === 0 && <p className="note">{txt('Nog geen activiteiten. Voeg de eerste toe.')}</p>}
      <ul className="stack lijst-los">
        {eigen.map((a) => (
          <li key={a.id} className="card stack klein-gap">
            <strong>{a.titel}</strong>
            <span className="meta">
              {dagLabel(dagDatum(data.instellingen, a.dag), a.dag)}, {a.start} – {a.eind}
              {a.locatie ? `, ${a.locatie}` : ''}
            </span>
            <span className="meta">
              {a.leerlingen.length} {txt('deelnemers')}
            </span>
            <div className="rij">
              <button className="btn ghost klein" onClick={() => setBewerk(a)}>
                {txt('Bewerken')}
              </button>
              <button className="btn ghost klein" onClick={() => setBewerk({ ...a, id: null, titel: `${a.titel} (kopie)` })}>
                {txt('Dupliceren')}
              </button>
              <button className="btn danger klein" onClick={() => verwijder(a)}>
                {txt('Verwijderen')}
              </button>
            </div>
          </li>
        ))}
      </ul>
      {globaal.length > 0 && (
        <>
          <h3>{txt('Voor iedereen')}</h3>
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
      setFout(txt('Er ging iets mis. Controleer je verbinding en probeer het opnieuw.'))
    }
  }

  return (
    <div className="stack">
      <p className="note">{txt('Een korte tekst bovenaan de dag, bijvoorbeeld "08:30 aanwezig zijn".')}</p>
      {[1, 2].map((d) => (
        <div key={d} className="card stack">
          <label className="veld">
            <span>{dagLabel(dagDatum(data.instellingen, d), d)}</span>
            <input value={waarden[d]} maxLength={200} onChange={(e) => setWaarden({ ...waarden, [d]: e.target.value })} />
          </label>
          <button className="btn" onClick={() => bewaar(d)}>
            {txt('Opslaan')}
          </button>
          {ok === d && <p className="ok">✓ {txt('Opgeslagen')}</p>}
        </div>
      ))}
      {fout && <p className="fout">{fout}</p>}
    </div>
  )
}
