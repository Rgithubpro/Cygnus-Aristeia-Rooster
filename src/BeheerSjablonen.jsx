import { useEffect, useState } from 'react'
import { rpc } from './api.js'
import { useData } from './data.jsx'
import { nl } from './strings.js'
import { dagDatum, dagLabel, emoji } from './util.js'

// Example roosters made by the organisers. Pick parts (or a whole example), then only add your students.
export default function BeheerSjablonen({ sessie }) {
  const { data, ververs } = useData()
  const [lijst, setLijst] = useState(null)
  const [gekozen, setGekozen] = useState([])
  const [iedereen, setIedereen] = useState(false)
  const [bericht, setBericht] = useState('')
  const [fout, setFout] = useState('')

  const laad = () => rpc('sjablonen_voor_klas', { p_token: sessie.token }).then(setLijst).catch(() => setLijst([]))
  useEffect(() => { laad() }, []) // eslint-disable-line react-hooks/exhaustive-deps
  if (!lijst || lijst.length === 0) return null

  const wissel = (id) => setGekozen((g) => (g.includes(id) ? g.filter((x) => x !== id) : [...g, id]))
  async function voegToe(ids) {
    setFout('')
    setBericht('')
    try {
      const r = await rpc('sjabloon_gebruiken', { p_token: sessie.token, p_item_ids: ids, p_iedereen: iedereen })
      setBericht(`${r.toegevoegd} activiteit(en) toegevoegd. Je vindt ze hieronder; voeg daar je leerlingen toe.`)
      setGekozen([])
      await laad()
      await ververs()
    } catch (e) {
      setFout(nl.fouten[e.code] || nl.laadFout)
    }
  }

  return (
    <details className="card stack sjablonen" open={lijst.some((j) => j.items.some((i) => !i.gebruikt))}>
      <summary><strong>📋 Voorbeeldroosters van de organisatie ({lijst.length})</strong></summary>
      <p className="note">Kies de onderdelen die je wilt gebruiken. Ze worden gekopieerd naar jouw klas, daarna kun je ze aanpassen en je leerlingen toevoegen.</p>
      <label className="vink">
        <input type="checkbox" checked={iedereen} onChange={(e) => setIedereen(e.target.checked)} />
        <span>Meteen alle leerlingen van mijn klas bij de onderdelen zetten</span>
      </label>
      {lijst.map((j) => {
        const nieuw = j.items.filter((i) => !i.gebruikt)
        return (
          <div key={j.id} className="stack klein-gap sjabloon">
            <strong>{j.naam}</strong>
            {j.beschrijving && <span className="note">{j.beschrijving}</span>}
            <ul className="vinklijst">
              {j.items.map((i) => (
                <li key={i.id}>
                  <label>
                    <input type="checkbox" disabled={i.gebruikt} checked={i.gebruikt || gekozen.includes(i.id)} onChange={() => wissel(i.id)} />
                    <span>
                      {i.emoji || emoji(i.titel)} {i.titel}{' '}
                      <small className="note">
                        {dagLabel(dagDatum(data.instellingen, i.dag), i.dag)}, {i.start} – {i.eind}
                        {i.locatie ? `, ${i.locatie}` : ''}
                        {i.gebruikt ? ' (al toegevoegd)' : ''}
                      </small>
                    </span>
                  </label>
                </li>
              ))}
            </ul>
            <div className="rij">
              <button className="btn klein" disabled={nieuw.length === 0} onClick={() => voegToe(nieuw.map((i) => i.id))}>
                Alles toevoegen ({nieuw.length})
              </button>
            </div>
          </div>
        )
      })}
      <button className="btn" disabled={gekozen.length === 0} onClick={() => voegToe(gekozen)}>
        Geselecteerde toevoegen ({gekozen.length})
      </button>
      {bericht && <p className="ok" role="status">✓ {bericht}</p>}
      {fout && <p className="fout">{fout}</p>}
    </details>
  )
}
