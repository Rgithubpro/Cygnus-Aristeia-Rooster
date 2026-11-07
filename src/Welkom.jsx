import { useState } from 'react'
import Modal from './Modal.jsx'
import { isIos, pushOndersteund, zetMeldingenAan } from './push.js'

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
      ? ['Tik onderin op het deel-icoon (een vierkantje met een pijl omhoog).', 'Scrol omlaag en tik op "Zet op beginscherm".', 'Tik rechtsboven op "Voeg toe". Open Aristeia daarna vanaf je beginscherm.']
      : ['Tik op het deel-icoon (of op ⋯) in je browser.', 'Kies "Zet op beginscherm" en tik op "Voeg toe".', 'Staat die optie er niet? Open Aristeia dan in Safari en doe het daar.']
  }
  if (/SamsungBrowser/.test(ua)) return ['Tik onderin op het menu (☰).', 'Kies "Pagina toevoegen aan" en dan "Startscherm".', 'Open Aristeia daarna vanaf je startscherm.']
  if (/Firefox/.test(ua) && /Android/.test(ua)) return ['Tik rechtsboven op ⋮.', 'Kies "Installeren".', 'Open Aristeia daarna vanaf je startscherm.']
  if (/Android/.test(ua)) return ['Tik rechtsboven op ⋮.', 'Kies "App installeren" (of "Toevoegen aan startscherm").', 'Open Aristeia daarna vanaf je startscherm.']
  return ['Klik rechts in de adresbalk op het installatie-icoontje (een scherm met een pijl).', 'Kies "Installeren".']
}

export function InstallUitleg({ onSluit }) {
  const stappen = installStappen()
  const kan = typeof window !== 'undefined' && window.__installPrompt
  return (
    <Modal titel="📲 Zet Aristeia op je beginscherm" onSluit={onSluit}>
      <p>Als app werkt alles beter:</p>
      <ul className="pagina-lijst">
        <li>🔔 Meldingen vlak voor je activiteit (op een iPhone kan dat alleen als app)</li>
        <li>⚡ Sneller openen, en je rooster werkt ook zonder internet</li>
        <li>🎨 Met het eigen icoontje van je klas</li>
      </ul>
      {kan && (
        <button className="btn" onClick={async () => { window.__installPrompt.prompt(); await window.__installPrompt.userChoice.catch(() => {}); window.__installPrompt = null; onSluit() }}>
          Nu installeren
        </button>
      )}
      <strong>Zo doe je het:</strong>
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
      💡 Tip: installeer Aristeia als app via het icoontje in de adresbalk van je browser.{' '}
      <button className="link" onClick={() => { markeer('ksv.tip_gezien'); setDicht(true) }}>Begrepen</button>
    </p>
  )
}

// First open on a phone: install popup. After choosing a name: notification popup.
export default function Welkom({ sessie, leerlingId }) {
  const [installKlaar, setInstallKlaar] = useState(!(isMobiel() && !isStandalone() && !gezien('ksv.install_gezien')))
  const [meldKlaar, setMeldKlaar] = useState(gezien('ksv.meldingen_gevraagd'))
  const [bezig, setBezig] = useState(false)

  if (!installKlaar) return <InstallUitleg onSluit={() => { markeer('ksv.install_gezien'); setInstallKlaar(true) }} />

  const toonMelding = sessie && leerlingId && !meldKlaar && pushOndersteund() && 'Notification' in window && Notification.permission === 'default'
  if (!toonMelding) return null
  const klaar = () => { markeer('ksv.meldingen_gevraagd'); setMeldKlaar(true) }
  return (
    <Modal titel="🔔 Meldingen aanzetten?" onSluit={klaar}>
      <p>Met meldingen krijg je <strong>5 minuten voor elke activiteit</strong> een seintje, en zie je meteen belangrijke berichten van je klas en de organisatie. Zonder meldingen mis je dat makkelijk.</p>
      <button className="btn" disabled={bezig} onClick={async () => { setBezig(true); try { await zetMeldingenAan(sessie.token) } catch { /* the settings menu explains problems */ } klaar() }}>
        Ja, zet meldingen aan
      </button>
    </Modal>
  )
}
