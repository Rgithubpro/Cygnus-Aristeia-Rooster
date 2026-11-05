import { useMemo } from 'react'
import { afbeeldingSrc } from './themaModel.js'

// Falling emoji behind the page. Hidden for people who prefer reduced motion (see styles.css).
function EmojiRegen({ emojis, aantal }) {
  const deeltjes = useMemo(
    () =>
      Array.from({ length: aantal }, (_, i) => ({
        e: emojis[i % emojis.length],
        links: Math.round(((i * 37) % 100) + (i % 3) * 2),
        duur: 9 + ((i * 7) % 9),
        vertraging: -((i * 5) % 14),
        grootte: 1.2 + ((i * 3) % 10) / 10,
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [emojis.join('|'), aantal],
  )
  return (
    <div className="emoji-regen" aria-hidden="true">
      {deeltjes.map((d, i) => (
        <span key={i} style={{ left: `${d.links % 100}%`, animationDuration: `${d.duur}s`, animationDelay: `${d.vertraging}s`, fontSize: `${d.grootte}rem` }}>
          {d.e}
        </span>
      ))}
    </div>
  )
}

// A row of the class emoji under the header.
export function EmojiStrook({ thema }) {
  const emojis = thema?.emojis || []
  if (!thema?.emoji_strook || emojis.length === 0) return null
  const rij = Array.from({ length: 24 }, (_, i) => emojis[i % emojis.length])
  return (
    <div className="emoji-strook" aria-hidden="true">
      {rij.join(' ')}
    </div>
  )
}

// Rain + mascot. The background pattern is a CSS variable (see themaModel.js).
export default function Decoratie({ thema }) {
  const emojis = thema?.emojis || []
  const regen = thema?.emoji_regen && thema.emoji_regen !== 'uit' && emojis.length > 0
  const mascotte = afbeeldingSrc(thema, 'mascotte')
  const positie = thema?.mascotte_positie || 'rechtsonder'
  return (
    <>
      {regen && <EmojiRegen emojis={emojis} aantal={thema.emoji_regen === 'veel' ? 22 : 9} />}
      {mascotte && positie !== 'uit' && <img className={`mascotte ${positie}`} src={mascotte} alt="" aria-hidden="true" />}
    </>
  )
}
