import { useState } from 'react'
import { KLEUREN, overlapt } from './util.js'
import { nl } from './strings.js'

export const LEEG = { id: null, titel: '', dag: 1, start: '09:00', eind: '09:45', locatie: '', omschrijving: '', kleur: 'blauw', leerlingen: [] }

// Shared by class admins (with participants) and Root (programme items for everyone, zonderDeelnemers).
export default function ActiviteitForm({ startwaarde, leerlingen = [], anderen = [], opslaan, onKlaar, onAnnuleer, zonderDeelnemers = false }) {
  const [f, setF] = useState(startwaarde)
  const [fout, setFout] = useState('')
  const [bezig, setBezig] = useState(false)
  const zet = (veld) => (e) => setF({ ...f, [veld]: e.target.value })
  const wissel = (id) =>
    setF({ ...f, leerlingen: f.leerlingen.includes(id) ? f.leerlingen.filter((x) => x !== id) : [...f.leerlingen, id] })

  // warn when a selected student is already busy at the same time
  const waarschuwingen = []
  if (!zonderDeelnemers && f.eind > f.start) {
    const naam = Object.fromEntries(leerlingen.map((l) => [l.id, l.naam]))
    for (const b of anderen) {
      if (b.id === f.id || !overlapt({ ...f, dag: Number(f.dag) }, b)) continue
      const getroffen = b.globaal ? f.leerlingen : f.leerlingen.filter((id) => b.leerlingen.includes(id))
      if (getroffen.length === 0) continue
      const wie = getroffen.length > 3 ? `${getroffen.length} leerlingen` : getroffen.map((id) => naam[id]).join(', ')
      waarschuwingen.push(`${wie} ${nl.overlaptMet} "${b.titel}" (${b.start}–${b.eind})`)
    }
  }

  async function bewaar(e) {
    e.preventDefault()
    if (!f.titel.trim()) return setFout(nl.titelFout)
    if (f.eind <= f.start) return setFout(nl.tijdFout)
    setBezig(true)
    setFout('')
    try {
      await opslaan({ ...f, dag: Number(f.dag) })
      onKlaar()
    } catch (err) {
      setFout(nl.fouten[err.code] || nl.laadFout)
      setBezig(false)
    }
  }

  return (
    <form className="card stack" onSubmit={bewaar}>
      <label className="veld">
        <span>{nl.titel}</span>
        <input value={f.titel} onChange={zet('titel')} maxLength={80} required />
      </label>
      <div className="rij">
        <label className="veld grow">
          <span>{nl.dag}</span>
          <select value={f.dag} onChange={zet('dag')}>
            <option value={1}>{nl.dag} 1</option>
            <option value={2}>{nl.dag} 2</option>
          </select>
        </label>
        <label className="veld grow">
          <span>{nl.kleur}</span>
          <select value={f.kleur} onChange={zet('kleur')}>
            {KLEUREN.map(([k, l]) => (
              <option key={k} value={k}>
                {l}
              </option>
            ))}
          </select>
        </label>
      </div>
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

      {!zonderDeelnemers && (
        <fieldset className="veld">
          <legend>
            {nl.deelnemers} ({f.leerlingen.length})
          </legend>
          <div className="rij">
            <button type="button" className="btn ghost klein" onClick={() => setF({ ...f, leerlingen: leerlingen.map((l) => l.id) })}>
              {nl.iedereenKnop}
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
      )}

      {waarschuwingen.length > 0 && (
        <div className="waarschuwing" role="status">
          <strong>⚠️ {nl.conflicten}</strong>
          <ul>
            {waarschuwingen.slice(0, 6).map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        </div>
      )}
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
