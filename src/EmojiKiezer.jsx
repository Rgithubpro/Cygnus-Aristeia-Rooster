import { nl } from './strings.js'

const KEUZES = ['⚽', '🏀', '🏐', '🏑', '🏓', '🥏', '🏃', '🪢', '🧠', '🎤', '🎸', '💃', '🎮', '♟️', '🔐', '🎨', '📸', '🍕', '☕', '🎉',
  '🏆', '🥇', '⭐', '🔥', '💪', '🎯', '🧩', '🎲', '🎬', '📚', '🧪', '🚴', '🏊', '🤸', '🎳', '🏹', '🛹', '🎭', '🌈', '🐉']

// Free text field (use your phone's emoji keyboard) plus quick picks.
export default function EmojiKiezer({ label, waarde, onKies, auto = false }) {
  return (
    <div className="veld">
      <span>{label}</span>
      <div className="rij">
        <input className="emoji-in" value={waarde} maxLength={12} onChange={(e) => onKies(e.target.value)} aria-label={label} />
        {auto && (
          <button type="button" className="btn ghost klein" onClick={() => onKies('')}>
            {nl.emojiAuto}
          </button>
        )}
      </div>
      <div className="emoji-rooster">
        {KEUZES.map((e) => (
          <button type="button" key={e} onClick={() => onKies(e)} aria-label={e}>
            {e}
          </button>
        ))}
      </div>
    </div>
  )
}
