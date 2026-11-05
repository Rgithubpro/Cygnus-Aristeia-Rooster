import { useState } from 'react'
import { nl } from './strings.js'
import { splitLinks } from './util.js'
import Modal from './Modal.jsx'

// Shows text as plain text. http(s) links become buttons that ask before opening.
export default function TekstMetLinks({ tekst }) {
  const [link, setLink] = useState(null)
  return (
    <p className="tekst">
      {splitLinks(tekst).map((d, i) =>
        d.type === 'link' ? (
          <button key={i} className="link" onClick={() => setLink(d.waarde)}>
            {d.waarde}
          </button>
        ) : (
          <span key={i}>{d.waarde}</span>
        ),
      )}
      {link && (
        <Modal titel={`🔗 ${nl.externeLink}`} onSluit={() => setLink(null)}>
          <p className="woord-af">{link}</p>
          <p>{nl.linkVraag}</p>
          <button
            className="btn"
            onClick={() => {
              window.open(link, '_blank', 'noopener,noreferrer')
              setLink(null)
            }}
          >
            {nl.jaGaDoor}
          </button>
        </Modal>
      )}
    </p>
  )
}
