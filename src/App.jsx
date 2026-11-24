import { lazy, Suspense, useEffect, useState } from 'react'
import { isGeconfigureerd } from './config.js'
import { rpc, setBijOngeldigeSessie } from './api.js'
import { laadSessie, bewaarSessie, wisAlles } from './session.js'
import { DataProvider, useData } from './data.jsx'
import { herregistreer, pushOndersteund, zetMeldingenUit } from './push.js'
import { ThemaProvider, useThema } from './themaContext.jsx'
import { TAB_STANDAARD, tabsVan } from './themaModel.js'
import { useAppIdentiteit } from './pwaIdentiteit.js'
import Kop from './Kop.jsx'
import Banner from './Banner.jsx'
import Decoratie, { EmojiStrook } from './Decoratie.jsx'
import LoginScherm from './Login.jsx'
import KiesNaam from './KiesNaam.jsx'
import Rooster from './Rooster.jsx'
import Info from './Info.jsx'
import Stand from './Stand.jsx'
import Pagina from './Pagina.jsx'
import Meldingen from './Meldingen.jsx'
import Beheer from './Beheer.jsx'
import { FoutVanger } from './FoutGrens.jsx'
import UpdateBalk from './UpdateBalk.jsx'
import Instellingen from './Instellingen.jsx'
import Welkom, { IcoonHint, InstallTip, InstallUitleg } from './Welkom.jsx'
import { useVoorkeur } from './voorkeur.js'
import { analyticsConfigured, startAnalytics, stopAnalytics, useAnalyticsToestemming } from './analytics.js'
import { AnalyticsConsentPrompt, AnalyticsTabWeergave } from './AnalyticsConsent.jsx'
import { txt } from './t.js'

// The Root panel (and the Supabase login library) is only downloaded on /root.
const RootApp = lazy(() => import('./root/RootApp.jsx'))

function useOnline() {
  const [online, setOnline] = useState(() => navigator.onLine)
  useEffect(() => {
    const up = () => setOnline(true)
    const down = () => setOnline(false)
    window.addEventListener('online', up)
    window.addEventListener('offline', down)
    return () => {
      window.removeEventListener('online', up)
      window.removeEventListener('offline', down)
    }
  }, [])
  return online
}

export default function App() {
  const [voork] = useVoorkeur()
  useEffect(() => {
    document.documentElement.dataset.animaties = voork.animaties === false ? 'uit' : 'aan'
  }, [voork.animaties])
  return (
    <>
      <FoutVanger />
      <UpdateBalk />
      <Inhoud />
    </>
  )
}

function Inhoud() {
  if (!isGeconfigureerd()) {
    return (
      <main className="page">
        <Kop />
        <div className="card stack">
          <h2>{txt('Bijna klaar')}</h2>
          <p>{txt('De website draait, maar de database is nog niet gekoppeld. Zet VITE_SUPABASE_URL en VITE_SUPABASE_KEY in je .env-bestand (lokaal) of in de build-variabelen van je hosting en bouw de app opnieuw.')}</p>
        </div>
      </main>
    )
  }
  if (location.pathname.startsWith('/root')) {
    return (
      <Suspense fallback={<main className="page"><p className="note">{txt('Laden…')}</p></main>}>
        <RootApp />
      </Suspense>
    )
  }
  return <LeerlingApp />
}

function LeerlingApp() {
  const online = useOnline()
  const [sessie, setSessie] = useState(laadSessie)
  const analyticsToestemming = useAnalyticsToestemming()

  useEffect(() => {
    if (!analyticsConfigured()) return
    if (analyticsToestemming === 'granted') startAnalytics()
    else if (analyticsToestemming === 'denied') stopAnalytics()
  }, [analyticsToestemming])

  useEffect(() => {
    setBijOngeldigeSessie(() => {
      wisAlles()
      setSessie(null)
    })
  }, [])

  function update(nieuw) {
    bewaarSessie(nieuw)
    setSessie(nieuw)
  }

  async function uitloggen() {
    try {
      if (pushOndersteund()) await zetMeldingenUit(sessie.token) // logging out stops notifications on this device
    } catch {
      /* ignore */
    }
    try {
      await rpc('uitloggen', { p_token: sessie.token })
    } catch {
      /* offline: still log out on this device */
    }
    wisAlles()
    setSessie(null)
  }

  const offline = !online && (
    <p className="banner" role="status">
      {txt('Je bent offline. Je ziet de laatst geladen gegevens.')}
    </p>
  )

  const analyticsPrompt = analyticsConfigured() && analyticsToestemming === null ? <AnalyticsConsentPrompt /> : null

  if (!sessie) {
    return (
      <>
        <LoginScherm onKlaar={update} offline={offline} />
        {analyticsPrompt}
      </>
    )
  }

  return (
    <>
      <DataProvider sessie={sessie}>
        <ThemaDoos sessie={sessie} update={update} uitloggen={uitloggen} offline={offline} />
      </DataProvider>
      {analyticsPrompt}
    </>
  )
}

