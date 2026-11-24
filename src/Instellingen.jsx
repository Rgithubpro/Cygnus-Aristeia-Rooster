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
import { AnalyticsBeheer } from './AnalyticsConsent.jsx'
import { txt } from './t.js'

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
        i.sw = reg ? `${reg.active ? 'actief' : reg.installing ? 'installeert' : 'onbekend'}${reg.waiting ? txt(' (update wacht)') : ''}` : 'geen'
        i.bestuurd = !!navigator.serviceWorker?.controller
      } catch { /* not supported */ }
      try {
        i.caches = await Promise.all((await caches.keys()).map(async (n) => txt('{n}: {length} bestanden', { n: n, length: (await (await caches.open(n)).keys()).length })))
      } catch { /* not supported */ }
      try {
        const e = await navigator.storage.estimate()
        i.opslag = txt('{x1} MB gebruikt van {x2} MB', { x1: (e.usage / 1048576).toFixed(1), x2: (e.quota / 1048576).toFixed(0) })
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
    [txt('App'), [
      [txt('Versie'), v.lokaal || 'ontwikkelversie'],
      [txt('Nieuwere versie beschikbaar'), v.wacht ? txt('ja ({achterstand}x gecontroleerd)', { achterstand: v.achterstand }) : 'nee'],
      [txt('Gegevensversie (server)'), data.versie],
      [txt('Laatst bijgewerkt'), laatst ? laatst.toLocaleTimeString('nl-NL') : txt('nog niet')],
      [txt('Verversfout'), fout ? fout.message : 'geen'],
      [txt('Online'), navigator.onLine ? 'ja' : 'nee'],
      [txt('Verbinding'), verbinding],
      [txt('Geïnstalleerd als app'), isStandalone() ? 'ja' : 'nee'],
      [txt('Service worker'), `${sys.sw ?? '…'}${sys.bestuurd ? txt(', bestuurt deze pagina') : ''}`],
      [txt('Opslag'), sys.opslag ?? '…'],
      ...(sys.caches || []).map((c, i) => [`Cache ${i + 1}`, c]),
    ]],
    [txt('Account'), [
      [txt('Klas'), data.klas.naam],
      [txt('Bijnaam'), data.klas.weergavenaam || '-'],
      [txt('Rol'), sessie.rol],
      [txt('Jij bent'), naam || txt('niemand gekozen')],
      [txt('Sessie (laatste tekens)'), `…${sessie.token.slice(-6)}`],
      ['Dag 1 / Dag 2', `${data.instellingen.dag1 || '-'} / ${data.instellingen.dag2 || '-'}`],
      ['Stand zichtbaar t/m dag', data.instellingen.uitslag_tot_dag],
    ]],
    [txt('Meldingen'), [
      [txt('Ondersteund'), pushOndersteund() ? 'ja' : 'nee'],
      [txt('Toestemming'), 'Notification' in window ? Notification.permission : txt('niet beschikbaar')],
      [txt('Aan voor dit apparaat'), meld ? (meld.aan ? 'ja' : 'nee') : '…'],
    ]],
    [txt('Apparaat'), [
      [txt('Browser'), navigator.userAgent.slice(0, 90)],
      ['Taal / tijdzone', `${navigator.language} / ${Intl.DateTimeFormat().resolvedOptions().timeZone}`],
      [txt('Scherm'), `${screen.width}×${screen.height} @${window.devicePixelRatio}x`],
      [txt('Tijd op apparaat'), new Date().toLocaleTimeString('nl-NL')],
      [txt('Tijd in Amsterdam'), `${nu.datum} ${String(Math.floor(nu.min / 60)).padStart(2, '0')}:${String(nu.min % 60).padStart(2, '0')}`],
    ]],
    [txt('Uiterlijk'), [
      ['Palet / modus', `${thema.palet || 'standaard'} / ${thema.modus || 'auto'}`],
      [txt('Kaartstijl'), thema.kaartstijl || 'kaart'],
      [txt('Tekstgrootte'), thema.tekstgrootte || 'normaal'],
    ]],
  ]

  const rapport = () => JSON.stringify(Object.fromEntries(groepen.map(([t, r]) => [t, Object.fromEntries(r)])), null, 2) + '\nFouten: ' + JSON.stringify(fouten)
  const kopieer = async () => {
    try {
      await navigator.clipboard.writeText(rapport())
      setBericht(txt('Rapport gekopieerd. Plak het in een bericht aan de organisatie.'))
    } catch {
      setBericht(txt('Kopiëren lukte niet.'))
    }
  }

  return (
    <Modal titel={txt('⚙️ Instellingen')} onSluit={onSluit}>
      <Sectie titel={txt('Voor jezelf')} uitleg={txt('Alleen op dit apparaat.')}>
        <Seg label={txt('Licht of donker')} waarde={voork.modus || ''} opties={[['', 'Zoals klas'], ['auto', 'Telefoon'], ['licht', 'Licht'], ['donker', 'Donker']]} onKies={(x) => zet({ modus: x })} />
        <Seg label={txt('Tekstgrootte')} waarde={voork.tekstgrootte || ''} opties={[['', 'Zoals klas'], ['klein', 'Klein'], ['normaal', 'Normaal'], ['groot', 'Groot']]} onKies={(x) => zet({ tekstgrootte: x })} />
        <Schakel label={txt('Animaties')} aan={voork.animaties !== false} onWissel={(x) => zet({ animaties: x })} />
        <Schakel label={txt('Emoji-regen uit')} aan={!!voork.regen_uit} onWissel={(x) => zet({ regen_uit: x })} />
      </Sectie>

      <Sectie titel={txt('Acties')}>
        <div className="rij">
          <button className="btn ghost klein" onClick={async () => { await ververs(); setBericht(txt('Gegevens ververst.')) }}>{txt('↻ Gegevens verversen')}</button>
          <button className="btn ghost klein" onClick={onMeldingen}>{txt('🔔 Meldingen')}</button>
          <button className="btn ghost klein" onClick={onInstall}>{txt('📲 Installatie-uitleg')}</button>
          <button className="btn danger klein" onClick={() => window.confirm(txt('Opgeslagen bestanden van de app wissen en opnieuw laden? Je blijft ingelogd.')) && herstel()}>{txt('Cache wissen en herladen')}</button>
          <button className="btn ghost klein" onClick={kopieer}>{txt('📋 Technisch rapport kopiëren')}</button>
          <button className="btn ghost klein" onClick={uitloggen}>{txt('Uitloggen')}</button>
        </div>
        {bericht && <p className="ok" role="status">{bericht}</p>}
      </Sectie>

      <AnalyticsBeheer />

      {groepen.map(([titel, rijen]) => (
        <Sectie key={titel} titel={titel}>
          {rijen.map(([k, w]) => <Rij key={k} k={k} v={w} />)}
        </Sectie>
      ))}

      <Sectie titel={txt('Foutenlogboek ({length})', { length: fouten.length })}>
        {fouten.length === 0 && <p className="note">{txt('Geen fouten gelogd.')}</p>}
        {fouten.map((f, i) => <Rij key={i} k={new Date(f.t).toLocaleString('nl-NL')} v={f.m} />)}
        {fouten.length > 0 && <button className="btn ghost klein" onClick={() => { wisFouten(); setFouten([]) }}>{txt('Logboek wissen')}</button>}
      </Sectie>
    </Modal>
  )
}
