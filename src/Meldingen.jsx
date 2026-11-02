import { useState } from 'react'
import { nl } from './strings.js'
import { pushVersturen } from './api.js'
import { isIos, meldingenStatus, pushOndersteund, zetMeldingenAan, zetMeldingenUit } from './push.js'
import Modal from './Modal.jsx'
import { pushGeconfigureerd } from './config.js'

export default function Meldingen({ sessie, leerlingId, onSluit }) {
  const [status, setStatus] = useState(meldingenStatus)
  const [bezig, setBezig] = useState(false)
  const [fout, setFout] = useState('')
  const [test, setTest] = useState('')

  async function aan() {
    setBezig(true)
    setFout('')
    try {
      const ok = await zetMeldingenAan(sessie.token)
      if (!ok) setFout(nl.meldingenGeweigerd)
    } catch {
      setFout(nl.laadFout)
    }
    setStatus(meldingenStatus())
    setBezig(false)
  }

  async function uit() {
    setBezig(true)
    await zetMeldingenUit(sessie.token)
    setStatus(meldingenStatus())
    setBezig(false)
  }

  async function testMelding() {
    setBezig(true)
    setTest('')
    try {
      const r = await pushVersturen({ actie: 'test', token: sessie.token })
      if (r.apparaten === 0) setTest(nl.testGeenApparaat)
      else if (r.verstuurd > 0) setTest(`${nl.testVerstuurd} (${r.verstuurd}/${r.apparaten})`)
      else setTest(`${nl.testMislukt} ${Object.keys(r.fouten || {}).join(', ')}`)
    } catch (e) {
      setTest(`${nl.testFout} (${e.message})`)
    }
    setBezig(false)
  }

  return (
    <Modal titel={`🔔 ${nl.meldingenTitel}`} onSluit={onSluit}>
      <p>{nl.meldingenUitleg}</p>
      {!pushGeconfigureerd() ? (
        <p className="note">{nl.meldingenNietBeschikbaar}</p>
      ) : !pushOndersteund() ? (
        <div className="stack">
          <strong>{nl.installeerTitel}</strong>
          <p>{nl.installeerUitleg}</p>
          <p className="note">{isIos() ? nl.installeerIos : nl.installeerAndroid}</p>
        </div>
      ) : !leerlingId ? (
        <p className="note">{nl.meldingenKiesNaam}</p>
      ) : status.toegestaan === 'denied' ? (
        <p className="fout">{nl.meldingenGeweigerd}</p>
      ) : status.aan && status.toegestaan === 'granted' ? (
        <>
          <p className="ok">✓ {nl.meldingenAan}</p>
          <button className="btn" disabled={bezig} onClick={testMelding}>
            {nl.testMelding}
          </button>
          {test && <p className="note" role="status">{test}</p>}
          <button className="btn danger" disabled={bezig} onClick={uit}>
            {nl.meldingenZetUit}
          </button>
        </>
      ) : (
        <button className="btn" disabled={bezig} onClick={aan}>
          {nl.meldingenZetAan}
        </button>
      )}
      {fout && <p className="fout">{fout}</p>}
    </Modal>
  )
}