// Applies the class look (live preview of unsaved edits included) around everything the student sees.
function ThemaDoos(props) {
  const { data } = useData()
  const klas = data?.klas ?? props.sessie.klas
  return (
    <ThemaProvider opgeslagen={klas?.thema}>
      <Shell {...props} klas={klas} />
    </ThemaProvider>
  )
}

function Kader({ klas, thema, onUitloggen, offline, banner, breed = false, children }) {
  return (
    <>
      <Decoratie thema={thema} />
      <main className={`page${breed ? ' breed' : ''}`}>
        <Kop klas={klas} thema={thema} onUitloggen={onUitloggen} />
        <EmojiStrook thema={thema} />
        {banner}
        {offline}
        {children}
      </main>
    </>
  )
}

function Shell({ sessie, update, uitloggen, offline, klas }) {
  const { data, fout } = useData()
  const { thema, opgeslagen } = useThema()
  const [tab, setTab] = useState(() => opgeslagen.start_tab || tabsVan(opgeslagen)[0][0])
  const [kiesOpnieuw, setKiesOpnieuw] = useState(false)
  const [meldingen, setMeldingen] = useState(false)
  const [instellingen, setInstellingen] = useState(false)
  const [installUitleg, setInstallUitleg] = useState(false)
  const leerlingId = data?.leerling_id ?? sessie.leerlingId

  useAppIdentiteit(klas ? klas.weergavenaam || klas.naam : null, sessie.klas?.slug, opgeslagen)

  // keep this device linked to the right student for notifications
  useEffect(() => {
    if (leerlingId) herregistreer(sessie.token)
  }, [leerlingId, sessie.token])

  if (!data) {
    return (
      <Kader klas={klas} thema={thema} onUitloggen={uitloggen} offline={offline}>
        <p className="note">{fout ? txt('Er ging iets mis. Controleer je verbinding en probeer het opnieuw.') : txt('Laden…')}</p>
      </Kader>
    )
  }

  const moetNaamKiezen = !leerlingId && !sessie.naamOvergeslagen
  if (moetNaamKiezen || kiesOpnieuw) {
    return (
      <Kader klas={klas} thema={thema} onUitloggen={uitloggen} offline={offline}>
        <KiesNaam
          sessie={sessie}
          onKlaar={(s) => {
            update(s)
            setKiesOpnieuw(false)
          }}
          onAnnuleer={kiesOpnieuw ? () => setKiesOpnieuw(false) : undefined}
        />
      </Kader>
    )
  }

  const tabs = [...tabsVan(thema, TAB_STANDAARD, { stand: data.instellingen.stand_tab_forceer }), ...(sessie.rol === 'beheer' ? [['beheer', txt('Beheer')]] : [])]
  const actief = tabs.some(([id]) => id === tab) ? tab : tabs[0][0]

  return (
    <Kader klas={klas} thema={thema} onUitloggen={uitloggen} offline={offline} breed={actief === 'beheer'} banner={<Banner banner={data.instellingen.banner} />}>
      <InstallTip />
      <div className="rij">
        <button className="btn ghost klein" onClick={() => setInstellingen(true)}>
          {txt('⚙️ Instellingen')}
        </button>
        <button className="btn ghost klein" onClick={() => setMeldingen(true)}>
          🔔 {txt('Meldingen')}
        </button>
        {leerlingId && (
          <button className="btn ghost klein" onClick={() => window.confirm(txt('Weet je zeker dat je een andere naam wilt kiezen?')) && setKiesOpnieuw(true)}>
            {txt('Ik ben iemand anders')}
          </button>
        )}
      </div>

      <nav className="segment" role="tablist">
        {tabs.map(([id, label]) => (
          <button key={id} role="tab" aria-selected={actief === id} onClick={() => setTab(id)}>
            {label}
          </button>
        ))}
      </nav>

      <div key={actief} className="tab-in stack">
        <AnalyticsTabWeergave tab={actief} klasSlug={sessie.klas?.slug} rol={sessie.rol} />
        {actief === 'rooster' && <Rooster />}
        {actief === 'info' && <Info />}
        {actief === 'stand' && <Stand sessie={sessie} />}
        {actief === 'pagina' && <Pagina sessie={sessie} />}
        {actief === 'beheer' && sessie.rol === 'beheer' && <Beheer sessie={sessie} />}
      </div>

      <Welkom sessie={sessie} leerlingId={leerlingId} icoon={opgeslagen.icoon} naam={klas ? klas.weergavenaam || klas.naam : ''} />
      <IcoonHint icoon={opgeslagen.icoon} slug={sessie.klas?.slug} />
      {instellingen && <Instellingen sessie={sessie} leerlingId={leerlingId} uitloggen={uitloggen} onSluit={() => setInstellingen(false)} onMeldingen={() => { setInstellingen(false); setMeldingen(true) }} onInstall={() => { setInstellingen(false); setInstallUitleg(true) }} />}
      {installUitleg && <InstallUitleg icoon={opgeslagen.icoon} naam={klas ? klas.weergavenaam || klas.naam : ''} onSluit={() => setInstallUitleg(false)} />}

      {meldingen && <Meldingen sessie={sessie} leerlingId={leerlingId} onSluit={() => setMeldingen(false)} />}
    </Kader>
  )
}
