import { useEffect, useMemo, useState } from 'react'
import { afbeeldingUrl } from './config.js'
import { nl } from './strings.js'
import { PRESET_KLEUREN, themaStijl } from './theme.js'
import EmojiKiezer from './EmojiKiezer.jsx'

const BASIS = {
  accent: '',
  achtergrond: '',
  kaart: '',
  tekst: '',
  emoji: '',
  slogan: '',
  logo: '',
  banner: '',
  bannerTekst: '',
  layout: 'standaard',
  decoratie: 'geen',
  toonRooster: true,
  toonInfo: true,
  toonStand: true,
}

export default function KlasThemaForm({ klas, opslaan, upload, verwijder }) {
  const [naam, setNaam] = useState(klas.weergavenaam || '')
  const [t, setT] = useState(() => {
    const thema = klas.thema || {}
    return {
      ...BASIS,
      ...thema,
      accent: thema.accent || '',
      achtergrond: thema.achtergrond || '',
      kaart: thema.kaart || '',
      tekst: thema.tekst || '',
      emoji: thema.emoji || '',
      slogan: thema.slogan || '',
      logo: thema.logo || '',
      banner: thema.banner || '',
      bannerTekst: thema.bannerTekst || '',
      layout: thema.layout || BASIS.layout,
      decoratie: thema.decoratie || BASIS.decoratie,
      toonRooster: thema.toonRooster !== false,
      toonInfo: thema.toonInfo !== false,
      toonStand: thema.toonStand !== false,
    }
  })
  const [logoBestand, setLogoBestand] = useState(null)
  const [bannerBestand, setBannerBestand] = useState(null)
  const [fout, setFout] = useState('')
  const [ok, setOk] = useState(false)
  const [bezig, setBezig] = useState(false)

  const logoVoorbeeld = useMemo(() => logoBestand && URL.createObjectURL(logoBestand), [logoBestand])
  const bannerVoorbeeld = useMemo(() => bannerBestand && URL.createObjectURL(bannerBestand), [bannerBestand])
  useEffect(() => () => {
    if (logoVoorbeeld) URL.revokeObjectURL(logoVoorbeeld)
    if (bannerVoorbeeld) URL.revokeObjectURL(bannerVoorbeeld)
  }, [logoVoorbeeld, bannerVoorbeeld])

  const logoSrc = logoVoorbeeld || (t.logo ? afbeeldingUrl(t.logo) : null)
  const bannerSrc = bannerVoorbeeld || (t.banner ? afbeeldingUrl(t.banner) : null)
  const zet = (sleutel) => (e) => setT({ ...t, [sleutel]: e.target.type === 'checkbox' ? e.target.checked : e.target.value })

  async function bewaar(e) {
    e.preventDefault()
    if (!t.toonRooster && !t.toonInfo && !t.toonStand) {
      setFout(nl.minstensEenTab)
      return
    }
    setBezig(true)
    setFout('')
    setOk(false)
    const nieuwePaden = []
    let logo = t.logo
    let banner = t.banner
    let opslaanGestart = false
    try {
      if (logoBestand) {
        logo = await upload(logoBestand, 512)
        nieuwePaden.push(logo)
      }
      if (bannerBestand) {
        banner = await upload(bannerBestand, 1600)
        nieuwePaden.push(banner)
      }
      opslaanGestart = true
      await opslaan(naam, { ...t, logo, banner })
    } catch (err) {
      const opruiming = await Promise.allSettled(nieuwePaden.map((pad) => verwijder(pad)))
      setFout(err.message === 'anoniem_uit' ? nl.anoniemUit : opslaanGestart ? nl.laadFout : nl.uploadFout)
      if (opruiming.some((r) => r.status === 'rejected')) {
        setFout(`${opslaanGestart ? nl.laadFout : nl.uploadFout} ${nl.afbeeldingOpruimen}`)
      }
      setBezig(false)
      return
    }

    const oudePaden = [klas.thema?.logo, klas.thema?.banner]
      .filter((pad) => pad && pad !== logo && pad !== banner)
    const verwijderingen = await Promise.allSettled(oudePaden.map((pad) => verwijder(pad)))
    setT({ ...t, logo, banner })
    setLogoBestand(null)
    setBannerBestand(null)
    setOk(true)
    if (verwijderingen.some((r) => r.status === 'rejected')) setFout(nl.afbeeldingOpruimen)
    setBezig(false)
  }

  return (
    <form className={`card stack thema-form layout-${t.layout}`} onSubmit={bewaar}>
      <div className="thema-voorbeeld" style={themaStijl(t)}>
        {bannerSrc && <img className="thema-voorbeeld-banner" src={bannerSrc} alt="" />}
        <div className="head">
          {logoSrc ? <img className="klas-logo" src={logoSrc} alt="" /> : t.emoji ? <span className="klas-emoji">{t.emoji}</span> : <span className="klas-emoji">🏅</span>}
          <div className="grow">
            <h2>{naam || klas.naam}</h2>
            <p className="tagline">{t.slogan || nl.title}</p>
          </div>
          {t.decoratie !== 'geen' && <span className="klas-decoratie" aria-hidden="true">{t.decoratie}</span>}
        </div>
        {t.bannerTekst && <p className="klas-banner-tekst">{t.bannerTekst}</p>}
        <div className="thema-voorbeeld-kaart">{nl.voorbeeld} · Rooster · Info · Stand</div>
      </div>

      <label className="veld">
        <span>{nl.weergavenaam}</span>
        <input value={naam} onChange={(e) => setNaam(e.target.value)} maxLength={40} placeholder={klas.naam} />
        <small className="note">{nl.weergavenaamUitleg}</small>
      </label>
      <label className="veld">
        <span>{nl.slogan}</span>
        <input value={t.slogan} onChange={zet('slogan')} maxLength={60} />
      </label>

      <details className="stack" open>
        <summary>{nl.themaKleuren}</summary>
        <div className="veld">
          <span>{nl.accentkleur}</span>
          <div className="kleuren">
            {PRESET_KLEUREN.map((kleur) => (
              <button
                type="button"
                key={kleur}
                className={`kleur${(t.accent || '').toLowerCase() === kleur ? ' gekozen' : ''}`}
                style={{ background: kleur }}
                aria-label={kleur}
                aria-pressed={(t.accent || '').toLowerCase() === kleur}
                onClick={() => setT({ ...t, accent: kleur })}
              />
            ))}
            <input type="color" value={t.accent || '#2f56d9'} onChange={zet('accent')} aria-label={nl.accentkleur} />
            <button type="button" className="btn ghost klein" onClick={() => setT({ ...t, accent: '' })}>{nl.standaardKleur}</button>
          </div>
        </div>
        <div className="rij">
          <label className="veld grow">
            <span>{nl.achtergrondkleur}</span>
            <input type="color" value={t.achtergrond || '#eef1f7'} onChange={zet('achtergrond')} />
          </label>
          <label className="veld grow">
            <span>{nl.kaartkleur}</span>
            <input type="color" value={t.kaart || '#ffffff'} onChange={zet('kaart')} />
          </label>
          <label className="veld grow">
            <span>{nl.tekstkleur}</span>
            <input type="color" value={t.tekst || '#14203d'} onChange={zet('tekst')} />
          </label>
        </div>
        <small className="note">{nl.tekstContrast}</small>
        <button type="button" className="btn ghost klein" onClick={() => setT({ ...t, achtergrond: '', kaart: '', tekst: '' })}>{nl.standaardKleur}</button>
      </details>

      <details className="stack">
        <summary>{nl.klasLogoEnAppicoon}</summary>
        <EmojiKiezer label={nl.klasEmoji} waarde={t.emoji} onKies={(emoji) => setT({ ...t, emoji })} auto />
        <label className="veld">
          <span>{nl.logo}</span>
          <input type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => { setLogoBestand(e.target.files?.[0] || null); e.currentTarget.value = '' }} />
          <small className="note">{nl.logoUitleg}</small>
          {(t.logo || logoBestand) && (
            <button type="button" className="btn danger klein" onClick={() => { setLogoBestand(null); setT({ ...t, logo: '' }) }}>{nl.logoWeghalen}</button>
          )}
        </label>
        <small className="note">{nl.klasAppicoonUitleg}</small>
      </details>

      <details className="stack">
        <summary>{nl.klasBanner}</summary>
        <label className="veld">
          <span>{nl.bannerAfbeelding}</span>
          <input type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => { setBannerBestand(e.target.files?.[0] || null); e.currentTarget.value = '' }} />
          <small className="note">{nl.bannerUitleg}</small>
          {(t.banner || bannerBestand) && (
            <button type="button" className="btn danger klein" onClick={() => { setBannerBestand(null); setT({ ...t, banner: '' }) }}>{nl.bannerWeg}</button>
          )}
        </label>
        <label className="veld">
          <span>{nl.bannerTekstLabel}</span>
          <textarea value={t.bannerTekst} onChange={zet('bannerTekst')} maxLength={200} rows={2} />
        </label>
      </details>

      <details className="stack">
        <summary>{nl.indelingEnZichtbaarheid}</summary>
        <label className="veld">
          <span>{nl.indeling}</span>
          <select value={t.layout} onChange={zet('layout')}>
            <option value="standaard">{nl.indelingStandaard}</option>
            <option value="compact">{nl.indelingCompact}</option>
            <option value="breed">{nl.indelingBreed}</option>
          </select>
        </label>
        <label className="veld">
          <span>{nl.versiering}</span>
          <select value={t.decoratie} onChange={zet('decoratie')}>
            <option value="geen">{nl.geenVersiering}</option>
            <option value="✨">✨ {nl.versieringSterren}</option>
            <option value="🎉">🎉 {nl.versieringFeest}</option>
            <option value="🌿">🌿 {nl.versieringNatuur}</option>
            <option value="🏆">🏆 {nl.versieringSport}</option>
          </select>
        </label>
        <fieldset className="stack thema-zichtbaarheid">
          <legend>{nl.zichtbareOnderdelen}</legend>
          {[
            ['toonRooster', nl.tabRooster],
            ['toonInfo', nl.tabInfo],
            ['toonStand', nl.tabStand],
          ].map(([sleutel, label]) => (
            <label className="vink" key={sleutel}>
              <input type="checkbox" checked={t[sleutel]} onChange={zet(sleutel)} />
              <span>{label}</span>
            </label>
          ))}
          <small className="note">{nl.zichtbaarheidUitleg}</small>
        </fieldset>
      </details>

      {fout && <p className="fout" role="alert">{fout}</p>}
      {ok && !fout && <p className="ok">✓ {nl.opgeslagen}</p>}
      <button className="btn" disabled={bezig}>{bezig ? nl.bezigMetOpslaan : nl.opslaan}</button>
    </form>
  )
}
