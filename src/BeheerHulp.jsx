import { useState } from 'react'
import { WIKI_URL } from './config.js'
import { txt } from './t.js'

// Short help for class admins, built into the app so it works offline and always matches this version.
// All wording lives in teksten.js. The long guide (screenshots, FAQ) is on the wiki.

// One or two lines above a Beheer tab; the longer explanation is folded away.
export function HulpTip({ kort, lang }) {
  return (
    <details className="card hulp-tip">
      <summary>💡 {kort}</summary>
      <p className="note">{lang}</p>
    </details>
  )
}

export const TIPS = {
  activiteiten: () => (
    <HulpTip
      kort={txt('Hier maak je het rooster van je klas.')}
      lang={txt('Kies een dag, tijd, plek en wie meedoet. Je kunt alles altijd aanpassen. Met Dupliceren maak je snel een kopie. Zie je een voorbeeldrooster van de organisatie, dan kun je dat overnemen als beginpunt.')}
    />
  ),
  leerlingen: () => (
    <HulpTip
      kort={txt('Hier staat de namenlijst van je klas.')}
      lang={txt('Plak een lijst met één naam per regel, bijvoorbeeld uit Excel. Je ziet wie de app al op een apparaat heeft gekoppeld en wie meldingen aan heeft. Bij Persoonlijke info kun je een leerling een eigen rol of opdracht geven.')}
    />
  ),
  dagberichten: () => (
    <HulpTip
      kort={txt('Eén korte regel bovenaan elke dag.')}
      lang={txt('Bijvoorbeeld "08:30 aanwezig zijn". Je klas ziet dit bovenaan het rooster van die dag. Houd het kort: maximaal 200 tekens.')}
    />
  ),
  info: () => (
    <HulpTip
      kort={txt('Plaats nieuws voor je klas, met een foto als je wilt.')}
      lang={txt('Zet belangrijke dingen altijd ook hier neer, niet alleen in een melding: niet iedereen heeft meldingen aan. Een concept (niet direct publiceren) ziet je klas pas als je het publiceert. Links worden herkend, HTML werkt niet.')}
    />
  ),
  meldingen: () => (
    <HulpTip
      kort={txt('Stuur een pushmelding naar je klas of één leerling.')}
      lang={txt('Alleen apparaten met meldingen aan krijgen het bericht. Op een iPhone werkt dat alleen als de app op het beginscherm staat. Leerlingen krijgen ook automatisch een melding 5 minuten voor hun activiteiten.')}
    />
  ),
  klas: () => (
    <HulpTip
      kort={txt('Maak de app van jouw klas: kleuren, logo, icoon en meer.')}
      lang={txt('Wat je verandert zie je meteen, maar je klas ziet het pas na Opslaan. Kies het app-icoon vóórdat leerlingen de app installeren: een geïnstalleerd icoon kan niet meer veranderen.')}
    />
  ),
}

const STAPPEN = [
  ['leerlingen', () => txt('Voeg je leerlingen toe'), () => txt('Plak de namenlijst, één naam per regel.'), () => txt('Naar Leerlingen')],
  ['activiteiten', () => txt('Maak je activiteiten'), () => txt('Kies dag, tijd, plek en wie meedoet. Gebruik een voorbeeldrooster als dat er is.'), () => txt('Naar Activiteiten')],
  ['klas', () => txt('Maak de app van jouw klas'), () => txt('Kies kleuren, een logo en het app-icoon. Druk daarna op Opslaan.'), () => txt('Naar Uiterlijk')],
  ['delen', () => txt('Deel de link met je klas'), () => txt('Stuur de klaslink en het leerlingwachtwoord. Laat leerlingen de app installeren via de link of QR-code, dan krijgen ze het icoon van je klas.'), null],
  ['meldingen', () => txt('Zet meldingen aan'), () => txt('Vraag je klas om meldingen aan te zetten en probeer zelf een melding. Zo mist niemand het begin van een activiteit.'), () => txt('Naar Meldingen')],
]

export default function BeheerHulp({ sessie, ga }) {
  const [gekopieerd, setGekopieerd] = useState(false)
  const slug = sessie.klas?.slug
  const link = slug ? `${location.origin}/k/${slug}` : location.origin

  async function kopieer() {
    try {
      await navigator.clipboard.writeText(link)
      setGekopieerd(true)
    } catch {
      setGekopieerd(false)
    }
  }

  return (
    <div className="stack">
      <p className="note">{txt('Zo ben je in vijf stappen klaar. Je kunt alles later nog aanpassen.')}</p>
      <ol className="stack lijst-los hulp-stappen">
        {STAPPEN.map(([id, titel, uitleg, knop], i) => (
          <li key={id} className="card stack klein-gap">
            <strong>{i + 1}. {titel()}</strong>
            <span className="meta">{uitleg()}</span>
            {id === 'delen' && (
              <div className="rij">
                <code>{link}</code>
                <button className="btn ghost klein" onClick={kopieer}>
                  {gekopieerd ? txt('✓ Link gekopieerd') : txt('📋 Kopieer de klaslink')}
                </button>
              </div>
            )}
            {knop && (
              <button className="btn ghost klein" onClick={() => ga(id)}>
                {knop()}
              </button>
            )}
          </li>
        ))}
      </ol>
      <div className="card stack klein-gap">
        <strong>{txt('Hulp nodig?')}</strong>
        <span className="meta">{txt('Lukt iets niet, kijk dan bij ⚙️ Instellingen. Daar kun je een technisch rapport kopiëren om naar de organisatie te sturen.')}</span>
        {WIKI_URL && (
          <a className="btn ghost klein" href={WIKI_URL} target="_blank" rel="noopener noreferrer">
            {txt('📖 Meer uitleg op de wiki')}
          </a>
        )}
      </div>
    </div>
  )
}
