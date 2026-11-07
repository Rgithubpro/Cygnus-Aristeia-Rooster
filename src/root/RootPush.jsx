import { useEffect, useState } from 'react'
import BestandsKnop from '../BestandsKnop.jsx'
import { pushVersturen } from '../api.js'
import { afbeeldingUrl } from '../config.js'
import { rootRpc, rootToken, uploadAfbeelding } from './client.js'

export default function RootPush({ overzicht }) {
  const [doel, setDoel] = useState('iedereen')
  const [klas, setKlas] = useState('')
  const [leerlingen, setLeerlingen] = useState([])
  const [leerling, setLeerling] = useState('')
  const [titel, setTitel] = useState('')
  const [tekst, setTekst] = useState('')
  const [bestand, setBestand] = useState(null)
  const [fout, setFout] = useState('')
  const [resultaat, setResultaat] = useState('')
  const [bezig, setBezig] = useState(false)

  useEffect(() => {
    setLeerling('')
    if (doel === 'leerling' && klas) rootRpc('root_klas_detail', { p_id: klas }).then((d) => setLeerlingen(d.leerlingen))
    else setLeerlingen([])
  }, [doel, klas])

  async function verstuur(e) {
    e.preventDefault()
    setBezig(true)
    setFout('')
    setResultaat('')
    try {
      const afbeelding = bestand ? afbeeldingUrl(await uploadAfbeelding(bestand)) : undefined
      const r = await pushVersturen(
        { doelgroep: doel, klas_id: klas || undefined, leerling_id: leerling || undefined, titel, tekst, afbeelding },
        await rootToken(),
      )
      setResultaat(`Verstuurd naar ${r.verstuurd} van ${r.apparaten} apparaten.`)
      setTitel('')
      setTekst('')
      setBestand(null)
    } catch (err) {
      setFout(`Versturen mislukt (${err.message}).`)
    }
    setBezig(false)
  }

  const totaalMeldingen = overzicht.klassen.reduce((s, k) => s + k.meldingen, 0)

  return (
    <form className="card stack" onSubmit={verstuur}>
      <h2>Melding sturen</h2>
      <p className="note">{totaalMeldingen} leerlingen hebben meldingen aan. Wie ze niet aan heeft, ziet het bericht niet als melding, dus plaats belangrijke dingen ook onder Info.</p>
      <label className="veld">
        <span>Aan</span>
        <select value={doel} onChange={(e) => setDoel(e.target.value)}>
          <option value="iedereen">Iedereen</option>
          <option value="klas">Eén klas</option>
          <option value="leerling">Eén leerling</option>
        </select>
      </label>
      {doel !== 'iedereen' && (
        <select value={klas} onChange={(e) => setKlas(e.target.value)} required aria-label="Klas">
          <option value="">Kies een klas</option>
          {overzicht.klassen.map((k) => <option key={k.id} value={k.id}>{k.naam}</option>)}
        </select>
      )}
      {doel === 'leerling' && (
        <select value={leerling} onChange={(e) => setLeerling(e.target.value)} required aria-label="Leerling">
          <option value="">Kies een leerling</option>
          {leerlingen.map((l) => <option key={l.id} value={l.id}>{l.naam}</option>)}
        </select>
      )}
      <label className="veld">
        <span>Titel</span>
        <input value={titel} onChange={(e) => setTitel(e.target.value)} maxLength={80} required />
      </label>
      <label className="veld">
        <span>Tekst</span>
        <textarea value={tekst} onChange={(e) => setTekst(e.target.value)} rows={3} maxLength={300} />
      </label>
      <label className="veld">
        <span>Afbeelding (optioneel)</span>
        <BestandsKnop onBestand={setBestand} bestand={bestand} />
      </label>
      {fout && <p className="fout">{fout}</p>}
      {resultaat && <p className="ok">✓ {resultaat}</p>}
      <button className="btn" disabled={bezig || !titel.trim()}>Verzenden</button>
    </form>
  )
}
