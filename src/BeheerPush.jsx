import { useState } from 'react'
import { pushVersturen } from './api.js'
import { useData } from './data.jsx'
import { txt } from './t.js'

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
      setResultaat(`${txt('Verstuurd naar')} ${r.verstuurd} ${txt('apparaten')}`)
      setTitel('')
      setTekst('')
    } catch {
      setFout(txt('Er ging iets mis. Controleer je verbinding en probeer het opnieuw.'))
    }
    setBezig(false)
  }

  return (
    <form className="card stack" onSubmit={verstuur}>
      <h3>{txt('Melding sturen')}</h3>
      <p className="note">{txt('Stuur een pushmelding naar je hele klas of naar één leerling (alleen apparaten met meldingen aan).')}</p>
      <label className="veld">
        <span>{txt('Aan')}</span>
        <select value={doel} onChange={(e) => setDoel(e.target.value)}>
          <option value="klas">{txt('Mijn hele klas')}</option>
          <option value="leerling">{txt('Eén leerling')}</option>
        </select>
      </label>
      {doel === 'leerling' && (
        <select value={leerling} onChange={(e) => setLeerling(e.target.value)} required aria-label={txt('Kies een leerling')}>
          <option value="">{txt('Kies een leerling')}</option>
          {data.leerlingen.map((l) => (
            <option key={l.id} value={l.id}>
              {l.naam}
              {l.meldingen ? ' 🔔' : ''}
            </option>
          ))}
        </select>
      )}
      <label className="veld">
        <span>{txt('Titel')}</span>
        <input value={titel} onChange={(e) => setTitel(e.target.value)} maxLength={80} required />
      </label>
      <label className="veld">
        <span>{txt('Tekst')}</span>
        <textarea value={tekst} onChange={(e) => setTekst(e.target.value)} rows={3} maxLength={300} />
      </label>
      {fout && <p className="fout">{fout}</p>}
      {resultaat && <p className="ok">✓ {resultaat}</p>}
      <button className="btn" disabled={bezig || !titel.trim()}>
        {txt('Verzenden')}
      </button>
    </form>
  )
}
