import { useState } from 'react'
import { rpc } from './api.js'
import { useLive } from './hooks.js'
import { nl } from './strings.js'

const LEEG = { id: null, titel: '', dag: 1, start: '09:00', eind: '09:45', locatie: '', omschrijving: '', leerlingen: [] }

export default function Beheer({ sessie }) {
  const [deel, setDeel] = useState('activiteiten')
  const delen = [
    ['activiteiten', nl.activiteiten],
    ['leerlingen', nl.leerlingen],
    ['mededelingen', nl.mededelingen],
  ]
  return (
    <div className="stack">
      <div className="segment" role="tablist">
        {delen.map(([id, label]) => (
          <button key={id} role="tab" aria-selected={deel === id} onClick={() => setDeel(id)}>
            {label}
          </button>
        ))}
      </div>
      {deel === 'activiteiten' && <Activiteiten sessie={sessie} />}
      {deel === 'leerlingen' && <Leerlingen sessie={sessie} />}
      {deel === 'mededelingen' && <MededelingenBeheer sessie={sessie} />}
    </div>
  )
}

/* ---------- activiteiten ---------- */

function Activiteiten({ sessie }) {
  const [bewerk, setBewerk] = useState(null)
  const { data: acts, herlaad } = useLive('beheer.activiteiten', () => rpc('activiteiten_van_klas', { p_token: sessie.token }), [], 30000)
  const { data: leerlingen } = useLive('leerlingen', () => rpc('leerlingen_van_klas', { p_token: sessie.token }), [], 120000)

  if (bewerk) {
    return (
      <ActiviteitForm
        sessie={sessie}
        startwaarde={bewerk}
        leerlingen={leerlingen || []}
        onKlaar={() => {
          setBewerk(null)
          herlaad()
        }}
        onAnnuleer={() => setBewerk(null)}
      />
    )
  }

  async function verwijder(a) {
    if (!window.confirm(nl.zekerActiviteit)) return
    await rpc('activiteit_verwijderen', { p_token: sessie.token, p_id: a.id })
    herlaad()
  }

  return (
    <div className="stack">
      <button className="btn" onClick={() => setBewerk({ ...LEEG })}>
        {nl.nieuweActiviteit}
      </button>
      {acts && acts.length === 0 && <p className="note">{nl.geenActiviteiten}</p>}
      <ul className="stack lijst-los">
        {(acts || []).map((a) => (
          <li key={a.id} className="card stack klein-gap">
            <strong>{a.titel}</strong>
            <span className="meta">
              {nl.dag} {a.dag}, {a.start} – {a.eind}
              {a.locatie ? `, ${a.locatie}` : ''}
            </span>
            <span className="meta">
              {a.leerlingen.length} {nl.deelnemersAantal}
            </span>
            <div className="rij">
              <button className="btn ghost klein" onClick={() => setBewerk(a)}>
                {nl.bewerken}
              </button>
              <button className="btn danger klein" onClick={() => verwijder(a)}>
                {nl.verwijderen}
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}

function ActiviteitForm({ sessie, startwaarde, leerlingen, onKlaar, onAnnuleer }) {
  const [f, setF] = useState(startwaarde)
  const [fout, setFout] = useState('')
  const [bezig, setBezig] = useState(false)
  const zet = (veld) => (e) => setF({ ...f, [veld]: e.target.value })

  const wissel = (id) =>
    setF({ ...f, leerlingen: f.leerlingen.includes(id) ? f.leerlingen.filter((x) => x !== id) : [...f.leerlingen, id] })

  async function bewaar(e) {
    e.preventDefault()
    if (!f.titel.trim()) return setFout(nl.titelFout)
    if (f.eind <= f.start) return setFout(nl.tijdFout)
    setBezig(true)
    setFout('')
    try {
      await rpc('activiteit_opslaan', {
        p_token: sessie.token,
        p_id: f.id,
        p_titel: f.titel,
        p_dag: Number(f.dag),
        p_start: f.start,
        p_eind: f.eind,
        p_locatie: f.locatie,
        p_omschrijving: f.omschrijving,
        p_leerlingen: f.leerlingen,
      })
      onKlaar()
    } catch {
      setFout(nl.laadFout)
      setBezig(false)
    }
  }

  return (
    <form className="card stack" onSubmit={bewaar}>
      <label className="veld">
        <span>{nl.titel}</span>
        <input value={f.titel} onChange={zet('titel')} maxLength={80} required />
      </label>
      <label className="veld">
        <span>{nl.dag}</span>
        <select value={f.dag} onChange={zet('dag')}>
          <option value={1}>{nl.dag} 1</option>
          <option value={2}>{nl.dag} 2</option>
        </select>
      </label>
      <div className="rij">
        <label className="veld grow">
          <span>{nl.begin}</span>
          <input type="time" value={f.start} onChange={zet('start')} required />
        </label>
        <label className="veld grow">
          <span>{nl.einde}</span>
          <input type="time" value={f.eind} onChange={zet('eind')} required />
        </label>
      </div>
      <label className="veld">
        <span>{nl.locatie}</span>
        <input value={f.locatie} onChange={zet('locatie')} maxLength={80} />
      </label>
      <label className="veld">
        <span>{nl.omschrijving}</span>
        <textarea value={f.omschrijving} onChange={zet('omschrijving')} maxLength={500} rows={3} />
      </label>

      <fieldset className="veld">
        <legend>
          {nl.deelnemers} ({f.leerlingen.length})
        </legend>
        <div className="rij">
          <button type="button" className="btn ghost klein" onClick={() => setF({ ...f, leerlingen: leerlingen.map((l) => l.id) })}>
            {nl.iedereen}
          </button>
          <button type="button" className="btn ghost klein" onClick={() => setF({ ...f, leerlingen: [] })}>
            {nl.niemand}
          </button>
        </div>
        <ul className="vinklijst">
          {leerlingen.map((l) => (
            <li key={l.id}>
              <label>
                <input type="checkbox" checked={f.leerlingen.includes(l.id)} onChange={() => wissel(l.id)} />
                <span>{l.naam}</span>
              </label>
            </li>
          ))}
        </ul>
      </fieldset>

      {fout && (
        <p className="fout" role="alert">
          {fout}
        </p>
      )}
      <button className="btn" disabled={bezig}>
        {nl.opslaan}
      </button>
      <button type="button" className="btn ghost" onClick={onAnnuleer}>
        {nl.annuleren}
      </button>
    </form>
  )
}

/* ---------- leerlingen ---------- */

function Leerlingen({ sessie }) {
  const [namen, setNamen] = useState('')
  const [fout, setFout] = useState('')
  const { data, herlaad } = useLive('leerlingen', () => rpc('leerlingen_van_klas', { p_token: sessie.token }), [], 120000)

  async function voegToe(e) {
    e.preventDefault()
    setFout('')
    try {
      await rpc('leerlingen_toevoegen', { p_token: sessie.token, p_namen: namen })
      setNamen('')
      herlaad()
    } catch {
      setFout(nl.laadFout)
    }
  }

  async function verwijder(l) {
    if (!window.confirm(`${l.naam}: ${nl.zekerLeerling}`)) return
    await rpc('leerling_verwijderen', { p_token: sessie.token, p_id: l.id })
    herlaad()
  }

  return (
    <div className="stack">
      <form className="card stack" onSubmit={voegToe}>
        <label className="veld">
          <span>{nl.namenToevoegen}</span>
          <textarea value={namen} onChange={(e) => setNamen(e.target.value)} rows={5} />
          <small className="note">{nl.namenUitleg}</small>
        </label>
        {fout && <p className="fout">{fout}</p>}
        <button className="btn" disabled={!namen.trim()}>
          {nl.toevoegen}
        </button>
      </form>
      <ul className="keuzelijst">
        {(data || []).map((l) => (
          <li key={l.id} className="rij tussen">
            <span>{l.naam}</span>
            <button className="btn danger klein" onClick={() => verwijder(l)}>
              {nl.verwijderen}
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}

/* ---------- mededelingen ---------- */

function MededelingenBeheer({ sessie }) {
  const [titel, setTitel] = useState('')
  const [tekst, setTekst] = useState('')
  const [fout, setFout] = useState('')
  const { data, herlaad } = useLive('mededelingen', () => rpc('mededelingen_lijst', { p_token: sessie.token }), [], 30000)

  async function plaats(e) {
    e.preventDefault()
    setFout('')
    try {
      await rpc('mededeling_plaatsen', { p_token: sessie.token, p_titel: titel, p_tekst: tekst })
      setTitel('')
      setTekst('')
      herlaad()
    } catch {
      setFout(nl.laadFout)
    }
  }

  async function verwijder(m) {
    if (!window.confirm(nl.zekerMededeling)) return
    await rpc('mededeling_verwijderen', { p_token: sessie.token, p_id: m.id })
    herlaad()
  }

  return (
    <div className="stack">
      <form className="card stack" onSubmit={plaats}>
        <h3>{nl.nieuweMededeling}</h3>
        <label className="veld">
          <span>{nl.titel}</span>
          <input value={titel} onChange={(e) => setTitel(e.target.value)} maxLength={80} required />
        </label>
        <label className="veld">
          <span>{nl.mededelingTekst}</span>
          <textarea value={tekst} onChange={(e) => setTekst(e.target.value)} rows={3} maxLength={1000} />
        </label>
        {fout && <p className="fout">{fout}</p>}
        <button className="btn" disabled={!titel.trim()}>
          {nl.plaatsen}
        </button>
      </form>
      <ul className="stack lijst-los">
        {(data || []).map((m) => (
          <li key={m.id} className="card stack klein-gap">
            <strong>{m.titel}</strong>
            {m.tekst && <span>{m.tekst}</span>}
            <span className="note">
              {m.tijd}
              {m.globaal ? `, ${nl.voorIedereen}` : ''}
            </span>
            {!m.globaal && (
              <button className="btn danger klein" onClick={() => verwijder(m)}>
                {nl.verwijderen}
              </button>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}
