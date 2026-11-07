import { useEffect, useState } from 'react'
import { useData } from './data.jsx'
import { useThema } from './themaContext.jsx'
import { useVoorkeur } from './voorkeur.js'
import { leesFouten, wisFouten } from './logboek.js'
import { herstel, versieInfo } from './update.js'
import { meldingenStatus, pushOndersteund } from './push.js'
import { isStandalone } from './Welkom.jsx'
import { nuAmsterdam } from './util.js'
import { Schakel, Seg, Sectie } from './editor/bouwstenen.jsx'
import Modal from './Modal.jsx'

const Rij = ({ k, v }) => (
  <div className="info-rij">
    <span className="note">{k}</span>
    <span>{String(v ?? '-')}</span>
  </div>
)

// One place for personal settings and everything needed to understand what is going on in the app.
export default function Instellingen({ sessie, leerlingId, onSluit, onMeldingen, onInstall, uitloggen }) {
  const { data, laatst, fout, ververs } = useData()
  const { thema } = useThema()
  const [voork, zet] = useVoorkeur()
  const [sys, setSys] = useState({})
  const [meld, setMeld] = useState(null)
  const [bericht, setBericht] = useState('')
  const [fouten, setFouten] = useState(leesFouten)

  useEffect(() => {
    ;(async () => {
      const i = {}
      try {
        const reg = await navigator.serviceWorker?.getRegistration()
        i.sw = reg ? `${reg.active ? 'actief' : reg.installing ? 'installeert' : 'onbekend'}${reg.waiting ? ' (update wacht)' : ''}` : 'geen'
        i.bestuurd = !!navigator.serviceWorker?.controller
      } catch { /* not supported */ }
      try {
        i.caches = await Promise.all((await caches.keys()).map(async (n) => `${n}: ${(await (await caches.open(n)).keys()).length} bestanden`))
      } catch { /* not supported */ }
      try {
        const e = await navigator.storage.estimate()
        i.opslag = `${(e.usage / 1048576).toFixed(1)} MB gebruikt van ${(e.quota / 1048576).toFixed(0)} MB`
      } catch { /* not supported */ }
      setSys(i)
      setMeld(await meldingenStatus(sessie.token, leerlingId).catch(() => null))
    })()
  }, [sessie.token, leerlingId])

  const v = versieInfo()
  const nu = nuAmsterdam()
  const naam = data.leerlingen.find((l) => l.id === leerlingId)?.naam
  const verbinding = navigator.connection ? `${navigator.connection.effectiveType || '?'}${navigator.connection.saveData ? ' (databesparing)' : ''}` : 'onbekend'
  const groepen = [
    ['App', [
      ['Versie', v.lokaal || 'ontwikkelversie'],
      ['Nieuwere versie beschikbaar', v.wacht ? `ja (${v.achterstand}x gecontroleerd)` : 'nee'],
      ['Gegevensversie (server)', data.versie],
      ['Laatst bijgewerkt', laatst ? laatst.toLocaleTimeString('nl-NL') : 'nog niet'],
      ['Verversfout', fout ? fout.message : 'geen'],
      ['Online', navigator.onLine ? 'ja' : 'nee'],
      ['Verbinding', verbinding],
      ['Geïnstalleerd als app', isStandalone() ? 'ja' : 'nee'],
      ['Service worker', `${sys.sw ?? '…'}${sys.bestuurd ? ', bestuurt deze pagina' : ''}`],
      ['Opslag', sys.opslag ?? '…'],
      ...(sys.caches || []).map((c, i) => [`Cache ${i + 1}`, c]),
    ]],
    ['Account', [
      ['Klas', data.klas.naam],
      ['Bijnaam', data.klas.weergavenaam || '-'],
      ['Rol', sessie.rol],
      ['Jij bent', naam || 'niemand gekozen'],
      ['Sessie (laatste tekens)', `…${sessie.token.slice(-6)}`],
      ['Dag 1 / Dag 2', `${data.instellingen.dag1 || '-'} / ${data.instellingen.dag2 || '-'}`],
      ['Stand zichtbaar t/m dag', data.instellingen.uitslag_tot_dag],
    ]],
    ['Meldingen', [
      ['Ondersteund', pushOndersteund() ? 'ja' : 'nee'],
      ['Toestemming', 'Notification' in window ? Notification.permission : 'niet beschikbaar'],
      ['Aan voor dit apparaat', meld ? (meld.aan ? 'ja' : 'nee') : '…'],
    ]],
    ['Apparaat', [
      ['Browser', navigator.userAgent.slice(0, 90)],
      ['Taal / tijdzone', `${navigator.language} / ${Intl.DateTimeFormat().resolvedOptions().timeZone}`],
      ['Scherm', `${screen.width}×${screen.height} @${window.devicePixelRatio}x`],
      ['Tijd op apparaat', new Date().toLocaleTimeString('nl-NL')],
      ['Tijd in Amsterdam', `${nu.datum} ${String(Math.floor(nu.min / 60)).padStart(2, '0')}:${String(nu.min % 60).padStart(2, '0')}`],
    ]],
    ['Uiterlijk', [
      ['Palet / modus', `${thema.palet || 'standaard'} / ${thema.modus || 'auto'}`],
      ['Kaartstijl', thema.kaartstijl || 'kaart'],
      ['Tekstgrootte', thema.tekstgrootte || 'normaal'],
    ]],
  ]

  const rapport = () => JSON.stringify(Object.fromEntries(groepen.map(([t, r]) => [t, Object.fromEntries(r)])), null, 2) + '\nFouten: ' + JSON.stringify(fouten)
  const kopieer = async () => {
    try {
      await navigator.clipboard.writeText(rapport())
      setBericht('Rapport gekopieerd. Plak het in een bericht aan de organisatie.')
    } catch {
      setBericht('Kopiëren lukte niet.')
    }
  }

  return (
    <Modal titel="⚙️ Instellingen" onSluit={onSluit}>
      <Sectie titel="Voor jezelf" uitleg="Alleen op dit apparaat.">
        <Seg label="Licht of donker" waarde={voork.modus || ''} opties={[['', 'Zoals klas'], ['auto', 'Telefoon'], ['licht', 'Licht'], ['donker', 'Donker']]} onKies={(x) => zet({ modus: x })} />
        <Seg label="Tekstgrootte" waarde={voork.tekstgrootte || ''} opties={[['', 'Zoals klas'], ['klein', 'Klein'], ['normaal', 'Normaal'], ['groot', 'Groot']]} onKies={(x) => zet({ tekstgrootte: x })} />
        <Schakel label="Animaties" aan={voork.animaties !== false} onWissel={(x) => zet({ animaties: x })} />
        <Schakel label="Emoji-regen uit" aan={!!voork.regen_uit} onWissel={(x) => zet({ regen_uit: x })} />
      </Sectie>

      <Sectie titel="Acties">
        <div className="rij">
          <button className="btn ghost klein" onClick={async () => { await ververs(); setBericht('Gegevens ververst.') }}>↻ Gegevens verversen</button>
          <button className="btn ghost klein" onClick={onMeldingen}>🔔 Meldingen</button>
          <button className="btn ghost klein" onClick={onInstall}>📲 Installatie-uitleg</button>
          <button className="btn danger klein" onClick={() => window.confirm('Opgeslagen bestanden van de app wissen en opnieuw laden? Je blijft ingelogd.') && herstel()}>Cache wissen en herladen</button>
          <button className="btn ghost klein" onClick={kopieer}>📋 Technisch rapport kopiëren</button>
          <button className="btn ghost klein" onClick={uitloggen}>Uitloggen</button>
        </div>
        {bericht && <p className="ok" role="status">{bericht}</p>}
      </Sectie>

      {groepen.map(([titel, rijen]) => (
        <Sectie key={titel} titel={titel}>
          {rijen.map(([k, w]) => <Rij key={k} k={k} v={w} />)}
        </Sectie>
      ))}

      <Sectie titel={`Foutenlogboek (${fouten.length})`}>
        {fouten.length === 0 && <p className="note">Geen fouten gelogd.</p>}
        {fouten.map((f, i) => <Rij key={i} k={new Date(f.t).toLocaleString('nl-NL')} v={f.m} />)}
        {fouten.length > 0 && <button className="btn ghost klein" onClick={() => { wisFouten(); setFouten([]) }}>Logboek wissen</button>}
      </Sectie>
    </Modal>
  )
}
