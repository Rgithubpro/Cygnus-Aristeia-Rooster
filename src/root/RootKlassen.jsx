import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { rootRpc, uploadAfbeelding, verwijderAfbeelding } from './client.js'
import KlasThemaForm from '../KlasThemaForm.jsx'
import { maakWachtwoord, slugVan } from '../util.js'

const link = (slug) => `${location.origin}/k/${slug}`
const zin = (e) => ({ wachtwoord_te_kort: 'Een wachtwoord moet minstens 6 tekens hebben.', wachtwoorden_gelijk: 'De twee wachtwoorden moeten verschillen.', limiet_leerlingen: 'Te veel leerlingen voor deze klas (zie Instellingen).' }[e.code] || 'Er ging iets mis. Mogelijk bestaat de klas al.')

async function qrVan(tekst) {
  const QR = await import('qrcode')
  return (QR.default || QR).toDataURL(tekst, { margin: 1, width: 360 })
}

export default function RootKlassen({ overzicht, herlaad }) {
  const [open, setOpen] = useState(null)
  const [qrBladen, setQrBladen] = useState(null)

  useEffect(() => {
    if (!qrBladen) return
    const klaar = () => setQrBladen(null)
    window.addEventListener('afterprint', klaar, { once: true })
    const t = setTimeout(() => window.print(), 150)
    return () => clearTimeout(t)
  }, [qrBladen])

  async function printQr() {
    const bladen = await Promise.all(overzicht.klassen.map(async (k) => ({ naam: k.naam, url: link(k.slug), img: await qrVan(link(k.slug)) })))
    setQrBladen(bladen)
  }

  return (
    <div className="stack">
      <NieuweKlas herlaad={herlaad} />
      <div className="rij tussen">
        <h2>{overzicht.klassen.length} klassen</h2>
        <button className="btn ghost klein" onClick={printQr} disabled={overzicht.klassen.length === 0}>
          🖨️ QR-codes printen
        </button>
      </div>
      <ul className="stack lijst-los">
        {overzicht.klassen.map((k) => (
          <li key={k.id} className="card stack klein-gap">
            <div className="rij tussen">
              <strong>{k.weergavenaam ? `${k.naam} (${k.weergavenaam})` : k.naam}</strong>
              <button className="btn ghost klein" onClick={() => setOpen(open === k.id ? null : k.id)}>
                {open === k.id ? 'Sluiten' : 'Details'}
              </button>
            </div>
            <span className="meta">
              League: {k.competitie || 'Algemeen'} · {k.leerlingen} leerlingen, {k.gekoppeld} gekoppeld, {k.meldingen} met meldingen, {k.activiteiten} activiteiten
              {k.laatst_gezien ? `, laatst actief ${new Date(k.laatst_gezien).toLocaleString('nl-NL', { dateStyle: 'short', timeStyle: 'short' })}` : ''}
            </span>
            {open === k.id && <KlasDetail klas={k} competities={overzicht.klassen.map((r) => r.competitie).filter(Boolean)} herlaad={herlaad} onWeg={() => setOpen(null)} />}
          </li>
        ))}
      </ul>

      {qrBladen &&
        createPortal(
          <div id="print-area">
            {qrBladen.map((b) => (
              <section key={b.url} className="print-pagina qr">
                <h1>{b.naam}</h1>
                <img src={b.img} alt="" />
                <p>{b.url}</p>
                <p>Scan de code en log in met het wachtwoord van je klas.</p>
              </section>
            ))}
          </div>,
          document.body,
        )}
    </div>
  )
}

