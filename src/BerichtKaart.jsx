import { useState } from 'react'
import { afbeeldingUrl } from './config.js'
import { nl } from './strings.js'
import Modal from './Modal.jsx'
import TekstMetLinks from './TekstMetLinks.jsx'

export default function BerichtKaart({ b, acties }) {
  const [groot, setGroot] = useState(false)
  return (
    <li className="card stack klein-gap">
      <div className="section-head">
        <h3>{b.titel}</h3>
        <span className="rij">
          {!b.gepubliceerd && <span className="tag">{nl.concept}</span>}
          {b.globaal && <span className="tag">{nl.voorIedereen}</span>}
        </span>
      </div>
      {b.afbeelding_pad && (
        <button className="plaatje" onClick={() => setGroot(true)} aria-label={b.titel}>
          <img src={afbeeldingUrl(b.afbeelding_pad)} alt="" loading="lazy" />
        </button>
      )}
      {b.tekst && <TekstMetLinks tekst={b.tekst} />}
      <p className="note">{b.tijd}</p>
      {acties}
      {groot && (
        <Modal titel={b.titel} onSluit={() => setGroot(false)}>
          <img className="groot" src={afbeeldingUrl(b.afbeelding_pad)} alt={b.titel} />
        </Modal>
      )}
    </li>
  )
}
