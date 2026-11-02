import { useState } from 'react'
import { rpc } from './api.js'
import { afbeeldingUrl } from './config.js'
import { useData } from './data.jsx'
import { nl } from './strings.js'
import { uploadKlasAfbeelding, verwijderKlasAfbeelding } from './upload.js'
import BerichtKaart from './BerichtKaart.jsx'

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
      setFout(nl.fouten[err.code] || (err.message === 'anoniem_uit' ? nl.anoniemUit : nl.uploadFout))
    }
    setBezig(false)
  }

  async function verwijder(b) {
    if (!window.confirm(nl.zekerBericht)) return
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
        <h3>{f.id ? nl.bewerken : nl.nieuwBericht}</h3>
        <label className="veld">
          <span>{nl.titel}</span>
          <input value={f.titel} onChange={(e) => setF({ ...f, titel: e.target.value })} maxLength={80} required />
        </label>
        <label className="veld">
          <span>{nl.tekst}</span>
          <textarea value={f.tekst} onChange={(e) => setF({ ...f, tekst: e.target.value })} rows={4} maxLength={2000} />
          <small className="note">{nl.berichtLinks}</small>
        </label>
        <label className="veld">
          <span>{nl.afbeelding}</span>
          <input type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => setBestand(e.target.files?.[0] || null)} />
        </label>
        {f.afbeelding_pad && !bestand && (
          <div className="rij">
            <img className="qr-klein" src={afbeeldingUrl(f.afbeelding_pad)} alt="" />
            <button type="button" className="btn danger klein" onClick={() => setF({ ...f, afbeelding_pad: '' })}>
              {nl.afbeeldingWeg}
            </button>
          </div>
        )}
        <label className="vink">
          <input type="checkbox" checked={f.gepubliceerd} onChange={(e) => setF({ ...f, gepubliceerd: e.target.checked })} />
          <span>{nl.gepubliceerd}</span>
        </label>
        {fout && <p className="fout">{fout}</p>}
        <button className="btn" disabled={bezig || !f.titel.trim()}>
          {nl.plaatsen}
        </button>
        {f.id && (
          <button type="button" className="btn ghost" onClick={() => { setF(LEEG); setBestand(null) }}>
            {nl.annuleren}
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
                    {nl.bewerken}
                  </button>
                  <button className="btn ghost klein" onClick={() => wisselZichtbaar(b)}>
                    {b.gepubliceerd ? nl.verberg : nl.publiceer}
                  </button>
                  <button className="btn danger klein" onClick={() => verwijder(b)}>
                    {nl.verwijderen}
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
