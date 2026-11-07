import { useEffect, useMemo, useState } from 'react'
import { afbeeldingUrl } from '../config.js'
import { useThema } from '../themaContext.jsx'
import { Decoratie, Identiteit, Kleuren, Stijl, Tabs, Weergave, leesbaarheid } from './Secties.jsx'
import PaginaEditor from './PaginaEditor.jsx'
import AppIcoon from './AppIcoon.jsx'
import { bouwIcoonSet, icoonPaden, laadBitmap } from './icoon.js'

const SECTIES = [
  ['identiteit', 'Identiteit'],
  ['icoon', 'App-icoon'],
  ['kleuren', 'Kleuren'],
  ['stijl', 'Stijl'],
  ['weergave', 'Weergave'],
  ['decoratie', 'Decoratie'],
  ['tabs', 'Tabs'],
  ['pagina', 'Klaspagina'],
]
const BEELDEN = ['logo', 'banner', 'mascotte']

// Compares settings ignoring key order and empty values (the server stores them sorted and without empty values).
function normaal(v) {
  if (Array.isArray(v)) return v.map(normaal)
  if (v && typeof v === 'object') {
    return Object.fromEntries(
      Object.keys(v)
        .filter((k) => !k.startsWith('_'))
        .sort()
        .map((k) => [k, normaal(v[k])])
        .filter(([, x]) => !(x === '' || x === null || x === undefined || (Array.isArray(x) && x.length === 0) || (x && typeof x === 'object' && !Array.isArray(x) && Object.keys(x).length === 0))),
    )
  }
  return v
}
const sleutel = (naam, thema) => JSON.stringify([String(naam || '').trim(), normaal(thema || {})])
const FOUTEN = {
  ongeldige_kleur: 'Een van de kleuren is ongeldig.',
  ongeldig_pad: 'Een afbeelding hoort niet bij deze klas.',
  thema_te_groot: 'Er zijn te veel instellingen gekozen.',
  ongeldige_keuze: 'Een van de keuzes is ongeldig.',
  ongeldige_emoji: 'Een emoji is ongeldig.',
}

