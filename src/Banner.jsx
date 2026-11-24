import { useState } from 'react'
import { txt } from './t.js'

// System message set by Root (for example maintenance). Can be closed for this visit.
export default function Banner({ banner }) {
  const sleutel = banner ? `ks.banner.${banner.titel}.${banner.tekst}` : ''
  const [dicht, setDicht] = useState(() => !!sleutel && sessionStorage.getItem(sleutel) === '1')
  if (!banner?.actief || dicht || (!banner.titel && !banner.tekst)) return null
  return (
    <div className="banner systeem" role="status">
      <div className="grow">
        {banner.titel && <strong>{banner.titel}</strong>}
        {banner.tekst && <div>{banner.tekst}</div>}
      </div>
      <button
        className="btn ghost klein"
        aria-label={txt('Melding sluiten')}
        onClick={() => {
          sessionStorage.setItem(sleutel, '1')
          setDicht(true)
        }}
      >
        ✕
      </button>
    </div>
  )
}
