import { useEffect, useState } from 'react'
import BestandsKnop from '../BestandsKnop.jsx'
import { rootRpc, uploadAfbeelding, verwijderAfbeelding } from './client.js'
import { afbeeldingUrl } from '../config.js'
import BerichtKaart from '../BerichtKaart.jsx'

const LEEG = { id: null, klas_id: '', titel: '', tekst: '', afbeelding_pad: '', gepubliceerd: true }

// Articles and announcements. "Iedereen" = every class, or pick one class. Images are uploaded here (Root only).
export default function RootInfo({ overzicht }) {
  const [lijst, setLijst] = useState(null)
  const [f, setF] = useState(LEEG)
  const [bestand, setBestand] = useState(null)
  const [fout, setFout] = useState('')
  const [bezig, setBezig] = useState(false)
  const laad = () => rootRpc('root_berichten_lijst').then(setLijst)
  useEffect(() => {
    laad()
  }, [])

  async function bewaar(e) {
    e.preventDefault()
    setBezig(true)
    setFout('')
    try {
      let pad = f.afbeelding_pad
      if (bestand) {
        const nieuw = await uploadAfbeelding(bestand)
        if (pad) verwijderAfbeelding(pad)
        pad = nieuw
      }
      await rootRpc('root_bericht_opslaan', {
        p_id: f.id, p_klas: f.klas_id || null, p_titel: f.titel, p_tekst: f.tekst, p_pad: pad, p_gepubliceerd: f.gepubliceerd,
      })
      setF(LEEG)
      setBestand(null)
      laad()
    } catch (err) {
      setFout(err.message || 'Er ging iets mis.')
    }
    setBezig(false)
  }

  async function verwijder(b) {
    if (!window.confirm('Dit bericht verwijderen?')) return
    const r = await rootRpc('root_bericht_verwijderen', { p_id: b.id })
    if (r.afbeelding_pad) verwijderAfbeelding(r.afbeelding_pad)
    laad()
  }

  return (
    <div className="stack">
      <form className="card stack" onSubmit={bewaar}>
        <h2>{f.id ? 'Bericht bewerken' : 'Nieuw bericht'}</h2>
        <label className="veld">
          <span>Voor</span>
          <select value={f.klas_id} onChange={(e) => setF({ ...f, klas_id: e.target.value })}>
            <option value="">Alle klassen</option>
            {overzicht.klassen.map((k) => (
              <option key={k.id} value={k.id}>{k.naam}</option>
            ))}
          </select>
        </label>
        <label className="veld">
          <span>Titel</span>
          <input value={f.titel} onChange={(e) => setF({ ...f, titel: e.target.value })} maxLength={80} required />
        </label>
        <label className="veld">
          <span>Tekst</span>
          <textarea value={f.tekst} onChange={(e) => setF({ ...f, tekst: e.target.value })} rows={5} maxLength={2000} />
          <small className="note">Links worden herkend. HTML en embed-code worden niet ondersteund.</small>
        </label>
        <label className="veld">
          <span>Afbeelding (wordt verkleind tot max 1600 px)</span>
          <BestandsKnop onBestand={setBestand} bestand={bestand} />
        </label>
        {f.afbeelding_pad && !bestand && (
          <div className="rij">
            <img className="qr-klein" src={afbeeldingUrl(f.afbeelding_pad)} alt="" />
            <button type="button" className="btn danger klein" onClick={() => setF({ ...f, afbeelding_pad: '' })}>Afbeelding weghalen</button>
          </div>
        )}
        <label className="vink">
          <input type="checkbox" checked={f.gepubliceerd} onChange={(e) => setF({ ...f, gepubliceerd: e.target.checked })} />
          <span>Direct publiceren (anders concept)</span>
        </label>
        {fout && <p className="fout">{fout}</p>}
        <button className="btn" disabled={bezig || !f.titel.trim()}>Opslaan</button>
        {f.id && <button type="button" className="btn ghost" onClick={() => { setF(LEEG); setBestand(null) }}>Annuleren</button>}
      </form>

      <ul className="stack lijst-los">
        {(lijst || []).map((b) => (
          <BerichtKaart
            key={b.id}
            b={{ ...b, globaal: !b.klas_id }}
            acties={
              <div className="rij">
                <span className="meta">{b.klas || 'Alle klassen'}</span>
                <button className="btn ghost klein" onClick={() => { setF({ ...b, klas_id: b.klas_id || '', afbeelding_pad: b.afbeelding_pad || '' }); setBestand(null); window.scrollTo(0, 0) }}>Bewerken</button>
                <button className="btn danger klein" onClick={() => verwijder(b)}>Verwijderen</button>
              </div>
            }
          />
        ))}
      </ul>
    </div>
  )
}