function NieuweKlas({ herlaad }) {
  const [naam, setNaam] = useState('')
  const [slug, setSlug] = useState('')
  const [lw, setLw] = useState(maakWachtwoord)
  const [bw, setBw] = useState(maakWachtwoord)
  const [namen, setNamen] = useState('')
  const [fout, setFout] = useState('')
  const [klaar, setKlaar] = useState(null)

  async function maak(e) {
    e.preventDefault()
    setFout('')
    try {
      const r = await rootRpc('root_klas_maken', { p_naam: naam, p_slug: slug || slugVan(naam), p_lw: lw, p_bw: bw })
      if (namen.trim()) await rootRpc('root_leerlingen_toevoegen', { p_klas: r.id, p_namen: namen })
      setKlaar({ naam, slug: slug || slugVan(naam), lw, bw })
      setNaam('')
      setSlug('')
      setNamen('')
      setLw(maakWachtwoord())
      setBw(maakWachtwoord())
      herlaad()
    } catch (err) {
      setFout(zin(err))
    }
  }

  return (
    <form className="card stack" onSubmit={maak}>
      <h2>Nieuwe klas</h2>
      <div className="rij">
        <label className="veld grow">
          <span>Naam</span>
          <input value={naam} onChange={(e) => { setNaam(e.target.value); setSlug(slugVan(e.target.value)) }} maxLength={40} required />
        </label>
        <label className="veld grow">
          <span>Link-naam</span>
          <input value={slug} onChange={(e) => setSlug(e.target.value)} pattern="[a-z0-9\-]+" maxLength={40} required />
        </label>
      </div>
      <div className="rij">
        <label className="veld grow">
          <span>Leerlingwachtwoord</span>
          <input value={lw} onChange={(e) => setLw(e.target.value)} minLength={6} required />
        </label>
        <button type="button" className="btn ghost klein" onClick={() => setLw(maakWachtwoord())}>
          Nieuw
        </button>
      </div>
      <div className="rij">
        <label className="veld grow">
          <span>Beheerderswachtwoord</span>
          <input value={bw} onChange={(e) => setBw(e.target.value)} minLength={6} required />
        </label>
        <button type="button" className="btn ghost klein" onClick={() => setBw(maakWachtwoord())}>
          Nieuw
        </button>
      </div>
      <label className="veld">
        <span>Leerlingen (optioneel, één naam per regel)</span>
        <textarea value={namen} onChange={(e) => setNamen(e.target.value)} rows={4} />
      </label>
      {fout && <p className="fout">{fout}</p>}
      <button className="btn">Klas aanmaken</button>
      {klaar && (
        <div className="waarschuwing">
          <strong>Noteer de wachtwoorden nu, ze worden niet opnieuw getoond:</strong>
          <p>
            {klaar.naam} ({link(klaar.slug)})<br />
            Leerlingen: <code>{klaar.lw}</code>
            <br />
            Beheerder: <code>{klaar.bw}</code>
          </p>
        </div>
      )}
    </form>
  )
}

