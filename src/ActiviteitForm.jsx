import { useState } from 'react'
import { KLEUREN, overlapt } from './util.js'
import EmojiKiezer from './EmojiKiezer.jsx'
import { foutTekst, txt } from './t.js'

export const LEEG = { id: null, titel: '', dag: 1, start: '09:00', eind: '09:45', locatie: '', omschrijving: '', kleur: 'blauw', emoji: '', leerlingen: [] }

// Shared by class admins (with participants) and Root (programme items for everyone, zonderDeelnemers).
export default function ActiviteitForm({ startwaarde, leerlingen = [], anderen = [], opslaan, onKlaar, onAnnuleer, zonderDeelnemers = false }) {
  const [f, setF] = useState({ ...startwaarde, emoji: startwaarde.emoji || '' })
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
      waarschuwingen.push(`${wie} ${txt('overlapt met')} "${b.titel}" (${b.start}–${b.eind})`)
    }
  }

  async function bewaar(e) {
    e.preventDefault()
    if (!f.titel.trim()) return setFout(txt('Vul een titel in.'))
    if (f.eind <= f.start) return setFout(txt('Het einde moet na het begin liggen.'))
    setBezig(true)
    setFout('')
    try {
      await opslaan({ ...f, dag: Number(f.dag) })
      onKlaar()
    } catch (err) {
      setFout(foutTekst(err.code) || txt('Er ging iets mis. Controleer je verbinding en probeer het opnieuw.'))
      setBezig(false)
    }
  }

  return (
    <form className="card stack" onSubmit={bewaar}>
      <label className="veld">
        <span>{txt('Titel')}</span>
        <input value={f.titel} onChange={zet('titel')} maxLength={80} required />
      </label>
      <div className="rij">
        <label className="veld grow">
          <span>{txt('Dag')}</span>
          <select value={f.dag} onChange={zet('dag')}>
            <option value={1}>{txt('Dag')} 1</option>
            <option value={2}>{txt('Dag')} 2</option>
          </select>
        </label>
      </div>
      <div className="veld">
        <span>{txt('Kleur')}</span>
        <div className="kleuren">
          {KLEUREN.map(([k, l, hex]) => (
            <button type="button" key={k} className={`kleur${f.kleur === k ? ' gekozen' : ''}`} style={{ background: hex }} aria-label={l} title={l} onClick={() => setF({ ...f, kleur: k })} />
          ))}
          <input type="color" value={f.kleur.startsWith('#') ? f.kleur : '#2f56d9'} onChange={(e) => setF({ ...f, kleur: e.target.value })} aria-label={txt('Eigen kleur')} />
        </div>
      </div>
      <div className="rij">
        <label className="veld grow">
          <span>{txt('Begin')}</span>
          <input type="time" value={f.start} onChange={zet('start')} required />
        </label>
        <label className="veld grow">
          <span>{txt('Einde')}</span>
          <input type="time" value={f.eind} onChange={zet('eind')} required />
        </label>
      </div>
      <EmojiKiezer label={txt('Emoji')} waarde={f.emoji} onKies={(emoji) => setF({ ...f, emoji })} auto />
      <label className="veld">
        <span>{txt('Locatie')}</span>
        <input value={f.locatie} onChange={zet('locatie')} maxLength={80} />
      </label>
      <label className="veld">
        <span>{txt('Omschrijving')}</span>
        <textarea value={f.omschrijving} onChange={zet('omschrijving')} maxLength={500} rows={3} />
      </label>

      {!zonderDeelnemers && (
        <fieldset className="veld">
          <legend>
            {txt('Deelnemers')} ({f.leerlingen.length})
          </legend>
          <div className="rij">
            <button type="button" className="btn ghost klein" onClick={() => setF({ ...f, leerlingen: leerlingen.map((l) => l.id) })}>
              {txt('Iedereen')}
            </button>
            <button type="button" className="btn ghost klein" onClick={() => setF({ ...f, leerlingen: [] })}>
              {txt('Niemand')}
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
          <strong>⚠️ {txt('Let op, overlappende activiteiten:')}</strong>
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
        {txt('Opslaan')}
      </button>
      <button type="button" className="btn ghost" onClick={onAnnuleer}>
        {txt('Annuleren')}
      </button>
    </form>
  )
}
