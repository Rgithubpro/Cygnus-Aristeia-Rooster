import { useEffect, useState } from 'react'
import { isGeconfigureerd } from './config.js'
import { rpc, setBijOngeldigeSessie } from './api.js'
import { laadSessie, bewaarSessie, wisAlles } from './session.js'
import { nl } from './strings.js'
import Mark from './Mark.jsx'
import Login from './Login.jsx'
import KiesNaam from './KiesNaam.jsx'
import Rooster from './Rooster.jsx'
import Klas from './Klas.jsx'
import Mededelingen from './Mededelingen.jsx'
import Beheer from './Beheer.jsx'

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
  const online = useOnline()
  const [sessie, setSessie] = useState(() => laadSessie())
  const [tab, setTab] = useState('rooster')

  useEffect(() => {
    setBijOngeldigeSessie(() => {
      wisAlles()
      setSessie(null)
    })
  }, [])

  // Check that the stored session is still valid (it also restores the chosen name).
  useEffect(() => {
    if (!sessie?.token || !isGeconfigureerd()) return
    rpc('mijn_sessie', { p_token: sessie.token })
      .then((s) => {
        if (s.leerling_id && s.leerling_id !== sessie.leerlingId) update({ ...sessie, leerlingId: s.leerling_id })
      })
      .catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    setTab('rooster')
  }

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

  const banner = !online && (
    <p className="banner" role="status">
      {nl.offlineBanner}
    </p>
  )

  if (!sessie) {
    return (
      <main className="page">
        <Kop />
        {banner}
        <Login onKlaar={update} />
      </main>
    )
  }

  const moetNaamKiezen = !sessie.leerlingId && !sessie.naamOvergeslagen
  if (moetNaamKiezen) {
    return (
      <main className="page">
        <Kop klas={sessie.klas} onUitloggen={uitloggen} />
        {banner}
        <KiesNaam sessie={sessie} onKlaar={update} />
      </main>
    )
  }

  const tabs = [
    ['rooster', nl.tabRooster],
    ['klas', nl.tabKlas],
    ['mededelingen', nl.tabMededelingen],
    ...(sessie.rol === 'beheer' ? [['beheer', nl.tabBeheer]] : []),
  ]

  return (
    <main className="page">
      <Kop klas={sessie.klas} onUitloggen={uitloggen} />
      {banner}
      <nav className="segment" role="tablist">
        {tabs.map(([id, label]) => (
          <button key={id} role="tab" aria-selected={tab === id} onClick={() => setTab(id)}>
            {label}
          </button>
        ))}
      </nav>

      {tab === 'rooster' &&
        (sessie.leerlingId ? (
          <Rooster sessie={sessie} leerlingId={sessie.leerlingId} />
        ) : (
          <div className="stack">
            <p className="note">{nl.geenNaamGekozen}</p>
            <button className="btn" onClick={() => update({ ...sessie, naamOvergeslagen: false })}>
              {nl.kiesNaam}
            </button>
          </div>
        ))}
      {tab === 'klas' && <Klas sessie={sessie} />}
      {tab === 'mededelingen' && <Mededelingen sessie={sessie} />}
      {tab === 'beheer' && sessie.rol === 'beheer' && <Beheer sessie={sessie} />}
    </main>
  )
}
