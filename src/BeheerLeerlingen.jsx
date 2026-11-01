import { useState } from 'react'
import { rpc } from './api.js'
import { useData } from './data.jsx'
import { nl } from './strings.js'

export default function BeheerLeerlingen({ sessie }) {
  const { data, ververs } = useData()
  const [namen, setNamen] = useState('')
  const [fout, setFout] = useState('')

  async function voegToe(e) {
    e.preventDefault()
    setFout('')
    try {
      await rpc('leerlingen_toevoegen', { p_token: sessie.token, p_namen: namen })
      setNamen('')
      ververs()
    } catch (err) {
      setFout(nl.fouten[err.code] || nl.laadFout)
    }
  }

  const aantal = data.leerlingen.length
  const gekoppeld = data.leerlingen.filter((l) => l.gekoppeld).length
  const meldingen = data.leerlingen.filter((l) => l.meldingen).length

  return (
    <div className="stack">
      <form className="card stack" onSubmit={voegToe}>
        <label className="veld">
          <span>{nl.namenToevoegen}</span>
          <textarea value={namen} onChange={(e) => setNamen(e.target.value)} rows={5} />
          <small className="note">{nl.namenUitleg}</small>
        </label>
        {fout && <p className="fout">{fout}</p>}
        <button className="btn" disabled={!namen.trim()}>
          {nl.toevoegen}
        </button>
      </form>

      <p className="note">
        {gekoppeld} van {aantal} {nl.gekoppeldVan}, {meldingen} {nl.meldingenAanVan}
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
    if (!window.confirm(`${l.naam} ${nl.zekerLeerling}`)) return
    await rpc('leerling_verwijderen', { p_token: sessie.token, p_id: l.id })
    ververs()
  }

  return (
    <li className="card stack klein-gap">
      <div className="rij tussen">
        <span>
          <strong>{l.naam}</strong>{' '}
          <span title={nl.gekoppeld}>{l.gekoppeld ? '✓' : '·'}</span>{' '}
          <span title={nl.metMeldingen}>{l.meldingen ? '🔔' : ''}</span>
        </span>
        <span className="rij">
          <button className="btn ghost klein" onClick={() => setOpen(!open)}>
            🎭
          </button>
          <button className="btn danger klein" onClick={verwijder}>
            {nl.verwijderen}
          </button>
        </span>
      </div>
      {l.rol_info && !open && <span className="meta">🎭 {l.rol_info}</span>}
      {open && (
        <div className="stack">
          <label className="veld">
            <span>{nl.rolInfo}</span>
            <textarea value={info} onChange={(e) => setInfo(e.target.value)} rows={2} maxLength={300} />
            <small className="note">{nl.rolInfoUitleg}</small>
          </label>
          <button className="btn" disabled={bezig} onClick={bewaar}>
            {nl.opslaan}
          </button>
        </div>
      )}
    </li>
  )
}
