import { useId } from 'react'
import { txt } from './t.js'

// A nicely styled "choose a picture" button (the real file input is hidden but stays accessible).
export default function BestandsKnop({ onBestand, bestand, label = txt('Kies een afbeelding'), accept = 'image/jpeg,image/png,image/webp' }) {
  const id = useId()
  return (
    <div className="bestand">
      <input
        id={id}
        className="sr-only"
        type="file"
        accept={accept}
        onChange={(e) => {
          onBestand(e.target.files?.[0] || null)
          e.target.value = ''
        }}
      />
      <label htmlFor={id} className="btn ghost bestand-knop">
        📷 {label}
      </label>
      <span className="note bestand-naam">{bestand ? bestand.name : txt('Nog niets gekozen')}</span>
    </div>
  )
}
