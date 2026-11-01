import { useState } from 'react'
import { pushVersturen } from './api.js'
import { useData } from './data.jsx'
import { nl } from './strings.js'

export default function BeheerPush({ sessie }) {
  const { data } = useData()
  const [doel, setDoel] = useState('klas')
  const [leerling, setLeerling] = useState('')
  const [titel, setTitel] = useState('')
  const [tekst, setTekst] = useState('')
  const [fout, setFout] = useState('')
  const [resultaat, setResultaat] = useState('')
  const [bezig, setBezig] = useState(false)

  async function verstuur(e) {
    e.preventDefault()
    setBezig(true)
    setFout('')
    setResultaat('')
    try {
      const r = await pushVersturen({ token: sessie.token, doelgroep: doel, leerling_id: doel === 'leerling' ? leerling : undefined, titel, tekst })
      setResultaat(`${nl.pushVerstuurd} ${r.verstuurd} ${nl.pushApparaten}`)
      setTitel('')
      setTekst('')
    } catch {
      setFout(nl.laadFout)
    }
    setBezig(false)
  }

  return (
    <form className="card stack" onSubmit={verstuur}>
      <h3>{nl.pushTitel}</h3>
      <p className="note">{nl.pushUitleg}</p>
      <label className="veld">
        <span>{nl.pushDoel}</span>
        <select value={doel} onChange={(e) => setDoel(e.target.value)}>
          <option value="klas">{nl.pushKlas}</option>
          <option value="leerling">{nl.pushLeerling}</option>
        </select>
      </label>
      {doel === 'leerling' && (
        <select value={leerling} onChange={(e) => setLeerling(e.target.value)} required aria-label={nl.pushKies}>
          <option value="">{nl.pushKies}</option>
          {data.leerlingen.map((l) => (
            <option key={l.id} value={l.id}>
              {l.naam}
              {l.meldingen ? ' 🔔' : ''}
            </option>
          ))}
        </select>
      )}
      <label className="veld">
        <span>{nl.titel}</span>
        <input value={titel} onChange={(e) => setTitel(e.target.value)} maxLength={80} required />
      </label>
      <label className="veld">
        <span>{nl.tekst}</span>
        <textarea value={tekst} onChange={(e) => setTekst(e.target.value)} rows={3} maxLength={300} />
      </label>
      {fout && <p className="fout">{fout}</p>}
      {resultaat && <p className="ok">✓ {resultaat}</p>}
      <button className="btn" disabled={bezig || !titel.trim()}>
        {nl.pushVersturen}
      </button>
    </form>
  )
}
