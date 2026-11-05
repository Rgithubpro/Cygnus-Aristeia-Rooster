import { lazy, Suspense, useEffect, useState } from 'react'
import { afbeeldingUrl, isGeconfigureerd } from './config.js'
import { rpc, setBijOngeldigeSessie } from './api.js'
import { laadSessie, bewaarSessie, wisAlles } from './session.js'
import { DataProvider, useData } from './data.jsx'
import { herregistreer, pushOndersteund, zetMeldingenUit } from './push.js'
import { nl } from './strings.js'
import Mark from './Mark.jsx'
import { themaStijl } from './theme.js'
import Banner from './Banner.jsx'
import Login from './Login.jsx'
import KiesNaam from './KiesNaam.jsx'
import Rooster from './Rooster.jsx'
import Info from './Info.jsx'
import Stand from './Stand.jsx'
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

function Kop({ klas, onUitloggen }) {
  const thema = klas?.thema || {}
  return (
    <header className={`head${thema.decoratie && thema.decoratie !== 'geen' ? ' heeft-decoratie' : ''}`}>
      {thema.logo ? (
        <img className="klas-logo" src={afbeeldingUrl(thema.logo)} alt="" />
      ) : thema.emoji ? (
        <span className="klas-emoji" aria-hidden="true">{thema.emoji}</span>
      ) : (
        <Mark size={52} />
      )}
      <div className="grow">
        <h1>{klas ? klas.weergavenaam || klas.naam : nl.title}</h1>
        <p className="tagline">{klas ? thema.slogan || nl.title : nl.tagline}</p>
      </div>
      {thema.decoratie && thema.decoratie !== 'geen' && (
        <span className="klas-decoratie" aria-hidden="true">{thema.decoratie}</span>
      )}
      {onUitloggen && (
        <button className="btn ghost klein" onClick={onUitloggen}>
          {nl.uitloggen}
        </button>
      )}
    </header>
  )
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
  const klas = data?.klas ?? sessie.klas
  const thema = klas?.thema || {}
  const tabConfig = [
    ...(thema.toonRooster === false ? [] : [['rooster', nl.tabRooster]]),
    ...(thema.toonInfo === false ? [] : [['info', nl.tabInfo]]),
    ...(thema.toonStand === false ? [] : [['stand', nl.tabStand]]),
    ...(sessie.rol === 'beheer' ? [['beheer', nl.tabBeheer]] : []),
  ]
  const tabSleutel = tabConfig.map(([id]) => id).join('|')

  // keep this device linked to the right student for notifications
  useEffect(() => {
    if (leerlingId) herregistreer(sessie.token)
  }, [leerlingId, sessie.token])

  useEffect(() => {
    const ids = tabSleutel.split('|').filter(Boolean)
    if (!ids.includes(tab)) setTab(ids[0] || 'beheer')
  }, [tab, tabSleutel])

  useEffect(() => {
    const favicon = document.querySelector('link[rel="icon"]')
    const appleIcon = document.querySelector('link[rel="apple-touch-icon"]')
    const bestaandeManifest = document.querySelector('link[rel="manifest"]')
    const manifestLink = bestaandeManifest || document.createElement('link')
    if (!bestaandeManifest) {
      manifestLink.rel = 'manifest'
      document.head.append(manifestLink)
    }
    const appTitle = document.querySelector('meta[name="apple-mobile-web-app-title"]')
    const themeColors = document.querySelectorAll('meta[name="theme-color"]')
    const titel = klas ? (klas.weergavenaam || klas.naam) : nl.title
    const icoonUrl = thema.logo ? afbeeldingUrl(thema.logo) : null
    const achtergrond = /^#[0-9a-fA-F]{6}$/.test(thema.achtergrond || '') ? thema.achtergrond : '#eef1f7'
    const accent = /^#[0-9a-fA-F]{6}$/.test(thema.accent || '') ? thema.accent : '#14203d'
    document.title = titel
    appTitle.content = titel.slice(0, 12)
    for (const meta of themeColors) meta.content = accent
    if (icoonUrl) {
      favicon.href = icoonUrl
      favicon.type = 'image/jpeg'
      appleIcon.href = icoonUrl
    } else {
      favicon.href = '/favicon.svg'
      favicon.type = 'image/svg+xml'
      appleIcon.href = '/apple-touch-icon.png'
    }
    const manifest = {
      id: location.pathname,
      name: titel,
      short_name: titel.slice(0, 12),
      description: thema.slogan || nl.tagline,
      lang: 'nl',
      start_url: location.pathname,
      scope: '/',
      display: 'standalone',
      background_color: achtergrond,
      theme_color: accent,
      icons: [
        ...(icoonUrl ? [{ src: icoonUrl, sizes: '512x512', type: 'image/jpeg', purpose: 'any' }] : []),
        { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
        { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
        { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      ],
    }
    const manifestUrl = URL.createObjectURL(new Blob([JSON.stringify(manifest)], { type: 'application/manifest+json' }))
    manifestLink.href = manifestUrl
    return () => {
      URL.revokeObjectURL(manifestUrl)
      document.title = nl.title
      appTitle.content = nl.title
      for (const meta of themeColors) meta.content = '#eef1f7'
      favicon.href = '/favicon.svg'
      favicon.type = 'image/svg+xml'
      appleIcon.href = '/apple-touch-icon.png'
      if (bestaandeManifest) manifestLink.href = '/manifest.webmanifest'
      else manifestLink.remove()
    }
  }, [klas?.naam, klas?.weergavenaam, thema.accent, thema.achtergrond, thema.logo, thema.slogan])

  const stijl = themaStijl(klas?.thema)
  const pageClass = `page thema layout-${thema.layout || 'standaard'}`

  if (!data) {
    return (
      <main className={pageClass} style={stijl}>
        <Kop klas={klas} onUitloggen={uitloggen} />
        {offline}
        <p className="note">{fout ? nl.laadFout : nl.laden}</p>
      </main>
    )
  }

  const moetNaamKiezen = !leerlingId && !sessie.naamOvergeslagen
  if (moetNaamKiezen || kiesOpnieuw) {
    return (
      <main className={pageClass} style={stijl}>
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

  return (
    <main className={pageClass} style={stijl}>
      <Kop klas={klas} onUitloggen={uitloggen} />
      <Banner banner={data.instellingen.banner} />
      {(thema.banner || thema.bannerTekst) && (
        <section className="klas-banner">
          {thema.banner && <img src={afbeeldingUrl(thema.banner)} alt="" />}
          {thema.bannerTekst && <p>{thema.bannerTekst}</p>}
        </section>
      )}
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
        {tabConfig.map(([id, label]) => (
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
