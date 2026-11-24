import { useEffect, useState } from 'react'
import {
  analyticsConfigured,
  stuurPaginaweergave,
  zetAnalyticsToestemming,
  useAnalyticsToestemming,
} from './analytics.js'
import Modal from './Modal.jsx'
import { txt } from './t.js'

export function AnalyticsConsentPrompt() {
  const [melding, setMelding] = useState('')
  const [klaar, setKlaar] = useState(false)
  const [details, setDetails] = useState(false)

  function kies(keuze) {
    if (!zetAnalyticsToestemming(keuze)) {
      if (keuze === 'denied') {
        setKlaar(true)
        return
      }
      setMelding(txt('Je keuze kon niet worden opgeslagen. Analytics blijft uit; je kunt de app gewoon blijven gebruiken.'))
      return
    }
  }

  if (klaar) return null

  return (
    <>
      <aside className="analytics-consent" aria-label={txt('Cookie- en analyticskeuze')}>
        <div className="stack klein-gap">
          <strong>{txt('Cookies en gebruiksstatistieken')}</strong>
          <p>
            {txt('We willen graag meten welke onderdelen van Aristeia worden gebruikt. Dat is optioneel: zonder jouw toestemming meten we niets.')}
            {' '}
            <button className="link" type="button" onClick={() => setDetails(true)}>
              {txt('Lees wat we meten en hoe het werkt')}
            </button>
          </p>
          {melding && <p className="banner" role="status">{melding}</p>}
          <div className="rij">
            <button className="btn ghost klein" onClick={() => kies('denied')}>{txt('Weigeren')}</button>
            <button className="btn klein" onClick={() => kies('granted')}>{txt('Toestaan')}</button>
          </div>
        </div>
      </aside>
      {details && <AnalyticsPrivacyNotice onSluit={() => setDetails(false)} />}
    </>
  )
}

function AnalyticsPrivacyNotice({ onSluit }) {
  return (
    <Modal titel={txt('Cookies en gebruiksstatistieken')} onSluit={onSluit}>
      <p>
        {txt('Aristeia kan Google Analytics gebruiken om te begrijpen welke onderdelen van de app worden geopend. Dit helpt de organisatie de app te verbeteren. Analytics is optioneel en staat standaard uit totdat je toestemming geeft. De app werkt ook als je weigert.')}
      </p>

      <h3>{txt('Wat wordt gedeeld?')}</h3>
      <p>{txt('Na toestemming stuurt de app de volgende gebeurtenissen naar Google Analytics:')}</p>
      <ul>
        <li>
          <code>{txt('page_view')}</code>{txt(': de algemene tabnaam, zoals Rooster of Info, de bijbehorende interne paginatitel en app-paden zoals')} <code>{txt('/app/rooster')}</code>{txt(', plus de klascode en je rol (leerling of beheerder).')}
        </li>
        <li>
          <code>{txt('admin_page_view')}</code>{txt(': de naam van een beheersectie, zoals Activiteiten of Leerlingen, plus de klascode en de rol beheerder.')}
        </li>
      </ul>
      <p>
        {txt('De app verstuurt geen naam, leerling-ID, sessietoken, rooster, inhoud of echte klasroute. Een klascode kan desondanks herkenbaar zijn voor de organisatie.')}
      </p>

      <h3>{txt('Cookies en gegevens van Google')}</h3>
      <p>
        {txt('Pas nadat je toestemt, laadt de app de Google Analytics-tag. Google kan daarbij analyticscookies en vergelijkbare browseropslag gebruiken en technische gegevens over browser, apparaat en gebruik verwerken. Die gegevens worden door Google verwerkt volgens de voorwaarden en het privacybeleid van Google. De organisatie kan mogelijk rapporten bekijken met klascode, rol en bezochte onderdelen; Analytics geeft geen naam door vanuit Aristeia.')}
      </p>

      <h3>{txt('Je keuze aanpassen')}</h3>
      <p>
        {txt('Je keuze wordt alleen in de opslag van deze browser op dit apparaat bewaard en is niet gekoppeld aan je account. Je kunt toestemming later intrekken of alsnog geven bij Instellingen → Privacy en gebruiksstatistieken. Intrekken stopt toekomstige metingen op dit apparaat, maar verwijdert niet automatisch gegevens die Google al heeft ontvangen.')}
      </p>

      <p>
        <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer">
          {txt('Lees het privacybeleid van Google')}
        </a>
      </p>
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
        <h3>{txt('Privacy en gebruiksstatistieken')}</h3>
        <p className="note">{txt('Google Analytics is niet ingesteld. Er worden geen gebruiksgegevens gemeten.')}</p>
      </section>
    )
  }

  const status = toestemming === 'granted'
    ? txt('Toestemming gegeven.')
    : toestemming === 'denied'
      ? txt('Toestemming geweigerd.')
      : txt('Je hebt nog geen keuze gemaakt; er worden geen gegevens gemeten.')

  return (
    <section className="card stack">
      <div>
        <h3>{txt('Privacy en gebruiksstatistieken')}</h3>
        <p className="note">
          {status} {txt('De klascode, rol en bezochte tab- of beheersectie worden gemeten; namen en inhoud niet. Google kan technische browsergegevens verwerken.')}
        </p>
      </div>
      <label className="vink">
        <input
          type="checkbox"
          checked={toestemming === 'granted'}
          onChange={(e) => {
            const opgeslagen = zetAnalyticsToestemming(e.target.checked ? 'granted' : 'denied')
            setMelding(opgeslagen ? '' : txt('Je keuze kon niet op dit apparaat worden opgeslagen.'))
          }}
        />
        <span>{txt('Gebruik delen met Google Analytics toestaan')}</span>
      </label>
      {melding && <p className="banner" role="status">{melding}</p>}
    </section>
  )
}
