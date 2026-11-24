import { useEffect, useState } from 'react'
import { rootRpc } from './client.js'
import { txt } from '../t.js'

// Standings: what students see, leagues, and a simple list of places per class (shared places allowed, points optional).
export default function RootLeagues({ overzicht, herlaad }) {
  const i = overzicht.instellingen
  const leagues = overzicht.leagues || []
  const zet = async (dag, punten, forceer) => {
    await rootRpc('root_stand_instellingen', { p_dag: dag, p_punten: punten, p_forceer: forceer })
    herlaad()
  }
  return (
    <>
      <div className="card stack">
        <h2>{txt('Zichtbaar voor leerlingen')}</h2>
        <p className="note">{txt('De database geeft alleen de uitslag van de gekozen dag vrij. Zet eerst de uitslag hieronder klaar.')}</p>
        <div className="segment">
          {[[0, txt('Niets')], [1, txt('Dag 1')], [2, txt('Dag 2')]].map(([d, l]) => (
            <button key={d} aria-selected={i.uitslag_tot_dag === d} onClick={() => zet(d, i.stand_toon_punten_dag1, i.stand_tab_forceer)}>{l}</button>
          ))}
        </div>
        <label className="vink"><input type="checkbox" checked={!!i.stand_toon_punten_dag1} onChange={(e) => zet(i.uitslag_tot_dag, e.target.checked, i.stand_tab_forceer)} /><span>{txt('Punten ook tonen op dag 1 (op dag 2 altijd)')}</span></label>
        <label className="vink"><input type="checkbox" checked={!!i.stand_tab_forceer} onChange={(e) => zet(i.uitslag_tot_dag, i.stand_toon_punten_dag1, e.target.checked)} /><span>{txt('Tabblad "Stand" altijd tonen, ook als een klas het uit heeft gezet')}</span></label>
      </div>
      <Leagues leagues={leagues} herlaad={herlaad} />
      <UitslagInvoer overzicht={overzicht} />
    </>
  )
}

function Leagues({ leagues, herlaad }) {
  const [naam, setNaam] = useState('')
  const [emoji, setEmoji] = useState('')
  return (
    <div className="card stack">
      <h2>{txt('Leagues')}</h2>
      <p className="note">{txt('Klassen strijden binnen hun eigen league. Deel klassen in via Klassen, Details.')}</p>
      {leagues.map((g) => <LeagueRij key={g.id} g={g} herlaad={herlaad} />)}
      <div className="rij">
        <input className="emoji-in" value={emoji} onChange={(e) => setEmoji(e.target.value)} maxLength={12} placeholder="🏆" aria-label={txt('Emoji')} />
        <input value={naam} onChange={(e) => setNaam(e.target.value)} maxLength={40} placeholder={txt('Naam van de league')} aria-label={txt('Naam')} />
        <button className="btn klein" disabled={!naam.trim()} onClick={async () => { await rootRpc('root_leagues_opslaan', { p_id: null, p_naam: naam, p_emoji: emoji }); setNaam(''); setEmoji(''); herlaad() }}>{txt('Toevoegen')}</button>
      </div>
    </div>
  )
}

function LeagueRij({ g, herlaad }) {
  const [naam, setNaam] = useState(g.naam)
  const [emoji, setEmoji] = useState(g.emoji || '')
  return (
    <div className="rij">
      <input className="emoji-in" value={emoji} onChange={(e) => setEmoji(e.target.value)} maxLength={12} aria-label={txt('Emoji')} />
      <input value={naam} onChange={(e) => setNaam(e.target.value)} maxLength={40} aria-label={txt('Naam')} />
      <button className="btn ghost klein" onClick={async () => { await rootRpc('root_leagues_opslaan', { p_id: g.id, p_naam: naam, p_emoji: emoji }); herlaad() }}>{txt('Opslaan')}</button>
      <button className="btn danger klein" onClick={async () => { if (window.confirm(txt('Deze league verwijderen? De klassen blijven bestaan.'))) { await rootRpc('root_league_verwijderen', { p_id: g.id }); herlaad() } }}>{txt('Verwijderen')}</button>
    </div>
  )
}

