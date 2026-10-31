import { useEffect, useState } from 'react'
import { rpc } from './api.js'
import { nl } from './strings.js'

// /k/<slug> (from the class QR code or link) pre-selects the class.
const slugUitLink = () => (location.pathname.match(/^\/k\/([a-z0-9-]+)/i)?.[1] || '').toLowerCase()

export default function Login({ onKlaar }) {
  const [klassen, setKlassen] = useState([])
  const [slug, setSlug] = useState(slugUitLink())
  const [wachtwoord, setWachtwoord] = useState('')
  const [fout, setFout] = useState('')
  const [bezig, setBezig] = useState(false)

  useEffect(() => {
    rpc('klassen_lijst').then(setKlassen).catch(() => setFout(nl.laadFout))
  }, [])

  async function verstuur(e) {
    e.preventDefault()
    setBezig(true)
    setFout('')
    try {
      const r = await rpc('inloggen', { p_slug: slug, p_wachtwoord: wachtwoord })
      if (r.fout) {
        setFout(nl.inlogFouten[r.fout] || nl.laadFout)
      } else {
        onKlaar({ token: r.token, rol: r.rol, klas: r.klas, leerlingId: null, naamOvergeslagen: false })
      }
    } catch {
      setFout(nl.laadFout)
    } finally {
      setBezig(false)
    }
  }

  return (
    <form className="card stack" onSubmit={verstuur}>
      <h2>{nl.loginTitel}</h2>
      <label className="veld">
        <span>{nl.klas}</span>
        <select value={slug} onChange={(e) => setSlug(e.target.value)} required>
          <option value="">{nl.kiesKlas}</option>
          {klassen.map((k) => (
            <option key={k.slug} value={k.slug}>
              {k.naam}
            </option>
          ))}
        </select>
      </label>
      <label className="veld">
        <span>{nl.wachtwoord}</span>
        <input
          type="password"
          value={wachtwoord}
          onChange={(e) => setWachtwoord(e.target.value)}
          autoComplete="current-password"
          required
        />
      </label>
      {fout && (
        <p className="fout" role="alert">
          {fout}
        </p>
      )}
      <button className="btn" disabled={bezig || !slug || !wachtwoord}>
        {nl.inloggen}
      </button>
    </form>
  )
}