function KlasDetail({ klas, competities, herlaad, onWeg }) {
  const [detail, setDetail] = useState(null)
  const [qr, setQr] = useState('')
  const [naam, setNaam] = useState(klas.naam)
  const [competitie, setCompetitie] = useState(klas.competitie || 'Algemeen')
  const [namen, setNamen] = useState('')
  const [nieuwWw, setNieuwWw] = useState(null)
  const [fout, setFout] = useState('')

  const laad = () => rootRpc('root_klas_detail', { p_id: klas.id }).then(setDetail)
  useEffect(() => {
    laad()
    qrVan(link(klas.slug)).then(setQr)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [klas.id])

  async function doe(fn) {
    setFout('')
    try {
      await fn()
      await herlaad()
      await laad()
    } catch (e) {
      setFout(zin(e))
    }
  }

  const zetWw = (rol) =>
    doe(async () => {
      if (!window.confirm('Alle apparaten van deze klas worden uitgelogd. Doorgaan?')) return
      const ww = maakWachtwoord()
      await rootRpc('root_wachtwoorden_zetten', { p_id: klas.id, p_lw: rol === 'lw' ? ww : null, p_bw: rol === 'bw' ? ww : null, p_sessies_beeindigen: true })
      setNieuwWw({ rol, ww })
    })

  return (
    <div className="stack">
      <div className="rij">
        {qr && <img className="qr-klein" src={qr} alt={`QR-code ${klas.naam}`} />}
        <p className="woord-af">{link(klas.slug)}</p>
      </div>

      <div className="rij">
        <input value={naam} onChange={(e) => setNaam(e.target.value)} aria-label="Naam" maxLength={40} />
        <button className="btn ghost klein" onClick={() => doe(() => rootRpc('root_klas_hernoemen', { p_id: klas.id, p_naam: naam }))}>
          Hernoemen
        </button>
      </div>

      <div className="rij">
        <label className="veld grow">
          <span>Competitie / league</span>
          <input value={competitie} onChange={(e) => setCompetitie(e.target.value)} list={`competities-${klas.id}`} maxLength={40} />
          <datalist id={`competities-${klas.id}`}>{[...new Set(competities)].map((naam) => <option key={naam} value={naam} />)}</datalist>
          <small className="note">Klassen met dezelfde naam worden alleen met elkaar vergeleken in de stand.</small>
        </label>
        <button className="btn ghost klein" onClick={() => doe(() => rootRpc('root_klas_competitie_opslaan', { p_id: klas.id, p_competitie: competitie }))}>
          Opslaan
        </button>
      </div>

      <div className="rij">
        <button className="btn ghost klein" onClick={() => zetWw('lw')}>Nieuw leerlingwachtwoord</button>
        <button className="btn ghost klein" onClick={() => zetWw('bw')}>Nieuw beheerderswachtwoord</button>
        <button className="btn ghost klein" onClick={() => doe(() => rootRpc('root_sessies_beeindigen', { p_id: klas.id }))}>Alle apparaten uitloggen</button>
      </div>
      {nieuwWw && (
        <div className="waarschuwing">
          Nieuw {nieuwWw.rol === 'lw' ? 'leerlingwachtwoord' : 'beheerderswachtwoord'}: <code>{nieuwWw.ww}</code> (noteer het nu)
        </div>
      )}

      <details className="stack">
        <summary>Uiterlijk en indeling van deze klas</summary>
        <KlasThemaForm
          key={klas.id}
          klas={klas}
          opslaan={async (weergavenaam, thema) => {
            await rootRpc('root_klas_thema_opslaan', { p_id: klas.id, p_weergavenaam: weergavenaam, p_thema: thema })
            await herlaad()
          }}
          upload={(bestand, maxPx) => uploadAfbeelding(bestand, klas.id, maxPx)}
          verwijder={verwijderAfbeelding}
        />
      </details>

      <label className="veld">
        <span>Leerlingen toevoegen (één naam per regel)</span>
        <textarea value={namen} onChange={(e) => setNamen(e.target.value)} rows={3} />
      </label>
      <button
        className="btn ghost klein"
        disabled={!namen.trim()}
        onClick={() => doe(async () => { await rootRpc('root_leerlingen_toevoegen', { p_klas: klas.id, p_namen: namen }); setNamen('') })}
      >
        Toevoegen
      </button>

      {detail && (
        <>
          <strong>Leerlingen ({detail.leerlingen.length})</strong>
          <p className="meta">{detail.leerlingen.map((l) => l.naam).join(', ') || 'Nog geen leerlingen'}</p>
          <strong>Activiteiten ({detail.activiteiten.length})</strong>
          <ul className="keuzelijst">
            {detail.activiteiten.map((a) => (
              <li key={a.id}>
                Dag {a.dag} {a.start}–{a.eind}: {a.titel} ({a.aantal} deelnemers)
              </li>
            ))}
          </ul>
        </>
      )}

      {fout && <p className="fout">{fout}</p>}
      <button
        className="btn danger klein"
        onClick={() => {
          if (window.prompt(`Typ "${klas.slug}" om deze klas definitief te verwijderen`) === klas.slug) {
            doe(async () => { await rootRpc('root_klas_verwijderen', { p_id: klas.id }); onWeg() })
          }
        }}
      >
        Klas verwijderen
      </button>
    </div>
  )
}
