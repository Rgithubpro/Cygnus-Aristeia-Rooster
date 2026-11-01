import { useState } from 'react'
import { rootRpc } from './client.js'

export default function RootInstellingen({ overzicht, herlaad }) {
  const i = overzicht.instellingen
  const [f, setF] = useState({
    dag1: i.dag1 || '', dag2: i.dag2 || '', event_einde: i.event_einde || '',
    banner_actief: i.banner_actief, banner_titel: i.banner_titel, banner_tekst: i.banner_tekst,
    max_leerlingen: i.max_leerlingen, max_activiteiten: i.max_activiteiten,
  })
  const [ok, setOk] = useState(false)
  const [fout, setFout] = useState('')
  const [wis, setWis] = useState('')
  const zet = (k) => (e) => setF({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value })

  async function bewaar(e) {
    e.preventDefault()
    setOk(false)
    setFout('')
    try {
      await rootRpc('root_instellingen_opslaan', { p_data: { ...f, max_leerlingen: Number(f.max_leerlingen), max_activiteiten: Number(f.max_activiteiten) } })
      await herlaad()
      setOk(true)
    } catch {
      setFout('Opslaan mislukt. Controleer de waarden.')
    }
  }

  return (
    <div className="stack">
      <form className="card stack" onSubmit={bewaar}>
        <h2>Evenement</h2>
        <div className="rij">
          <label className="veld grow"><span>Datum dag 1</span><input type="date" value={f.dag1} onChange={zet('dag1')} /></label>
          <label className="veld grow"><span>Datum dag 2</span><input type="date" value={f.dag2} onChange={zet('dag2')} /></label>
        </div>
        <label className="veld">
          <span>Einde evenement</span>
          <input type="date" value={f.event_einde} onChange={zet('event_einde')} />
          <small className="note">Logins verlopen daarna, en 14 dagen later worden alle leerlingen, apparaten en sessies automatisch gewist (als cron.sql is ingesteld).</small>
        </label>

        <h2>Systeembericht</h2>
        <p className="note">Verschijnt bovenaan de app, ook op het inlogscherm (bijvoorbeeld bij storingen).</p>
        <label className="vink"><input type="checkbox" checked={f.banner_actief} onChange={zet('banner_actief')} /><span>Tonen</span></label>
        <label className="veld"><span>Titel</span><input value={f.banner_titel} onChange={zet('banner_titel')} maxLength={80} /></label>
        <label className="veld"><span>Tekst</span><textarea value={f.banner_tekst} onChange={zet('banner_tekst')} rows={2} maxLength={400} /></label>

        <h2>Limieten</h2>
        <div className="rij">
          <label className="veld grow"><span>Max leerlingen per klas</span><input type="number" min="1" max="500" value={f.max_leerlingen} onChange={zet('max_leerlingen')} /></label>
          <label className="veld grow"><span>Max activiteiten per klas</span><input type="number" min="1" max="1000" value={f.max_activiteiten} onChange={zet('max_activiteiten')} /></label>
        </div>
        {fout && <p className="fout">{fout}</p>}
        {ok && <p className="ok">✓ Opgeslagen</p>}
        <button className="btn">Opslaan</button>
      </form>

      <div className="card stack">
        <h2>Na het evenement</h2>
        <p className="note">Wist alle leerlingen, gekoppelde apparaten, meldingen en sessies. Klassen, wachtwoorden, programma en punten blijven bestaan. Dit kan niet ongedaan worden gemaakt.</p>
        <input value={wis} onChange={(e) => setWis(e.target.value)} placeholder='Typ WISSEN' aria-label="Typ WISSEN" />
        <button
          className="btn danger"
          disabled={wis !== 'WISSEN'}
          onClick={async () => { await rootRpc('root_opruimen'); setWis(''); await herlaad() }}
        >
          Persoonsgegevens wissen
        </button>
      </div>
    </div>
  )
}
