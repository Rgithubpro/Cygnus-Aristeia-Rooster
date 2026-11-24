import { useState } from 'react'
import { afbeeldingUrl } from './config.js'
import Modal from './Modal.jsx'
import { isIos, pushOndersteund, zetMeldingenAan } from './push.js'
import { txt } from './t.js'

const gezien = (k) => {
  try {
    return localStorage.getItem(k) === '1'
  } catch {
    return true
  }
}
const markeer = (k) => {
  try {
    localStorage.setItem(k, '1')
  } catch {
    /* ignore */
  }
}
export const isStandalone = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true
export const isMobiel = () => isIos() || (matchMedia('(pointer: coarse)').matches && /Android/i.test(navigator.userAgent))

// Exact steps for this device and browser.
export function installStappen() {
  const ua = navigator.userAgent
  if (isIos()) {
    const safari = /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS/.test(ua)
    return safari
      ? [txt('Tik onderin op het deel-icoon (een vierkantje met een pijl omhoog).'), 'Scrol omlaag en tik op "Zet op beginscherm".', 'Tik rechtsboven op "Voeg toe". Open Aristeia daarna vanaf je beginscherm.']
      : [txt('Tik op het deel-icoon (of op ⋯) in je browser.'), 'Kies "Zet op beginscherm" en tik op "Voeg toe".', txt('Staat die optie er niet? Open Aristeia dan in Safari en doe het daar.')]
  }
  if (/SamsungBrowser/.test(ua)) return [txt('Tik onderin op het menu (☰).'), 'Kies "Pagina toevoegen aan" en dan "Startscherm".', txt('Open Aristeia daarna vanaf je startscherm.')]
  if (/Firefox/.test(ua) && /Android/.test(ua)) return [txt('Tik rechtsboven op ⋮.'), 'Kies "Installeren".', txt('Open Aristeia daarna vanaf je startscherm.')]
  if (/Android/.test(ua)) return [txt('Tik rechtsboven op ⋮.'), 'Kies "App installeren" (of "Toevoegen aan startscherm").', txt('Open Aristeia daarna vanaf je startscherm.')]
  return [txt('Klik rechts in de adresbalk op het installatie-icoontje (een scherm met een pijl).'), 'Kies "Installeren".']
}

// An installed app keeps the icon it was installed with. If it was installed without the class icon, explain how to get it.
export function IcoonHint({ icoon, slug }) {
  const [dicht, setDicht] = useState(() => gezien('ksv.icoon_hint'))
  const [gekopieerd, setGekopieerd] = useState(false)
  const [open, setOpen] = useState(false)
  let start = ''
  try {
    start = new URL(performance.getEntriesByType('navigation')[0]?.name || location.href).pathname
  } catch {
    /* ignore */
  }
  if (dicht || !icoon || !slug || !isStandalone() || start !== '/') return null
  const link = `${location.origin}/k/${slug}`
  return (
    <>
      <p className="hulp">
        {txt('🎨 Je klas heeft een eigen app-icoon.')}{' '}
        <button className="link" onClick={() => setOpen(true)}>{txt('Zo krijg je het')}</button>
        {' · '}
        <button className="link" onClick={() => { markeer('ksv.icoon_hint'); setDicht(true) }}>{txt('Niet meer tonen')}</button>
      </p>
      {open && (
    <Modal titel={txt('🎨 Het icoon van je klas')} onSluit={() => setOpen(false)}>
      <p>{txt('Je klas heeft een eigen app-icoon, maar deze app staat met het standaard-icoon op je beginscherm. Een icoon kan achteraf niet worden veranderd. Zo krijg je het klas-icoon:')}</p>
      <ol className="pagina-lijst">
        <li>{txt('Verwijder deze app van je beginscherm.')}</li>
        <li>{txt('Open de link van je klas in je browser:')} <span className="woord-af">{link}</span></li>
        {installStappen().map((x, i) => <li key={i}>{x}</li>)}
        <li>{txt('Log daarna opnieuw in (een app op een iPhone heeft zijn eigen opslag).')}</li>
      </ol>
      <button className="btn ghost" onClick={async () => { try { await navigator.clipboard.writeText(link); setGekopieerd(true) } catch { /* ignore */ } }}>
        {gekopieerd ? txt('✓ Link gekopieerd') : txt('📋 Kopieer de klaslink')}
      </button>
    </Modal>
      )}
    </>
  )
}

