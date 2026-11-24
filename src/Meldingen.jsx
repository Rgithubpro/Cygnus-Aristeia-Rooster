import { useEffect, useState } from 'react'
import { pushVersturen } from './api.js'
import { isIos, meldingenStatus, pushOndersteund, zetMeldingenAan, zetMeldingenUit } from './push.js'
import Modal from './Modal.jsx'
import { pushGeconfigureerd } from './config.js'
import { txt } from './t.js'

export default function Meldingen({ sessie, leerlingId, onSluit }) {
  const [status, setStatus] = useState(null) // null = still checking
  const [bezig, setBezig] = useState(false)
  const [fout, setFout] = useState('')
  const [test, setTest] = useState('')

  const ververs = () => meldingenStatus(sessie.token, leerlingId).then(setStatus)
  useEffect(() => {
    let weg = false
    meldingenStatus(sessie.token, leerlingId).then((s) => !weg && setStatus(s))
    return () => {
      weg = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function aan() {
    setBezig(true)
    setFout('')
    try {
      const ok = await zetMeldingenAan(sessie.token)
      if (!ok) setFout(txt('Meldingen zijn geblokkeerd in je browser. Sta ze toe in de instellingen van je browser of telefoon.'))
    } catch {
      setFout(txt('Er ging iets mis. Controleer je verbinding en probeer het opnieuw.'))
    }
    await ververs()
    setBezig(false)
  }

  async function uit() {
    setBezig(true)
    await zetMeldingenUit(sessie.token).catch(() => {})
    await ververs()
    setBezig(false)
  }

  async function testMelding() {
    setBezig(true)
    setTest('')
    try {
      const r = await pushVersturen({ actie: 'test', token: sessie.token })
      if (r.apparaten === 0) setTest(txt('Dit apparaat staat nog niet bij de server. Zet meldingen eerst uit en weer aan.'))
      else if (r.verstuurd > 0) setTest(`${txt('Testmelding verstuurd, kijk op je scherm.')} (${r.verstuurd}/${r.apparaten})`)
      else setTest(`${txt('De melding is niet aangekomen. Foutcodes:')} ${Object.keys(r.fouten || {}).join(', ')}`)
    } catch (e) {
      setTest(`${txt('Testen is niet gelukt.')} (${e.message})`)
    }
    setBezig(false)
  }

  let inhoud
  if (!pushGeconfigureerd()) {
    inhoud = <p className="note">{txt('Meldingen zijn niet beschikbaar op deze server.')}</p>
  } else if (!pushOndersteund()) {
    inhoud = (
      <div className="stack">
        <strong>{txt('Zet de app op je beginscherm')}</strong>
        <p>{txt('Om meldingen te ontvangen moet je Aristeia als app op je telefoon zetten.')}</p>
        <p className="note">{isIos() ? txt('iPhone / iPad: tik op het deel-icoon onderin je scherm, kies "Zet op beginscherm" en open de app daarna vanaf je beginscherm.') : txt('Android: tik op de drie puntjes rechtsboven, kies "App installeren" en open de app daarna vanaf je beginscherm.')}</p>
      </div>
    )
  } else if (!leerlingId) {
    inhoud = <p className="note">{txt('Kies eerst wie je bent.')}</p>
  } else if (!status) {
    inhoud = <p className="note">{txt('Laden…')}</p>
  } else if (status.toegestaan === 'denied') {
    inhoud = <p className="fout">{txt('Meldingen zijn geblokkeerd in je browser. Sta ze toe in de instellingen van je browser of telefoon.')}</p>
  } else if (status.aan) {
    inhoud = (
      <>
        <p className="ok">✓ {txt('Meldingen staan aan op dit apparaat.')}</p>
        <button className="btn" disabled={bezig} onClick={testMelding}>
          {txt('Stuur een testmelding')}
        </button>
        {test && (
          <p className="note" role="status">
            {test}
          </p>
        )}
        <button className="btn danger" disabled={bezig} onClick={uit}>
          {txt('Meldingen uitzetten')}
        </button>
      </>
    )
  } else {
    inhoud = (
      <button className="btn" disabled={bezig} onClick={aan}>
        {txt('Meldingen aanzetten')}
      </button>
    )
  }

  return (
    <Modal titel={`🔔 ${txt('Meldingen')}`} onSluit={onSluit}>
      <p>{txt('Ontvang 5 minuten van tevoren een melding voor elke activiteit die bij jou hoort, ook als de app gesloten is.')}</p>
      {inhoud}
      {fout && <p className="fout">{fout}</p>}
    </Modal>
  )
}
