import { useState } from 'react'
import { rpc } from './api.js'
import { useData } from './data.jsx'
import { foutTekst, txt } from './t.js'

export default function BeheerLeerlingen({ sessie }) {
  const { data, ververs } = useData()
  const [namen, setNamen] = useState('')
  const [fout, setFout] = useState('')
  const [info, setInfo] = useState('')

  async function voegToe(e) {
    e.preventDefault()
    setFout('')
    try {
      const r = await rpc('leerlingen_toevoegen', { p_token: sessie.token, p_namen: namen })
      setInfo(r ? `${r.toegevoegd} ${txt('toegevoegd')}${r.overgeslagen ? `, ${r.overgeslagen} ${txt('overgeslagen (stonden er al)')}` : ''}` : '')
      setNamen('')
      ververs()
    } catch (err) {
      setFout(foutTekst(err.code) || txt('Er ging iets mis. Controleer je verbinding en probeer het opnieuw.'))
    }
  }

  const aantal = data.leerlingen.length
  const gekoppeld = data.leerlingen.filter((l) => l.gekoppeld).length
  const meldingen = data.leerlingen.filter((l) => l.meldingen).length

  return (
    <div className="stack">
      <form className="card stack" onSubmit={voegToe}>
        <label className="veld">
          <span>{txt('Namen toevoegen')}</span>
          <textarea value={namen} onChange={(e) => setNamen(e.target.value)} rows={5} />
          <small className="note">{txt('Eén naam per regel. Je kunt een lijst uit Excel plakken.')}</small>
        </label>
        {fout && <p className="fout">{fout}</p>}
        {info && <p className="ok">✓ {info}</p>}
        <button className="btn" disabled={!namen.trim()}>
          {txt('Toevoegen')}
        </button>
      </form>

      <p className="note">
        {gekoppeld} {txt('van')} {aantal} {txt('gekoppeld')}, {meldingen} {txt('met meldingen')}
      </p>
      <ul className="stack lijst-los">
        {data.leerlingen.map((l) => (
          <Rij key={l.id} l={l} sessie={sessie} ververs={ververs} />
        ))}
      </ul>
    </div>
  )
}

function Rij({ l, sessie, ververs }) {
  const [open, setOpen] = useState(false)
  const [info, setInfo] = useState(l.rol_info || '')
  const [bezig, setBezig] = useState(false)

  async function bewaar() {
    setBezig(true)
    await rpc('leerling_info_zetten', { p_token: sessie.token, p_id: l.id, p_info: info })
    await ververs()
    setBezig(false)
    setOpen(false)
  }

  async function verwijder() {
    if (!window.confirm(`${l.naam} ${txt('verwijderen? De leerling verdwijnt ook uit alle activiteiten.')}`)) return
    await rpc('leerling_verwijderen', { p_token: sessie.token, p_id: l.id })
    ververs()
  }

  return (
    <li className="card stack klein-gap">
      <div className="rij tussen">
        <span>
          <strong>{l.naam}</strong>{' '}
          <span title={txt('Op een apparaat gekoppeld')}>{l.gekoppeld ? '✓' : '·'}</span>{' '}
          <span title={txt('Meldingen aan')}>{l.meldingen ? '🔔' : ''}</span>
        </span>
        <span className="rij">
          <button className="btn ghost klein" onClick={() => setOpen(!open)}>
            🎭
          </button>
          <button className="btn danger klein" onClick={verwijder}>
            {txt('Verwijderen')}
          </button>
        </span>
      </div>
      {l.rol_info && !open && <span className="meta">🎭 {l.rol_info}</span>}
      {open && (
        <div className="stack">
          <label className="veld">
            <span>{txt('Persoonlijke info')}</span>
            <textarea value={info} onChange={(e) => setInfo(e.target.value)} rows={2} maxLength={300} />
            <small className="note">{txt('Wordt alleen aan deze leerling getoond, bijvoorbeeld een rol of opdracht.')}</small>
          </label>
          <button className="btn" disabled={bezig} onClick={bewaar}>
            {txt('Opslaan')}
          </button>
        </div>
      )}
    </li>
  )
}
