import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { txt } from './t.js'

// Rendered directly on <body> so a popup always covers the whole screen, whatever it is opened from.
export default function Modal({ titel, onSluit, children }) {
  useEffect(() => {
    const op = (e) => e.key === 'Escape' && onSluit()
    document.addEventListener('keydown', op)
    return () => document.removeEventListener('keydown', op)
  }, [onSluit])

  return createPortal(
    <div className="modal" role="dialog" aria-modal="true" aria-label={titel} onClick={onSluit}>
      <div className="modal-kaart stack" onClick={(e) => e.stopPropagation()}>
        {titel && <h2>{titel}</h2>}
        {children}
        <button className="btn ghost" onClick={onSluit}>
          {txt('Sluiten')}
        </button>
      </div>
    </div>,
    document.body,
  )
}
