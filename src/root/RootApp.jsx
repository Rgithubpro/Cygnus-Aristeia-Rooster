import { useCallback, useEffect, useState } from 'react'
import Mark from '../Mark.jsx'
import { rootClient, rootRpc } from './client.js'
import RootKlassen from './RootKlassen.jsx'
import RootProgramma from './RootProgramma.jsx'
import RootInfo from './RootInfo.jsx'
import RootStand from './RootStand.jsx'
import RootPush from './RootPush.jsx'
import RootInstellingen from './RootInstellingen.jsx'
import RootVeiligheid from './RootVeiligheid.jsx'

const TABS = [
  ['klassen', 'Klassen'],
  ['programma', 'Programma'],
  ['info', 'Info'],
  ['stand', 'Stand'],
  ['push', 'Meldingen'],
  ['instellingen', 'Instellingen'],
  ['veiligheid', 'Veiligheid'],
]

export default function RootApp() {
  const [stap, setStap] = useState('laden') // laden | login | mfa | geenToegang | klaar
  const [overzicht, setOverzicht] = useState(null)
  const [tab, setTab] = useState('klassen')

  const beoordeelInner = useCallback(async () => {
    const c = await rootClient()
    const { data } = await c.auth.getSession()
    if (!data.session) return setStap('login')
    const { data: aal } = await c.auth.mfa.getAuthenticatorAssuranceLevel()
    if (aal && aal.nextLevel === 'aal2' && aal.currentLevel !== 'aal2') return setStap('mfa')
    try {
      setOverzicht(await rootRpc('root_overzicht'))
      setStap('klaar')
    } catch {
      setStap('geenToegang')
    }
  }, [])

  const beoordeel = useCallback(async () => {
    try {
      await beoordeelInner()
    } catch {
      setStap('login')
    }
  }, [beoordeelInner])

  useEffect(() => {
    beoordeel()
  }, [beoordeel])

  const herlaad = useCallback(async () => setOverzicht(await rootRpc('root_overzicht')), [])

  async function uitloggen() {
    const c = await rootClient()
    await c.auth.signOut()
    setOverzicht(null)
    setStap('login')
  }

  return (
    <main className="page breed">
      <header className="head">
        <Mark size={44} />
        <div className="grow">
          <h1>Aristeia Root</h1>
          <p className="tagline">Organisatie</p>
        </div>
        {stap === 'klaar' && (
          <button className="btn ghost klein" onClick={uitloggen}>
            Uitloggen
          </button>
        )}
      </header>

      {stap === 'laden' && <p className="note">Laden…</p>}
      {stap === 'login' && <RootLogin onKlaar={beoordeel} />}
      {stap === 'mfa' && <RootMfa onKlaar={beoordeel} onAnnuleer={uitloggen} />}
      {stap === 'geenToegang' && (
        <div className="card stack">
          <p className="fout">Dit account heeft geen Root-rechten.</p>
          <button className="btn" onClick={uitloggen}>
            Uitloggen
          </button>
        </div>
      )}

      {stap === 'klaar' && overzicht && (
        <>
          <nav className="segment" role="tablist">
            {TABS.map(([id, label]) => (
              <button key={id} role="tab" aria-selected={tab === id} onClick={() => setTab(id)}>
                {label}
              </button>
            ))}
          </nav>
          {tab === 'klassen' && <RootKlassen overzicht={overzicht} herlaad={herlaad} />}
          {tab === 'programma' && <RootProgramma overzicht={overzicht} />}
          {tab === 'info' && <RootInfo overzicht={overzicht} />}
          {tab === 'stand' && <RootStand overzicht={overzicht} herlaad={herlaad} />}
          {tab === 'push' && <RootPush overzicht={overzicht} />}
          {tab === 'instellingen' && <RootInstellingen overzicht={overzicht} herlaad={herlaad} />}
          {tab === 'veiligheid' && <RootVeiligheid onUitloggen={uitloggen} />}
        </>
      )}
    </main>
  )
}

function RootLogin({ onKlaar }) {
  const [email, setEmail] = useState('')
  const [ww, setWw] = useState('')
  const [fout, setFout] = useState('')
  const [bezig, setBezig] = useState(false)

  async function verstuur(e) {
    e.preventDefault()
    setBezig(true)
    setFout('')
    const c = await rootClient()
    const { error } = await c.auth.signInWithPassword({ email, password: ww })
    setBezig(false)
    if (error) return setFout('Inloggen mislukt. Controleer je e-mailadres en wachtwoord.')
    onKlaar()
  }

  return (
    <form className="card stack" onSubmit={verstuur}>
      <h2>Inloggen als Root</h2>
      <label className="veld">
        <span>E-mailadres</span>
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" required />
      </label>
      <label className="veld">
        <span>Wachtwoord</span>
        <input type="password" value={ww} onChange={(e) => setWw(e.target.value)} autoComplete="current-password" required />
      </label>
      {fout && <p className="fout">{fout}</p>}
      <button className="btn" disabled={bezig}>
        Inloggen
      </button>
    </form>
  )
}

function RootMfa({ onKlaar, onAnnuleer }) {
  const [code, setCode] = useState('')
  const [fout, setFout] = useState('')

  async function verstuur(e) {
    e.preventDefault()
    setFout('')
    const c = await rootClient()
    const { data: lijst } = await c.auth.mfa.listFactors()
    const factor = lijst?.totp?.[0]
    if (!factor) return setFout('Geen 2FA-methode gevonden.')
    const { error } = await c.auth.mfa.challengeAndVerify({ factorId: factor.id, code: code.trim() })
    if (error) return setFout('Deze code klopt niet.')
    onKlaar()
  }

  return (
    <form className="card stack" onSubmit={verstuur}>
      <h2>Tweestapsverificatie</h2>
      <label className="veld">
        <span>Code uit je authenticator-app</span>
        <input value={code} onChange={(e) => setCode(e.target.value)} inputMode="numeric" autoComplete="one-time-code" maxLength={6} required />
      </label>
      {fout && <p className="fout">{fout}</p>}
      <button className="btn">Bevestigen</button>
      <button type="button" className="btn ghost" onClick={onAnnuleer}>
        Annuleren
      </button>
    </form>
  )
}