export function InstallUitleg({ onSluit, icoon, naam }) {
  const stappen = installStappen()
  const kan = typeof window !== 'undefined' && window.__installPrompt
  return (
    <Modal titel={txt('📲 Zet Aristeia op je beginscherm')} onSluit={onSluit}>
      {icoon && (
        <div className="rij">
          <div className="icoon-doos ios">
            <img crossOrigin="anonymous" src={afbeeldingUrl(icoon.replace(/-512\.png$/, '-192.png'))} alt="" />
          </div>
          <span>
            <strong>{naam}</strong>
            <br />
            <small className="note">{txt('Zo komt de app op je beginscherm.')}</small>
          </span>
        </div>
      )}
      <p>{txt('Als app werkt alles beter:')}</p>
      <ul className="pagina-lijst">
        <li>{txt('🔔 Meldingen vlak voor je activiteit (op een iPhone kan dat alleen als app)')}</li>
        <li>{txt('⚡ Sneller openen, en je rooster werkt ook zonder internet')}</li>
        <li>{txt('🎨 Met het eigen icoontje van je klas')}</li>
      </ul>
      {kan && (
        <button className="btn" onClick={async () => { window.__installPrompt.prompt(); await window.__installPrompt.userChoice.catch(() => {}); window.__installPrompt = null; onSluit() }}>
          {txt('Nu installeren')}
        </button>
      )}
      <p className="note">{txt('💡 Installeer via de link of QR-code van je klas: dan krijgt de app het icoon van je klas (als je klas er een heeft).')}</p>
      <strong>{txt('Zo doe je het:')}</strong>
      <ol className="pagina-lijst">
        {stappen.map((x, i) => <li key={i}>{x}</li>)}
      </ol>
    </Modal>
  )
}

// Desktop: only a subtle one-line tip.
export function InstallTip() {
  const [dicht, setDicht] = useState(() => isMobiel() || isStandalone() || gezien('ksv.tip_gezien'))
  if (dicht) return null
  return (
    <p className="tip">
      {txt('💡 Tip: installeer Aristeia als app via het icoontje in de adresbalk van je browser.')}{' '}
      <button className="link" onClick={() => { markeer('ksv.tip_gezien'); setDicht(true) }}>{txt('Begrepen')}</button>
    </p>
  )
}

// First open on a phone: install popup. After choosing a name: notification popup.
export default function Welkom({ sessie, leerlingId, icoon, naam }) {
  const [installKlaar, setInstallKlaar] = useState(!(isMobiel() && !isStandalone() && !gezien('ksv.install_gezien')))
  const [meldKlaar, setMeldKlaar] = useState(gezien('ksv.meldingen_gevraagd'))
  const [bezig, setBezig] = useState(false)

  if (!sessie) return null // no popups before login: the app is installed after login so it gets the class icon
  if (!installKlaar) return <InstallUitleg icoon={icoon} naam={naam} onSluit={() => { markeer('ksv.install_gezien'); setInstallKlaar(true) }} />

  const toonMelding = sessie && leerlingId && !meldKlaar && pushOndersteund() && 'Notification' in window && Notification.permission === 'default'
  if (!toonMelding) return null
  const klaar = () => { markeer('ksv.meldingen_gevraagd'); setMeldKlaar(true) }
  return (
    <Modal titel={txt('🔔 Meldingen aanzetten?')} onSluit={klaar}>
      <p>{txt('Met meldingen krijg je')} <strong>{txt('5 minuten voor elke activiteit')}</strong> {txt('een seintje, en zie je meteen belangrijke berichten van je klas en de organisatie. Zonder meldingen mis je dat makkelijk.')}</p>
      <button className="btn" disabled={bezig} onClick={async () => { setBezig(true); try { await zetMeldingenAan(sessie.token) } catch { /* the settings menu explains problems */ } klaar() }}>
        {txt('Ja, zet meldingen aan')}
      </button>
    </Modal>
  )
}
