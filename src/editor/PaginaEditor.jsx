import { useEffect, useRef, useState } from 'react'
import { afbeeldingUrl } from '../config.js'
import { Sectie } from './bouwstenen.jsx'

const NIEUW = {
  kop: () => ({ type: 'kop', tekst: '' }),
  tekst: () => ({ type: 'tekst', tekst: '' }),
  afbeelding: () => ({ type: 'afbeelding', pad: '', onderschrift: '' }),
  link: () => ({ type: 'link', url: 'https://', tekst: '' }),
  lijst: () => ({ type: 'lijst', items: [''] }),
  lijn: () => ({ type: 'lijn' }),
}
const NAMEN = { kop: 'Kop', tekst: 'Tekst', afbeelding: 'Afbeelding', link: 'Link', lijst: 'Lijst', lijn: 'Scheidingslijn' }

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

  if (!blokken) return <p className="note">Laden…</p>

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
      setFout(e.message === 'anoniem_uit' ? 'Uploaden staat nog niet aan.' : 'Uploaden is niet gelukt.')
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
      setFout(e.code === 'ongeldige_url' ? 'Een link is ongeldig (begin met https://).' : 'Opslaan is niet gelukt.')
    }
    setBezig(false)
  }

  return (
    <Sectie titel="Klaspagina" uitleg="Bouw je eigen pagina met blokken: kop, tekst, afbeelding, link, lijst. Zet daarna het tabblad 'Onze klas' aan (tab Tabs).">
      <div className="rij">
        {Object.keys(NIEUW).map((t) => (
          <button type="button" key={t} className="btn ghost klein" disabled={blokken.length >= 30} onClick={() => setBlokken([...blokken, metId(NIEUW[t]())])}>
            + {NAMEN[t]}
          </button>
        ))}
      </div>

      {blokken.length === 0 && <p className="note">Nog geen blokken. Voeg er een toe.</p>}
      {blokken.map((b, i) => (
        <div key={b._id} className="blok card stack klein-gap">
          <div className="rij tussen">
            <strong>{NAMEN[b.type]}</strong>
            <span className="rij">
              <button type="button" className="btn ghost klein" onClick={() => verplaats(i, -1)} disabled={i === 0} aria-label="Omhoog">↑</button>
              <button type="button" className="btn ghost klein" onClick={() => verplaats(i, 1)} disabled={i === blokken.length - 1} aria-label="Omlaag">↓</button>
              <button type="button" className="btn danger klein" onClick={() => setBlokken(blokken.filter((_, j) => j !== i))} aria-label="Verwijderen">✕</button>
            </span>
          </div>
          {b.type === 'kop' && <input value={b.tekst} maxLength={80} onChange={(e) => wijzig(i, { tekst: e.target.value })} aria-label="Kop" />}
          {b.type === 'tekst' && <textarea value={b.tekst} maxLength={600} rows={4} onChange={(e) => wijzig(i, { tekst: e.target.value })} aria-label="Tekst" />}
          {b.type === 'afbeelding' && (
            <>
              <input type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => kiesPlaatje(i, e.target.files?.[0])} />
              {b.pad && <img className="pagina-voorbeeld" src={afbeeldingUrl(b.pad)} alt="" />}
              <input value={b.onderschrift} maxLength={100} placeholder="Onderschrift (optioneel)" onChange={(e) => wijzig(i, { onderschrift: e.target.value })} aria-label="Onderschrift" />
            </>
          )}
          {b.type === 'link' && (
            <>
              <input value={b.tekst} maxLength={80} placeholder="Tekst op de knop" onChange={(e) => wijzig(i, { tekst: e.target.value })} aria-label="Tekst op de knop" />
              <input value={b.url} maxLength={300} placeholder="https://…" onChange={(e) => wijzig(i, { url: e.target.value })} aria-label="Adres" />
            </>
          )}
          {b.type === 'lijst' && <textarea value={b.items.join('\n')} rows={4} onChange={(e) => wijzig(i, { items: e.target.value.split('\n').slice(0, 12) })} aria-label="Lijst, één regel per punt" placeholder="Eén punt per regel" />}
        </div>
      ))}

      {fout && <p className="fout" role="alert">{fout}</p>}
      {ok && <p className="ok">✓ Opgeslagen</p>}
      <button type="button" className="btn" disabled={bezig} onClick={bewaar}>
        Pagina opslaan
      </button>
    </Sectie>
  )
}
