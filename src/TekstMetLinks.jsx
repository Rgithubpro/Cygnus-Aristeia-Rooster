import { useState } from 'react'
import { splitLinks } from './util.js'
import Modal from './Modal.jsx'
import { txt } from './t.js'

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
        <Modal titel={`🔗 ${txt('Externe link')}`} onSluit={() => setLink(null)}>
          <p className="woord-af">{link}</p>
          <p>{txt('Wil je doorgaan naar deze site?')}</p>
          <button
            className="btn"
            onClick={() => {
              window.open(link, '_blank', 'noopener,noreferrer')
              setLink(null)
            }}
          >
            {txt('Ja, ga door')}
          </button>
        </Modal>
      )}
    </p>
  )
}

// A link with its own title (class page). Opens only after a confirmation.
export function LinkKnop({ url, tekst }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button className="btn ghost link-knop" onClick={() => setOpen(true)}>
        🔗 {tekst || url}
      </button>
      {open && (
        <Modal titel={`🔗 ${txt('Externe link')}`} onSluit={() => setOpen(false)}>
          <p className="woord-af">{url}</p>
          <p>{txt('Wil je doorgaan naar deze site?')}</p>
          <button
            className="btn"
            onClick={() => {
              window.open(url, '_blank', 'noopener,noreferrer')
              setOpen(false)
            }}
          >
            {txt('Ja, ga door')}
          </button>
        </Modal>
      )}
    </>
  )
}