// A place per class (1, 2, 2, 4 ... shared places are fine) and optionally the total points.
function UitslagInvoer({ overzicht }) {
  const [dag, setDag] = useState(1)
  const [league, setLeague] = useState('')
  const [rijen, setRijen] = useState([])
  const [w, setW] = useState({})
  const [ok, setOk] = useState(false)
  const [fout, setFout] = useState('')
  const laad = () => rootRpc('root_stand_dag_lijst').then(setRijen)
  useEffect(() => { laad() }, [])
  useEffect(() => {
    setW(Object.fromEntries(rijen.filter((r) => r.dag === dag).map((r) => [r.klas_id, { plaats: String(r.plaats), punten: r.punten ?? '' }])))
    setOk(false)
  }, [dag, rijen])
  const klassen = overzicht.klassen.filter((k) => (league === '' ? true : league === 'geen' ? !k.league_id : k.league_id === league))
  const zet = (id, veld, v) => { setOk(false); setW({ ...w, [id]: { plaats: '', punten: '', ...w[id], [veld]: v } }) }

  async function bewaar() {
    setFout('')
    try {
      const p_rijen = klassen.map((k) => ({ klas_id: k.id, plaats: w[k.id]?.plaats ? Number(w[k.id].plaats) : null, punten: w[k.id]?.punten === '' || w[k.id]?.punten == null ? null : Number(w[k.id].punten) }))
      await rootRpc('root_stand_dag_opslaan', { p_dag: dag, p_rijen })
      await laad()
      setOk(true)
    } catch {
      setFout(txt('Opslaan mislukt. Gebruik hele getallen (plaats 1 of hoger).'))
    }
  }

  return (
    <div className="card stack">
      <h2>{txt('Uitslag invoeren')}</h2>
      <p className="note">{txt('Vul per klas de plaats in (twee klassen mogen dezelfde plaats delen). Punten zijn optioneel. Leeg laten = de klas staat niet in de lijst.')}</p>
      <div className="rij">
        <label className="veld"><span>{txt('Dag')}</span><select value={dag} onChange={(e) => setDag(Number(e.target.value))}><option value={1}>{txt('Dag 1')}</option><option value={2}>{txt('Dag 2')}</option></select></label>
        <label className="veld grow"><span>{txt('League')}</span>
          <select value={league} onChange={(e) => setLeague(e.target.value)}>
            <option value="">{txt('Alle klassen')}</option>
            {(overzicht.leagues || []).map((g) => <option key={g.id} value={g.id}>{g.naam}</option>)}
            <option value="geen">{txt('Zonder league')}</option>
          </select>
        </label>
      </div>
      <ul className="vinklijst hoog">
        <li className="rij tussen note"><span>{txt('Klas')}</span><span className="rij"><span className="getal">{txt('Plaats')}</span><span className="getal">{txt('Punten')}</span></span></li>
        {klassen.map((k) => (
          <li key={k.id} className="rij tussen">
            <span>{k.naam}</span>
            <span className="rij">
              <input className="getal" type="number" min="1" step="1" value={w[k.id]?.plaats ?? ''} onChange={(e) => zet(k.id, 'plaats', e.target.value)} aria-label={`Plaats ${k.naam}`} />
              <input className="getal" type="number" step="1" value={w[k.id]?.punten ?? ''} onChange={(e) => zet(k.id, 'punten', e.target.value)} aria-label={`Punten ${k.naam}`} />
            </span>
          </li>
        ))}
      </ul>
      {fout && <p className="fout">{fout}</p>}
      {ok && <p className="ok">{txt('✓ Opgeslagen')}</p>}
      <div className="rij">
        <button className="btn" onClick={bewaar}>{txt('Opslaan')}</button>
        <button className="btn ghost" onClick={async () => { if (window.confirm(txt('De plaatsen en totalen van deze dag worden overschreven met de uitkomst van de punten per onderdeel (zie hieronder). Doorgaan?'))) { await rootRpc('root_stand_berekenen', { p_dag: dag }); await laad() } }}>{txt('Berekenen uit onderdeel-punten')}</button>
      </div>
    </div>
  )
}
