import { useEffect, useState } from 'react'
import { rpc } from './api.js'
import { useData } from './data.jsx'
import { dagDatum, dagLabel, emoji } from './util.js'
import { foutTekst, txt } from './t.js'

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
      setBericht(txt('{toegevoegd} activiteit(en) toegevoegd. Je vindt ze hieronder; voeg daar je leerlingen toe.', { toegevoegd: r.toegevoegd }))
      setGekozen([])
      await laad()
      await ververs()
    } catch (e) {
      setFout(foutTekst(e.code) || txt('Er ging iets mis. Controleer je verbinding en probeer het opnieuw.'))
    }
  }

  return (
    <details className="card stack sjablonen" open={lijst.some((j) => j.items.some((i) => !i.gebruikt))}>
      <summary>
        <strong>{txt('📋 Voorbeeldroosters van de organisatie (')}{lijst.length})</strong>
      </summary>
      <p className="note">{txt('Kies de onderdelen die je wilt gebruiken. Ze worden gekopieerd naar jouw klas, daarna kun je ze aanpassen en je leerlingen toevoegen.')}</p>
      <label className="vink">
        <input type="checkbox" checked={iedereen} onChange={(e) => setIedereen(e.target.checked)} />
        <span>{txt('Meteen alle leerlingen van mijn klas bij de onderdelen zetten')}</span>
      </label>

      {lijst.map((j) => {
        const nieuw = j.items.filter((i) => !i.gebruikt)
        const mijn = nieuw.filter((i) => gekozen.includes(i.id))
        return (
          <section key={j.id} className="sjabloon stack klein-gap">
            <div>
              <strong>{j.naam}</strong>
              {j.beschrijving && <p className="note">{j.beschrijving}</p>}
            </div>
            <ul className="sj-lijst">
              {j.items.map((i) => (
                <li key={i.id}>
                  <label className={`sj-item${i.gebruikt ? ' gebruikt' : ''}`}>
                    <input type="checkbox" disabled={i.gebruikt} checked={i.gebruikt || gekozen.includes(i.id)} onChange={() => wissel(i.id)} />
                    <span className="sj-tekst">
                      <strong>
                        {i.emoji || emoji(i.titel)} {i.titel}
                      </strong>
                      <small className="note">
                        {dagLabel(dagDatum(data.instellingen, i.dag), i.dag)}, {i.start} – {i.eind}
                        {i.locatie ? `, ${i.locatie}` : ''}
                      </small>
                    </span>
                    {i.gebruikt && <span className="tag">{txt('Al toegevoegd')}</span>}
                  </label>
                </li>
              ))}
            </ul>
            <div className="sj-acties">
              <button className="btn ghost" disabled={nieuw.length === 0} onClick={() => voegToe(nieuw.map((i) => i.id))}>
                {txt('Alles toevoegen (')}{nieuw.length})
              </button>
              <button className="btn" disabled={mijn.length === 0} onClick={() => voegToe(mijn.map((i) => i.id))}>
                {txt('Geselecteerde toevoegen (')}{mijn.length})
              </button>
            </div>
          </section>
        )
      })}
      {bericht && <p className="ok" role="status">✓ {bericht}</p>}
      {fout && <p className="fout">{fout}</p>}
    </details>
  )
}
