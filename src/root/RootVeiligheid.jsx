import { useEffect, useState } from 'react'
import { rootClient } from './client.js'

// Two-step verification (authenticator app) for the Root login.
export default function RootVeiligheid({ onUitloggen }) {
  const [factoren, setFactoren] = useState(null)
  const [aanmelden, setAanmelden] = useState(null)
  const [code, setCode] = useState('')
  const [fout, setFout] = useState('')

  const laad = async () => {
    const c = await rootClient()
    const { data } = await c.auth.mfa.listFactors()
    setFactoren(data?.totp || [])
  }
  useEffect(() => {
    laad()
  }, [])

  async function start() {
    setFout('')
    const c = await rootClient()
    const { data, error } = await c.auth.mfa.enroll({ factorType: 'totp', friendlyName: `Root ${Date.now()}` })
    if (error) return setFout('Starten mislukt.')
    setAanmelden({ id: data.id, qr: data.totp.qr_code, geheim: data.totp.secret })
  }

  async function bevestig(e) {
    e.preventDefault()
    setFout('')
    const c = await rootClient()
    const { error } = await c.auth.mfa.challengeAndVerify({ factorId: aanmelden.id, code: code.trim() })
    if (error) return setFout('Deze code klopt niet.')
    setAanmelden(null)
    setCode('')
    laad()
  }

  async function verwijder(id) {
    if (!window.confirm('2FA uitzetten? Dit maakt je Root-login minder veilig.')) return
    const c = await rootClient()
    const { error } = await c.auth.mfa.unenroll({ factorId: id })
    if (error) return setFout('Verwijderen mislukt. Log opnieuw in met je 2FA-code en probeer het nog eens.')
    laad()
  }

  const actief = (factoren || []).filter((f) => f.status === 'verified')

  return (
    <div className="stack">
      <div className="card stack">
        <h2>Tweestapsverificatie (aanbevolen)</h2>
        {factoren && actief.length > 0 ? (
          <>
            <p className="ok">✓ 2FA staat aan. Zonder code kan niemand Root-functies gebruiken, ook niet met jouw wachtwoord.</p>
            {actief.map((f) => (
              <button key={f.id} className="btn danger klein" onClick={() => verwijder(f.id)}>2FA uitzetten</button>
            ))}
          </>
        ) : aanmelden ? (
          <form className="stack" onSubmit={bevestig}>
            <p>Scan de QR-code met een authenticator-app (bijvoorbeeld Google Authenticator of Microsoft Authenticator) en vul de code in.</p>
            <img className="qr-groot" src={aanmelden.qr} alt="QR-code voor 2FA" />
            <p className="note">Lukt scannen niet? Voer dit in: <code>{aanmelden.geheim}</code></p>
            <input value={code} onChange={(e) => setCode(e.target.value)} inputMode="numeric" maxLength={6} placeholder="6-cijferige code" required />
            <button className="btn">Activeren</button>
          </form>
        ) : (
          <button className="btn" onClick={start}>2FA instellen</button>
        )}
        {fout && <p className="fout">{fout}</p>}
      </div>
      <div className="card stack">
        <h2>Sessie</h2>
        <button className="btn ghost" onClick={onUitloggen}>Uitloggen</button>
      </div>
    </div>
  )
}
