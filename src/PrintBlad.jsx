import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useData } from './data.jsx'
import { nl } from './strings.js'
import { dagDatum, dagLabel } from './util.js'
import Modal from './Modal.jsx'

export default function PrintBlad({ open, onSluit }) {
  const { data } = useData()
  const [gekozen, setGekozen] = useState([])
  const [afdruk, setAfdruk] = useState(null)

  useEffect(() => {
    if (open) setGekozen(data.leerling_id ? [data.leerling_id] : [])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  useEffect(() => {
    if (!afdruk) return
    const klaar = () => setAfdruk(null)
    window.addEventListener('afterprint', klaar, { once: true })
    const t = setTimeout(() => window.print(), 80)
    return () => clearTimeout(t)
  }, [afdruk])

  const wissel = (id) => setGekozen((g) => (g.includes(id) ? g.filter((x) => x !== id) : [...g, id]))
  const naam = Object.fromEntries(data.leerlingen.map((l) => [l.id, l.naam]))

  function voor(a, id) {
    if (a.globaal) return nl.iedereen
    const anderen = a.leerlingen.filter((x) => x !== id).map((x) => naam[x]).filter(Boolean)
    return anderen.length ? `${nl.met}: ${anderen.join(', ')}` : nl.alleen
  }

  return (
    <>
      {open && (
        <Modal titel={nl.printTitel} onSluit={onSluit}>
          <p className="note">{nl.printUitleg}</p>
          <div className="rij">
            <button className="btn ghost klein" onClick={() => setGekozen(data.leerlingen.map((l) => l.id))}>
              {nl.iedereen}
            </button>
            <button className="btn ghost klein" onClick={() => setGekozen([])}>
              {nl.niemand}
            </button>
          </div>
          <ul className="vinklijst">
            {data.leerlingen.map((l) => (
              <li key={l.id}>
                <label>
                  <input type="checkbox" checked={gekozen.includes(l.id)} onChange={() => wissel(l.id)} />
                  <span>{l.naam}</span>
                </label>
              </li>
            ))}
          </ul>
          <button
            className="btn"
            disabled={gekozen.length === 0}
            onClick={() => {
              setAfdruk(gekozen)
              onSluit()
            }}
          >
            🖨️ {nl.printen}
          </button>
        </Modal>
      )}
      {afdruk &&
        createPortal(
          <div id="print-area">
            {afdruk.map((id) => (
              <section key={id} className="print-pagina">
                <h1>
                  {nl.roosterPrintTitel}: {naam[id]} ({data.klas.naam})
                </h1>
                {[1, 2].map((d) => {
                  const items = data.activiteiten
                    .filter((a) => a.dag === d && (a.globaal || a.leerlingen.includes(id)))
                    .sort((a, b) => a.start.localeCompare(b.start))
                  return (
                    <div key={d}>
                      <h2>{dagLabel(dagDatum(data.instellingen, d), d)}</h2>
                      {items.length === 0 ? (
                        <p>{nl.geenActiviteiten}</p>
                      ) : (
                        <table>
                          <thead>
                            <tr>
                              <th>{nl.tijd}</th>
                              <th>{nl.activiteit}</th>
                              <th>{nl.locatie}</th>
                              <th>{nl.voor}</th>
                            </tr>
                          </thead>
                          <tbody>
                            {items.map((a) => (
                              <tr key={a.id}>
                                <td>
                                  {a.start} – {a.eind}
                                </td>
                                <td>{a.titel}</td>
                                <td>{a.locatie}</td>
                                <td>{voor(a, id)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>
                  )
                })}
              </section>
            ))}
          </div>,
          document.body,
        )}
    </>
  )
}
