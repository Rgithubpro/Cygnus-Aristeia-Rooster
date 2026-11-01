import { useState } from 'react'
import { rpc } from './api.js'
import { useData } from './data.jsx'
import { nl } from './strings.js'
import BerichtKaart from './BerichtKaart.jsx'

const LEEG = { id: null, titel: '', tekst: '', gepubliceerd: true }

export default function BeheerInfo({ sessie }) {
  const { data, ververs } = useData()
  const [f, setF] = useState(LEEG)
  const [fout, setFout] = useState('')

  async function bewaar(e) {
    e.preventDefault()
    setFout('')
    try {
      await rpc('bericht_opslaan', { p_token: sessie.token, p_id: f.id, p_titel: f.titel, p_tekst: f.tekst, p_gepubliceerd: f.gepubliceerd })
      setF(LEEG)
      ververs()
    } catch (err) {
      setFout(nl.fouten[err.code] || nl.laadFout)
    }
  }

  async function verwijder(b) {
    if (!window.confirm(nl.zekerBericht)) return
    await rpc('bericht_verwijderen', { p_token: sessie.token, p_id: b.id })
    ververs()
  }

  async function wisselZichtbaar(b) {
    await rpc('bericht_opslaan', { p_token: sessie.token, p_id: b.id, p_titel: b.titel, p_tekst: b.tekst, p_gepubliceerd: !b.gepubliceerd })
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
        <label className="vink">
          <input type="checkbox" checked={f.gepubliceerd} onChange={(e) => setF({ ...f, gepubliceerd: e.target.checked })} />
          <span>{nl.gepubliceerd}</span>
        </label>
        {fout && <p className="fout">{fout}</p>}
        <button className="btn" disabled={!f.titel.trim()}>
          {nl.plaatsen}
        </button>
        {f.id && (
          <button type="button" className="btn ghost" onClick={() => setF(LEEG)}>
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
                  <button className="btn ghost klein" onClick={() => setF({ id: b.id, titel: b.titel, tekst: b.tekst, gepubliceerd: b.gepubliceerd })}>
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
