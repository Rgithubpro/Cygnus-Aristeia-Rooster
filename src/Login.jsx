import { useEffect, useState } from 'react'
import { rpc } from './api.js'
import Banner from './Banner.jsx'
import Kop from './Kop.jsx'
import { useAppIdentiteit } from './pwaIdentiteit.js'
import { foutTekst, txt } from './t.js'

// /k/<slug> (from the class QR code or link) pre-selects the class. The login screen always uses the default look:
// the class look only appears after logging in.
const slugUitLink = () => (location.pathname.match(/^\/k\/([a-z0-9-]+)/i)?.[1] || '').toLowerCase()

export default function LoginScherm({ onKlaar, offline }) {
  const [info, setInfo] = useState(null)
  const [slug, setSlug] = useState(slugUitLink())
  const [wachtwoord, setWachtwoord] = useState('')
  const [fout, setFout] = useState('')
  const [bezig, setBezig] = useState(false)

  useEffect(() => {
    rpc('start_info').then(setInfo).catch(() => setFout(txt('Er ging iets mis. Controleer je verbinding en probeer het opnieuw.')))
  }, [])

  const klas = info?.klassen.find((k) => k.slug === slug)
  useAppIdentiteit(klas ? klas.naam : null, klas?.slug, { icoon: klas?.icoon })

  async function verstuur(e) {
    e.preventDefault()
    setBezig(true)
    setFout('')
    try {
      const r = await rpc('inloggen', { p_slug: slug, p_wachtwoord: wachtwoord })
      if (r.fout) setFout(foutTekst(r.fout) || txt('Er ging iets mis. Controleer je verbinding en probeer het opnieuw.'))
      else onKlaar({ token: r.token, rol: r.rol, klas: { ...r.klas, slug }, leerlingId: null, naamOvergeslagen: false })
    } catch {
      setFout(txt('Er ging iets mis. Controleer je verbinding en probeer het opnieuw.'))
    } finally {
      setBezig(false)
    }
  }

  return (
    <main className="page">
      <Kop />
      {offline}
      <Banner banner={info?.banner} />
      <form className="card stack" onSubmit={verstuur}>
        <h2>{txt('Inloggen')}</h2>
        <label className="veld">
          <span>{txt('Klas')}</span>
          <select value={slug} onChange={(e) => setSlug(e.target.value)} required>
            <option value="">{txt('Kies je klas')}</option>
            {(info?.klassen || []).map((k) => (
              <option key={k.slug} value={k.slug}>{k.naam}</option>
            ))}
          </select>
        </label>
        <label className="veld">
          <span>{txt('Wachtwoord')}</span>
          <input type="password" value={wachtwoord} onChange={(e) => setWachtwoord(e.target.value)} autoComplete="current-password" required />
        </label>
        {fout && <p className="fout" role="alert">{fout}</p>}
        <button className="btn" disabled={bezig || !slug || !wachtwoord}>{txt('Inloggen')}</button>
      </form>
      <p className="note">{txt('Tip: log eerst in en installeer de app daarna. Dan krijgt hij het icoon van je klas.')}</p>
    </main>
  )
}
