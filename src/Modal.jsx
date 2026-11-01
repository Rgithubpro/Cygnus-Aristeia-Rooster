import { useEffect } from 'react'
import { nl } from './strings.js'

export default function Modal({ titel, onSluit, children }) {
  useEffect(() => {
    const op = (e) => e.key === 'Escape' && onSluit()
    document.addEventListener('keydown', op)
    return () => document.removeEventListener('keydown', op)
  }, [onSluit])

  return (
    <div className="modal" role="dialog" aria-modal="true" aria-label={titel} onClick={onSluit}>
      <div className="modal-kaart stack" onClick={(e) => e.stopPropagation()}>
        {titel && <h2>{titel}</h2>}
        {children}
        <button className="btn ghost" onClick={onSluit}>
          {nl.sluiten}
        </button>
      </div>
    </div>
  )
}
