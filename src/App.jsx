import { lazy, Suspense, useEffect, useState } from 'react'
import { isGeconfigureerd } from './config.js'
import { rpc, setBijOngeldigeSessie } from './api.js'
import { laadSessie, bewaarSessie, wisAlles } from './session.js'
import { DataProvider, useData } from './data.jsx'
import { herregistreer, pushOndersteund, zetMeldingenUit } from './push.js'
import { nl } from './strings.js'
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
          <h2>{nl.setupTitel}</h2>
          <p>{nl.setupTekst}</p>
        </div>
      </main>
    )
  }
  if (location.pathname.startsWith('/root')) {
    return (
      <Suspense fallback={<main className="page"><p className="note">{nl.laden}</p></main>}>
        <RootApp />
      </Suspense>
    )
  }
  return <LeerlingApp />
}

function LeerlingApp() {
  const online = useOnline()
  const [sessie, setSessie] = useState(laadSessie)

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
      {nl.offlineBanner}
    </p>
  )

  if (!sessie) return <LoginScherm onKlaar={update} offline={offline} />

  return (
    <DataProvider sessie={sessie}>
      <ThemaDoos sessie={sessie} update={update} uitloggen={uitloggen} offline={offline} />
    </DataProvider>
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

function Kader({ klas, thema, onUitloggen, offline, banner, children }) {
  return (
    <>
      <Decoratie thema={thema} />
      <main className="page">
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
  const leerlingId = data?.leerling_id ?? sessie.leerlingId

  useAppIdentiteit(klas ? klas.weergavenaam || klas.naam : null, sessie.klas?.slug, opgeslagen)

  // keep this device linked to the right student for notifications
  useEffect(() => {
    if (leerlingId) herregistreer(sessie.token)
  }, [leerlingId, sessie.token])

  if (!data) {
    return (
      <Kader klas={klas} thema={thema} onUitloggen={uitloggen} offline={offline}>
        <p className="note">{fout ? nl.laadFout : nl.laden}</p>
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

  const tabs = [...tabsVan(thema, TAB_STANDAARD), ...(sessie.rol === 'beheer' ? [['beheer', nl.tabBeheer]] : [])]
  const actief = tabs.some(([id]) => id === tab) ? tab : tabs[0][0]

  return (
    <Kader klas={klas} thema={thema} onUitloggen={uitloggen} offline={offline} banner={<Banner banner={data.instellingen.banner} />}>
      <div className="rij">
        <button className="btn ghost klein" onClick={() => setMeldingen(true)}>
          🔔 {nl.meldingen}
        </button>
        {leerlingId && (
          <button className="btn ghost klein" onClick={() => window.confirm(nl.zekerAnderPersoon) && setKiesOpnieuw(true)}>
            {nl.anderPersoon}
          </button>
        )}
      </div>

      <nav className="segment scroll" role="tablist">
        {tabs.map(([id, label]) => (
          <button key={id} role="tab" aria-selected={actief === id} onClick={() => setTab(id)}>
            {label}
          </button>
        ))}
      </nav>

      {actief === 'rooster' && <Rooster />}
      {actief === 'info' && <Info />}
      {actief === 'stand' && <Stand sessie={sessie} />}
      {actief === 'pagina' && <Pagina sessie={sessie} />}
      {actief === 'beheer' && sessie.rol === 'beheer' && <Beheer sessie={sessie} />}

      {meldingen && <Meldingen sessie={sessie} leerlingId={leerlingId} onSluit={() => setMeldingen(false)} />}
    </Kader>
  )
}
