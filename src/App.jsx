import { lazy, Suspense, useEffect, useState } from 'react'
import { isGeconfigureerd } from './config.js'
import { rpc, setBijOngeldigeSessie } from './api.js'
import { laadSessie, bewaarSessie, wisAlles } from './session.js'
import { DataProvider, useData } from './data.jsx'
import { herregistreer } from './push.js'
import { nl } from './strings.js'
import Mark from './Mark.jsx'
import Banner from './Banner.jsx'
import Login from './Login.jsx'
import KiesNaam from './KiesNaam.jsx'
import Rooster from './Rooster.jsx'
import Info from './Info.jsx'
import Stand from './Stand.jsx'
import Meldingen from './Meldingen.jsx'
import Beheer from './Beheer.jsx'

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

function Kop({ klas, onUitloggen }) {
  return (
    <header className="head">
      <Mark size={44} />
      <div className="grow">
        <h1>{nl.title}</h1>
        <p className="tagline">{klas ? klas.naam : nl.tagline}</p>
      </div>
      {onUitloggen && (
        <button className="btn ghost klein" onClick={onUitloggen}>
          {nl.uitloggen}
        </button>
      )}
    </header>
  )
}

export default function App() {
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

  if (!sessie) {
    return (
      <main className="page">
        <Kop />
        {offline}
        <Login onKlaar={update} />
      </main>
    )
  }

  return (
    <DataProvider sessie={sessie}>
      <Shell sessie={sessie} update={update} uitloggen={uitloggen} offline={offline} />
    </DataProvider>
  )
}

function Shell({ sessie, update, uitloggen, offline }) {
  const { data, fout } = useData()
  const [tab, setTab] = useState('rooster')
  const [kiesOpnieuw, setKiesOpnieuw] = useState(false)
  const [meldingen, setMeldingen] = useState(false)
  const leerlingId = data?.leerling_id ?? sessie.leerlingId

  // keep this device linked to the right student for notifications
  useEffect(() => {
    if (leerlingId) herregistreer(sessie.token)
  }, [leerlingId, sessie.token])

  const klas = data?.klas ?? sessie.klas

  if (!data) {
    return (
      <main className="page">
        <Kop klas={klas} onUitloggen={uitloggen} />
        {offline}
        <p className="note">{fout ? nl.laadFout : nl.laden}</p>
      </main>
    )
  }

  const moetNaamKiezen = !leerlingId && !sessie.naamOvergeslagen
  if (moetNaamKiezen || kiesOpnieuw) {
    return (
      <main className="page">
        <Kop klas={klas} onUitloggen={uitloggen} />
        {offline}
        <KiesNaam
          sessie={sessie}
          onKlaar={(s) => {
            update(s)
            setKiesOpnieuw(false)
          }}
          onAnnuleer={kiesOpnieuw ? () => setKiesOpnieuw(false) : undefined}
        />
      </main>
    )
  }

  const tabs = [
    ['rooster', nl.tabRooster],
    ['info', nl.tabInfo],
    ['stand', nl.tabStand],
    ...(sessie.rol === 'beheer' ? [['beheer', nl.tabBeheer]] : []),
  ]

  return (
    <main className="page">
      <Kop klas={klas} onUitloggen={uitloggen} />
      <Banner banner={data.instellingen.banner} />
      {offline}
      <div className="rij">
        <button className="btn ghost klein" onClick={() => setMeldingen(true)}>
          🔔 {nl.meldingen}
        </button>
        {leerlingId && (
          <button
            className="btn ghost klein"
            onClick={() => window.confirm(nl.zekerAnderPersoon) && setKiesOpnieuw(true)}
          >
            {nl.anderPersoon}
          </button>
        )}
      </div>

      <nav className="segment" role="tablist">
        {tabs.map(([id, label]) => (
          <button key={id} role="tab" aria-selected={tab === id} onClick={() => setTab(id)}>
            {label}
          </button>
        ))}
      </nav>

      {tab === 'rooster' && <Rooster />}
      {tab === 'info' && <Info />}
      {tab === 'stand' && <Stand sessie={sessie} />}
      {tab === 'beheer' && sessie.rol === 'beheer' && <Beheer sessie={sessie} />}

      {meldingen && <Meldingen sessie={sessie} leerlingId={leerlingId} onSluit={() => setMeldingen(false)} />}
    </main>
  )
}
