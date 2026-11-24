import { useState } from 'react'
import { afbeeldingUrl } from './config.js'
import Modal from './Modal.jsx'
import TekstMetLinks from './TekstMetLinks.jsx'
import { txt } from './t.js'

export default function BerichtKaart({ b, acties }) {
  const [groot, setGroot] = useState(false)
  return (
    <li className="card stack klein-gap">
      <div className="section-head">
        <h3>{b.titel}</h3>
        <span className="rij">
          {!b.gepubliceerd && <span className="tag">{txt('Concept')}</span>}
          {b.globaal && <span className="tag">{txt('Voor iedereen')}</span>}
        </span>
      </div>
      {b.afbeelding_pad && (
        <button className="plaatje" onClick={() => setGroot(true)} aria-label={b.titel}>
          <img crossOrigin="anonymous" src={afbeeldingUrl(b.afbeelding_pad)} alt="" loading="lazy" />
        </button>
      )}
      {b.tekst && <TekstMetLinks tekst={b.tekst} />}
      <p className="note">{b.tijd}</p>
      {acties}
      {groot && (
        <Modal titel={b.titel} onSluit={() => setGroot(false)}>
          <img crossOrigin="anonymous" className="groot" src={afbeeldingUrl(b.afbeelding_pad)} alt={b.titel} />
        </Modal>
      )}
    </li>
  )
}
