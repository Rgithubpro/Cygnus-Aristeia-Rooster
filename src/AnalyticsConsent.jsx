import { useEffect, useState } from 'react'
import {
  analyticsConfigured,
  stuurPaginaweergave,
  zetAnalyticsToestemming,
  useAnalyticsToestemming,
} from './analytics.js'
import Modal from './Modal.jsx'

export function AnalyticsConsentPrompt() {
  const [melding, setMelding] = useState('')
  const [klaar, setKlaar] = useState(false)

  function kies(keuze) {
    if (!zetAnalyticsToestemming(keuze)) {
      if (keuze === 'denied') setKlaar(true)
      else setMelding('Je keuze kon niet worden opgeslagen. Analytics blijft uit; je kunt verder zonder toestemming te geven.')
      return
    }
    if (keuze === 'denied') setKlaar(true)
  }

  if (klaar) return null

  return (
    <Modal titel="📊 Gebruik meten?" onSluit={() => kies('denied')}>
      <p>
        Met Google Analytics kan de organisatie zien hoe vaak algemene onderdelen van Aristeia worden geopend. Dit is
        optioneel. Alleen als je toestemt, wordt de Google-tag geladen; Google kan dan technische browsergegevens
        verwerken en analyticscookies plaatsen.
      </p>
      <p>
        We delen de klascode, je rol (leerling of beheerder) en welke algemene pagina of beheersectie je opent. We delen
        geen namen, leerlinggegevens, roosters, sessiegegevens of inhoud. Google ontvangt wel technische
        browsergegevens. Je keuze wordt op dit apparaat bewaard en je kunt die later aanpassen bij Instellingen.
      </p>
      <div className="rij">
        <button className="btn ghost" onClick={() => kies('denied')}>Niet toestaan</button>
        <button className="btn" onClick={() => kies('granted')}>Toestaan</button>
      </div>
      {melding && <p className="banner" role="status">{melding}</p>}
    </Modal>
  )
}

export function AnalyticsTabWeergave({ tab, klasSlug, rol }) {
  const toestemming = useAnalyticsToestemming()

  useEffect(() => {
    if (toestemming === 'granted') stuurPaginaweergave(tab, klasSlug, rol)
  }, [tab, klasSlug, rol, toestemming])

  return null
}

export function AnalyticsBeheer() {
  const toestemming = useAnalyticsToestemming()
  const [melding, setMelding] = useState('')

  if (!analyticsConfigured()) {
    return (
      <section className="card stack">
        <h3>Privacy en gebruiksstatistieken</h3>
        <p className="note">Google Analytics is niet ingesteld. Er worden geen gebruiksgegevens gemeten.</p>
      </section>
    )
  }

  const status = toestemming === 'granted'
    ? 'Toestemming gegeven.'
    : toestemming === 'denied'
      ? 'Toestemming geweigerd.'
      : 'Je hebt nog geen keuze gemaakt; er worden geen gegevens gemeten.'

  return (
    <section className="card stack">
      <div>
        <h3>Privacy en gebruiksstatistieken</h3>
        <p className="note">
          {status} De klascode, rol en bezochte tab- of beheersectie worden gemeten; namen en inhoud niet. Google kan
          technische browsergegevens verwerken.
        </p>
      </div>
      <label className="vink">
        <input
          type="checkbox"
          checked={toestemming === 'granted'}
          onChange={(e) => {
            const opgeslagen = zetAnalyticsToestemming(e.target.checked ? 'granted' : 'denied')
            setMelding(opgeslagen ? '' : 'Je keuze kon niet op dit apparaat worden opgeslagen.')
          }}
        />
        <span>Gebruik delen met Google Analytics toestaan</span>
      </label>
      {melding && <p className="banner" role="status">{melding}</p>}
    </section>
  )
}
