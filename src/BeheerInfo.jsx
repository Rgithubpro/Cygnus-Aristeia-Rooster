import { useState } from 'react'
import { rpc } from './api.js'
import BestandsKnop from './BestandsKnop.jsx'
import { afbeeldingUrl } from './config.js'
import { useData } from './data.jsx'
import { uploadKlasAfbeelding, verwijderKlasAfbeelding } from './upload.js'
import BerichtKaart from './BerichtKaart.jsx'
import { foutTekst, txt } from './t.js'

const LEEG = { id: null, titel: '', tekst: '', afbeelding_pad: '', gepubliceerd: true }

export default function BeheerInfo({ sessie }) {
  const { data, ververs } = useData()
  const [f, setF] = useState(LEEG)
  const [bestand, setBestand] = useState(null)
  const [fout, setFout] = useState('')
  const [bezig, setBezig] = useState(false)

  async function bewaar(e) {
    e.preventDefault()
    setBezig(true)
    setFout('')
    try {
      let pad = f.afbeelding_pad
      if (bestand) pad = await uploadKlasAfbeelding(sessie, bestand)
      await rpc('bericht_opslaan', {
        p_token: sessie.token, p_id: f.id, p_titel: f.titel, p_tekst: f.tekst, p_pad: pad || null, p_gepubliceerd: f.gepubliceerd,
      })
      const oud = f.id ? data.berichten.find((b) => b.id === f.id)?.afbeelding_pad : null
      if (oud && oud !== pad) verwijderKlasAfbeelding(sessie, oud).catch(() => {})
      setF(LEEG)
      setBestand(null)
      ververs()
    } catch (err) {
      setFout(foutTekst(err.code) || (err.message === 'anoniem_uit' ? txt('Uploaden staat nog niet aan. Vraag de organisatie om anonieme logins aan te zetten.') : txt('Uploaden is niet gelukt. Probeer het opnieuw met een kleinere foto.')))
    }
    setBezig(false)
  }

  async function verwijder(b) {
    if (!window.confirm(txt('Dit bericht verwijderen?'))) return
    const r = await rpc('bericht_verwijderen', { p_token: sessie.token, p_id: b.id })
    if (r?.afbeelding_pad) verwijderKlasAfbeelding(sessie, r.afbeelding_pad).catch(() => {})
    ververs()
  }

  async function wisselZichtbaar(b) {
    await rpc('bericht_opslaan', {
      p_token: sessie.token, p_id: b.id, p_titel: b.titel, p_tekst: b.tekst, p_pad: b.afbeelding_pad || null, p_gepubliceerd: !b.gepubliceerd,
    })
    ververs()
  }

  return (
    <div className="stack">
      <form className="card stack" onSubmit={bewaar}>
        <h3>{f.id ? txt('Bewerken') : txt('Nieuw bericht voor je klas')}</h3>
        <label className="veld">
          <span>{txt('Titel')}</span>
          <input value={f.titel} onChange={(e) => setF({ ...f, titel: e.target.value })} maxLength={80} required />
        </label>
        <label className="veld">
          <span>{txt('Tekst')}</span>
          <textarea value={f.tekst} onChange={(e) => setF({ ...f, tekst: e.target.value })} rows={4} maxLength={2000} />
          <small className="note">{txt('Links worden automatisch herkend. Embed-code en HTML worden niet ondersteund.')}</small>
        </label>
        <label className="veld">
          <span>{txt('Afbeelding (optioneel)')}</span>
          <BestandsKnop onBestand={setBestand} bestand={bestand} />
        </label>
        {f.afbeelding_pad && !bestand && (
          <div className="rij">
            <img className="qr-klein" src={afbeeldingUrl(f.afbeelding_pad)} alt="" />
            <button type="button" className="btn danger klein" onClick={() => setF({ ...f, afbeelding_pad: '' })}>
              {txt('Afbeelding weghalen')}
            </button>
          </div>
        )}
        <label className="vink">
          <input type="checkbox" checked={f.gepubliceerd} onChange={(e) => setF({ ...f, gepubliceerd: e.target.checked })} />
          <span>{txt('Direct publiceren (anders opgeslagen als concept)')}</span>
        </label>
        {fout && <p className="fout">{fout}</p>}
        <button className="btn" disabled={bezig || !f.titel.trim()}>
          {txt('Plaatsen')}
        </button>
        {f.id && (
          <button type="button" className="btn ghost" onClick={() => { setF(LEEG); setBestand(null) }}>
            {txt('Annuleren')}
          </button>
        )}
      </form>
      <ul className="stack lijst-los">
        {data.berichten.map((b) => (
          <BerichtKaart
            key={b.id}
            b={b}
            acties={
              !b.globaal && (
                <div className="rij">
                  <button
                    className="btn ghost klein"
                    onClick={() => { setF({ id: b.id, titel: b.titel, tekst: b.tekst, afbeelding_pad: b.afbeelding_pad || '', gepubliceerd: b.gepubliceerd }); setBestand(null) }}
                  >
                    {txt('Bewerken')}
                  </button>
                  <button className="btn ghost klein" onClick={() => wisselZichtbaar(b)}>
                    {b.gepubliceerd ? txt('Verbergen') : txt('Publiceren')}
                  </button>
                  <button className="btn danger klein" onClick={() => verwijder(b)}>
                    {txt('Verwijderen')}
                  </button>
                </div>
              )
            }
          />
        ))}
      </ul>
    </div>
  )
}
