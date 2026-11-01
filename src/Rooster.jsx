import { useEffect, useState } from 'react'
import { useData } from './data.jsx'
import { nl } from './strings.js'
import { dagDatum, dagLabel, dagVanVandaag, emoji, isHuidig, nuAmsterdam } from './util.js'
import Modal from './Modal.jsx'
import PrintBlad from './PrintBlad.jsx'

const tijdFormat = new Intl.DateTimeFormat('nl-NL', { hour: '2-digit', minute: '2-digit' })

function useNu() {
  const [nu, setNu] = useState(nuAmsterdam)
  useEffect(() => {
    const t = setInterval(() => setNu(nuAmsterdam()), 30000)
    return () => clearInterval(t)
  }, [])
  return nu
}

export default function Rooster() {
  const { data, laatst } = useData()
  const nu = useNu()
  const eigen = data.leerling_id
  const [wie, setWie] = useState(eigen || 'allen')
  const [dag, setDag] = useState(() => dagVanVandaag(data.instellingen, nuAmsterdam()) || 1)
  const [printen, setPrinten] = useState(false)
  const [infoPopup, setInfoPopup] = useState(false)

  useEffect(() => setWie(eigen || 'allen'), [eigen])

  // personal info pops up once per visit, only for the student themselves
  useEffect(() => {
    if (eigen && data.mijn_info && !sessionStorage.getItem('ks.info_gezien')) {
      sessionStorage.setItem('ks.info_gezien', '1')
      setInfoPopup(true)
    }
  }, [eigen, data.mijn_info])

  const naam = Object.fromEntries(data.leerlingen.map((l) => [l.id, l.naam]))
  const zichtbaar = data.activiteiten
    .filter((a) => a.dag === dag)
    .filter((a) => wie === 'allen' || a.globaal || a.leerlingen.includes(wie))
    .sort((a, b) => a.start.localeCompare(b.start))
  const dagbericht =
    data.dagberichten.find((b) => b.dag === dag && !b.globaal) || data.dagberichten.find((b) => b.dag === dag && b.globaal)

  function voorWie(a) {
    if (a.globaal) return `👥 ${nl.iedereen}`
    if (wie === 'allen') return a.leerlingen.length ? `👥 ${a.leerlingen.map((id) => naam[id]).filter(Boolean).join(', ')}` : ''
    const anderen = a.leerlingen.filter((id) => id !== wie).map((id) => naam[id]).filter(Boolean)
    if (anderen.length === 0) return wie === eigen ? `★ ${nl.alleenJij}` : `★ ${nl.alleen} ${naam[wie] || ''}`
    return `★ ${nl.met}: ${anderen.join(', ')}`
  }

  return (
    <div className="stack">
      <div className="rij">
        <label className="veld grow">
          <span>{nl.roosterVan}</span>
          <select value={wie} onChange={(e) => setWie(e.target.value)}>
            <option value="allen">{nl.heleKlas}</option>
            {data.leerlingen.map((l) => (
              <option key={l.id} value={l.id}>
                {l.naam}
                {l.id === eigen ? ' (jij)' : ''}
              </option>
            ))}
          </select>
        </label>
        <button className="btn ghost klein" onClick={() => setPrinten(true)}>
          🖨️ {nl.printen}
        </button>
      </div>

      <div className="segment" role="tablist">
        {[1, 2].map((d) => (
          <button key={d} role="tab" aria-selected={dag === d} onClick={() => setDag(d)}>
            {dagLabel(dagDatum(data.instellingen, d), d)}
          </button>
        ))}
      </div>

      {dagbericht && <p className="dagbericht">{dagbericht.bericht}</p>}

      {zichtbaar.length === 0 ? (
        <p className="note">{nl.leegDag}</p>
      ) : (
        <ol className="activiteiten">
          {zichtbaar.map((a) => {
            const nuBezig = isHuidig(a, data.instellingen, nu)
            const wiens = voorWie(a)
            return (
              <li key={a.id} className={`activiteit c-${a.kleur}${nuBezig ? ' huidig' : ''}`}>
                <div className="act-tijd">
                  <strong>{a.start}</strong>
                  <span>t/m {a.eind}</span>
                </div>
                <div className="act-body">
                  {nuBezig && <span className="nu-badge">▶ {nl.nuBezig}</span>}
                  <strong>
                    {emoji(a.titel)} {a.titel}
                  </strong>
                  {a.locatie && <span className="meta">📍 {a.locatie}</span>}
                  {a.omschrijving && <span className="meta">{a.omschrijving}</span>}
                  {wiens && <span className="voor">{wiens}</span>}
                </div>
              </li>
            )
          })}
        </ol>
      )}

      {wie === eigen && data.mijn_info && (
        <div className="card info-kaart">
          <strong>🎭 {nl.jouwInfo}</strong>
          <p>{data.mijn_info}</p>
        </div>
      )}

      {laatst && (
        <p className="note">
          {nl.laatstBijgewerkt}: {tijdFormat.format(laatst)}
        </p>
      )}

      {infoPopup && (
        <Modal titel={`🎭 ${nl.jouwInfo}`} onSluit={() => setInfoPopup(false)}>
          <p>{data.mijn_info}</p>
        </Modal>
      )}
      <PrintBlad open={printen} onSluit={() => setPrinten(false)} />
    </div>
  )
}
