import { useEffect, useState } from 'react'
import { rootRpc } from './client.js'
import ActiviteitForm, { LEEG } from '../ActiviteitForm.jsx'
import { emoji } from '../util.js'
import { txt } from '../t.js'

// Example roosters ("sjablonen"): parts of a rooster that class admins can copy into their own class.
export default function RootSjablonen({ overzicht }) {
  const [lijst, setLijst] = useState(null)
  const [bewerk, setBewerk] = useState(null) // template being edited: {id, naam, beschrijving, klas_ids}
  const [item, setItem] = useState(null) // {sjabloon, start}
  const laad = () => rootRpc('root_sjablonen_lijst').then(setLijst)
  useEffect(() => { laad() }, [])

  if (item) {
    return (
      <ActiviteitForm
        zonderDeelnemers
        startwaarde={item.start}
        opslaan={(f) => rootRpc('root_sjabloon_item_opslaan', { p_id: f.id, p_sjabloon: item.sjabloon, p_titel: f.titel, p_dag: f.dag, p_start: f.start, p_eind: f.eind, p_locatie: f.locatie, p_omschrijving: f.omschrijving, p_kleur: f.kleur, p_emoji: f.emoji })}
        onKlaar={async () => { await laad(); setItem(null) }}
        onAnnuleer={() => setItem(null)}
      />
    )
  }

  if (bewerk) return <SjabloonForm start={bewerk} klassen={overzicht.klassen} onKlaar={async () => { await laad(); setBewerk(null) }} onAnnuleer={() => setBewerk(null)} />

  return (
    <div className="stack">
      <p className="note">{txt('Maak voorbeeldroosters of losse onderdelen. Klassenbeheerders kiezen zelf wat ze overnemen en voegen daarna alleen hun leerlingen toe.')}</p>
      <button className="btn" onClick={() => setBewerk({ id: null, naam: '', beschrijving: '', klas_ids: [] })}>{txt('Nieuw voorbeeldrooster')}</button>
      {lijst && lijst.length === 0 && <p className="note">{txt('Nog geen voorbeeldroosters.')}</p>}
      {(lijst || []).map((j) => (
        <div key={j.id} className="card stack klein-gap">
          <div className="rij tussen">
            <strong>{j.naam}</strong>
            <span className="note">{j.klas_ids.length === 0 ? txt('Alle klassen') : `${j.klas_ids.length} klas(sen)`}</span>
          </div>
          {j.beschrijving && <span className="note">{j.beschrijving}</span>}
          <ul className="keuzelijst">
            {j.items.map((i) => (
              <li key={i.id} className="rij tussen">
                <span>{i.emoji || emoji(i.titel)} {txt('Dag')} {i.dag} {i.start}–{i.eind}: {i.titel}</span>
                <span className="rij">
                  <button className="btn ghost klein" onClick={() => setItem({ sjabloon: j.id, start: i })}>{txt('Bewerken')}</button>
                  <button className="btn danger klein" onClick={async () => { if (window.confirm(txt('Dit onderdeel verwijderen? Al gekopieerde activiteiten blijven bestaan.'))) { await rootRpc('root_sjabloon_item_verwijderen', { p_id: i.id }); laad() } }}>✕</button>
                </span>
              </li>
            ))}
          </ul>
          <div className="rij">
            <button className="btn klein" onClick={() => setItem({ sjabloon: j.id, start: { ...LEEG } })}>{txt('+ Onderdeel')}</button>
            <button className="btn ghost klein" onClick={() => setBewerk(j)}>{txt('Naam en klassen')}</button>
            <button className="btn danger klein" onClick={async () => { if (window.confirm(txt('Dit hele voorbeeldrooster verwijderen?'))) { await rootRpc('root_sjabloon_verwijderen', { p_id: j.id }); laad() } }}>{txt('Verwijderen')}</button>
          </div>
        </div>
      ))}
    </div>
  )
}

function SjabloonForm({ start, klassen, onKlaar, onAnnuleer }) {
  const [f, setF] = useState(start)
  const [fout, setFout] = useState('')
  const alle = f.klas_ids.length === 0
  const wissel = (id) => setF({ ...f, klas_ids: f.klas_ids.includes(id) ? f.klas_ids.filter((x) => x !== id) : [...f.klas_ids, id] })
  async function bewaar(e) {
    e.preventDefault()
    setFout('')
    try {
      await rootRpc('root_sjabloon_opslaan', { p_id: f.id, p_naam: f.naam, p_beschrijving: f.beschrijving, p_klas_ids: f.klas_ids })
      onKlaar()
    } catch {
      setFout(txt('Opslaan mislukt.'))
    }
  }
  return (
    <form className="card stack" onSubmit={bewaar}>
      <label className="veld"><span>{txt('Naam')}</span><input value={f.naam} onChange={(e) => setF({ ...f, naam: e.target.value })} maxLength={60} required /></label>
      <label className="veld"><span>{txt('Beschrijving (voor de beheerders)')}</span><textarea value={f.beschrijving} onChange={(e) => setF({ ...f, beschrijving: e.target.value })} rows={2} maxLength={300} /></label>
      <fieldset className="veld">
        <legend>{txt('Voor welke klassen?')}</legend>
        <label className="vink"><input type="checkbox" checked={alle} onChange={() => setF({ ...f, klas_ids: [] })} /><span>{txt('Alle klassen')}</span></label>
        <ul className="vinklijst">
          {klassen.map((k) => (
            <li key={k.id}><label><input type="checkbox" checked={f.klas_ids.includes(k.id)} onChange={() => wissel(k.id)} /><span>{k.naam}</span></label></li>
          ))}
        </ul>
        {!alle && <small className="note">{txt('Alleen de aangevinkte klassen zien dit voorbeeldrooster.')}</small>}
      </fieldset>
      {fout && <p className="fout">{fout}</p>}
      <button className="btn">{txt('Opslaan')}</button>
      <button type="button" className="btn ghost" onClick={onAnnuleer}>{txt('Annuleren')}</button>
    </form>
  )
}
