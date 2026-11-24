import { useEffect, useRef, useState } from 'react'
import { afbeeldingUrl } from '../config.js'
import BestandsKnop from '../BestandsKnop.jsx'
import { PaginaBlokken } from '../Pagina.jsx'
import { Sectie } from './bouwstenen.jsx'
import { txt } from '../t.js'

const NIEUW = {
  kop: () => ({ type: 'kop', tekst: '' }),
  tekst: () => ({ type: 'tekst', tekst: '' }),
  afbeelding: () => ({ type: 'afbeelding', pad: '', onderschrift: '' }),
  link: () => ({ type: 'link', url: 'https://', tekst: '' }),
  lijst: () => ({ type: 'lijst', items: [''] }),
  lijn: () => ({ type: 'lijn' }),
}
const NAMEN = { kop: txt('Kop'), tekst: txt('Tekst'), afbeelding: txt('Afbeelding'), link: txt('Link'), lijst: txt('Lijst'), lijn: txt('Scheidingslijn') }

const metId = (b) => ({ ...b, _id: crypto.randomUUID() })
const schoon = ({ _id, ...rest }) => rest

// Editor for the free-form class page ("Onze klas"): a list of simple blocks.
export default function PaginaEditor({ laad, opslaan, upload, verwijder }) {
  const [blokken, setBlokken] = useState(null)
  const [orgPaden, setOrgPaden] = useState([])
  const [bezig, setBezig] = useState(false)
  const [fout, setFout] = useState('')
  const [ok, setOk] = useState(false)
  const nieuw = useRef(new Set()) // pictures uploaded in this editing session but not saved yet

  useEffect(() => {
    laad().then((p) => {
      setBlokken((p || []).map(metId))
      setOrgPaden((p || []).filter((b) => b.type === 'afbeelding').map((b) => b.pad))
    })
    return () => {
      // leaving without saving: remove pictures that were uploaded but never saved
      nieuw.current.forEach((pad) => verwijder(pad).catch(() => {}))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (!blokken) return <p className="note">{txt('Laden…')}</p>

  const wijzig = (i, patch) => setBlokken(blokken.map((b, j) => (j === i ? { ...b, ...patch } : b)))
  const verplaats = (i, d) => {
    const n = [...blokken]
    const j = i + d
    if (j < 0 || j >= n.length) return
    ;[n[i], n[j]] = [n[j], n[i]]
    setBlokken(n)
  }

  async function kiesPlaatje(i, bestand) {
    if (!bestand) return
    setFout('')
    try {
      const pad = await upload(bestand, 1200)
      nieuw.current.add(pad)
      wijzig(i, { pad })
    } catch (e) {
      setFout(e.message === 'anoniem_uit' ? txt('Uploaden staat nog niet aan.') : txt('Uploaden is niet gelukt.'))
    }
  }

  async function bewaar() {
    setBezig(true)
    setFout('')
    setOk(false)
    try {
      const lijst = blokken.map(schoon).map((b) => (b.type === 'lijst' ? { ...b, items: b.items.map((x) => x.trim()).filter(Boolean) } : b))
      await opslaan(lijst)
      const gebruikt = new Set(lijst.filter((b) => b.type === 'afbeelding').map((b) => b.pad))
      const weg = [...new Set([...orgPaden, ...nieuw.current])].filter((p) => !gebruikt.has(p))
      weg.forEach((p) => verwijder(p).catch(() => {}))
      nieuw.current = new Set()
      setOrgPaden([...gebruikt])
      setOk(true)
    } catch (e) {
      setFout(e.code === 'ongeldige_url' ? 'Een link is ongeldig (begin met https://).' : txt('Opslaan is niet gelukt.'))
    }
    setBezig(false)
  }

  const voorbeeld = blokken
    .map(schoon)
    .filter((b) => (b.type === 'kop' || b.type === 'tekst' ? b.tekst.trim() : b.type === 'afbeelding' ? b.pad : b.type === 'link' ? /^https?:\/\/\S+$/.test(b.url) : b.type === 'lijst' ? b.items.some((x) => x.trim()) : true))
    .map((b) => (b.type === 'lijst' ? { ...b, items: b.items.filter((x) => x.trim()) } : b))

  return (
    <div className="pagina-split">
    <Sectie titel={txt('Klaspagina')} uitleg={txt('Bouw je eigen pagina met blokken: kop, tekst, afbeelding, link, lijst. Zet daarna het tabblad \'Onze klas\' aan (tab Tabs).')}>
      <div className="rij">
        {Object.keys(NIEUW).map((t) => (
          <button type="button" key={t} className="btn ghost klein" disabled={blokken.length >= 30} onClick={() => setBlokken([...blokken, metId(NIEUW[t]())])}>
            + {NAMEN[t]}
          </button>
        ))}
      </div>

      {blokken.length === 0 && <p className="note">{txt('Nog geen blokken. Voeg er een toe.')}</p>}
      {blokken.map((b, i) => (
        <div key={b._id} className="blok card stack klein-gap">
          <div className="rij tussen">
            <strong>{NAMEN[b.type]}</strong>
            <span className="rij">
              <button type="button" className="btn ghost klein" onClick={() => verplaats(i, -1)} disabled={i === 0} aria-label={txt('Omhoog')}>↑</button>
              <button type="button" className="btn ghost klein" onClick={() => verplaats(i, 1)} disabled={i === blokken.length - 1} aria-label={txt('Omlaag')}>↓</button>
              <button type="button" className="btn danger klein" onClick={() => setBlokken(blokken.filter((_, j) => j !== i))} aria-label={txt('Verwijderen')}>✕</button>
            </span>
          </div>
          {b.type === 'kop' && <input value={b.tekst} maxLength={80} onChange={(e) => wijzig(i, { tekst: e.target.value })} aria-label={txt('Kop')} />}
          {b.type === 'tekst' && <textarea value={b.tekst} maxLength={600} rows={4} onChange={(e) => wijzig(i, { tekst: e.target.value })} aria-label={txt('Tekst')} />}
          {b.type === 'afbeelding' && (
            <>
              <BestandsKnop label={txt('Kies een afbeelding')} bestand={null} onBestand={(f) => kiesPlaatje(i, f)} />
              {b.pad && <img className="pagina-voorbeeld" src={afbeeldingUrl(b.pad)} alt="" />}
              <input value={b.onderschrift} maxLength={100} placeholder={txt('Onderschrift (optioneel)')} onChange={(e) => wijzig(i, { onderschrift: e.target.value })} aria-label={txt('Onderschrift')} />
            </>
          )}
          {b.type === 'link' && (
            <>
              <input value={b.tekst} maxLength={80} placeholder={txt('Tekst op de knop')} onChange={(e) => wijzig(i, { tekst: e.target.value })} aria-label={txt('Tekst op de knop')} />
              <input value={b.url} maxLength={300} placeholder={txt('https://…')} onChange={(e) => wijzig(i, { url: e.target.value })} aria-label={txt('Adres')} />
            </>
          )}
          {b.type === 'lijst' && <textarea value={b.items.join('\n')} rows={4} onChange={(e) => wijzig(i, { items: e.target.value.split('\n').slice(0, 12) })} aria-label={txt('Lijst, één regel per punt')} placeholder={txt('Eén punt per regel')} />}
        </div>
      ))}

      {fout && <p className="fout" role="alert">{fout}</p>}
      {ok && <p className="ok">{txt('✓ Opgeslagen')}</p>}
      <button type="button" className="btn" disabled={bezig} onClick={bewaar}>
        {txt('Pagina opslaan')}
      </button>
    </Sectie>
    <aside className="card stack voorbeeld">
      <h3>{txt('Voorbeeld (zo ziet je klas het)')}</h3>
      {voorbeeld.length ? <PaginaBlokken blokken={voorbeeld} /> : <p className="note">{txt('Hier verschijnt een voorbeeld zodra je blokken toevoegt.')}</p>}
    </aside>
    </div>
  )
}
