import { useState } from 'react'

const KEUZES = ['⭐', '🔥', '🌈', '🎉', '🏆', '💪', '🐉', '🦄', '🐯', '🦊', '🐼', '🦁', '⚡', '🚀', '🎯', '🎵', '❤️', '💎', '🌟', '🍀', '🌸', '🍕', '⚽', '🏀', '🎮', '🎨', '👑', '🦋', '🌊', '☀️']

// A list of up to 5 emoji (for the emoji strip and the emoji rain).
export default function EmojiLijst({ label, waarde = [], onWijzig, max = 5 }) {
  const [eigen, setEigen] = useState('')
  const voeg = (e) => {
    const x = e.trim()
    if (x && waarde.length < max) onWijzig([...waarde, x.slice(0, 12)])
  }
  return (
    <div className="veld">
      <span>
        {label} ({waarde.length}/{max})
      </span>
      <div className="rij">
        {waarde.map((e, i) => (
          <button type="button" key={i} className="emoji-chip" onClick={() => onWijzig(waarde.filter((_, j) => j !== i))} aria-label={`${e} verwijderen`}>
            {e} ✕
          </button>
        ))}
        {waarde.length === 0 && <small className="note">Nog geen emoji gekozen</small>}
      </div>
      <div className="rij">
        <input className="emoji-in" value={eigen} maxLength={12} onChange={(e) => setEigen(e.target.value)} aria-label="Eigen emoji" placeholder="🙂" />
        <button type="button" className="btn ghost klein" disabled={!eigen.trim() || waarde.length >= max} onClick={() => { voeg(eigen); setEigen('') }}>
          Toevoegen
        </button>
      </div>
      <div className="emoji-rooster">
        {KEUZES.map((e) => (
          <button type="button" key={e} onClick={() => voeg(e)} disabled={waarde.length >= max} aria-label={e}>
            {e}
          </button>
        ))}
      </div>
    </div>
  )
}