// The whole class customization in one place. In the class admin's own app the whole page previews edits live (`live`).
export default function KlasEditor({ klas, opslaanThema, opslaanPagina, paginaLaad, upload, uploadPng, verwijder, live = true }) {
  const { zetConcept } = useThema()
  const basis = useMemo(() => sleutel(klas.weergavenaam, klas.thema), [klas.weergavenaam, klas.thema])
  const [sectie, setSectie] = useState('identiteit')
  const [naam, setNaam] = useState(klas.weergavenaam || '')
  const [t, setT] = useState(() => ({ ...(klas.thema || {}) }))
  const [bestanden, setBestanden] = useState({})
  const [icoon, setIcoon] = useState({ actief: false, bron: 'logo', bestand: null, marge: 12, achtergrond: '#ffffff' })
  const zetIcoon = (p) => {
    setOk(false)
    setIcoon((v) => ({ ...v, ...p, actief: true }))
  }
  const [bezig, setBezig] = useState(false)
  const [fout, setFout] = useState('')
  const [ok, setOk] = useState(false)

  const zet = (patch) => {
    setOk(false)
    setT((v) => ({ ...v, ...patch }))
  }
  const zetBestand = (k, f) => setBestanden((b) => ({ ...b, [k]: f }))

  const blobs = useMemo(() => Object.fromEntries(Object.entries(bestanden).filter(([, f]) => f).map(([k, f]) => [k, URL.createObjectURL(f)])), [bestanden])
  useEffect(() => () => Object.values(blobs).forEach((u) => URL.revokeObjectURL(u)), [blobs])

  // live preview: the real app restyles itself while you edit
  useEffect(() => {
    if (!live) return
    zetConcept({ ...t, _naam: naam.trim() || klas.naam, _blob: blobs })
    return () => zetConcept(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [t, naam, blobs, live])

  const gewijzigd = sleutel(naam, t) !== basis || BEELDEN.some((k) => bestanden[k]) || icoon.actief
  const l = leesbaarheid(t)

  async function bewaar() {
    if (!l.ok) return setFout('Je tekstkleur is slecht leesbaar. Pas de kleuren aan (tab Kleuren).')
    setBezig(true)
    setFout('')
    setOk(false)
    const nieuw = []
    try {
      const paden = { logo: t.logo || '', banner: t.banner || '', mascotte: t.mascotte || '', icoon: t.icoon || '' }
      for (const k of BEELDEN) {
        if (bestanden[k]) {
          const pad = await upload(bestanden[k], k === 'banner' ? 1600 : 512)
          nieuw.push(pad)
          paden[k] = pad
        }
      }
      if (icoon.actief) {
        const bron = icoon.bron === 'eigen' ? icoon.bestand : bestanden.logo || (t.logo ? afbeeldingUrl(t.logo) : null)
        if (!bron) throw new Error('geen_icoonbron')
        const set = await bouwIcoonSet(await laadBitmap(bron), icoon)
        const id = crypto.randomUUID().replace(/-/g, '').slice(0, 16)
        for (const [sleutel, naam] of [['512', `${id}-512.png`], ['192', `${id}-192.png`], ['180', `${id}-180.png`], ['m512', `${id}-m512.png`]]) {
          const pad = await uploadPng(set[sleutel], naam)
          nieuw.push(pad)
          if (sleutel === '512') paden.icoon = pad
        }
      }
      const thema = { ...t, ...paden }
      await opslaanThema(naam, thema)
      if (klas.thema?.icoon && klas.thema.icoon !== paden.icoon) icoonPaden(klas.thema.icoon).forEach((p) => verwijder(p).catch(() => {}))
      for (const k of BEELDEN) {
        const oud = klas.thema?.[k]
        if (oud && oud !== paden[k]) verwijder(oud).catch(() => {})
      }
      setT(thema)
      setBestanden({})
      setIcoon((v) => ({ ...v, actief: false, bestand: null }))
      setOk(true)
    } catch (e) {
      nieuw.forEach((p) => verwijder(p).catch(() => {}))
      setFout(e.message === 'geen_icoonbron' ? 'Kies eerst een logo of een eigen afbeelding voor het app-icoon.' : e.message === 'anoniem_uit' ? 'Uploaden staat nog niet aan. Vraag de organisatie om anonieme logins aan te zetten.' : FOUTEN[e.code] || 'Opslaan is niet gelukt. Probeer het opnieuw.')
    }
    setBezig(false)
  }

  const terug = () => {
    setNaam(klas.weergavenaam || '')
    setT({ ...(klas.thema || {}) })
    setBestanden({})
    setIcoon({ actief: false, bron: 'logo', bestand: null, marge: 12, achtergrond: '#ffffff' })
    setFout('')
  }
  const reset = () => {
    if (!window.confirm('Alles terugzetten naar de standaardstijl? (Je moet daarna nog op Opslaan drukken.)')) return
    setNaam('')
    setT({})
    setBestanden({})
  }

  return (
    <div className="stack editor">
      <div className="segment" role="tablist">
        {SECTIES.map(([id, label]) => (
          <button key={id} role="tab" aria-selected={sectie === id} onClick={() => setSectie(id)}>
            {label}
          </button>
        ))}
      </div>
      {live && <p className="note">Wat je hier verandert, zie je meteen in de hele app. Het wordt pas bewaard (en door je klas gezien) als je op Opslaan drukt.</p>}

      {sectie === 'identiteit' && <Identiteit t={t} zet={zet} naam={naam} setNaam={setNaam} bestanden={bestanden} zetBestand={zetBestand} />}
      {sectie === 'icoon' && <AppIcoon t={t} bestandLogo={bestanden.logo} icoon={icoon} zetIcoon={zetIcoon} />}
      {sectie === 'kleuren' && <Kleuren t={t} zet={zet} />}
      {sectie === 'stijl' && <Stijl t={t} zet={zet} />}
      {sectie === 'weergave' && <Weergave t={t} zet={zet} />}
      {sectie === 'decoratie' && <Decoratie t={t} zet={zet} />}
      {sectie === 'tabs' && <Tabs t={t} zet={zet} />}
      {sectie === 'pagina' && <PaginaEditor laad={paginaLaad} opslaan={opslaanPagina} upload={upload} verwijder={verwijder} />}

      {sectie !== 'pagina' && (
        <div className="opslaanbalk">
          <span className="note">{gewijzigd ? 'Niet-opgeslagen wijzigingen' : ok ? '✓ Opgeslagen' : 'Alles is opgeslagen'}</span>
          <span className="rij">
            <button type="button" className="btn ghost klein" onClick={reset}>Standaard</button>
            <button type="button" className="btn ghost klein" disabled={!gewijzigd} onClick={terug}>Ongedaan maken</button>
            <button type="button" className="btn" disabled={bezig || !gewijzigd} onClick={bewaar}>Opslaan</button>
          </span>
        </div>
      )}
      {fout && <p className="fout" role="alert">{fout}</p>}
    </div>
  )
}
