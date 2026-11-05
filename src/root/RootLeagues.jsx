import { useEffect, useState } from 'react'
import { rootRpc } from './client.js'

// Standings control: what students see (day 1 = top N per league, day 2 = everyone), the leagues, and quick point entry.
export default function RootLeagues({ overzicht, herlaad }) {
  const i = overzicht.instellingen
  const leagues = overzicht.leagues || []
  const [top, setTop] = useState(i.stand_top_aantal ?? 3)
  const [punten, setPunten] = useState(i.stand_toon_punten_dag1 ?? true)
  const zichtbaar = async (dag) => {
    await rootRpc('root_stand_opslaan', { p_dag: dag, p_top: Number(top) || 3, p_punten: punten })
    herlaad()
  }
  return (
    <>
      <div className="card stack">
        <h2>Zichtbaar voor leerlingen</h2>
        <p className="note">De database geeft alleen vrij wat hier is gekozen. Dag 1: de beste klassen per league. Dag 2: alle klassen met punten.</p>
        <div className="segment">
          {[[0, 'Niets'], [1, 'Dag 1 (top)'], [2, 'Dag 2 (alles)']].map(([d, l]) => (
            <button key={d} aria-selected={i.uitslag_tot_dag === d} onClick={() => zichtbaar(d)}>{l}</button>
          ))}
        </div>
        <div className="rij">
          <label className="veld"><span>Aantal klassen in de top (dag 1)</span><input className="getal" type="number" min="1" max="10" value={top} onChange={(e) => setTop(e.target.value)} onBlur={() => zichtbaar(i.uitslag_tot_dag)} /></label>
          <label className="vink"><input type="checkbox" checked={punten} onChange={(e) => { setPunten(e.target.checked); rootRpc('root_stand_opslaan', { p_dag: i.uitslag_tot_dag, p_top: Number(top) || 3, p_punten: e.target.checked }).then(herlaad) }} /><span>Punten tonen op dag 1</span></label>
        </div>
      </div>
      <Leagues leagues={leagues} herlaad={herlaad} />
      <SnelleInvoer overzicht={overzicht} />
    </>
  )
}

function Leagues({ leagues, herlaad }) {
  const [naam, setNaam] = useState('')
  const [emoji, setEmoji] = useState('')
  return (
    <div className="card stack">
      <h2>Leagues</h2>
      <p className="note">Klassen strijden binnen hun eigen league (bijvoorbeeld twee leerjaren). Deel klassen in via Klassen, Details.</p>
      {leagues.map((g) => (
        <LeagueRij key={g.id} g={g} herlaad={herlaad} />
      ))}
      <div className="rij">
        <input className="emoji-in" value={emoji} onChange={(e) => setEmoji(e.target.value)} maxLength={12} placeholder="🏆" aria-label="Emoji" />
        <input value={naam} onChange={(e) => setNaam(e.target.value)} maxLength={40} placeholder="Naam van de league" aria-label="Naam" />
        <button className="btn klein" disabled={!naam.trim()} onClick={async () => { await rootRpc('root_leagues_opslaan', { p_id: null, p_naam: naam, p_emoji: emoji }); setNaam(''); setEmoji(''); herlaad() }}>Toevoegen</button>
      </div>
    </div>
  )
}

function LeagueRij({ g, herlaad }) {
  const [naam, setNaam] = useState(g.naam)
  const [emoji, setEmoji] = useState(g.emoji || '')
  return (
    <div className="rij">
      <input className="emoji-in" value={emoji} onChange={(e) => setEmoji(e.target.value)} maxLength={12} aria-label="Emoji" />
      <input value={naam} onChange={(e) => setNaam(e.target.value)} maxLength={40} aria-label="Naam" />
      <button className="btn ghost klein" onClick={async () => { await rootRpc('root_leagues_opslaan', { p_id: g.id, p_naam: naam, p_emoji: emoji }); herlaad() }}>Opslaan</button>
      <button className="btn danger klein" onClick={async () => { if (window.confirm('Deze league verwijderen? De klassen blijven bestaan.')) { await rootRpc('root_league_verwijderen', { p_id: g.id }); herlaad() } }}>Verwijderen</button>
    </div>
  )
}

// One number per class per day (stored as the game "Totaal"). The per-game entry below stays available.
function SnelleInvoer({ overzicht }) {
  const [dag, setDag] = useState(1)
  const [league, setLeague] = useState('')
  const [rijen, setRijen] = useState([])
  const [w, setW] = useState({})
  const [ok, setOk] = useState(false)
  useEffect(() => { rootRpc('root_punten_lijst').then(setRijen) }, [])
  useEffect(() => {
    setW(Object.fromEntries(rijen.filter((r) => r.dag === dag && r.onderdeel === 'Totaal').map((r) => [r.klas_id, String(r.punten)])))
    setOk(false)
  }, [dag, rijen])
  const klassen = overzicht.klassen.filter((k) => (league === '' ? true : league === 'geen' ? !k.league_id : k.league_id === league))
  async function bewaar() {
    const payload = Object.fromEntries(klassen.map((k) => [k.id, w[k.id] ?? '']))
    await rootRpc('root_punten_opslaan', { p_dag: dag, p_onderdeel: 'Totaal', p_waarden: payload })
    setRijen(await rootRpc('root_punten_lijst'))
    setOk(true)
  }
  return (
    <div className="card stack">
      <h2>Snelle puntentelling</h2>
      <p className="note">Eén getal per klas voor die dag. De stand telt dag 1 en dag 2 bij elkaar op.</p>
      <div className="rij">
        <label className="veld"><span>Dag</span><select value={dag} onChange={(e) => setDag(Number(e.target.value))}><option value={1}>Dag 1</option><option value={2}>Dag 2</option></select></label>
        <label className="veld grow"><span>League</span>
          <select value={league} onChange={(e) => setLeague(e.target.value)}>
            <option value="">Alle klassen</option>
            {(overzicht.leagues || []).map((g) => <option key={g.id} value={g.id}>{g.naam}</option>)}
            <option value="geen">Zonder league</option>
          </select>
        </label>
      </div>
      <ul className="vinklijst hoog">
        {klassen.map((k) => (
          <li key={k.id} className="rij tussen"><span>{k.weergavenaam || k.naam}</span><input className="getal" type="number" step="1" value={w[k.id] ?? ''} onChange={(e) => { setOk(false); setW({ ...w, [k.id]: e.target.value }) }} aria-label={`Punten ${k.naam}`} /></li>
        ))}
      </ul>
      {ok && <p className="ok">✓ Opgeslagen</p>}
      <button className="btn" onClick={bewaar}>Opslaan</button>
    </div>
  )
}
