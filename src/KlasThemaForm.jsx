import { useEffect, useMemo, useState } from 'react'
import { afbeeldingUrl } from './config.js'
import { nl } from './strings.js'
import { PRESET_KLEUREN, themaStijl } from './theme.js'
import EmojiKiezer from './EmojiKiezer.jsx'

// Used by class admins (Beheer -> Uiterlijk) and by Root. Everything is stored in klassen.thema (JSON), so new
// options can be added later without a new table.
export default function KlasThemaForm({ klas, opslaan, upload, verwijder }) {
  const [naam, setNaam] = useState(klas.weergavenaam || '')
  const [t, setT] = useState({
    accent: klas.thema?.accent || '',
    emoji: klas.thema?.emoji || '',
    slogan: klas.thema?.slogan || '',
    logo: klas.thema?.logo || '',
  })
  const [bestand, setBestand] = useState(null)
  const [fout, setFout] = useState('')
  const [ok, setOk] = useState(false)
  const [bezig, setBezig] = useState(false)

  const voorbeeldUrl = useMemo(() => (bestand ? URL.createObjectURL(bestand) : null), [bestand])
  useEffect(() => () => voorbeeldUrl && URL.revokeObjectURL(voorbeeldUrl), [voorbeeldUrl])

  const logoSrc = voorbeeldUrl || (t.logo ? afbeeldingUrl(t.logo) : null)

  async function bewaar(e) {
    e.preventDefault()
    setBezig(true)
    setFout('')
    setOk(false)
    try {
      let logo = t.logo
      if (bestand) logo = await upload(bestand)
      await opslaan(naam, { ...t, logo })
      const oud = klas.thema?.logo
      if (oud && oud !== logo) verwijder(oud).catch(() => {})
      setT({ ...t, logo })
      setBestand(null)
      setOk(true)
    } catch (err) {
      setFout(err.message === 'anoniem_uit' ? nl.anoniemUit : nl.uploadFout)
    }
    setBezig(false)
  }

  return (
    <form className="card stack" onSubmit={bewaar}>
      <div className="head thema voorbeeld" style={themaStijl({ accent: t.accent })} aria-label={nl.voorbeeld}>
        {logoSrc ? <img className="klas-logo" src={logoSrc} alt="" /> : t.emoji ? <span className="klas-emoji">{t.emoji}</span> : <span className="klas-emoji">🏅</span>}
        <div className="grow">
          <h2>{naam || klas.naam}</h2>
          <p className="tagline">{t.slogan || nl.title}</p>
        </div>
        <span className="btn klein">{nl.voorbeeld}</span>
      </div>

      <label className="veld">
        <span>{nl.weergavenaam}</span>
        <input value={naam} onChange={(e) => setNaam(e.target.value)} maxLength={40} placeholder={klas.naam} />
        <small className="note">{nl.weergavenaamUitleg}</small>
      </label>
      <label className="veld">
        <span>{nl.slogan}</span>
        <input value={t.slogan} onChange={(e) => setT({ ...t, slogan: e.target.value })} maxLength={60} />
      </label>

      <EmojiKiezer label={nl.klasEmoji} waarde={t.emoji} onKies={(emoji) => setT({ ...t, emoji })} auto />

      <div className="veld">
        <span>{nl.accentkleur}</span>
        <div className="kleuren">
          {PRESET_KLEUREN.map((k) => (
            <button
              type="button"
              key={k}
              className={`kleur${t.accent.toLowerCase() === k ? ' gekozen' : ''}`}
              style={{ background: k }}
              aria-label={k}
              onClick={() => setT({ ...t, accent: k })}
            />
          ))}
          <input type="color" value={t.accent || '#2f56d9'} onChange={(e) => setT({ ...t, accent: e.target.value })} aria-label={nl.eigenKleur} />
          <button type="button" className="btn ghost klein" onClick={() => setT({ ...t, accent: '' })}>
            {nl.standaardKleur}
          </button>
        </div>
      </div>

      <div className="veld">
        <span>{nl.logo}</span>
        <input type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => setBestand(e.target.files?.[0] || null)} />
        <small className="note">{nl.logoUitleg}</small>
        {(t.logo || bestand) && (
          <button type="button" className="btn danger klein" onClick={() => { setBestand(null); setT({ ...t, logo: '' }) }}>
            {nl.logoWeghalen}
          </button>
        )}
      </div>

      {fout && <p className="fout" role="alert">{fout}</p>}
      {ok && <p className="ok">✓ {nl.opgeslagen}</p>}
      <button className="btn" disabled={bezig}>{nl.opslaan}</button>
    </form>
  )
}
