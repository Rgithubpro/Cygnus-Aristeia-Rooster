import { rpc } from './api.js'
import { useLive } from './hooks.js'
import { nl } from './strings.js'

const tijdFormat = new Intl.DateTimeFormat('nl-NL', { hour: '2-digit', minute: '2-digit' })

export default function Rooster({ sessie, leerlingId }) {
  const { data, fout, laatst } = useLive(
    `rooster.${leerlingId}`,
    () => rpc('rooster_van', { p_token: sessie.token, p_leerling_id: leerlingId }),
    [leerlingId],
  )

  if (!data) return <p className="note">{fout ? nl.laadFout : nl.laden}</p>
  if (data.length === 0) return <p className="note">{nl.leegRooster}</p>

  return (
    <div className="stack">
      {[1, 2].map((dag) => {
        const items = data.filter((a) => a.dag === dag)
        if (items.length === 0) return null
        return (
          <section key={dag} aria-label={`${nl.dag} ${dag}`}>
            <h3>
              {nl.dag} {dag}
            </h3>
            <ol className="lessons">
              {items.map((a) => (
                <li key={a.id} className="lesson">
                  <span className="time">
                    {a.start} – {a.eind}
                  </span>
                  <span className="what">
                    <strong>{a.titel}</strong>
                    {(a.locatie || a.omschrijving) && (
                      <span className="meta">{[a.locatie, a.omschrijving].filter(Boolean).join(', ')}</span>
                    )}
                  </span>
                </li>
              ))}
            </ol>
          </section>
        )
      })}
      {laatst && (
        <p className="note">
          {nl.laatstBijgewerkt}: {tijdFormat.format(laatst)}
        </p>
      )}
    </div>
  )
}
